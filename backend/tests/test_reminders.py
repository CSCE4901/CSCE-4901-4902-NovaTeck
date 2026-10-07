import sys
import unittest
from pathlib import Path
from datetime import date
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from reminders import build_reminders
import app as api

class ReminderTests(unittest.TestCase):
    def test_deadlines_followups_and_exclusions(self):
        saved = [{'job_id': n, 'title': 'Engineer', 'closing_date': due} for n, due in [(1,'2026-10-06'),(2,'2026-10-13'),(3,'2026-10-14'),(4,'2026-10-05'),(5,None)]]
        apps = [{'job_id':2,'title':'Engineer','status':'Applied','updated_at':'2026-09-20'}, {'job_id':6,'title':'Engineer','status':'Closed','updated_at':'2026-09-20'}, {'job_id':7,'title':'Engineer','status':'Opened employer site','updated_at':'2026-09-20'}]
        alerts=build_reminders(saved, apps, date(2026,10,6))
        self.assertEqual({row['id'] for row in alerts}, {'deadline-1','followup-2'})
        self.assertTrue(alerts[0]['overdue'])
        self.assertEqual(alerts[1]['message'], 'Deadline today')

    def test_owner_only(self):
        with patch.object(api,'JWT_SECRET','test-only-secret-at-least-32-characters'):
            client=api.app.test_client()
            for path in ['reminders','reminder-preferences']:
                self.assertEqual(client.get(f'/api/students/8/{path}', headers={'Authorization':'Bearer '+api.create_token(7)}).status_code,403)

    def test_email_worker_is_disabled(self):
        import reminder_worker as worker
        with patch('smtplib.SMTP') as smtp:
            worker.run()
        smtp.assert_not_called()
