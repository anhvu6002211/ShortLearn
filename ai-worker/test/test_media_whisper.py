import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from src.scrapers import media_whisper


class MediaWhisperTests(unittest.TestCase):
    def test_normalizes_dict_and_object_segments(self):
        cues = media_whisper._segments_to_cues([
            {'start': 0.25, 'end': 1.0, 'text': ' Hello '},
            SimpleNamespace(start=1.0, end=1.2, text='world'),
            {'start': 2.0, 'end': 3.0, 'text': '   '},
        ])

        self.assertEqual(cues, [
            {'start': 0.25, 'duration': 0.75, 'text': 'Hello'},
            {'start': 1.0, 'duration': 0.5, 'text': 'world'},
        ])

    def test_local_transcription_enables_vad_and_stable_context(self):
        model = Mock()
        model.transcribe.return_value = (
            iter([SimpleNamespace(start=0.0, end=1.5, text=' Accurate captions. ')]),
            SimpleNamespace(language='en', language_probability=0.99),
        )

        with patch.object(media_whisper, '_get_local_model', return_value=model):
            cues = media_whisper._transcribe_local('sample.m4a')

        self.assertEqual(cues[0]['text'], 'Accurate captions.')
        model.transcribe.assert_called_once()
        options = model.transcribe.call_args.kwargs
        self.assertTrue(options['vad_filter'])
        self.assertFalse(options['condition_on_previous_text'])
        self.assertEqual(options['language'], 'en')

    def test_local_is_default_and_groq_is_optional_fallback(self):
        with (
            patch.object(media_whisper, 'WHISPER_PROVIDER', 'local'),
            patch.object(media_whisper, 'GROQ_API_KEY', ''),
        ):
            self.assertEqual(media_whisper._provider_order(), ['local'])

        with (
            patch.object(media_whisper, 'WHISPER_PROVIDER', 'local'),
            patch.object(media_whisper, 'GROQ_API_KEY', 'configured'),
        ):
            self.assertEqual(media_whisper._provider_order(), ['local', 'groq'])


if __name__ == '__main__':
    unittest.main()
