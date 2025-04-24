import { env } from "@/env"
import { z } from "zod"

const schema = z.object({
  kind: z.string(),
  url: z.object({ type: z.string(), template: z.string() }),
  queries: z.object({
    request: z.array(
      z.object({
        title: z.string(),
        totalResults: z.string(),
        searchTerms: z.string(),
        count: z.number(),
        startIndex: z.number(),
        inputEncoding: z.string(),
        outputEncoding: z.string(),
        safe: z.string(),
        cx: z.string()
      })
    ),
    nextPage: z.array(
      z.object({
        title: z.string(),
        totalResults: z.string(),
        searchTerms: z.string(),
        count: z.number(),
        startIndex: z.number(),
        inputEncoding: z.string(),
        outputEncoding: z.string(),
        safe: z.string(),
        cx: z.string()
      })
    )
  }),
  context: z.object({ title: z.string() }),
  searchInformation: z.object({
    searchTime: z.number(),
    formattedSearchTime: z.string(),
    totalResults: z.string(),
    formattedTotalResults: z.string()
  }),
  items: z.array(
      z.object({
        kind: z.string(),
        title: z.string(),
        htmlTitle: z.string(),
        link: z.string(),
        displayLink: z.string(),
        snippet: z.string(),
        htmlSnippet: z.string(),
        formattedUrl: z.string(),
        htmlFormattedUrl: z.string(),
        pagemap: z.object({
          cse_thumbnail: z.array(
            z.object({ src: z.string(), width: z.string(), height: z.string() })
          ),
          metatags: z.array(
            z.object({
              moddate: z.string(),
              creationdate: z.string(),
              creator: z.string(),
              author: z.string(),
              subject: z.string(),
              producer: z.string(),
              title: z.string(),
              metadate: z.string()
            })
          ),
          cse_image: z.array(z.object({ src: z.string() }))
        }),
        mime: z.string(),
        fileFormat: z.string()
      }),
    )
  }
);

export const queryCSE = async (query: string, grade: string, startIndex: string = "1") => {
    try {
        const base_url = "https://customsearch.googleapis.com/customsearch/v1";
        const request_url = new URL(base_url);

        request_url.searchParams.append("key", env.CSE_API_KEY);
        request_url.searchParams.append("cx", env.CSE_CX_ID);
        request_url.searchParams.append("q", query + " " + grade + " filetype:pdf");
        request_url.searchParams.append("start", startIndex);

        const response = await fetch(request_url, {
            method: "GET",
            redirect: "follow"
        });
        
        const data : z.infer<typeof schema> = await response.json();
        return data;
    }
    catch (err){
        if(err instanceof Error) {
            throw new Error(err.message);
        }
    }
};