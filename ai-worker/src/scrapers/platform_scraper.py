from typing import Any, Dict, List, Tuple

from .tiktok_scraper import extract_subtitles_pipeline as extract_tiktok_subtitles
from .youtube_scraper import extract_subtitles_pipeline as extract_youtube_subtitles


def extract_platform_subtitles(
    platform: str,
    video_id: str,
) -> Tuple[List[Dict[str, Any]], str]:
    """Dispatch a validated task to its platform-specific extraction pipeline."""
    if platform == 'youtube':
        return extract_youtube_subtitles(video_id)
    if platform == 'tiktok':
        return extract_tiktok_subtitles(video_id)
    raise ValueError(f'Unsupported video platform: {platform}')
