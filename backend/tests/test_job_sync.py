import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from job_sync import SyncSettings, format_salary, is_tech_job, lever_description, normalize_listing, parse_posted_date


class JobSyncNormalizationTests(unittest.TestCase):
    def test_normalizes_a_provider_listing(self):
        job = normalize_listing({
            "redirect_url": "https://example.test/jobs/123",
            "title": "<b>Software Engineer</b>",
            "company": {"display_name": "Example &amp; Co."},
            "description": "Build <em>safe</em> systems.",
            "location": {"display_name": "Dallas, TX"},
            "contract_type": "full_time",
            "salary_min": 100000,
            "salary_max": 120000,
            "created": "2026-09-01T10:30:00Z",
        })
        self.assertEqual("Software Engineer", job["title"])
        self.assertEqual("Example & Co.", job["company_name"])
        self.assertEqual("Full Time", job["job_type"])
        self.assertEqual("$100,000 - $120,000", job["salary_range"])
        self.assertEqual("2026-09-01", job["date_posted"])

    def test_rejects_a_listing_without_identity(self):
        self.assertIsNone(normalize_listing({"title": "Engineer"}))

    def test_date_and_salary_handles_provider_gaps(self):
        self.assertIsNone(parse_posted_date("not-a-date"))
        self.assertEqual("$80,000", format_salary({"salary_min": 80000}))

    def test_company_feeds_do_not_need_adzuna_credentials(self):
        with patch.dict("os.environ", {"ADZUNA_APP_ID": "", "ADZUNA_APP_KEY": ""}, clear=False):
            self.assertEqual(SyncSettings.from_environment().app_id, "")
            with self.assertRaises(ValueError):
                SyncSettings.from_environment(require_adzuna=True)

    def test_technology_role_policy_rejects_general_company_roles(self):
        self.assertTrue(is_tech_job("Senior Software Engineer"))
        self.assertTrue(is_tech_job("Data Analyst"))
        self.assertFalse(is_tech_job("Technician III, Production"))
        self.assertFalse(is_tech_job("Associate Inventory Administrator"))

    def test_lever_description_preserves_requirement_lists(self):
        description = lever_description({
            "descriptionPlain": "Build reliable services.",
            "lists": [{"text": "Required Qualifications", "content": "Python and SQL"}],
        })
        self.assertIn("Build reliable services.", description)
        self.assertIn("Required Qualifications: Python and SQL", description)


if __name__ == "__main__":
    unittest.main()
