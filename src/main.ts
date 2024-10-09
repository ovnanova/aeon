import { AtpAgent } from 'atproto';
import { Jetstream } from 'jetstream';
import { Aeon } from './aeon.ts';
import { CONFIG } from './config.ts';
import { DidSchema, RkeySchema } from './schemas.ts';

const agent = new AtpAgent({ service: CONFIG.JETSTREAM_URL });
const aeon = new Aeon();

async function main() {
	await agent.login({
		identifier: CONFIG.BSKY_HANDLE,
		password: CONFIG.BSKY_PASSWORD,
	});
	await aeon.init();

	let cursor: number;
	try {
		cursor = Number(await Deno.readTextFile('./cursor.txt'));
		console.log(
			`Cursor found: ${cursor} (${new Date(cursor / 1000).toISOString()})`,
		);
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			cursor = Date.now() * 1000;
			console.log(
				`Cursor not found, setting to: ${cursor} (${
					new Date(cursor / 1000).toISOString()
				})`,
			);
			await Deno.writeTextFile('./cursor.txt', cursor.toString());
		} else {
			console.error(error);
			Deno.exit(1);
		}
	}

	const jetstream = new Jetstream({
		wantedCollections: [CONFIG.COLLECTION],
		endpoint: CONFIG.JETSTREAM_URL,
		cursor: cursor,
	});

	jetstream.on('open', () => {
		console.log(
			`Connected to Jetstream at ${CONFIG.JETSTREAM_URL} with cursor ${jetstream.cursor}`,
		);
	});

	jetstream.on('close', () => {
		console.log('Jetstream connection closed.');
	});

	jetstream.on('error', (error: Error) => {
		console.error(`Jetstream error: ${error.message}`);
	});

	jetstream.onCreate(CONFIG.COLLECTION, async (event: any) => {
		if (event.commit?.record?.subject?.uri?.includes(CONFIG.DID)) {
			try {
				const validatedDID = DidSchema.parse(event.did);
				const rkey = event.commit.record.subject.uri.split('/').pop()!;
				const validatedRkey = RkeySchema.parse(rkey);
				await aeon.assignLabel(validatedDID, validatedRkey);
			} catch (error) {
				console.error(
					`Error processing event: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		}
	});

	jetstream.start();

	setInterval(async () => {
		if (jetstream.cursor) {
			console.log(
				`Updating cursor to: ${jetstream.cursor} (${
					new Date(jetstream.cursor / 1000).toISOString()
				})`,
			);
			await Deno.writeTextFile('./cursor.txt', jetstream.cursor.toString());
		}
	}, CONFIG.CURSOR_INTERVAL);

	const shutdown = () => {
		console.log('Shutting down...');
		jetstream.close();
		Deno.exit(0);
	};

	Deno.addSignalListener('SIGINT', shutdown);
	Deno.addSignalListener('SIGTERM', shutdown);
}

main().catch(console.error);
