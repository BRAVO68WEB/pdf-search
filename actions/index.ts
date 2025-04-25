'use server'

import { getRelevantPages, getRelevanceRange } from "@/libs/pdfParse";
import { downloadPdf } from "@/libs/download";
import { DB } from "@/supabase/kysely";
import { itemSchema, SearchResultType } from "@/types";
import { z } from "zod";
import pLimit from "p-limit";

export const handleQuery = async (search_result_id: string): Promise<SearchResultType[]> => {
    const ts = Date.now()
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
    
    // Set concurrency limit for PDF processing
    const processLimit = pLimit(3); // Process 3 PDFs concurrently
    
    // Process PDFs concurrently with limits
    const pdf_texts_promises = pdf_files.map(({ blob, s3_url, url }) => 
        processLimit(() => getRelevantPages(
            search_result.query + " For " + search_result.grade, 
            blob, 
            {
                description: resultMetadataMap.get(url)?.htmlTitle || "",
                title: resultMetadataMap.get(url)?.title || "",
                pdf_url: url,
                grade: search_result.grade,
                query: search_result.query,
                s3_url,
                thumbnail_url: resultMetadataMap.get(url)?.thumbnail || "",
            }
        ))
    );
    
    const pdf_texts = (await Promise.all(pdf_texts_promises))
        .filter(({ pages }) => pages.length <= 50);
    
    // Early return if no relevant PDF texts were found
    if (pdf_texts.length === 0) {
        return [];
    }
    
    // Process relevance ranges concurrently
    const relevance_promises = pdf_texts.map(({ pages, pdf_store_id }) => 
        getRelevanceRange(pages, {
            pdf_store_id,
            search_result_id
        })
    );
    
    const relevant_pdfs = (await Promise.all(relevance_promises))
        .filter(({ range }) => range.length > 0);
    
    // Early return if no relevant PDFs were found
    if (relevant_pdfs.length === 0) {
        return [];
    }
    
    // Batch database queries for better performance
    const pdf_store_ids = relevant_pdfs.map(item => item.id);
    
    // Fetch all pdf_parsed records in one query
    const pdf_parsed_records = await db
        .selectFrom('pdf_parsed')
        .selectAll()
        .where('id', 'in', pdf_store_ids)
        .execute();
    
    // Create a map for faster lookups
    const pdf_parsed_map = new Map(
        pdf_parsed_records.map(record => [record.id, record])
    );
    
    // Get all unique pdf_store_ids
    const store_ids = Array.from(new Set(
        pdf_parsed_records.map(record => record.pdf_store_id)
    ));
    
    // Fetch all pdf_stores records in one query
    const pdf_store_records = await db
        .selectFrom('pdf_stores')
        .selectAll()
        .where('id', 'in', store_ids)
        .execute();
    
    // Create a map for faster lookups
    const pdf_store_map = new Map(
        pdf_store_records.map(store => [store.id, store])
    );
    
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
        };
    }).filter(Boolean) as SearchResultType[];
 
    const difTs = Date.now() - ts

    console.log("Time elapsed in secs: ",  difTs / 1000)
    
    return data;
}