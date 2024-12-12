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
	/** Timeout handle for reconnection attempts */
	private reconnectTimeout: number | null = null;

	/** Flag indicating if a connection attempt is in progress */
	private isConnecting = false;

	/** Flag indicating if the connection is currently established */
	private isConnected = false;

	public get connected(): boolean {
		return this.isConnected;
	}

	/** Flag indicating if reconnection should be attempted on failure */
	private shouldReconnect = true;

	/** Flag indicating if shutdown is in progress */
	private isShuttingDown = false;

	/** Current reconnection attempt counter */
	private reconnectAttempt = 0;

	/** Promise resolution function for connection closure */
	private closePromiseResolve: (() => void) | null = null;

	/** Maximum number of exponential reconnection attempts before falling back to MAX_DELAY */
	private readonly MAX_EXPONENTIAL_ATTEMPTS = 6;

	/** Default timeout for shutdown operations in milliseconds */
	private readonly SHUTDOWN_TIMEOUT = 5000;

	/** Base delay between reconnection attempts in milliseconds (30 seconds) */
	private readonly BASE_DELAY = 30000;

	/** Maximum delay between reconnection attempts in milliseconds (600 seconds) */
	private readonly MAX_DELAY = 600000;

	/** Logger instance for connection-related events */
	private readonly logger = log.getLogger();

	/**
	 * Creates a new Handler instance and sets up event handlers.
	 *
	 * @param jetstream - The Jetstream instance to manage
	 */
	constructor(
		private readonly jetstream: Jetstream<string, string>,
	) {
		this.setupEventHandlers();
	}

	/**
	 * Starts the Jetstream connection with proper state management.
	 * Prevents multiple concurrent connection attempts.
	 */
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

	/**
	 * Initiates a graceful shutdown of the connection.
	 * Includes fallback forced closure if graceful shutdown exceeds timeout.
	 * Ensures cleanup of all resources and event listeners.
	 *
	 * @returns Promise that resolves when shutdown is complete
	 */
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
				this.jetstream.removeAllListeners();
				resolve();
			};

			const shutdownTimer = setTimeout(forceClose, 2000);

			try {
				this.jetstream.close();

				const gracefulClose = () => {
					clearTimeout(shutdownTimer);
					this.cleanup();
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

	/**
	 * Cleans up connection-related resources.
	 * Cancels any pending reconnection timeouts.
	 */
	private cleanup(): void {
		if (this.reconnectTimeout !== null) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
	}

	/**
	 * Calculates the delay for the next reconnection attempt.
	 * Uses linear scaling from BASE_DELAY to MAX_DELAY based on attempt count.
	 *
	 * @returns The delay in milliseconds before the next reconnection attempt
	 */
	private calculateDelay(): number {
		if (this.reconnectAttempt >= this.MAX_EXPONENTIAL_ATTEMPTS) {
			return this.MAX_DELAY;
		}

		const progress = this.reconnectAttempt / this.MAX_EXPONENTIAL_ATTEMPTS;
		const baseDelay = this.BASE_DELAY +
			(this.MAX_DELAY - this.BASE_DELAY) * progress;
		const jitter = Math.random() * 1000; // Add up to 1 second of jitter
		return Math.min(baseDelay + jitter, this.MAX_DELAY);
	}

	/**
	 * Initiates a connection attempt.
	 * Handles connection errors and initiates reconnection if appropriate.
	 */
	private async connect(): Promise<void> {
		try {
			this.cleanup();
			this.jetstream.start();
			this.isConnected = true;
			this.logger.info(
				`[${
					new Date().toISOString()
				}] Connected to Jetstream with cursor ${this.jetstream.cursor}`,
			);
		} catch (error) {
			this.isConnected = false;
			this.logger.error(
				`[${new Date().toISOString()}] Connection attempt failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			await this.handleConnectionError(error);
		}
	}

	/**
	 * Handles connection errors and manages reconnection attempts.
	 * Implements backoff with jitter for reconnection timing.
	 *
	 * @param error - The error that caused the connection failure
	 */
	private handleConnectionError(error: unknown): Promise<void> {
		if (!this.shouldReconnect || this.isShuttingDown) {
			this.logger.info(
				`[${
					new Date().toISOString()
				}] Connection terminated, reconnection disabled`,
			);
			return Promise.resolve();
		}

		const errorMessage = error instanceof Error ? error.message : String(error);
		this.logger.error(
			`[${new Date().toISOString()}] Connection failed: ${errorMessage}`,
		);

		if (this.reconnectTimeout !== null) {
			return Promise.resolve();
		}

		if (this.reconnectAttempt === this.MAX_EXPONENTIAL_ATTEMPTS) {
			this.logger.info(
				`[${
					new Date().toISOString()
				}] Switching to long-interval reconnection attempts (every ${
					this.MAX_DELAY / 1000
				}s)`,
			);
		}

		const delay = this.calculateDelay();
		this.reconnectAttempt++;

		const now = new Date();
		const reconnectTime = new Date(now.getTime() + delay);
		this.logger.info(
			`[${now.toISOString()}] Scheduling reconnection for ${reconnectTime.toISOString()} ` +
				`(in ${Math.floor(delay / 1000)}s, attempt ${this.reconnectAttempt})`,
		);

		return new Promise<void>((resolve, reject) => {
			this.reconnectTimeout = setTimeout(() => {
				this.reconnectTimeout = null;
				if (this.shouldReconnect && !this.isShuttingDown) {
					this.connect()
						.then(resolve)
						.catch(reject);
				} else {
					resolve();
				}
			}, delay);
		});
	}

	/**
	 * Sets up event handlers for the Jetstream instance.
	 * Handles 'open', 'close', and 'error' events with appropriate logging
	 * and reconnection logic.
	 */
	public setupEventHandlers(): void {
		this.jetstream.on('open', () => {
			this.isConnected = true;
			this.logger.info(
				`[${
					new Date().toISOString()
				}] Connected to Jetstream with cursor ${this.jetstream.cursor}`,
			);
		});

		this.jetstream.on('error', () => {
			if (!this.isConnected) {
				return; // Ignore errors when not connected
			}
			this.logger.error(
				`[${new Date().toISOString()}] Jetstream encountered a WebSocket error`,
			);
		});

		this.jetstream.on('close', async () => {
			// Only log closure if we were previously connected
			if (this.isConnected) {
				this.logger.info(
					`[${new Date().toISOString()}] Jetstream connection closed`,
				);
			}

			this.isConnected = false;

			if (this.isShuttingDown) {
				if (this.closePromiseResolve) {
					this.closePromiseResolve();
					this.closePromiseResolve = null;
				}
				return;
			}

			if (this.reconnectTimeout !== null) {
				return;
			}

			if (this.shouldReconnect) {
				await this.handleConnectionError(
					new JetstreamError('WebSocket connection error'),
				);
			}
		});
	}
}
