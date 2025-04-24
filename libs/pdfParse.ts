import { env } from "@/env"

import Groq from "groq-sdk";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { z } from "zod";
import { extractImagesFromPdf } from './images';
import { Uploader } from "./s3"
import { DB } from "@/supabase/kysely";

const groq = new Groq({
    apiKey: env.GROQ_API_KEY,
});

export const extImages = async (
    pdfBuffer: ArrayBuffer,
) => {
  return await extractImagesFromPdf(pdfBuffer);
}


export const findRelevantPagesByText = async (user_query: string, file_blob: Blob) => {
    const pages: number[] = [];

    const data = new WebPDFLoader(file_blob, {
        splitPages: true
    });

    const doc = await data.load();

    console.log("Total Pages: ", doc.length);

    if(doc.length > 100) {
        return {
            pages,
            total_page: doc.length,
        };
    }

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
    
    return {
        pages,
        total_page: doc.length,
    };
}

export const findRelevantPagesByImage = async (user_query: string, file_blob: Blob) => {
    const pages: number[] = [];

    // convert blob to arraybuffer 
    const arrayBuffer = await file_blob.arrayBuffer();
    // png image array
    const imagesArrRaw = await extImages(arrayBuffer);

    const imageArr : {
        page_no: number,
        image_url: string
    }[] = [];

    // upload images to s3
    for (const image of imagesArrRaw) {
        const uploader = new Uploader(env.R2_BUCKET_NAME);
        let image_name = Date.now() + ".png";
        await uploader.uploadFile("images", image_name, image.image, "public-read");
        imageArr.push({
            page_no: image.page_no,
            image_url: `${env.R2_PUBLIC_URL}/${env.R2_BUCKET_NAME}/images/${image_name}`,
        });
    }

    const zodSchema = z.object({
        page_no: z.number(),
        is_relevant: z.boolean(),
    });

    const jsonSchema = JSON.stringify(zodSchema.shape, null, 2);

    const queryGroq = ({
        image_url,
        page_no
    } : {
        image_url: string,
        page_no: number,
    }) => {
        return groq.chat.completions.create({
            model: "meta-llama/llama-4-maverick-17b-128e-instruct",
            messages: [
                {
                    role: "system",
                    content: `You are a AI Assistant that finds the diagrams or images in pages of pdf documents that are relevant to the user's query and outputs answer in JSON.\n'The JSON object must use the schema: ${jsonSchema}`,
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "image_url",
                            image_url: {
                                url: image_url,
                                detail: "auto"
                            },
                        },
                        {
                            type: "text",
                            text: `Page number: ${page_no}`,
                        },
                        {
                            type: "text",
                            text: `User query: ${user_query}`
                        },
                        {
                            type: "text",
                            text: `Please answer with a JSON object that contains the following fields:
                            - page_no: The page number of the PDF file
                            - is_relevant: A boolean value that indicates whether the page is relevant to the user's query
                            The JSON object must use the schema: ${jsonSchema}`
                        }
                    ],
                },
            ],
            temperature: 1,
            response_format: {
                type: "json_object",
            },
            stream: false,
        })
    }

    const processImages = async () => {
        const promises = imageArr.map(async (page) => {
            const page_no = page.page_no;
            const image_url = page.image_url;

            const response = await queryGroq({
                image_url,
                page_no
            });

            const parsedResponse = zodSchema.parse(JSON.parse(response.choices[0].message.content!));    

            return parsedResponse.is_relevant ? page_no : null;
        });

        const results = await Promise.all(promises);
        pages.push(...results.filter(Boolean) as number[]);
    };

    await processImages();
    
    return pages;
}

export const getRelevantPages = async (user_query: string, file_blob: Blob, meta_data: {
    query: string,
    grade: string,
    title: string,
    description: string,
    s3_url: string,
    pdf_url: string,
    thumbnail_url: string,
}) : Promise<{
    pages: number[];
    total_page: number;
    pdf_store_id: string;
}>=> {
    const db = await DB.getInstance();

    const { query, grade, title, description, s3_url, pdf_url, thumbnail_url } = meta_data;
    
    const pagesByTextObj = await findRelevantPagesByText(user_query, file_blob);

    const pdf_store_data = await db
        .insertInto('pdf_stores')
        .values({
            id: Date.now().toString(),
            created_at: new Date(),
            description,
            grade,
            pdf_url,
            s3_url,
            query,
            title,
            total_pages: pagesByTextObj.total_page,
            thumbnail_url
        })
        .returning('id')
        .executeTakeFirstOrThrow();

    if(pagesByTextObj.total_page > 100) {
        return {
            pages: [],
            total_page: pagesByTextObj.total_page,
            pdf_store_id: pdf_store_data.id,
        };
    }
    const pagesByText = pagesByTextObj.pages;
    const pagesByImage = await findRelevantPagesByImage(user_query, file_blob);

    const data = await Promise.all([pagesByText, pagesByImage]).then((results) => {
        const [textPages, imagePages] = results;
        const allPages = Array.from(new Set([...textPages, ...imagePages]));
        return allPages;
    });

    return {
        pages: data,
        total_page: pagesByTextObj.total_page,
        pdf_store_id: pdf_store_data.id,
    };
}

export const getRelevanceRange = async (relevantPages: number[], meta_data: {
    search_result_id: string;
    pdf_store_id: string;
}): Promise<{
    id: string;
    range: string[];
}> => {
    if (!relevantPages.length) {
        return {
            id: "",
            range: [],
        };
    }
    
    const db = await DB.getInstance();

    const { search_result_id, pdf_store_id } = meta_data;
    
    let output: string[] = [];
    let rangeStart = relevantPages[0];
    let prev = relevantPages[0];
    
    // Handle single page case
    if (relevantPages.length === 1) {
        output = [String(rangeStart)];
    }
    
    for (let i = 1; i < relevantPages.length; i++) {
      const current = relevantPages[i];
      
      // If pages are not consecutive
      if (current - prev > 1) {
        // Add the completed range (or single page)
        output.push(rangeStart === prev ? String(rangeStart) : `${rangeStart}-${prev}`);
        // Start a new range
        rangeStart = current;
      }
      
      // If we're at the last page
      if (i === relevantPages.length - 1) {
        output.push(rangeStart === current ? String(current) : `${rangeStart}-${current}`);
      }
      
      prev = current;
    }

    // Save the parsed data to the database
    const pdf_parsed_data = await db.insertInto('pdf_parsed')
        .values({
            id: Date.now().toString(),
            pdf_store_id,
            search_result_id,
            relevance: JSON.stringify(output),
            created_at: new Date(),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
    
    return {
        id: pdf_parsed_data.id,
        range: output,
    };
  }
  