import { createClient } from "redis";

//const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const url = "redis://127.0.0.1:6379";

const redisClient = createClient({ url });

redisClient.on("error", (err) => {
  console.error("❌ Redis Client Error:", err);
});

// don’t use top-level await in a module unless your Node version supports it fully
(async () => {
  await redisClient.connect();
  console.log("✅ Redis connected to", url);
})();

export { redisClient };
