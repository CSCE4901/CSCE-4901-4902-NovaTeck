import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import app


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


if __name__ == "__main__":
    unittest.main()
