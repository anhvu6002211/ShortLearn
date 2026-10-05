const amqp = require('amqplib');
require('dotenv').config();

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const QUEUE_NAME = process.env.RABBITMQ_QUEUE_SUBTITLES || 'subtitles_tasks';
const DLX_EXCHANGE = 'subtitles_dlx';
const DLQ_NAME = 'subtitles_tasks_dlq';

let connection = null;
let channel = null;
let connecting = null;

function resetConnection() {
  connection = null;
  channel = null;
  connecting = null;
}

async function createChannel() {
  const nextConnection = await amqp.connect(RABBITMQ_URL);
  nextConnection.on('error', (error) => {
    console.error('❌ [RabbitMQ] Connection error:', error.message);
  });
  nextConnection.on('close', () => {
    console.warn('⚠️ [RabbitMQ] Connection closed. A new connection will be created on demand.');
    resetConnection();
  });

  const nextChannel = await nextConnection.createConfirmChannel();
  await nextChannel.assertExchange(DLX_EXCHANGE, 'fanout', { durable: true });
  await nextChannel.assertQueue(DLQ_NAME, { durable: true });
  await nextChannel.bindQueue(DLQ_NAME, DLX_EXCHANGE, '');
  await nextChannel.assertQueue(QUEUE_NAME, {
    durable: true,
    arguments: { 'x-dead-letter-exchange': DLX_EXCHANGE },
  });

  connection = nextConnection;
  channel = nextChannel;
  console.log(`✅ [RabbitMQ] Ready: queue "${QUEUE_NAME}" with DLQ "${DLQ_NAME}".`);
  return channel;
}

async function getChannel() {
  if (channel) return channel;
  if (!connecting) {
    connecting = createChannel().catch((error) => {
      resetConnection();
      throw error;
    });
  }
  return connecting;
}

async function publishSubtitleTask(payload) {
  const activeChannel = await getChannel();
  const accepted = activeChannel.sendToQueue(
    QUEUE_NAME,
    Buffer.from(JSON.stringify(payload)),
    {
      persistent: true,
      contentType: 'application/json',
      headers: { 'x-retry-count': 0 },
    }
  );

  if (!accepted) {
    console.warn('⚠️ [RabbitMQ] Write buffer is full; waiting for broker confirmation.');
  }

  // Confirm channel bảo đảm broker đã nhận message trước khi API trả 202.
  await activeChannel.waitForConfirms();
}

async function closeRabbitMq() {
  const activeConnection = connection;
  resetConnection();
  if (activeConnection) await activeConnection.close();
}

module.exports = {
  getChannel,
  publishSubtitleTask,
  closeRabbitMq,
  QUEUE_NAME,
  DLX_EXCHANGE,
  DLQ_NAME,
};
