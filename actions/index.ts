'use server'

import { getRelevantPages, getRelevanceRange } from "@/libs/pdfParse";
import { downloadPdf } from "@/libs/download";
import { DB } from "@/supabase/kysely";
import { itemSchema, SearchResultType } from "@/types";
import { z } from "zod";

export const handleQuery = async (search_result_id: string) : Promise<SearchResultType[]> => {
    const db = await DB.getInstance();
    
    const search_result = await db
        .selectFrom("search_results")
        .selectAll()
        .where("id", "=", search_result_id)
        .executeTakeFirst();

    if(!search_result) {
        throw new Error("No search result found");
    }

    const { results: results_raw } = search_result;
    const results : z.infer<typeof itemSchema>[] = JSON.parse(results_raw);

    const pdf_urls = results.map((item) => item.link);

    const pdf_files = (await Promise.all(pdf_urls.map((url) => downloadPdf(url)))).filter(({ is_error }) => !is_error);
    
    const pdf_texts = await Promise.all(pdf_files.map(({ blob, s3_url, url }) => getRelevantPages(search_result.query + " For " + search_result.grade, blob, {
        description: results.find((item) => item.link === url)?.htmlTitle ?? "",
        title: results.find((item) => item.link === url)?.title ?? "",
        pdf_url: url,
        grade: search_result.grade,
        query: search_result.query,
        s3_url,
        thumbnail_url: results.find((item) => item.link === url)?.pagemap?.cse_thumbnail?.[0]?.src ?? "",
    })));
    const relevant_pdfs = await Promise.all(pdf_texts.map(async ({
        pages,
        pdf_store_id,
        total_page
     }) =>  getRelevanceRange(pages, {
                pdf_store_id,
                search_result_id
            })
    ));

    const data = relevant_pdfs.map(async ({
        id,
        range
    }) => {
        const pdf_parsed = await db
            .selectFrom('pdf_parsed')
            .selectAll()
            .where("id", "=", id)
            .executeTakeFirstOrThrow();

        const pdf_store = await db
            .selectFrom('pdf_stores')
            .selectAll()
            .where("id", "=", pdf_parsed.pdf_store_id)
            .executeTakeFirstOrThrow();

        return {
            id: pdf_parsed.id,
            title: pdf_store.title,
            description: pdf_store.description,
            image: pdf_store.thumbnail_url,
            totalPages: pdf_store.total_pages,
            relevantPages: range,
        }
    });

    return await Promise.all(data);
}
