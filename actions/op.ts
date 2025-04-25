'use server'

import { getRelevantPages, getRelevanceRange, getPdfPageCount } from "@/libs/pdfParse";
import { downloadPdf } from "@/libs/download";
import { DB } from "@/supabase/kysely";
import { itemSchema, SearchResultType } from "@/types";
import { z } from "zod";
import pLimit from "p-limit";

// Part 1: Get basic search results without relevance calculation
// Only query search_results, download PDFs and insert to pdf_stores
export const getBasicSearchResults = async (search_result_id: string): Promise<SearchResultType[]> => {
    const ts = Date.now();
    const db = await DB.getInstance();
    
    // Fetch search result
    const search_result = await db
        .selectFrom("search_results")
        .selectAll()
        .where("id", "=", search_result_id)
        .executeTakeFirst();

    if(!search_result) {
        throw new Error("No search result found");
    }

    const { results: results_raw } = search_result;
    const results: z.infer<typeof itemSchema>[] = JSON.parse(results_raw);

    // Extract PDF URLs
    const pdf_urls = results.map((item) => item.link);
    
    // Create a lookup map for faster access to result metadata
    const resultMetadataMap = new Map(
        results.map(item => [
            item.link, 
            {
                title: item.title || "",
                htmlTitle: item.htmlTitle || "",
                thumbnail: item.pagemap?.cse_thumbnail?.[0]?.src || ""
            }
        ])
    );

    // Set concurrency limit for PDF downloads
    const downloadLimit = pLimit(5); // Process 5 downloads concurrently
    
    // Download PDFs concurrently with limits
    const pdf_files_promises = pdf_urls.map(url => 
        downloadLimit(() => downloadPdf(url))
    );
    
    const pdf_files = (await Promise.all(pdf_files_promises))
        .filter(({ is_error }) => !is_error);
    
    // Early return if no PDFs were successfully downloaded
    if (pdf_files.length === 0) {
        return [];
    }
    
    // Insert PDFs into pdf_stores table
    const storeLimit = pLimit(5); // Process 5 inserts concurrently
    
    const pdf_store_promises = pdf_files.map(({ blob, s3_url, url }) => 
        storeLimit(async () => {
            try {
                // Get basic PDF info like page count without full processing
                const pageCount = await getPdfPageCount(blob);
                
                // Insert into pdf_stores
                const pdf_store_data = await db
                    .insertInto('pdf_stores')
                    .values({
                        id: Date.now() + '-' + Math.random().toString(36).substring(2, 9), // Unique ID
                        created_at: new Date(),
                        description: resultMetadataMap.get(url)?.htmlTitle ?? "",
                        title: resultMetadataMap.get(url)?.title ?? "",
                        grade: search_result.grade,
                        pdf_url: url,
                        s3_url,
                        query: search_result.query,
                        total_pages: pageCount,
                        thumbnail_url: resultMetadataMap.get(url)?.thumbnail ?? "",
                    })
                    .returning('id')
                    .executeTakeFirstOrThrow();
                
                return {
                    pdf_store_id: pdf_store_data.id,
                    blob,
                    url
                };
            } catch (error) {
                console.error(`Error storing PDF ${url}:`, error);
                return null;
            }
        })
    );
    
    const pdf_stores = (await Promise.all(pdf_store_promises))
        .filter(Boolean) as Array<{pdf_store_id: string, blob: Blob, url: string}>;
    
    // Early return if no PDFs were successfully stored
    if (pdf_stores.length === 0) {
        return [];
    }
    
    // Fetch all pdf_stores records in one query
    const pdf_store_ids = pdf_stores.map(item => item.pdf_store_id);
    
    const pdf_store_records = await db
        .selectFrom('pdf_stores')
        .selectAll()
        .where('id', 'in', pdf_store_ids)
        .execute();
    
    // Create a map for faster lookups
    const pdf_store_map = new Map(
        pdf_store_records.map(store => [store.id, store])
    );
    
    // Map the results efficiently using the lookup maps
    const data = pdf_stores.map(({ pdf_store_id }) => {
        const pdf_store = pdf_store_map.get(pdf_store_id);
        
        if (!pdf_store) {
            return null;
        }
        
        return {
            id: pdf_store_id,
            title: pdf_store.title,
            description: pdf_store.description,
            image: pdf_store.thumbnail_url,
            totalPages: pdf_store.total_pages,
            pdf_url: pdf_store.s3_url,
        };
    }).filter(Boolean) as SearchResultType[];

    const difTs = Date.now() - ts;
    console.log("Basic search results time elapsed in secs: ", difTs / 1000);
    
    return data;
}

