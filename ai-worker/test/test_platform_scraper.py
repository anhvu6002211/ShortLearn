import unittest
from unittest.mock import Mock, patch

from src.scrapers.platform_scraper import extract_platform_subtitles
from src.scrapers.tiktok_scraper import build_tiktok_video_url, extract_subtitles_pipeline
from src.scrapers.youtube_scraper import fetch_subtitles_tier1
from src.task_validation import normalize_task_payload


class TaskValidationTests(unittest.TestCase):
    def test_accepts_youtube_and_tiktok_tasks(self):
        self.assertEqual(
            normalize_task_payload({'platform': 'youtube', 'video_id': 'dQw4w9WgXcQ'}),
            ('youtube', 'dQw4w9WgXcQ'),
        )
        self.assertEqual(
            normalize_task_payload({'platform': 'TikTok', 'video_id': '7381234567890123456'}),
            ('tiktok', '7381234567890123456'),
        )

    def test_rejects_unknown_platform_and_malformed_ids(self):
        with self.assertRaises(ValueError):
            normalize_task_payload({'platform': 'vimeo', 'video_id': '1234567890123456789'})
        with self.assertRaises(ValueError):
            normalize_task_payload({'platform': 'tiktok', 'video_id': '../unsafe'})


class TikTokScraperTests(unittest.TestCase):
    def test_builds_canonical_url_from_id(self):
        video_id = '7381234567890123456'
        self.assertEqual(
            build_tiktok_video_url(video_id),
            f'https://www.tiktok.com/@_/video/{video_id}',
        )

    @patch('src.scrapers.tiktok_scraper.transcribe_media_url')
    def test_transcribes_tiktok_audio(self, transcribe):
        transcribe.return_value = [{'start': 0, 'duration': 1, 'text': 'Hello'}]
        cues, source_type = extract_subtitles_pipeline('7381234567890123456')
        self.assertEqual(source_type, 'WHISPER_AI')
        self.assertEqual(cues[0]['text'], 'Hello')

    @patch('src.scrapers.platform_scraper.extract_tiktok_subtitles')
    def test_dispatches_tiktok_pipeline(self, extract_tiktok):
        extract_tiktok.return_value = ([], 'FAILED')
        self.assertEqual(
            extract_platform_subtitles('tiktok', '7381234567890123456'),
            ([], 'FAILED'),
        )
        extract_tiktok.assert_called_once_with('7381234567890123456')


class YouTubeScraperTests(unittest.TestCase):
    @patch('src.scrapers.youtube_scraper.YouTubeTranscriptApi')
    def test_uses_current_instance_api_and_returns_raw_cues(self, api_class):
        fetched = Mock()
        fetched.to_raw_data.return_value = [
            {'start': 0.0, 'duration': 1.25, 'text': 'Hello'}
        ]
        transcript = Mock()
        transcript.fetch.return_value = fetched
        api_class.return_value.list.return_value.find_manually_created_transcript.return_value = transcript

        cues = fetch_subtitles_tier1('dQw4w9WgXcQ')

        api_class.return_value.list.assert_called_once_with('dQw4w9WgXcQ')
        self.assertEqual(cues[0]['text'], 'Hello')


if __name__ == '__main__':
    unittest.main()
