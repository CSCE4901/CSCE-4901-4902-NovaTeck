import sys
import unittest
from unittest.mock import patch
from mysql.connector import Error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import app
from urllib.parse import parse_qs, urlsplit


class AuthValidationTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_register_rejects_malformed_email_before_database_access(self):
        response = self.client.post("/api/auth/register", json={
            "name": "Example Student", "email": "not-an-email", "password": "password123"
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "Enter a valid email address")

    def test_login_rejects_malformed_email_before_database_access(self):
        response = self.client.post("/api/auth/login", json={
            "email": "not-an-email", "password": "password123"
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "Enter a valid email address")

    def test_register_rejects_password_without_required_strength(self):
        response = self.client.post("/api/auth/register", json={
            "name": "Example Student", "email": "example@student.test", "password": "password123"
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("uppercase", response.get_json()["error"])

    def test_password_reset_request_rejects_malformed_email(self):
        response = self.client.post("/api/auth/password-reset/request", json={"email": "not-an-email"})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "Enter a valid email address")

    def test_job_endpoints_require_authentication(self):
        response = self.client.get("/api/jobs")
        self.assertEqual(response.status_code, 401)

    def test_database_outage_is_not_reported_as_invalid_credentials(self):
        with patch('db.get_connection', side_effect=Error('private connection details')):
            response = self.client.post('/api/auth/login', json={
                'email': 'student@example.test', 'password': 'ExamplePass12'
            })
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json['error'], 'Service temporarily unavailable. Please try again.')
        self.assertNotIn('private', response.get_data(as_text=True))

    def verification_token(self, email):
        with patch("app.deliver_auth_email", return_value=True) as deliver:
            response = self.client.post("/api/auth/register/request", json={"email": email})
        self.assertEqual(response.status_code, 200)
        link = deliver.call_args.args[2].split()[-1]
        return parse_qs(urlsplit(link).fragment)["registrationToken"][0]

    def test_registration_requires_proof_for_the_same_address(self):
        email = "student@example.test"
        data = {"name": "Student", "email": email, "password": "ExamplePass12"}
        with patch("db.insert_user", return_value=7) as insert:
            self.assertEqual(self.client.post("/api/auth/register", json=data).status_code, 400)
            token = self.verification_token(email)
            self.assertEqual(self.client.post("/api/auth/register", json={
                **data, "email": "other@example.test", "verification_token": token,
            }).status_code, 400)
            insert.assert_not_called()
            result = self.client.post("/api/auth/register", json={**data, "verification_token": token})
            self.assertEqual(result.status_code, 201)
            insert.assert_called_once()

    def test_registration_database_outage_is_not_reported_as_duplicate_email(self):
        email = "student@example.test"
        token = self.verification_token(email)
        with patch('db.get_connection', side_effect=Error('database offline')):
            response = self.client.post('/api/auth/register', json={
                'name': 'Student', 'email': email, 'password': 'ExamplePass12',
                'verification_token': token,
            })
        self.assertEqual(response.status_code, 503)

    def test_unknown_account_still_returns_invalid_credentials(self):
        with patch('db.get_user_by_email', return_value=None):
            response = self.client.post('/api/auth/login', json={
                'email': 'student@example.test', 'password': 'ExamplePass12'
            })
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
