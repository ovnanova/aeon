import { AtpAgent } from 'atproto';
import { Jetstream } from 'jetstream';
import { Aeon } from './aeon.ts';
import { CONFIG, initializeConfig } from './config.ts';
import { DidSchema, RkeySchema } from './schemas.ts';
import { verifyKvStore } from '../scripts/kv_utils.ts';
import * as log from '@std/log';

const kv = await Deno.openKv();
const logger = log.getLogger();

async function main() {
	try {
		await initializeConfig();

		if (!(await verifyKvStore())) {
			throw new Error('KV store verification failed');
		}
		logger.info('KV store verified successfully');

		const agent = new AtpAgent({ service: CONFIG.BSKY_URL });
		const aeon = await Aeon.create();

		if (!CONFIG.BSKY_HANDLE || !CONFIG.BSKY_PASSWORD) {
			throw new Error(
				'BSKY_HANDLE and BSKY_PASSWORD must be set in the configuration',
			);
		}

		await agent.login({
			identifier: CONFIG.BSKY_HANDLE,
			password: CONFIG.BSKY_PASSWORD,
		});
		logger.info('Logged in to ATP successfully');

		await aeon.init();

		const cursor = await initializeCursor();

		if (!CONFIG.COLLECTION) {
			throw new Error('COLLECTION must be set in the configuration');
		}

		const jetstream = new Jetstream({
			wantedCollections: [CONFIG.COLLECTION],
			endpoint: CONFIG.JETSTREAM_URL,
			cursor: cursor,
		});

		setupJetstreamListeners(jetstream, aeon);

		jetstream.start();
		logger.info('Jetstream started');

		setupCursorUpdateInterval(jetstream);
		setupShutdownHandlers(jetstream);
	} catch (error) {
		logger.error(
			`Error in main: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
		Deno.exit(1);
	}
}

async function initializeCursor(): Promise<number> {
	const cursorResult = await kv.get(['cursor']);
	if (cursorResult.value === null) {
		const cursor = Date.now() * 1000;
		logger.info(
			`Cursor not found, setting to: ${cursor} (${
				new Date(cursor / 1000).toISOString()
			})`,
		);
		await kv.set(['cursor'], cursor);
		return cursor;
	} else {
		const cursor = cursorResult.value as number;
		logger.info(
			`Cursor found: ${cursor} (${new Date(cursor / 1000).toISOString()})`,
		);
		return cursor;
	}
}

function setupJetstreamListeners(jetstream: Jetstream, aeon: Aeon) {
	jetstream.on('open', () => {
		logger.info(
			`Connected to Jetstream at ${CONFIG.JETSTREAM_URL} with cursor ${jetstream.cursor}`,
		);
	});

	jetstream.on('close', () => {
		logger.info('Jetstream connection closed.');
	});

	jetstream.on('error', (error: Error) => {
		logger.error(`Jetstream error: ${error.message}`);
	});

	jetstream.onCreate(CONFIG.COLLECTION, async (event: any) => {
		if (event.commit?.record?.subject?.uri?.includes(CONFIG.DID)) {
			try {
				const validatedDID = DidSchema.parse(event.did);
				const rkey = event.commit.record.subject.uri.split('/').pop()!;
				const validatedRkey = RkeySchema.parse(rkey);
				await aeon.assignLabel(validatedDID, validatedRkey);
			} catch (error) {
				logger.error(
					`Error processing event: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		}
	});
}

function setupCursorUpdateInterval(jetstream: Jetstream) {
	setInterval(async () => {
		if (jetstream.cursor) {
			logger.info(
				`Updating cursor to: ${jetstream.cursor} (${
					new Date(jetstream.cursor / 1000).toISOString()
				})`,
			);
			await kv.set(['cursor'], jetstream.cursor);
		}
	}, CONFIG.CURSOR_INTERVAL);
}

function setupShutdownHandlers(jetstream: Jetstream) {
	const shutdown = () => {
		logger.info('Shutting down...');
		jetstream.close();
		Deno.exit(0);
	};

	Deno.addSignalListener('SIGINT', shutdown);
	Deno.addSignalListener('SIGTERM', shutdown);
}

main().catch((error) => {
	logger.critical(
		`Unhandled error in main: ${
			error instanceof Error ? error.message : String(error)
		}`,
	);
	Deno.exit(1);
});
