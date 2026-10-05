import logging
from typing import Any, Dict, List, Tuple

from youtube_transcript_api import (
    NoTranscriptFound,
    TranscriptsDisabled,
    YouTubeTranscriptApi,
)

from .media_whisper import transcribe_media_url

logger = logging.getLogger(__name__)


def fetch_subtitles_tier1(video_id: str) -> List[Dict[str, Any]]:
    """Fetch existing English captions before spending time on speech-to-text."""
    try:
        transcript_list = YouTubeTranscriptApi().list(video_id)
        transcript = None

        try:
            transcript = transcript_list.find_manually_created_transcript(
                ['en', 'en-US', 'en-GB']
            )
        except Exception:
            try:
                transcript = transcript_list.find_generated_transcript(
                    ['en', 'en-US', 'en-GB']
                )
            except Exception:
                pass

        if transcript:
            fetched_transcript = transcript.fetch()
            raw_cues = (
                fetched_transcript.to_raw_data()
                if hasattr(fetched_transcript, 'to_raw_data')
                else fetched_transcript
            )
            logger.info(
                '[YouTube captions] Extracted %s cues for %s.',
                len(raw_cues),
                video_id,
            )
            return raw_cues
    except (TranscriptsDisabled, NoTranscriptFound) as error:
        logger.warning('[YouTube captions] No captions for %s: %s', video_id, error)
    except Exception as error:
        logger.warning('[YouTube captions] Fetch failed for %s: %s', video_id, error)

    return []


def fetch_subtitles_tier2_whisper(video_id: str) -> List[Dict[str, Any]]:
    """Download low-bitrate audio and use local Whisper (or configured fallback)."""
    video_url = f'https://www.youtube.com/watch?v={video_id}'
    return transcribe_media_url(video_url, video_id, 'youtube')


def extract_subtitles_pipeline(video_id: str) -> Tuple[List[Dict[str, Any]], str]:
    """Use native captions first, then Whisper when captions are unavailable."""
    cues = fetch_subtitles_tier1(video_id)
    if cues:
        return cues, 'ORIGINAL_CAPTIONS'

    cues = fetch_subtitles_tier2_whisper(video_id)
    if cues:
        return cues, 'WHISPER_AI'

    return [], 'FAILED'
