import { env } from "@/env"
import {  cseSchema } from "@/types";
import { z } from "zod"

export const queryCSE = async (query: string, grade: string, startIndex: string = "1") => {
    try {
        const base_url = "https://customsearch.googleapis.com/customsearch/v1";
        const request_url = new URL(base_url);

        request_url.searchParams.append("key", env.CSE_API_KEY);
        request_url.searchParams.append("cx", env.CSE_CX_ID);
        request_url.searchParams.append("q", query + " for Grade " + grade + " filetype:pdf");
        request_url.searchParams.append("start", startIndex);

        const response = await fetch(request_url, {
            method: "GET",
            redirect: "follow"
        });
        
        const data : z.infer<typeof cseSchema> = await response.json();
        return data.items;
    }
    catch (err){
        if(err instanceof Error) {
            throw new Error(err.message);
        }
    }
};