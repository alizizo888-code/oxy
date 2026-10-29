"""Regression tests for the OXYGEN static article pipeline.

Run with: python -m unittest discover -s tests -v
"""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "publish_static_articles.py"
SPEC = importlib.util.spec_from_file_location("publish_static_articles", SCRIPT)
assert SPEC and SPEC.loader
publisher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(publisher)


class SafeHtmlTests(unittest.TestCase):
    def test_keeps_allowed_markup_and_local_links(self) -> None:
        result = publisher.sanitize_body(
            '<h2>العنوان</h2><p>نص <strong>مهم</strong> '
            '<a href="/services/">الخدمات</a></p>'
        )
        self.assertIn("<h2>العنوان</h2>", result)
        self.assertIn("<strong>مهم</strong>", result)
        self.assertIn('href="/services/"', result)

    def test_removes_script_tags_and_event_attributes(self) -> None:
        result = publisher.sanitize_body(
            '<p onclick="run()">نص</p><script>alert(1)</script>'
        )
        self.assertNotIn("<script", result.lower())
        self.assertNotIn("onclick", result.lower())
        self.assertIn("<p>نص</p>", result)

    def test_external_and_protocol_links_do_not_survive_as_href(self) -> None:
        result = publisher.sanitize_body(
            '<a href="https://evil.example">خارجي</a>'
            '<a href="javascript:alert(1)">غير آمن</a>'
            '<a href="//evil.example">نسبي غير آمن</a>'
        )
        self.assertNotIn("href=", result.lower())
        self.assertNotIn("javascript:", result.lower())
        self.assertNotIn("https://evil.example", result.lower())

    def test_malformed_nesting_is_closed(self) -> None:
        result = publisher.sanitize_body("<p><strong>نص</p>")
        self.assertEqual(result, "<p><strong>نص</strong></p>")

    def test_arabic_word_count_counts_words(self) -> None:
        self.assertEqual(publisher.word_count("<p>صيانة مكيفات منزلية آمنة</p>"), 4)


if __name__ == "__main__":
    unittest.main()
