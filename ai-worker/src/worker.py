import json
import logging
import time

import mysql.connector
import pika
import redis

from .core.config import (
    DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER,
    LLM_BATCH_SIZE, RABBITMQ_URL, QUEUE_NAME, REDIS_HOST, REDIS_PORT,
)
from .scrapers.platform_scraper import extract_platform_subtitles
from .task_validation import normalize_task_payload
from .translators.llm_translator import translate_subtitles_in_batches
from .utils.sliding_window import merge_cues_sliding_window

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
)
logger = logging.getLogger('AI-Worker')

DLX_EXCHANGE = 'subtitles_dlx'
DLQ_NAME = 'subtitles_tasks_dlq'
RETRY_QUEUE = f'{QUEUE_NAME}_retry'
MAX_RETRIES = 3
RETRY_DELAY_MS = 10_000


def get_mysql_connection():
    return mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        autocommit=False,
        connection_timeout=10,
    )


def get_redis_client():
    return redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=0,
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
    )


def save_subtitles_to_db(video_id: str, platform: str, source_type: str, subtitles: list):
    if not subtitles:
        raise ValueError('Refusing to mark a video READY without subtitle cues.')

    conn = get_mysql_connection()
    cursor = conn.cursor()
    try:
        conn.start_transaction()
        cursor.execute(
            """INSERT INTO videos (platform_video_id, platform, status, source_type)
               VALUES (%s, %s, 'PENDING', %s)
               ON DUPLICATE KEY UPDATE source_type = VALUES(source_type)""",
            (video_id, platform, source_type),
        )
        cursor.execute(
            "SELECT id FROM videos WHERE platform_video_id = %s AND platform = %s FOR UPDATE",
            (video_id, platform),
        )
        video_row = cursor.fetchone()
        if not video_row:
            raise RuntimeError('Failed to fetch the video record after insert.')
        db_video_id = video_row[0]

        records = []
        for index, item in enumerate(subtitles):
            start_time = round(float(item['start_time']), 2)
            end_time = round(float(item['end_time']), 2)
            en_text = str(item['en_text']).strip()
            vi_text = str(item['vi_text']).strip()

            if start_time < 0 or end_time < start_time or not en_text or not vi_text:
                raise ValueError(f'Invalid translated subtitle cue at index {index}.')
            records.append((db_video_id, index, start_time, end_time, en_text, vi_text))

        cursor.execute('DELETE FROM subtitles WHERE video_id = %s', (db_video_id,))
        cursor.executemany(
            """INSERT INTO subtitles
               (video_id, cue_index, start_time, end_time, en_text, vi_text)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            records,
        )
        cursor.execute(
            """UPDATE videos
               SET status = 'READY', source_type = %s, updated_at = NOW()
               WHERE id = %s""",
            (source_type, db_video_id),
        )
        conn.commit()
        logger.info('💾 [MySQL] Saved %s subtitle cues for video %s', len(records), video_id)
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def cache_subtitles_redis(video_id: str, platform: str, subtitles: list):
    try:
        redis_client = get_redis_client()
        cache_key = f'sub:{platform}:{video_id}'
        redis_client.setex(cache_key, 60 * 60 * 48, json.dumps(subtitles, ensure_ascii=False))
        logger.info('⚡ [Redis] Cached subtitles key: %s (TTL 48h)', cache_key)
    except Exception as error:
        # DB là nguồn dữ liệu chính; cache failure không làm thất bại toàn bộ task.
        logger.warning('⚠️ [Redis] Caching error: %s', error)


def mark_video_failed(video_id: str, platform: str):
    try:
        conn = get_mysql_connection()
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO videos (platform_video_id, platform, status)
               VALUES (%s, %s, 'FAILED')
               ON DUPLICATE KEY UPDATE status = 'FAILED', updated_at = NOW()""",
            (video_id, platform),
        )
        conn.commit()
        logger.info('⚠️ Marked video %s as FAILED in DB.', video_id)
    except Exception as error:
        logger.error('❌ Failed to mark video as FAILED: %s', error)
    finally:
        try:
            cursor.close()
            conn.close()
        except (UnboundLocalError, NameError):
            pass


def get_retry_count(properties) -> int:
    try:
        return max(0, int((properties.headers or {}).get('x-retry-count', 0)))
    except (TypeError, ValueError):
        return 0


