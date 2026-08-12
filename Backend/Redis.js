// Redis support has been commented out to disable caching during development
// and avoid connection errors when Redis is not available.
// Original implementation used `createClient` and attempted to connect.
// Keeping a no-op stub allows existing imports across controllers
// to continue working without runtime errors.

// import { createClient } from "redis";

// const url = process.env.REDIS_URL;
// if (url) {
//   const client = createClient({ url });
//   client.on("error", (err) => console.error("❌ Redis Client Error:", err));
//   (async () => {
//     try {
//       await client.connect();
//       console.log("✅ Redis connected to", url);
//     } catch (err) {
//       console.error("❌ Redis failed to connect:", err.message);
//     }
//   })();
// } else {
//   console.warn("⚠️ REDIS_URL is not set. Redis cache is disabled.");
// }

const redisClient = {
  get: async () => null,
  setEx: async () => {},
  del: async () => {},
};

console.warn("⚠️ Redis is disabled. `redisClient` is a no-op stub.");

export { redisClient };
