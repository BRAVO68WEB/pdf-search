import { env } from "@/env";

import Groq from "groq-sdk";
import { z } from "zod";

import { redisCache } from "@/libs/redis";

const groq = new Groq({
	apiKey: env.GROQ_API_KEY,
});

export const zodSchema = z.object({
	page_no: z.number(),
	is_relevant: z.boolean(),
});

const jsonSchema = JSON.stringify(zodSchema.shape, null, 2);

export const queryGroq = async (
	user_query: string,
	{ pageContent, page_no }: { pageContent: string; page_no: number },
) => {
	// Create a cache key based on content hash
	const cacheKey = `${page_no}-${Buffer.from(pageContent.substring(0, 100)).toString("base64")}`;

	if (await redisCache.exists(cacheKey)) {
		return JSON.parse((await redisCache.get(cacheKey)) as string);
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

	redisCache.set(cacheKey, JSON.stringify(response));
	return response;
};