def requeue_with_delay(channel, body: bytes, properties, retry_count: int, error: Exception):
    headers = dict(properties.headers or {})
    headers['x-retry-count'] = retry_count + 1
    headers['x-last-error'] = str(error)[:250]
    delay_ms = RETRY_DELAY_MS * (2 ** retry_count)
    channel.basic_publish(
        exchange='',
        routing_key=RETRY_QUEUE,
        body=body,
        properties=pika.BasicProperties(
            content_type='application/json',
            delivery_mode=2,
            expiration=str(delay_ms),
            headers=headers,
        ),
    )
    logger.warning('♻️ Retry %s/%s scheduled in %sms.', retry_count + 1, MAX_RETRIES - 1, delay_ms)


def process_task(channel, method, properties, body):
    retry_count = get_retry_count(properties)
    video_id = None
    platform = 'youtube'

    try:
        payload = json.loads(body.decode('utf-8'))
        platform, video_id = normalize_task_payload(payload)

        logger.info(
            '📥 [Task] Processing %s (%s), attempt %s/%s',
            video_id, platform, retry_count + 1, MAX_RETRIES,
        )
        raw_cues, source_type = extract_platform_subtitles(platform, video_id)
        if not raw_cues:
            raise RuntimeError(f'Could not extract subtitles or audio for {video_id}.')

        chunks = merge_cues_sliding_window(raw_cues)
        if not chunks:
            raise RuntimeError(f'No usable subtitle chunks for {video_id}.')
        logger.info('🧩 Merged %s raw cues into %s chunks.', len(raw_cues), len(chunks))

        logger.info('🧠 Translating %s chunks in batches of %s.', len(chunks), LLM_BATCH_SIZE)
        translated_cues = translate_subtitles_in_batches(chunks, LLM_BATCH_SIZE)
        if len(translated_cues) != len(chunks):
            raise RuntimeError('Translation output count does not match the source chunk count.')

        save_subtitles_to_db(video_id, platform, source_type, translated_cues)
        cache_subtitles_redis(video_id, platform, translated_cues)
        channel.basic_ack(delivery_tag=method.delivery_tag)
        logger.info('🎉 [Completed] Video %s processed (%s bilingual cues).', video_id, len(translated_cues))

    except Exception as error:
        logger.error('💥 [Task failed] Attempt %s: %s', retry_count + 1, error, exc_info=True)
        if video_id and retry_count + 1 < MAX_RETRIES:
            try:
                requeue_with_delay(channel, body, properties, retry_count, error)
                channel.basic_ack(delivery_tag=method.delivery_tag)
            except Exception as publish_error:
                logger.error('❌ Could not enqueue delayed retry: %s', publish_error, exc_info=True)
                channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
            return

        if video_id:
            mark_video_failed(video_id, platform)
        # Main queue có DLX nên message cuối cùng sẽ được lưu vào subtitles_tasks_dlq.
        channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def start_worker():
    while True:
        try:
            logger.info('🔌 Connecting to RabbitMQ at %s...', RABBITMQ_URL)
            params = pika.URLParameters(RABBITMQ_URL)
            params.heartbeat = 30
            params.blocked_connection_timeout = 60
            connection = pika.BlockingConnection(params)
            channel = connection.channel()

            channel.exchange_declare(exchange=DLX_EXCHANGE, exchange_type='fanout', durable=True)
            channel.queue_declare(queue=DLQ_NAME, durable=True)
            channel.queue_bind(queue=DLQ_NAME, exchange=DLX_EXCHANGE)
            channel.queue_declare(
                queue=QUEUE_NAME,
                durable=True,
                arguments={'x-dead-letter-exchange': DLX_EXCHANGE},
            )
            channel.queue_declare(
                queue=RETRY_QUEUE,
                durable=True,
                arguments={
                    'x-dead-letter-exchange': '',
                    'x-dead-letter-routing-key': QUEUE_NAME,
                },
            )
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue=QUEUE_NAME, on_message_callback=process_task)
            logger.info('👂 Worker listening on %s (max attempts: %s).', QUEUE_NAME, MAX_RETRIES)
            channel.start_consuming()
        except KeyboardInterrupt:
            logger.info('🛑 Worker stopped by user.')
            break
        except pika.exceptions.AMQPConnectionError as error:
            logger.warning('⚠️ RabbitMQ connection lost (%s). Retrying in 5s...', error)
            time.sleep(5)
        except Exception as error:
            logger.error('❌ Unexpected worker failure: %s. Retrying in 5s...', error, exc_info=True)
            time.sleep(5)


if __name__ == '__main__':
    start_worker()
