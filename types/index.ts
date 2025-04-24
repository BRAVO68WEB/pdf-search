import { z } from "zod";

export type SearchResultType = {
  id: string;
  title: string;
  description: string;
  image: string;
  totalPages: number;
  relevantPages?: string[];
}; 

export const itemSchema = z.object({
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
      z.object({ src: z.string(), width: z.string(), height: z.string() }).optional()
    ).optional(),
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
    cse_image: z.array(z.object({ src: z.string() }).optional()).optional(),
  }),
  mime: z.string(),
  fileFormat: z.string()
});

export const cseSchema = z.object({
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
      itemSchema
    )
  }
);