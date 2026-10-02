"""Per-job resume percentages use saved detected skills, not profile skills."""
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import db


class ResumeMatchTests(unittest.TestCase):
    def test_no_resume_uses_profile_skills(self):
        connection = MagicMock()
        connection.cursor.return_value.fetchall.return_value = [
            {'job_id': 1, 'skill_name': 'Python'}, {'job_id': 1, 'skill_name': 'SQL'}]
        with patch.object(db, 'get_saved_resume', return_value=None), patch.object(db, 'get_user_skills', return_value=['Python']), patch.object(db, 'get_connection') as context:
            context.return_value.__enter__.return_value = connection
            result = db.add_resume_matches(7, [{'job_id': 1}])
        self.assertEqual(result[0]['resume_match_pct'], 50)
        self.assertEqual(result[0]['resume_match_source'], 'profile')

    def test_batch_matches_distinct_required_skills_and_handles_missing_requirements(self):
        connection = MagicMock()
        cursor = connection.cursor.return_value
        cursor.fetchall.return_value = [
            {'job_id': 1, 'skill_name': 'Python'}, {'job_id': 1, 'skill_name': 'python'},
            {'job_id': 1, 'skill_name': 'SQL'}, {'job_id': 1, 'skill_name': 'Git'},
            {'job_id': 2, 'skill_name': 'Java'},
        ]
        jobs = [{'job_id': 1}, {'job_id': 2}, {'job_id': 3}]
        with patch.object(db, 'get_saved_resume', return_value={'skills': [' PYTHON ', 'SQL']}), patch.object(db, 'get_connection') as context:
            context.return_value.__enter__.return_value = connection
            result = db.add_resume_matches(7, jobs)
        self.assertEqual([job['resume_match_pct'] for job in result], [67, 0, None])
        self.assertEqual(result[0]['resume_matched_count'], 2)
        self.assertEqual(result[0]['resume_matched_skills'], ['python', 'sql'])
        self.assertEqual(result[0]['resume_missing_skills'], ['git'])
        self.assertEqual(result[0]['resume_required_count'], 3)
        self.assertEqual(result[2]['resume_match_status'], 'no_requirements')
        self.assertNotIn('resume_match_pct', jobs[0])
        cursor.execute.assert_called_once()
        self.assertIn("requirement_type = 'required'", cursor.execute.call_args.args[0])
        self.assertEqual(cursor.execute.call_args.args[1], [1, 2, 3])

    def test_empty_page_skips_all_queries(self):
        with patch.object(db, 'get_saved_resume') as saved:
            self.assertEqual(db.add_resume_matches(7, []), [])
        saved.assert_not_called()

    def test_saved_resume_with_no_detected_skills_is_a_real_zero(self):
        connection = MagicMock()
        connection.cursor.return_value.fetchall.return_value = [{'job_id': 1, 'skill_name': 'SQL'}]
        with patch.object(db, 'get_saved_resume', return_value={'skills': []}), patch.object(db, 'get_connection') as context:
            context.return_value.__enter__.return_value = connection
            result = db.add_resume_matches(7, [{'job_id': 1}])
        self.assertEqual(result[0]['resume_match_pct'], 0)
        self.assertEqual(result[0]['resume_match_status'], 'ready')