// Part 2: Calculate relevance for search results
// Get relevant pages and handle the rest of the processing
export const calculateRelevance = async (search_result_id: string, pdf_stores: Array<{pdf_store_id: string}>): Promise<SearchResultType[]> => {
    const ts = Date.now();
    const db = await DB.getInstance();
    
    // Fetch search result for query information
    const search_result = await db
        .selectFrom("search_results")
        .select(['query', 'grade'])
        .where("id", "=", search_result_id)
        .executeTakeFirstOrThrow();
    
    // Fetch PDF store records
    const pdf_store_records = await db
        .selectFrom('pdf_stores')
        .selectAll()
        .where('id', 'in', pdf_stores.map(item => item.pdf_store_id))
        .execute();
    
    // Create a map for faster lookups
    const pdf_store_map = new Map(
        pdf_store_records.map(store => [store.id, store])
    );
    
    // Download PDFs again (or fetch from cache if possible)
    const downloadLimit = pLimit(5);
    const download_promises = pdf_store_records.map(store => 
        downloadLimit(() => downloadPdf(store.pdf_url))
    );
    
    const downloaded_pdfs = (await Promise.all(download_promises))
        .filter(({ is_error }) => !is_error);
    
    // Map downloads to store IDs
    const pdf_blobs = new Map();
    for (let i = 0; i < downloaded_pdfs.length; i++) {
        const pdf = downloaded_pdfs[i];
        const store = pdf_store_records[i];
        if (store && !pdf.is_error) {
            pdf_blobs.set(store.id, pdf.blob);
        }
    }
    
    // Process PDFs to get relevant pages
    const processLimit = pLimit(3);
    const process_promises = pdf_store_records
        .filter(store => pdf_blobs.has(store.id))
        .map(store => 
            processLimit(() => getRelevantPages(
                search_result.query + " For Grade " + search_result.grade,
                pdf_blobs.get(store.id),
                {
                    description: store.description,
                    title: store.title,
                    pdf_url: store.pdf_url,
                    grade: store.grade,
                    query: store.query,
                    s3_url: store.s3_url,
                    thumbnail_url: store.thumbnail_url,
                }
            ))
        );
    
    const pdf_texts = (await Promise.all(process_promises))
        .filter(({ pages }) => pages.length <= 100);
    
    // Early return if no relevant PDF texts were found
    if (pdf_texts.length === 0) {
        return [];
    }
    
    // Process relevance ranges concurrently
    const relevanceLimit = pLimit(5);
    const relevance_promises = pdf_texts.map(({ pages, pdf_store_id }) => 
        relevanceLimit(() => getRelevanceRange(pages, {
            pdf_store_id,
            search_result_id
        }))
    );
    
    const relevant_pdfs = (await Promise.all(relevance_promises))
        .filter(({ range }) => range.length > 0);
    
    // Early return if no relevant PDFs were found
    if (relevant_pdfs.length === 0) {
        return [];
    }
    
    // Batch database queries for better performance
    const pdf_parsed_ids = relevant_pdfs.map(item => item.id);
    
    // Fetch all pdf_parsed records in one query
    const pdf_parsed_records = await db
        .selectFrom('pdf_parsed')
        .selectAll()
        .where('id', 'in', pdf_parsed_ids)
        .execute();
    
    // Create a map for faster lookups
    const pdf_parsed_map = new Map(
        pdf_parsed_records.map(record => [record.id, record])
    );
    
    // Get all unique pdf_store_ids
    const store_ids = Array.from(new Set(
        pdf_parsed_records.map(record => record.pdf_store_id)
    ));
    
    // Fetch all pdf_stores records in one query (if not already fetched)
    const additional_store_ids = store_ids.filter(id => !pdf_store_map.has(id));
    
    if (additional_store_ids.length > 0) {
        const additional_stores = await db
            .selectFrom('pdf_stores')
            .selectAll()
            .where('id', 'in', additional_store_ids)
            .execute();
        
        additional_stores.forEach(store => {
            pdf_store_map.set(store.id, store);
        });
    }
    
    // Map the results efficiently using the lookup maps
    const data = relevant_pdfs.map(({ id, range }) => {
        const pdf_parsed = pdf_parsed_map.get(id);
        
        if (!pdf_parsed) {
            return null;
        }
        
        const pdf_store = pdf_store_map.get(pdf_parsed.pdf_store_id);
        
        if (!pdf_store) {
            return null;
        }
        
        return {
            id: pdf_parsed.id,
            title: pdf_store.title,
            description: pdf_store.description,
            image: pdf_store.thumbnail_url,
            totalPages: pdf_store.total_pages,
            relevantPages: range,
            pdf_url: pdf_store.s3_url,
        };
    }).filter(Boolean) as SearchResultType[];
 
    const difTs = Date.now() - ts;
    console.log("Relevance calculation time elapsed in secs: ", difTs / 1000);
    
    return data;
}
