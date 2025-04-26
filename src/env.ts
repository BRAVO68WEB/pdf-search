import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	server: {
		CSE_CX_ID: z.string().min(1),
		CSE_API_KEY: z.string().min(1),
		DATABASE_URL: z.string(),
		GROQ_API_KEY: z.string().min(1),
		R2_BUCKET_NAME: z.string().min(1),
		R2_ACCESS_KEY_ID: z.string().min(1),
		R2_SECRET_ACCESS_KEY: z.string().min(1),
		R2_ENDPOINT: z.string().min(1),
		R2_PUBLIC_URL: z.string().min(1),
		UPSTASH_REDIS_URI: z.string().min(1),
	},
	client: {},
	runtimeEnv: {
		CSE_CX_ID: process.env.CSE_CX_ID,
		CSE_API_KEY: process.env.CSE_API_KEY,
		DATABASE_URL: process.env.DATABASE_URL,
		GROQ_API_KEY: process.env.GROQ_API_KEY,
		R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
		R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
		R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
		R2_ENDPOINT: process.env.R2_ENDPOINT,
		R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
		UPSTASH_REDIS_URI: process.env.UPSTASH_REDIS_URI,
	},
});

export type Env = typeof env;

declare global {
	interface ProcessEnv extends Env {}
}
