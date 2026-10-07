import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import db
import app as api
from job_metadata import rank_similar_jobs, extract_work_type

class DetailConsistencyTests(unittest.TestCase):
    def test_undo_skill_dismissal_accepts_empty_json_object(self):
        with patch.object(db, 'restore_resume_skill', return_value=True) as restore, patch.object(api, 'JWT_SECRET', 'test-only-secret-at-least-32-characters'):
            response = api.app.test_client().post('/api/resume/skills/9/restore', json={}, headers={'Authorization': 'Bearer ' + api.create_token(7)})
        self.assertEqual(response.status_code, 200)
        restore.assert_called_once_with(7, 9)

    def test_market_projection_uses_the_same_weighted_summary_as_ring(self):
        connection = MagicMock()
        connection.cursor.return_value.fetchall.return_value = [
            {'skill_name': 'python', 'demand_count': 2},
            {'skill_name': 'sql', 'demand_count': 1},
            {'skill_name': 'react', 'demand_count': 6},
        ]
        with patch.object(db, 'get_connection') as context, patch.object(db, 'get_user_skills', return_value=['python']):
            context.return_value.__enter__.return_value = connection
            current = db.get_student_skill_gap_summary(7)
            projected = db.get_student_skill_gap_summary(7, profile_override=['python', 'sql'])
        self.assertEqual(current['overall_match_pct'], 22)
        self.assertEqual(projected['overall_match_pct'], 33)
        self.assertEqual([row['skill_name'] for row in projected['missing_skills']], ['react'])

    def test_card_detail_and_gap_use_identical_alternative_requirements(self):
        html = '<h2>Requirements</h2><p>Python required</p><p>React or TypeScript required</p><p>Observability required</p>'
        job = {'job_id': 1, 'skills': [{'skill_name': s, 'requirement_type': 'required'} for s in ['python', 'react', 'typescript', 'observability']]}
        connection = MagicMock()
        connection.cursor.return_value.fetchall.return_value = [{'job_id': 1, 'skill_name': s['skill_name'], 'description_html': html} for s in job['skills']]
        with patch.object(db, 'get_saved_resume', return_value={'skills': ['python', 'react']}), patch.object(db, 'get_connection') as context, patch.object(db, 'get_job_by_id', return_value=job), patch.object(db, 'get_flagged_skills', return_value=[]), patch.object(api, 'JWT_SECRET', 'test-only-secret-at-least-32-characters'):
            context.return_value.__enter__.return_value = connection
            card = db.add_resume_matches(7, [job])[0]
            client = api.app.test_client()
            headers = {'Authorization': 'Bearer ' + api.create_token(7)}
            detail = client.get('/api/jobs/1', headers=headers).json
            gap = client.get('/api/students/7/skill-gap?job_id=1', headers=headers).json
        for result in [card, detail, gap]:
            self.assertEqual(result['resume_match_pct'], 67)
            self.assertEqual(result['resume_required_count'], 3)
            self.assertEqual(result['resume_matched_count'], 2)
            self.assertEqual(result['resume_requirement_groups'], card['resume_requirement_groups'])
        self.assertEqual(gap['match_pct'], 67)
        self.assertEqual(gap['missing'], ['observability'])

    def test_similar_jobs_exclude_zero_matches_and_rank_shared_requirements(self):
        def job(id, skills, match):
            return {'job_id': id, 'resume_requirement_groups': [{'skills': skills}], 'resume_match_pct': match}
        target = job(1, ['python', 'react'], 67)
        candidates = [target, job(2, ['python'], 0), job(3, ['java'], 100), job(4, ['python', 'sql', 'java'], 80), job(5, ['python', 'react'], 50)]
        self.assertEqual([j['job_id'] for j in rank_similar_jobs(target, candidates)], [5, 4])

    def test_similar_endpoint_uses_authenticated_user_and_returns_three(self):
        target = {'job_id': 1, 'resume_requirement_groups': [{'skills': ['python']}], 'resume_match_pct': 67}
        candidates = [{**target, 'job_id': id, 'resume_match_pct': score} for id, score in [(2, 0), (3, 50), (4, 80), (5, 100), (6, 60)]]
        with patch.object(db, 'get_job_by_id', return_value=target), patch.object(db, 'get_jobs', return_value=candidates), patch.object(db, 'add_resume_matches', side_effect=lambda user, jobs: jobs) as matching, patch.object(api, 'JWT_SECRET', 'test-only-secret-at-least-32-characters'):
            headers = {'Authorization': 'Bearer ' + api.create_token(7)}
            response = api.app.test_client().get('/api/jobs/1/similar', headers=headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json['total'], 4)
            self.assertEqual([job['job_id'] for job in response.json['jobs']], [5, 4, 6])
            self.assertTrue(all(call.args[0] == 7 for call in matching.call_args_list))

    def test_work_arrangement_requires_explicit_role_language(self):
        self.assertEqual(extract_work_type('This is a hybrid role with 2 days remote.'), 'Hybrid')
        self.assertEqual(extract_work_type('This position is fully remote.'), 'Remote')
        self.assertIsNone(extract_work_type('Build hybrid cloud systems.'))
        self.assertIsNone(extract_work_type(''))
