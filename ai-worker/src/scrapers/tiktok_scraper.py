import re
from typing import Any, Dict, List, Tuple

from .media_whisper import transcribe_media_url

TIKTOK_VIDEO_ID_PATTERN = re.compile(r'^\d{15,32}$')


def build_tiktok_video_url(video_id: str) -> str:
    """Build a canonical URL from a validated ID instead of trusting task URLs."""
    if not isinstance(video_id, str) or not TIKTOK_VIDEO_ID_PATTERN.fullmatch(video_id):
        raise ValueError('Invalid TikTok video ID.')
    return f'https://www.tiktok.com/@_/video/{video_id}'


def extract_subtitles_pipeline(video_id: str) -> Tuple[List[Dict[str, Any]], str]:
    """TikTok uses audio transcription because it exposes no stable caption API."""
    video_url = build_tiktok_video_url(video_id)
    cues = transcribe_media_url(video_url, video_id, 'tiktok')
    if cues:
        return cues, 'WHISPER_AI'
    return [], 'FAILED'
