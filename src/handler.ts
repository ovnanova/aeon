/**
 * Connection management module for Jetstream WebSocket connections.
 * Handles connection lifecycle, reconnection attempts, and error recovery.
 *
 * This module provides a robust connection management system with features for:
 * - Preventing multiple concurrent connection attempts
 * - Implementing exponential backoff with jitter for reconnection attempts
 * - Managing connection state and cleanup
 * - Providing proper error handling and logging
 * - Ensuring graceful shutdown with proper resource cleanup
 *
 * @module connection_handler
 * @license MPL-2.0
 */

import { Jetstream } from 'jetstream';
import * as log from '@std/log';
import { JetstreamError } from './errors.ts';

/**
 * Manages Jetstream WebSocket connections with automatic reconnection handling.
 * Ensures only one connection attempt is active at any time and implements
 * proper cleanup of resources during reconnection and shutdown.
 *
 * The Handler class takes responsibility for:
 * - Single connection state management
 * - Exponential backoff with jitter for reconnection
 * - Resource cleanup on shutdown
 * - Comprehensive error handling and logging
 * - Graceful shutdown coordination
 */
export class Handler {
	private readonly logger = log.getLogger();
	private reconnectTimeout: number | null = null;
	private isConnecting = false;
	private isConnected = false;
	private shouldReconnect = true;
	private isShuttingDown = false;
	private reconnectAttempt = 0;
	private closePromiseResolve: (() => void) | null = null;
	private handlersRegistered = false;

	private readonly MAX_EXPONENTIAL_ATTEMPTS = 6;
	private readonly SHUTDOWN_TIMEOUT = 5000;
	private readonly BASE_DELAY = 30000;
	private readonly MAX_DELAY = 600000;
	private readonly CONNECTION_EVENTS = ['open', 'error', 'close'] as const;

	public get connected(): boolean {
		return this.isConnected;
	}

	constructor(private readonly jetstream: Jetstream<string, string>) {
		this.initializeEventHandlers();
	}

	public async start(): Promise<void> {
		if (this.isConnecting) {
			this.logger.debug('Connection attempt already in progress');
			return;
		}

		try {
			this.isConnecting = true;
			this.shouldReconnect = true;
			await this.connect();
		} finally {
			this.isConnecting = false;
		}
	}

	private async connect(): Promise<void> {
		try {
			this.cleanup();
			if (!this.handlersRegistered) {
				this.initializeEventHandlers();
			}
			await this.jetstream.start();
		} catch (error) {
			this.isConnected = false;
			await this.handleConnectionError(error);
		}
	}

	public shutdown(): Promise<void> {
		if (this.isShuttingDown) {
			return Promise.resolve();
		}

		this.isShuttingDown = true;
		this.shouldReconnect = false;
		this.cleanup();

		return new Promise<void>((resolve) => {
			const forceClose = () => {
				this.logger.warn('Forcing connection closure after timeout');
				this.cleanup();
				// Only remove all listeners during complete shutdown
				this.jetstream.removeAllListeners();
				resolve();
			};

			const shutdownTimer = setTimeout(forceClose, 2000);

			try {
				this.jetstream.close();

				const gracefulClose = () => {
					clearTimeout(shutdownTimer);
					this.cleanup();
					// Only remove all listeners during complete shutdown
					this.jetstream.removeAllListeners();
					resolve();
				};

				setTimeout(gracefulClose, this.SHUTDOWN_TIMEOUT);
			} catch (error) {
				this.logger.error(
					`Error during shutdown: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
				forceClose();
			}
		});
	}

	private cleanup(): void {
		if (this.reconnectTimeout !== null) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		if (this.handlersRegistered) {
			// Only remove connection lifecycle event handlers
			for (const event of this.CONNECTION_EVENTS) {
				this.jetstream.removeAllListeners(event);
			}
			this.handlersRegistered = false;
		}
	}

	private calculateDelay(): number {
		if (this.reconnectAttempt >= this.MAX_EXPONENTIAL_ATTEMPTS) {
			return this.MAX_DELAY;
		}

		const progress = this.reconnectAttempt / this.MAX_EXPONENTIAL_ATTEMPTS;
		const baseDelay = this.BASE_DELAY +
			(this.MAX_DELAY - this.BASE_DELAY) * progress;
		const jitter = Math.random() * 1000;
		return Math.min(baseDelay + jitter, this.MAX_DELAY);
	}

	private handleConnectionError(error: unknown): Promise<void> {
		if (this.isConnecting || this.reconnectTimeout !== null) {
			return Promise.resolve();
		}

		if (!this.shouldReconnect || this.isShuttingDown) {
			this.logger.info(
				`[${
					new Date().toISOString()
				}] Skipping reconnection - shutdown in progress`,
			);
			return Promise.resolve();
		}

		const errorMessage = error instanceof Error ? error.message : String(error);
		this.logger.error(
			`[${new Date().toISOString()}] Connection failed: ${errorMessage}`,
		);

		const delay = this.calculateDelay();
		this.reconnectAttempt++;

		const now = new Date();
		const reconnectTime = new Date(now.getTime() + delay);
		this.logger.info(
			`[${now.toISOString()}] Scheduling reconnection for ${reconnectTime.toISOString()} ` +
				`(in ${Math.floor(delay / 1000)}s, attempt ${this.reconnectAttempt})`,
		);

		return new Promise<void>((resolve) => {
			this.reconnectTimeout = setTimeout(() => {
				this.reconnectTimeout = null;

				if (this.shouldReconnect && !this.isShuttingDown) {
					this.connect()
						.then(resolve)
						.catch((connectError) => {
							this.logger.error(
								`[${new Date().toISOString()}] Reconnection failed:`,
								connectError,
							);
							resolve();
						});
				} else {
					resolve();
				}
			}, delay);
		});
	}

	private initializeEventHandlers(): void {
		if (this.handlersRegistered) {
			return;
		}

		this.jetstream.on('open', () => {
			if (!this.isConnected) {
				this.isConnected = true;
				this.reconnectAttempt = 0;
				this.logger.info(
					`[${
						new Date().toISOString()
					}] Connected to Jetstream with cursor ${this.jetstream.cursor}`,
				);
			}
		});

		this.jetstream.on('error', () => {
			if (!this.isConnected) return;
			this.logger.error(
				`[${new Date().toISOString()}] Jetstream encountered a WebSocket error`,
			);
		});

		this.jetstream.on('close', () => {
			const wasConnected = this.isConnected;
			this.isConnected = false;

			if (wasConnected) {
				this.logger.info(
					`[${new Date().toISOString()}] Jetstream connection closed`,
				);
			}

			if (this.isShuttingDown) {
				if (this.closePromiseResolve) {
					this.closePromiseResolve();
					this.closePromiseResolve = null;
				}
				return;
			}

			if (wasConnected && this.shouldReconnect && !this.reconnectTimeout) {
				this.handleConnectionError(
					new JetstreamError('WebSocket connection closed unexpectedly'),
				);
			}
		});

		this.handlersRegistered = true;
	}
}
