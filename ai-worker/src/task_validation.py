import re
from typing import Any, Dict, Tuple

VIDEO_ID_PATTERNS = {
    'youtube': re.compile(r'^[A-Za-z0-9_-]{11}$'),
    'tiktok': re.compile(r'^\d{15,32}$'),
}


def normalize_task_payload(payload: Dict[str, Any]) -> Tuple[str, str]:
    """Validate queue input and return ``(platform, video_id)``."""
    if not isinstance(payload, dict):
        raise ValueError('Invalid task payload.')

    platform = payload.get('platform', 'youtube')
    if not isinstance(platform, str):
        raise ValueError('Invalid task platform.')
    platform = platform.strip().lower()

    pattern = VIDEO_ID_PATTERNS.get(platform)
    video_id = payload.get('video_id')
    if pattern is None or not isinstance(video_id, str) or not pattern.fullmatch(video_id):
        raise ValueError('Invalid task payload.')
    return platform, video_id
