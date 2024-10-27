/**
 * Logging configuration for ÆON
 * Uses Deno's standard logging module.
 */

import * as log from '@std/log';
import { ensureDir } from '@std/fs';
import { join } from '@std/path';

/**
 * Initializes logging system with console and file handlers.
 * Creates log directory if it doesn't exist.
 * Should be called once at application startup.
 */
export async function initLogging(): Promise<void> {
	const logDir = './logs';
	await ensureDir(logDir);

	const logFilePath = join(
		logDir,
		`aeon_${new Date().toISOString().split('T')[0]}.log`,
	);

	await log.setup({
		handlers: {
			console: new log.ConsoleHandler('INFO'),
			file: new log.FileHandler('DEBUG', {
				filename: logFilePath,
				formatter: (record) => {
					const { msg, ...rest } = record;
					return JSON.stringify({
						timestamp: new Date().toISOString(),
						message: typeof msg === 'string' ? msg : JSON.stringify(msg),
						...rest,
					});
				},
			}),
		},
		loggers: {
			default: {
				level: 'DEBUG',
				handlers: ['console', 'file'],
			},
		},
	});

	const logger = log.getLogger();
	logger.info('Logger initialized', { logFile: logFilePath });
}
