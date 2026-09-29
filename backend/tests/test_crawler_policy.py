import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from job_sync import PublicCompanyFeeds
from nlp_tagger import tag_skills_for_job


class CrawlerPolicyTests(unittest.TestCase):
    def test_denied_policy_prevents_feed_request(self):
        session = Mock(); session.headers = {}
        session.get.return_value = Mock(status_code=200, text='User-agent: *\nDisallow: /')
        feed = PublicCompanyFeeds([], session)
        with self.assertRaises(requests.RequestException): feed._get_json('https://example.test/jobs')
        self.assertEqual(session.get.call_count, 1)

    def test_unavailable_policy_fails_closed(self):
        session = Mock(); session.headers = {}
        session.get.return_value = Mock(status_code=503)
        with self.assertRaises(requests.RequestException): PublicCompanyFeeds([], session)._get_json('https://example.test/jobs')
        self.assertEqual(session.get.call_count, 1)

    def test_allow_policy_obeys_delay_and_does_not_follow_redirects(self):
        session = Mock(); session.headers = {}
        session.get.side_effect = [Mock(status_code=200, text='User-agent: *\nAllow: /\nCrawl-delay: 2'), Mock(status_code=302)]
        with patch('job_sync.time.sleep') as sleep:
            with self.assertRaises(requests.RequestException): PublicCompanyFeeds([], session)._get_json('https://example.test/jobs')
        self.assertGreater(sleep.call_args.args[0], 1)
        self.assertFalse(session.get.call_args.kwargs['allow_redirects'])

    def test_shared_nlp_preserves_punctuation_and_requirement_tags(self):
        tags = {item['skill_name']: item['requirement_type'] for item in tag_skills_for_job('Required Skills\nPython, C++, Node.js and CI/CD\nPreferred Skills\nRust and AWS')}
        self.assertEqual(tags['c++'], 'required')
        self.assertEqual(tags['node.js'], 'required')
        self.assertEqual(tags['ci/cd'], 'required')
        self.assertEqual(tags['rust'], 'preferred')
        self.assertEqual(tags['aws'], 'preferred')


if __name__ == '__main__': unittest.main()
