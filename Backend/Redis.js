import { createClient } from "redis";

const url = process.env.REDIS_URL || "redis://127.0.0.1:6379"; // fallback for local dev

const redisClient = createClient({ url });

redisClient.on("error", (err) => {
  console.error("❌ Redis Client Error:", err);
});

await redisClient.connect();
console.log("✅ Redis connected to", url);

export { redisClient };
