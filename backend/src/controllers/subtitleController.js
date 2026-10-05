const redisClient = require('../config/redis');
const db = require('../config/db');
const { publishSubtitleTask } = require('../config/rabbitmq');
const { normalizePlatform, normalizePlatformVideoId } = require('../utils/validation');

const CACHE_TTL_SECONDS = 60 * 60 * 48;
const configuredStaleProcessingMs = Number(process.env.SUBTITLE_PROCESSING_STALE_MS);
const STALE_PROCESSING_MS = Number.isFinite(configuredStaleProcessingMs) && configuredStaleProcessingMs >= 60_000
  ? configuredStaleProcessingMs
  : 10 * 60 * 1000;

function cacheKey(platform, videoId) {
  return `sub:${platform}:${videoId}`;
}

function errorResponse(res, error, fallbackMessage) {
  if (error instanceof TypeError) {
    return res.status(400).json({ error: error.message });
  }

  console.error(`❌ [${fallbackMessage}]`, error);
  const payload = { error: fallbackMessage };
  if (process.env.NODE_ENV !== 'production') payload.details = error.message;
  return res.status(500).json(payload);
}

function isStale(updatedAt) {
  const updatedAtMs = new Date(updatedAt).getTime();
  return !Number.isNaN(updatedAtMs) && Date.now() - updatedAtMs >= STALE_PROCESSING_MS;
}

async function getCachedSubtitles(key) {
  if (!redisClient.isReady) return null;

  try {
    const cached = await redisClient.get(key);
    if (!cached) return null;

    const subtitles = JSON.parse(cached);
    if (!Array.isArray(subtitles) || subtitles.length === 0) {
      await redisClient.del(key);
      return null;
    }
    return subtitles;
  } catch (error) {
    console.warn('⚠️ [Cache] Failed to read cached subtitles:', error.message);
    return null;
  }
}

async function cacheSubtitles(key, subtitles) {
  if (!redisClient.isReady || !Array.isArray(subtitles) || subtitles.length === 0) return;
  try {
    await redisClient.setEx(key, CACHE_TTL_SECONDS, JSON.stringify(subtitles));
  } catch (error) {
    console.warn('⚠️ [Cache] Failed to cache subtitles:', error.message);
  }
}

async function getVideo(videoId, platform) {
  const [rows] = await db.query(
    `SELECT id, platform, status, updated_at FROM videos
     WHERE platform_video_id = ? AND platform = ? LIMIT 1`,
    [videoId, platform]
  );
  return rows[0] || null;
}

async function getReadySubtitles(video) {
  const [subtitles] = await db.query(
    `SELECT cue_index, start_time, end_time, en_text, vi_text
     FROM subtitles WHERE video_id = ? ORDER BY start_time ASC, cue_index ASC`,
    [video.id]
  );
  return subtitles;
}

async function claimSubtitleJob(video, { retry = false } = {}) {
  if (video.status === 'FAILED' && !retry) {
    return { claimed: false, state: 'FAILED' };
  }

  if (video.status === 'PROCESSING' && !isStale(video.updated_at)) {
    return { claimed: false, state: 'PROCESSING' };
  }

  if (video.status === 'PROCESSING') {
    // Đưa task bị kẹt về PENDING trước; chỉ request thắng điều kiện sau mới được publish.
    await db.query(
      `UPDATE videos SET status = 'PENDING'
       WHERE id = ? AND status = 'PROCESSING' AND updated_at < ?`,
      [video.id, new Date(Date.now() - STALE_PROCESSING_MS)]
    );
  } else if (video.status === 'FAILED') {
    await db.query(
      `UPDATE videos SET status = 'PENDING'
       WHERE id = ? AND status = 'FAILED'`,
      [video.id]
    );
  }

  const [claim] = await db.query(
    `UPDATE videos SET status = 'PROCESSING'
     WHERE id = ? AND status = 'PENDING'`,
    [video.id]
  );

  return { claimed: claim.affectedRows === 1, state: 'PROCESSING' };
}

