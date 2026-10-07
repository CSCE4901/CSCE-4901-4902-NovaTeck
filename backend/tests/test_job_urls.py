import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from job_metadata import canonical_job_url


class JobUrlTests(unittest.TestCase):
    def test_tracking_variants_have_one_identity(self):
        self.assertEqual(canonical_job_url('https://example.test/jobs?id=42&utm_source=email&gclid=abc#apply'),
                         'https://example.test/jobs?id=42#apply')

    def test_distinct_jobs_and_functional_parameters_are_preserved(self):
        url = 'https://example.test/jobs?id=43&source=careers&ref=abc'
        self.assertEqual(canonical_job_url(url), url)
        self.assertNotEqual(canonical_job_url(url), canonical_job_url(url.replace('43', '42')))

    def test_untracked_signed_url_is_unchanged(self):
        url = 'https://example.test/jobs?signature=a%20b&job=42'
        self.assertEqual(canonical_job_url(url), url)
