import { Kysely } from 'kysely';

import { type Database } from '../../types/database';

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("search_results")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("query", "text", (col) => col.notNull())
        .addColumn("grade", "text", (col) => col.notNull())
        .addColumn("results", "text", (col) => col.notNull())
        .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(`now()`))
        .execute();

    await db.schema
        .createTable("pdf_stores")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("query", "text", (col) => col.notNull())
        .addColumn("grade", "text", (col) => col.notNull())
        .addColumn("total_pages", "int8", (col) => col.notNull())
        .addColumn("title", "text", (col) => col.notNull())
        .addColumn("description", "text", (col) => col.notNull())
        .addColumn("s3_url", "text", (col) => col.notNull())
        .addColumn("pdf_url", "text", (col) => col.notNull())
        .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(`now()`))
        .execute();

    await db.schema
        .createTable("pdf_parsed")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("search_result_id", "text", (col) => col.notNull())
        .addColumn("pdf_store_id", "text", (col) => col.notNull())
        .addColumn("relevance", "text", (col) => col.notNull())
        .addColumn("thumbnail_url", "text", (col) => col.notNull())
        .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(`now()`))
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("pdf_parsed").execute();
    await db.schema.dropTable("pdf_stores").execute();
    await db.schema.dropTable("search_results").execute();
}