import { env } from "@/env"

import Groq from "groq-sdk";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { z } from "zod";
import { DB } from "@/supabase/kysely";
import pLimit from 'p-limit';
import { v7 as uuidv7 } from "uuid";


const groq = new Groq({
    apiKey: env.GROQ_API_KEY,
});

const findRelevantPagesByText = async (user_query: string, file_blob: Blob) => {
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

    // Memoize query results to avoid duplicate processing
    const queryCache = new Map();
    
    const queryGroq = async ({
        pageContent,
        page_no
    } : {
        pageContent: string,
        page_no: number,
    }) => {
        // Create a cache key based on content hash
        const cacheKey = `${page_no}-${Buffer.from(pageContent.substring(0, 100)).toString('base64')}`;
        
        if (queryCache.has(cacheKey)) {
            return queryCache.get(cacheKey);
        }
        
        const response = await groq.chat.completions.create({
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
        });
        
        queryCache.set(cacheKey, response);
        return response;
    }

    const processPages = async () => {
        // Use concurrency limiting to avoid overwhelming the API
        const limit = pLimit(5); // Process 5 pages concurrently
        
        // Group pages into batches for more efficient processing
        const batchSize = 10;
        const batches = [];
        
        for (let i = 0; i < doc.length; i += batchSize) {
            batches.push(doc.slice(i, i + batchSize));
        }
        
        // Process batches sequentially, but pages within batches concurrently
        for (const batch of batches) {
            const batchPromises = batch.map(page => {
                return limit(async () => {
                    const page_no = page.metadata.loc.pageNumber;
                    const pageContent = page.pageContent;
                    
                    try {
                        const response = await queryGroq({
                            pageContent,
                            page_no
                        });
                        
                        const parsedResponse = zodSchema.parse(JSON.parse(response.choices[0].message.content!));    
                        return parsedResponse.is_relevant ? page_no : null;
                    } catch (error) {
                        console.error(`Error processing page ${page_no}:`, error);
                        return null;
                    }
                });
            });
            
            const results = await Promise.all(batchPromises);
            pages.push(...results.filter(Boolean) as number[]);
        }
    };

    await processPages();
    
    return {
        pages,
        total_page: doc.length,
    };
}

// export const findRelevantPagesByImage = async (user_query: string, file_blob: Blob) => {
//     const pages: number[] = [];

//     // Convert blob to arraybuffer 
//     const arrayBuffer = await file_blob.arrayBuffer();
//     // Extract images
//     const imagesArrRaw = await extImages(arrayBuffer);

//     console.log("Total Images: ", imagesArrRaw.length);
    
//     // Skip if no images found
//     if (imagesArrRaw.length === 0) {
//         return pages;
//     }

//     const imageArr : {
//         page_no: number,
//         image_url: string
//     }[] = [];

//     // Optimize image uploads with concurrent processing
//     const uploader = new Uploader(env.R2_BUCKET_NAME);
//     const uploadLimit = pLimit(5); // Upload 5 images concurrently
    
//     const uploadPromises = imagesArrRaw.map(image => 
//         uploadLimit(async () => {
//             try {
//                 const image_name = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.png`;
//                 await uploader.uploadFile("images", image_name, image.image, "public-read");
//                 return {
//                     page_no: image.page_no,
//                     image_url: `${env.R2_PUBLIC_URL}/${env.R2_BUCKET_NAME}/images/${image_name}`,
//                 };
//             } catch (error) {
//                 console.error(`Error uploading image for page ${image.page_no}:`, error);
//                 return null;
//             }
//         })
//     );
    
//     const uploadResults = await Promise.all(uploadPromises);
//     imageArr.push(...uploadResults.filter(Boolean) as {page_no: number, image_url: string}[]);

//     const zodSchema = z.object({
//         page_no: z.number(),
//         is_relevant: z.boolean(),
//     });

//     const jsonSchema = JSON.stringify(zodSchema.shape, null, 2);
    
//     // Implement caching for image analysis
//     const analysisCache = new Map();

//     const queryGroq = async ({
//         image_url,
//         page_no
//     } : {
//         image_url: string,
//         page_no: number,
//     }) => {
//         const cacheKey = `${page_no}-${image_url}`;
        
//         if (analysisCache.has(cacheKey)) {
//             return analysisCache.get(cacheKey);
//         }
        
