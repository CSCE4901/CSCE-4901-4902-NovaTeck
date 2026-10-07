import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bs4 import BeautifulSoup
from job_html import clean_html, group_by_headings, lever_html


class JobHtmlTests(unittest.TestCase):
    def test_source_headings_and_bold_only_paragraphs_define_boundaries(self):
        cleaned = clean_html('Intro text<h1>Employer title</h1><p>Background</p><p><b>Our exact heading:</b></p><ul><li>Requirement</li></ul><p><b>Bold</b> mixed paragraph</p>')
        sections = group_by_headings(cleaned)
        self.assertEqual([s['title'] for s in sections], [None, 'Employer title', 'Our exact heading'])
        self.assertIn('<li>Requirement</li>', sections[-1]['html'])
        self.assertIn('mixed paragraph', sections[-1]['html'])
        self.assertIn('Intro text', sections[0]['html'])

    def test_heading_words_inside_prose_do_not_create_cards(self):
        sections = group_by_headings(clean_html('<p>About the Company: work with us.</p><p>Key Responsibilities include coding.</p>'))
        self.assertEqual(len(sections), 1)
        self.assertIsNone(sections[0]['title'])

    def test_dangerous_html_is_removed_and_links_are_safe(self):
        cleaned = clean_html('<script>alert(1)</script><p onclick="bad()">Safe<img src=x onerror="bad()"></p><a href="javascript:bad()">Link</a><a href="/job">Job</a>', 'https://example.test/careers')
        self.assertNotIn('script', cleaned)
        self.assertNotIn('onclick', cleaned)
        self.assertNotIn('onerror', cleaned)
        self.assertNotIn('javascript:', cleaned)
        self.assertIn('https://example.test/job', cleaned)
        self.assertIn('noopener noreferrer', cleaned)

    def test_lever_keeps_additional_content_and_source_list_titles(self):
        raw = lever_html({'description': '<p>Intro</p>', 'lists': [{'text': 'Employer heading', 'content': '<ul><li>Python</li></ul>'}], 'additional': '<p>Closing paragraph</p>'})
        sections = group_by_headings(clean_html(raw))
        self.assertEqual(sections[1]['title'], 'Employer heading')
        self.assertIn('Closing paragraph', sections[1]['html'])

    def test_actual_source_fixtures_preserve_all_sanitized_text(self):
        fixtures = list((Path(__file__).parent / 'fixtures' / 'job_html').glob('*.html'))
        self.assertTrue(fixtures, 'Actual employer fixtures must be captured with the backfill.')
        for fixture in fixtures:
            with self.subTest(source=fixture.name):
                cleaned = clean_html(fixture.read_text())
                sections = group_by_headings(cleaned)
                original = BeautifulSoup(cleaned, 'html.parser').get_text(' ', strip=True).replace(':', '').split()
                rendered = ' '.join((s['title'] or '') + ' ' + BeautifulSoup(s['html'], 'html.parser').get_text(' ', strip=True) for s in sections).replace(':', '').split()
                self.assertEqual(rendered, original)
