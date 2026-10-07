import sys
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
from datetime import date
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import job_alerts as alerts

class JobAlertTests(unittest.TestCase):
    def test_salary_preferences(self):
        self.assertTrue(alerts.salary_matches({'salary_range':'$80,000 – $100,000'}, '$80,000–$99,999 / year'))
        self.assertFalse(alerts.salary_matches({'salary_range':None}, '$120,000+ / year'))
        self.assertFalse(alerts.salary_matches({'salary_range':'$40 / hour'}, '$80,000–$99,999 / year'))

    def test_new_jobs_use_profile_and_preferences(self):
        jobs=[{'job_id':1,'title':'Engineer','date_posted':'2026-10-05','resume_match_pct':67,'resume_required_count':3}, {'job_id':2,'title':'Old','date_posted':'2026-01-01'}, {'job_id':3,'title':'Thin','date_posted':'2026-10-05','resume_match_pct':100,'resume_required_count':1}]
        conn=MagicMock();conn.cursor.return_value.fetchall.return_value=[]
        with patch.object(alerts.db,'get_profile_details',return_value={'career_focus':'software','preferred_location':'Dallas, TX','work_types':['Full-time']}), patch.object(alerts.db,'get_user_skills',return_value=['python']), patch.object(alerts.db,'get_saved_jobs',return_value=[]), patch.object(alerts.db,'get_connection') as context, patch.object(alerts.db,'get_jobs',return_value=jobs) as get_jobs, patch.object(alerts.db,'add_resume_matches',side_effect=lambda user,rows,**kwargs: rows) as matching:
            context.return_value.__enter__.return_value=conn
            result=alerts.matching_new_jobs(7,date(2026,10,6))
        self.assertEqual([row['job_id'] for row in result],[1])
        self.assertEqual(get_jobs.call_args.kwargs['location'],'Dallas')
        self.assertEqual(matching.call_args.kwargs['profile_override'],['python'])
