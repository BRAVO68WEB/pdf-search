# Dev Journey 🕸️

This assignment was a great opportunity to build a full-stack application using Next.js, LLMs and Projects. The project was built using the latest technologies, including Next.js, TypeScript, Tailwind CSS, Zod, Kysely, PostgreSQL, Bun, React, Groq-SDK, Wrangler and Github Actions.

## Research 🔎

First and the foremost thing that I did was to break the entire project to into multiple subparts.
    
- [Dev Journey 🕸️](#dev-journey-️)
  - [Research 🔎](#research-)
  - [Google Search 📄](#google-search-)
  - [PDF Parsing 📄](#pdf-parsing-)
  - [LLM 🤖](#llm-)
  - [Database 🗄️](#database-️)
  - [Frontend 🖥️](#frontend-️)
  - [Integrations 🧪](#integrations-)
  - [Deployment 🚀](#deployment-)
  - [Improvements 🛠️](#improvements-️)
  - [Performance ⚡](#performance-)
  - [Conclusion 🎉](#conclusion-)

Now, keeping this in mind, I started working on the project.

## Google Search 📄

Google Search was the first thing that I worked on. I used the Google Search API to get the results. The API was easy to use and I was able to get the results in no time.

Early I found Serp APIs, which were paid, but later I found that Google has its own API for Custom Search Engine. I used that API to get the results.

I also used the Google Custom Search Engine API to get the results.

I created a helper library to interact with the Google Custom Search Engine API. The library is responsible for making the API calls and returning the results. Check [libs/cse.ts](./src/cse.ts) for more details.

- References
  - Docs : https://developers.google.com/custom-search/docs/overview
  - API Dashboard: https://programmablesearchengine.google.com/controlpanel/all

## PDF Parsing 📄

This was most annoying part of the Project. I tried over 15+ libraries and none of them worked.

Then, I stumbled upon `pdf-parse` library. This library was good but had some limitations. It was not able to parse the PDF files properly. I had to do some workarounds to make it work. Even, the widely used `pdf-dist` library was not able to parse the PDF files properly. Check this Github Issue for more reference [react-pdf#1811](https://github.com/wojtekmaj/react-pdf/issues/1811)

Main reason, I was facing issues was because of "Server-Sie Rendering" using NextJS's Server Actions. 

After more research, I found that the `@langchain/community` library has "WebPDFLoader" which is able to parse the PDF files properly. I used that library to parse the PDF files. This was a game changer. 

Why?
- Serverless Deployment don't allow to create files on the server.
- Parsing Speed is great

Now, I was able to parse the PDF files properly. I created a helper library to interact with the `@langchain/community` library. The library is responsible for making the API calls and returning the results. Check [libs/pdfParse.ts](./src/pdfParse.ts) for more details.

I also created a PDF downloader to download the PDF files from the server. It returns `ArrayBuffer`, which I then convert to `Blob` and pass it `WebPDFLoader` to load and parse my PDF files.

Check [libs/download.ts](./src/download.ts.ts) for more details.

- References
  - Docs : https://js.langchain.com/docs/integrations/document_loaders/web_loaders/pdf/
  - Docs : https://www.npmjs.com/package/@langchain/community

> PDF files are also then stored to a S3 bucket using R2 Storage for caching.

## LLM 🤖

I always wanted to work on a project that uses LLMs :)

After check different Models and Providers, I choose [Groq](https://groq.com/) as my LLM provider. The API was easy to use, I was able to get the results in blazing fast speeds, and the pricing and rate limits were reasonable.

I created a helper library to interact with the Groq API. The library is responsible for making the API calls and returning the results. Check [libs/groq.ts](./src/groq.ts) for more details.

Earlier, I though of creating Embeddings and storing then in a VectorDB. Created small demo project to try it out. After sometime, I got confused and asked ChatGPT if embedding even required. It said, "No, you don't need to create embedding for your use-case, though it ca have secondary benefits. Try directly querying with page content". I was like, "Oh, that's great!".

I used the Groq API to get the results. The API was easy to use and I was able to get the results in no time.

```js
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
```

While doing, I got a idea. If a page contains < 50 words, it might contain images and diagrams. I wrote another function to ask a vision model about relevance using OCR. Dropped the Idea as it was not taking a lot of time, because I need to render a PDF server-side, then upload images to S3, then, finally pass them to LLMs

Check this [URL](https://github.com/BRAVO68WEB/pdf-search/blob/2da332ffa3c7ef37951ec93f673ad92263e1a69f/libs/pdfParse.ts#L108) for the code from previous commits.

- References
  - Docs : https://console.groq.com/docs/overview
  - API Dashboard: https://console.groq.com/

## Database 🗄️

I used Supabase as my database provider. It was easy to use and I was set it up quickly.

I am a ORM hater, and strongly believe in writing raw SQL queries or query builders. I used Kysely as my SQL query builder. I have previous experience with it and I was able to use it easily.

Check [db/kysely.ts](./src/db/kysely.ts) for more details.
Then wrote migration scripts to create the tables. Check [db/migrations](./src/db/migrations/00_init.ts) for more details.

- References
  - Docs : https://supabase.com/docs/guides/database
  - Docs : https://kysely.dev/
  - API Dashboard: https://supabase.com/dashboard

## Frontend 🖥️

- It was already pre-built by the team. So, just did minor changes.

## Integrations 🧪

Integrations with APIs was a breeze. I used things for this.

- `NextJS API Routes` - For handling the API requests
- `NextJS Server Actions` - For handling the server-side rendering and API requests.

**API routes** is a great way to handle the API requests. It allows you to create serverless functions. I am performing Search Operation and tracking recent searches using this.

**Server Actions** is a great way to handle load heavy tasks. I am using it to perform heavy tasks like PDF parsing and querying LLMs and DB interactions.

> Every thing can be done using API Routes, but have have timeout restrictions
> and also, it is not a good practice to use API Routes for heavy tasks.

- References
  - Docs : https://nextjs.org/docs/app/api-reference/functions/server-actions
  - Docs : https://nextjs.org/docs/app/building-your-application/routing/route-handlers

## Deployment 🚀

I choose to deploy my Next app to CloudFlare Workers using Wrangler.

- Configured [OpenNext](https://opennext.js.org/) to deploy my Next.js app to CloudFlare Workers.
- Wrote a Github CI Action to deploy on every push to master branch.

Check [.github/workflows/deploy-cf.yaml](.github/workflows/deploy-cf.yaml) for more details.

- References
  - Docs : https://developers.cloudflare.com/workers/
  - Docs : https://opennext.js.org/cloudflare
  - Docs : https://docs.github.com/en/actions

## Improvements 🛠️

- Add a loading spinner to the search results page.
- Create embeddings for the search results and store them in a vector database. This will improve the search speed and accuracy, also can be used for other use-cases like, 
  - Text Summarization
  - Text Classification
  - Text Generation
- Implement a way to query via images of the pdf for searching.
- Add Auth layer to the app to prevent abuse and spamming.

## Performance ⚡

- The app is fast and responsive. The search results are returned in less than 30 secs.
- Batch parsing is also done in parallel to improve the performance.
- The app is able to handle multiple requests at the same time.

## Conclusion 🎉

Thank you, Astral Copilot Team for the opportunity to work on this project. It was a great experience and I learned a lot about building Next.js, TypeScript, and LLMs.