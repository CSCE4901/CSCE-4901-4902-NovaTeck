import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import app as api

class HomeContentTests(unittest.TestCase):
    def test_live_stats_and_fresh_student_roles(self):
        jobs=[{'job_id':n,'company_id':n%2,'title':title,'location':location,'date_posted':posted} for n,title,location,posted in [(1,'Software Intern','Dallas, TX','2026-10-01'),(2,'Junior Engineer','Plano, TX','2026-10-05'),(3,'Senior Engineer','Dallas, TX','2026-10-06'),(4,'Intern','Boston, MA','2026-10-06')]]
        with patch.object(api.db,'get_jobs',return_value=jobs),patch.object(api.db,'add_resume_matches',side_effect=lambda user,rows:rows),patch.object(api,'JWT_SECRET','test-only-secret-at-least-32-characters'):
            response=api.app.test_client().get('/api/home',headers={'Authorization':'Bearer '+api.create_token(7)})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json['stats'],{'jobs':3,'companies':2,'internships':1})
        self.assertEqual([job['job_id'] for job in response.json['student_jobs']],[2,1])