/** POST /api/v1/subtitles/request */
async function requestSubtitles(req, res) {
  let video;

  try {
    const payload = req.body || {};
    const platform = normalizePlatform(payload.platform);
    const videoId = normalizePlatformVideoId(payload.video_id, platform);
    const retry = payload.retry === true;
    const key = cacheKey(platform, videoId);

    const cached = await getCachedSubtitles(key);
    if (cached) {
      return res.status(200).json({ status: 'READY', source: 'CACHE_HIT', data: cached });
    }

    video = await getVideo(videoId, platform);

    if (!video) {
      await db.query(
        `INSERT IGNORE INTO videos (platform_video_id, platform, status)
         VALUES (?, ?, 'PENDING')`,
        [videoId, platform]
      );
      video = await getVideo(videoId, platform);
    }

    if (video.status === 'READY') {
      const subtitles = await getReadySubtitles(video);
      if (subtitles.length > 0) {
        await cacheSubtitles(key, subtitles);
        return res.status(200).json({ status: 'READY', source: 'DATABASE_HIT', data: subtitles });
      }

      // READY nhưng không có cue là trạng thái hỏng; cho phép đưa lại vào pipeline.
      await db.query("UPDATE videos SET status = 'PENDING' WHERE id = ? AND status = 'READY'", [video.id]);
      video = await getVideo(videoId, platform);
    }

    const job = await claimSubtitleJob(video, { retry });
    if (job.state === 'FAILED') {
      return res.status(422).json({
        status: 'FAILED',
        message: 'Subtitle processing failed. Send retry: true to request a new attempt.',
      });
    }

    if (job.claimed) {
      try {
        await publishSubtitleTask({
          video_id: videoId,
          platform,
          requested_at: new Date().toISOString(),
        });
      } catch (publishError) {
        await db.query("UPDATE videos SET status = 'FAILED' WHERE id = ? AND status = 'PROCESSING'", [video.id]);
        throw publishError;
      }
    }

    return res.status(202).json({
      status: 'PROCESSING',
      retry_after_seconds: 2,
      message: job.claimed
        ? 'Task successfully dispatched to the AI Worker pipeline.'
        : 'Video is currently being processed by the AI Worker.',
    });
  } catch (error) {
    return errorResponse(res, error, 'Failed to request subtitles');
  }
}

/** GET /api/v1/subtitles/:videoId */
async function getSubtitles(req, res) {
  try {
    const platform = normalizePlatform(req.query.platform);
    const videoId = normalizePlatformVideoId(req.params.videoId, platform);
    const key = cacheKey(platform, videoId);

    const cached = await getCachedSubtitles(key);
    if (cached) {
      return res.status(200).json({ status: 'READY', source: 'CACHE_HIT', data: cached });
    }

    const video = await getVideo(videoId, platform);
    if (!video) {
      return res.status(404).json({
        status: 'NOT_FOUND',
        message: 'Video subtitles not found. Send POST /request first.',
      });
    }

    if (video.status !== 'READY') {
      return res.status(video.status === 'FAILED' ? 422 : 200).json({
        status: video.status,
        retry_after_seconds: video.status === 'PROCESSING' ? 2 : undefined,
        message: `Video is in ${video.status} state.`,
      });
    }

    const subtitles = await getReadySubtitles(video);
    if (subtitles.length === 0) {
      return res.status(503).json({
        status: 'PROCESSING',
        message: 'Subtitle data is not ready yet. Please retry shortly.',
      });
    }

    await cacheSubtitles(key, subtitles);
    return res.status(200).json({ status: 'READY', source: 'DATABASE_HIT', data: subtitles });
  } catch (error) {
    return errorResponse(res, error, 'Failed to fetch subtitles');
  }
}

module.exports = { requestSubtitles, getSubtitles };
