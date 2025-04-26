import { env } from "@/env";

import Redis from "ioredis";

export const redisCache = new Redis(env.UPSTASH_REDIS_URI);
