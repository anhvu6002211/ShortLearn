const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const subtitleRoutes = require('./routes/subtitleRoutes');
const vocabRoutes = require('./routes/vocabRoutes');
const learningRoutes = require('./routes/learningRoutes');
const authRoutes = require('./routes/authRoutes');
const db = require('./config/db');
const redisClient = require('./config/redis');
const { getChannel, closeRabbitMq } = require('./config/rabbitmq');

const app = express();
const PORT = Number(process.env.PORT || process.env.API_PORT || 5000);
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || (isProduction ? '' : 'http://localhost:19006,http://localhost:8081'))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

app.use((req, res, next) => {
  const requestId = typeof req.headers['x-request-id'] === 'string'
    && req.headers['x-request-id'].length <= 100
    ? req.headers['x-request-id']
    : crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(cors({
  origin(origin, callback) {
    // Expo native không gửi Origin. Browser phải thuộc allow-list.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS policy.'));
  },
  methods: ['GET', 'POST', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  maxAge: 86_400,
}));
app.use(express.json({ limit: '100kb', strict: true }));

const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_PER_MINUTE || 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' },
});
app.use('/api', generalLimiter);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'shortlearn-api-gateway',
    request_id: req.requestId,
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/ready', async (req, res) => {
  const checks = await Promise.allSettled([
    db.checkDatabase(),
    redisClient.checkRedis(),
    getChannel(),
  ]);
  const services = ['mysql', 'redis', 'rabbitmq'];
  const dependencies = Object.fromEntries(checks.map((result, index) => [
    services[index],
    result.status === 'fulfilled' ? 'UP' : 'DOWN',
  ]));
  const ready = checks.every((result) => result.status === 'fulfilled');

  res.status(ready ? 200 : 503).json({
    status: ready ? 'READY' : 'DEGRADED',
    request_id: req.requestId,
    dependencies,
  });
});

app.use('/api/v1/subtitles', subtitleRoutes);
app.use('/api/v1/vocabulary', vocabRoutes);
app.use('/api/v1/learning', learningRoutes);
app.use('/api/v1/auth', authRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found.', request_id: req.requestId });
});

app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Request body must be valid JSON.', request_id: req.requestId });
  }
  if (error.message === 'Origin is not allowed by CORS policy.') {
    return res.status(403).json({ error: error.message, request_id: req.requestId });
  }

  console.error(`💥 [${req.requestId}] Unhandled error:`, error);
  const payload = { error: 'Internal server error.', request_id: req.requestId };
  if (!isProduction) payload.details = error.message;
  return res.status(500).json(payload);
});

function startServer(port = PORT) {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 [ShortLearn API Gateway] running at http://0.0.0.0:${port}`);
  });

  const shutdown = async (signal) => {
    console.log(`🛑 Received ${signal}; shutting down gracefully...`);
    server.close(async () => {
      await Promise.allSettled([db.closeDatabase(), redisClient.closeRedis(), closeRabbitMq()]);
      process.exit(0);
    });

    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
  return server;
}

if (require.main === module) startServer();

module.exports = app;
module.exports.startServer = startServer;
