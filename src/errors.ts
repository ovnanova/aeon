/**
 * Custom error classes for ÆON
 * Provides typed errors for different failure scenarios.
 */

/**
 * Error thrown when there's an issue with ATP (AT Protocol) operations.
 * Used for failures in communication with ATP services, authentication,
 * or when ATP operations fail.
 *
 * See aeon.ts for usage in ATP initialization and operations.
 *
 * @example
 * ```ts
 * throw new AtpError('Failed to authenticate with ATP service');
 * ```
 */
export class AtpError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AtpError';
	}
}

/**
 * Error thrown when there's an issue with labeling operations.
 * Used for failures in applying, updating, or removing labels,
 * or when label validation fails.
 *
 * See aeon.ts for usage in label operations.
 *
 * @example
 * ```ts
 * throw new LabelingError('Failed to assign label: invalid category');
 * ```
 */
export class LabelingError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LabelingError';
	}
}

/**
 * Error thrown when there's an issue with the labeler server.
 * Used for failures in server initialization, startup,
 * or when server operations fail.
 *
 * See aeon.ts for usage in server initialization and operations.
 *
 * @example
 * ```ts
 * throw new ServerError('Failed to start labeler server on port 1024');
 * ```
 */
export class ServerError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ServerError';
	}
}

/**
 * Error thrown when there's an issue with configuration.
 * Used for failures in configuration initialization, validation,
 * or when required configuration values are missing.
 *
 * See config.ts for usage in configuration management.
 *
 * @example
 * ```ts
 * throw new ConfigurationError('Required configuration key BSKY_HANDLE not set');
 * ```
 */
export class ConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigurationError';
	}
}

/**
 * Error thrown when there's an issue with KV store operations.
 * Used for failures in KV store initialization, access,
 * or when KV operations fail.
 *
 * See kv_utils.ts for usage in KV store operations.
 *
 * @example
 * ```ts
 * throw new KvError('Failed to access KV store');
 * ```
 */
export class KvError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'KvError';
	}
}

/**
 * Error thrown when there's an issue with Jetstream operations.
 * Used for failures in Jetstream connection, subscription,
 * or when stream operations fail.
 *
 * See main.ts for usage in Jetstream operations.
 *
 * @example
 * ```ts
 * throw new JetstreamError('Failed to connect to Jetstream service');
 * ```
 */
export class JetstreamError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'JetstreamError';
	}
}

/**
 * Error thrown when there's an issue with the logging system.
 * Used for failures in log initialization, file operations,
 * or when logging operations fail.
 */
export class LoggingError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LoggingError';
	}
}

/**
 * Error thrown when there's an issue with the metrics system..
 * Used for failures in initialization, metric collection,
 * or when metric operations fail.
 */
export class MetricsError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MetricsError';
	}
}
