import unittest
from unittest.mock import patch

from src.translators import llm_translator
from src.translators.llm_translator import normalize_translations


class NormalizeTranslationsTests(unittest.TestCase):
    def setUp(self):
        self.chunks = [
            {"cue_index": 4, "start_time": 0.0, "end_time": 1.2, "text": "Hello there."},
            {"cue_index": 5, "start_time": 1.2, "end_time": 2.4, "text": "How are you?"},
        ]

    def test_reorders_a_valid_model_response_by_cue_index(self):
        result = normalize_translations([
            {"cue_index": 5, "vi_text": "Bạn khỏe không?"},
            {"cue_index": 4, "vi_text": "Xin chào."},
        ], self.chunks)

        self.assertEqual([item["en_text"] for item in result], ["Hello there.", "How are you?"])
        self.assertEqual([item["vi_text"] for item in result], ["Xin chào.", "Bạn khỏe không?"])

    def test_rejects_partial_or_misaligned_model_response(self):
        with self.assertRaises(ValueError):
            normalize_translations([{"cue_index": 4, "vi_text": "Xin chào."}], self.chunks)

        with self.assertRaises(ValueError):
            normalize_translations([
                {"cue_index": 4, "vi_text": "Xin chào."},
                {"cue_index": 99, "vi_text": "Sai thứ tự."},
            ], self.chunks)

    def test_rejects_passthrough_english_as_a_translation(self):
        with self.assertRaisesRegex(ValueError, "did not translate"):
            normalize_translations([
                {"cue_index": 4, "vi_text": "Hello there."},
                {"cue_index": 5, "vi_text": "Bạn khỏe không?"},
            ], self.chunks)

    def test_refuses_to_complete_without_a_translation_provider(self):
        with (
            patch.object(llm_translator, "GROQ_API_KEY", ""),
            patch.object(llm_translator, "GEMINI_API_KEY", ""),
        ):
            with self.assertRaisesRegex(RuntimeError, "No translation provider"):
                llm_translator.translate_subtitles(self.chunks)

    def test_refuses_to_cache_a_failed_provider_response_as_ready(self):
        with (
            patch.object(llm_translator, "PRIMARY_LLM", "gemini"),
            patch.object(llm_translator, "GEMINI_API_KEY", "gemini-key"),
            patch.object(llm_translator, "GROQ_API_KEY", "groq-key"),
            patch.object(llm_translator, "translate_with_gemini", side_effect=RuntimeError("gemini down")),
            patch.object(llm_translator, "translate_with_groq", side_effect=RuntimeError("groq down")),
        ):
            with self.assertRaisesRegex(RuntimeError, "All configured translation providers failed"):
                llm_translator.translate_subtitles(self.chunks)


if __name__ == "__main__":
    unittest.main()
