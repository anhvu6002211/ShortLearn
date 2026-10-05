const { createClient } = require('redis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL || (() => {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || 6379;
  const password = process.env.REDIS_PASSWORD;
  return password
    ? `redis://:${encodeURIComponent(password)}@${host}:${port}`
    : `redis://${host}:${port}`;
})();

const redisClient = createClient({
  url: redisUrl,
  socket: {
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 5_000,
    reconnectStrategy: (retries) => Math.min(250 * (retries + 1), 3_000),
  },
});

redisClient.on('error', (error) => console.error('❌ [Redis] Client error:', error.message));
redisClient.on('ready', () => console.log('✅ [Redis] Connected successfully.'));

(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.warn('⚠️ [Redis] Initial connection failed:', error.message);
  }
})();

async function checkRedis() {
  if (!redisClient.isReady) throw new Error('Redis client is not ready.');
  const result = await redisClient.ping();
  if (result !== 'PONG') throw new Error('Unexpected Redis ping response.');
  return true;
}

async function closeRedis() {
  if (redisClient.isOpen) await redisClient.quit();
}

module.exports = Object.assign(redisClient, { checkRedis, closeRedis });
