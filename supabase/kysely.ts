import { FileMigrationProvider, Kysely, Migrator, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import fs from 'node:fs/promises';
import path from 'node:path';

import { env } from '@/env';

import type { Database } from '../types/database'

/**
 * Postgres DB Adapter
 */
class PostgresDB {
	static db: Kysely<Database> | undefined;
	static postgres?: Pool;

	static async getInstance(): Promise<Kysely<Database>> {
		this.postgres ??= new Pool({
				connectionString: env.DATABASE_URL,
			});

		this.db ??= new Kysely({
				dialect: new PostgresDialect({
					pool: this.postgres,
				}),
			});

		return this.db;
	}

	static get poolSize() {
		return this.postgres?.totalCount ?? 0;
	}

	static get availableConnections() {
		return this.postgres?.idleCount ?? 0;
	}
}

/**
 * DB class to get the database instance
 */
export class DB {
	private static kysely: Promise<Kysely<Database>> | undefined;
  private static kysely_migration: Promise<Migrator> | undefined;

	static getInstance(): Promise<Kysely<Database>> {
		if (!this.kysely) {
			this.kysely = this._getInstance();
		}

		return this.kysely;
	}

	static async _getInstance(): Promise<Kysely<Database>> {
		const kysely: Kysely<Database> = await PostgresDB.getInstance();

		return kysely;
	}

  static async migrate(kysely: Kysely<Database>, auto_migrate: boolean) {
		if (!auto_migrate) {
			return;
		}

    const migrator = new Migrator({
			db: kysely,
			provider: new FileMigrationProvider({
				fs,
				path,
				migrationFolder: path.join(process.cwd(), 'supabase/migrations'),
			}),
		});

		const { results, error } = (await migrator.migrateToLatest()) as {
			results: { migrationName: string; status: string }[] | null;
			error: Error | null;
		};

		if (error) {
			console.log(error.message);
		} else if (results?.length) {
			console.log('Migrations finished!');
			for (const { migrationName, status } of results) {
				console.log(`  - ${migrationName}: ${status}`);
			}
		} else {
			console.log('Everything up-to-date.');
		}
	}

	static async migrator() {
		this.kysely_migration ??= this._migrator();

		return this.kysely_migration;
	}

	static async _migrator() {
		const kysely: Kysely<Database> = await this.getInstance();

		return new Migrator({
			db: kysely,
			provider: new FileMigrationProvider({
				fs,
				path,
				migrationFolder: new URL(import.meta.resolve('./migrations')).pathname,
			}),
		});
	}

	static get poolSize(): number {
		return PostgresDB.poolSize;
	}

	static get availableConnections(): number {
		return PostgresDB.availableConnections;
	}
}