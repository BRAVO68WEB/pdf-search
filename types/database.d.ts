import type { ColumnType } from "kysely"

interface SearchResultData {
    id: ColumnType<string>;
    query: ColumnType<string>;
    grade: ColumnType<string>;
    results: ColumnType<string>;
    created_at: ColumnType<Date>;
}

interface PDFStoreData {
    id: ColumnType<string>;
    query: ColumnType<string>;
    grade: ColumnType<string>;
    total_pages: ColumnType<number>;
    title: ColumnType<string>;
    description: ColumnType<string>;
    s3_url: ColumnType<string>;
    pdf_url: ColumnType<string>;
    created_at: ColumnType<Date>;
}

interface PDFParsedData {
    id: ColumnType<string>;
    search_result_id: ColumnType<string>;
    pdf_store_id: ColumnType<string>;
    relevance: ColumnType<string>;
    thumbnail_url: ColumnType<string>;
    created_at: ColumnType<Date>;
}

interface Database {
    search_results: SearchResultData;
    pdf_stores: PDFStoreData;
    pdf_parsed: PDFParsedData;
}