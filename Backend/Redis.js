import { createClient } from 'redis';

const host = process.env.REDIS_HOST;
const port = process.env.REDIS_PORT;
const url = process.env.REDIS_URL || (host && port ? `redis://${host}:${port}` : 'redis://127.0.0.1:6379');

const redisClient = createClient({ url });

redisClient.on('error', (err) => console.error('Redis Client Error', err));

await redisClient.connect();
console.log('✅ Redis connected to', url);

export { redisClient };
