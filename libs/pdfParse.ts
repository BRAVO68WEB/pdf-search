import { env } from "@/env"

import Groq from "groq-sdk";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { z } from "zod";

const groq = new Groq({
    apiKey: env.GROQ_API_KEY,
});

export const findRelevantPages = async (user_query: string, file_name: string) => {
    const pages: number[] = [];

    const data = new PDFLoader(file_name, {
        splitPages: true
    });

    const doc = await data.load();

    const zodSchema = z.object({
        page_no: z.number(),
        is_relevant: z.boolean(),
    });

    const jsonSchema = JSON.stringify(zodSchema.shape, null, 2);

    const queryGroq = ({
        pageContent,
        page_no
    } : {
        pageContent: string,
        page_no: number,
    }) => {
        return groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `You are a AI Assistant that finds the pages that are relevant to the user's query and outputs answer in JSON.\n'The JSON object must use the schema: ${jsonSchema}`,
                },
                {
                    role: "user",
                    content: `
                        User query: ${user_query}
                        Page number: ${page_no}
                        Page content: ${pageContent}
                        Please answer with a JSON object that contains the following fields:
                        - page_no: The page number of the PDF file
                        - is_relevant: A boolean value that indicates whether the page is relevant to the user's query
                        The JSON object must use the schema: ${jsonSchema}
                    `,
                },
            ],
            temperature: 0,
            response_format: {
                type: "json_object",
            },
            stream: false,
        })
    }

    const processPages = async () => {
        const promises = doc.map(async (page) => {
            const page_no = page.metadata.loc.pageNumber;
            const pageContent = page.pageContent;

            const response = await queryGroq({
                pageContent,
                page_no
            });

            const parsedResponse = zodSchema.parse(JSON.parse(response.choices[0].message.content!));    

            return parsedResponse.is_relevant ? page_no : null;
        });

        const results = await Promise.all(promises);
        pages.push(...results.filter(Boolean) as number[]);
    };

    await processPages();
    
    return pages;
}

export const getRelevanceRange = (relevantPages: number[]) => {
    if (relevantPages.length === 0) {
        return null;
    }

    const startPage = Math.min(...relevantPages);
    const endPage = Math.max(...relevantPages);

    return {
        startPage,
        endPage,
    };
}