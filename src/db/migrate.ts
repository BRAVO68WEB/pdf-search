import { DB } from "./kysely";

async function migrate() {
	const db = await DB.getInstance();
	await DB.migrate(db, true);
}

migrate();
