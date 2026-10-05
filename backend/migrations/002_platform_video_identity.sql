-- Treat an external video ID as platform-scoped now that TikTok is supported.
-- Run once on databases created before this migration.
ALTER TABLE videos
    DROP INDEX platform_video_id,
    ADD UNIQUE KEY uq_videos_platform_video (platform, platform_video_id);
