import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app as api

class SupportTests(unittest.TestCase):
    def setUp(self):
        self.client = api.app.test_client()
        self.secret = patch.object(api, 'JWT_SECRET', 'support-test-only-key-at-least-32-characters')
        self.secret.start()
        self.headers = {'Authorization': 'Bearer ' + api.create_token(7)}
    def tearDown(self):
        self.secret.stop()
    def test_requires_authentication(self):
        self.assertEqual(self.client.post('/api/support', json={}).status_code, 401)
    def test_rejects_empty_or_excessive_messages(self):
        with patch.object(api.db, 'create_support_request') as create:
            for body in [{}, {'subject': ' ', 'message': 'hello'}, {'subject': 'a', 'message': 'x' * 3001}]:
                self.assertEqual(self.client.post('/api/support', json=body, headers=self.headers).status_code, 400)
            create.assert_not_called()
    def test_saves_as_authenticated_user(self):
        with patch.object(api.db, 'create_support_request', return_value=12) as create:
            result = self.client.post('/api/support', json={'subject': ' Help ', 'message': ' Problem ', 'user_id': 999}, headers=self.headers)
            self.assertEqual(result.status_code, 201)
            create.assert_called_once_with(7, 'Help', 'Problem')
    def test_regular_users_cannot_read_or_update_inbox(self):
        with patch.object(api.db, 'get_user_by_id', return_value={'role': 'student'}):
            self.assertEqual(self.client.get('/api/admin/support', headers=self.headers).status_code, 403)
            self.assertEqual(self.client.patch('/api/admin/support/12', json={'status': 'Resolved'}, headers=self.headers).status_code, 403)
    def test_users_only_load_their_own_requests(self):
        with patch.object(api.db, 'support_threads', return_value=[]) as threads:
            response = self.client.get('/api/support?user_id=999', headers=self.headers)
            self.assertEqual(response.status_code, 200)
            threads.assert_called_once_with(7)
    def test_only_admins_can_reply(self):
        with patch.object(api.db, 'get_user_by_id', return_value={'role': 'student'}), patch.object(api.db, 'reply_to_support') as reply:
            self.assertEqual(self.client.post('/api/admin/support/12/replies', json={'message': 'hello'}, headers=self.headers).status_code, 403)
            reply.assert_not_called()
    def test_admin_reply_validates_and_uses_authenticated_identity(self):
        with patch.object(api.db, 'get_user_by_id', return_value={'role': 'admin'}), patch.object(api.db, 'reply_to_support', return_value=True) as reply:
            self.assertEqual(self.client.post('/api/admin/support/12/replies', json={'message': ' '}, headers=self.headers).status_code, 400)
            response = self.client.post('/api/admin/support/12/replies', json={'message': ' Fixed ', 'admin_id': 999}, headers=self.headers)
            self.assertEqual(response.status_code, 201)
            reply.assert_called_once_with(12, 7, 'Fixed')
