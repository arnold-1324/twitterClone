import { createClient } from "redis";

const url = process.env.REDIS_URL;
const client = url ? createClient({
  url,
  disableOfflineQueue: true,
  socket: { connectTimeout: 1500 },
}) : null;

client?.on("error", (error) => {
  console.warn("Redis connection unavailable:", error.code || error.name);
});

export const redisClient = client ?? {
  get: async () => null,
  setEx: async () => {},
  del: async () => {},
};

export function startRedis() {
  if (client && !client.isOpen) {
    void client.connect()
      .then(() => console.info("Redis connected"))
      .catch((error) => console.warn("Redis startup failed:", error.code || error.name));
  }
}