//         const response = await groq.chat.completions.create({
//             model: "meta-llama/llama-4-maverick-17b-128e-instruct",
//             messages: [
//                 {
//                     role: "system",
//                     content: `You are a AI Assistant that finds the diagrams or images in pages of pdf documents that are relevant to the user's query and outputs answer in JSON.\n'The JSON object must use the schema: ${jsonSchema}`,
//                 },
//                 {
//                     role: "user",
//                     content: [
//                         {
//                             type: "image_url",
//                             image_url: {
//                                 url: image_url,
//                                 detail: "auto"
//                             },
//                         },
//                         {
//                             type: "text",
//                             text: `Page number: ${page_no}`,
//                         },
//                         {
//                             type: "text",
//                             text: `User query: ${user_query}`
//                         },
//                         {
//                             type: "text",
//                             text: `Please answer with a JSON object that contains the following fields:
//                             - page_no: The page number of the PDF file
//                             - is_relevant: A boolean value that indicates whether the page is relevant to the user's query
//                             The JSON object must use the schema: ${jsonSchema}`
//                         }
//                     ],
//                 },
//             ],
//             temperature: 1,
//             response_format: {
//                 type: "json_object",
//             },
//             stream: false,
//         });
        
//         analysisCache.set(cacheKey, response);
//         return response;
//     }

//     const processImages = async () => {
//         // Use concurrency limiting for image analysis
//         const analysisLimit = pLimit(3); // Process 3 images concurrently
        
//         // Group images into batches
//         const batchSize = 5;
//         const batches = [];
        
//         for (let i = 0; i < imageArr.length; i += batchSize) {
//             batches.push(imageArr.slice(i, i + batchSize));
//         }
        
//         // Process batches sequentially, but images within batches concurrently
//         for (const batch of batches) {
//             const batchPromises = batch.map(page => {
//                 return analysisLimit(async () => {
//                     try {
//                         const response = await queryGroq({
//                             image_url: page.image_url,
//                             page_no: page.page_no
//                         });
                        
//                         const parsedResponse = zodSchema.parse(JSON.parse(response.choices[0].message.content!));    
//                         return parsedResponse.is_relevant ? page.page_no : null;
//                     } catch (error) {
//                         console.error(`Error analyzing image for page ${page.page_no}:`, error);
//                         return null;
//                     }
//                 });
//             });
            
//             const results = await Promise.all(batchPromises);
//             pages.push(...results.filter(Boolean) as number[]);
//         }
//     };

//     await processImages();
    
//     return pages;
// }


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
}> => {
    const db = await DB.getInstance();

    const { query, grade, title, description, s3_url, pdf_url, thumbnail_url } = meta_data;
    
    // Start text and image analysis in parallel
    const textAnalysisPromise = findRelevantPagesByText(user_query, file_blob);
    
    // Insert PDF store data early to avoid waiting
    const pdf_store_data = await db
        .insertInto('pdf_stores')
        .values({
            id: uuidv7(),
            created_at: new Date(),
            description,
            grade,
            pdf_url,
            s3_url,
            query,
            title,
            total_pages: 0, // Will update this later
            thumbnail_url
        })
        .returning('id')
        .executeTakeFirstOrThrow();
    
    // Get text analysis results
    const pagesByTextObj = await textAnalysisPromise;
    
    // Update total pages count
    await db
        .updateTable('pdf_stores')
        .set({ total_pages: pagesByTextObj.total_page })
        .where('id', '=', pdf_store_data.id)
        .execute();
    
    if(pagesByTextObj.total_page > 100) {
        return {
            pages: [],
            total_page: pagesByTextObj.total_page,
            pdf_store_id: pdf_store_data.id,
        };
    }
    
    const pagesByText = pagesByTextObj.pages;
    
    // Only run image analysis if we have text results (optimization)
    // const imageAnalysisPromise = pagesByText.length > 0 
        // ? findRelevantPagesByImage(user_query, file_blob)
        // : Promise.resolve([]);
    
    // const pagesByImage = await imageAnalysisPromise;

    // Efficiently merge and deduplicate pages
    // const allPages = Array.from(new Set([...pagesByText, ...pagesByImage])).sort((a, b) => a - b);

    const allPages = pagesByText

    return {
        pages: allPages,
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
            id: uuidv7(),
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
  