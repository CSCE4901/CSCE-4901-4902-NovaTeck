import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from nlp_tagger import tag_skills_for_job
from job_metadata import extract_experience, extract_salary, with_salary, experience_summary


class AcceptanceDefectTests(unittest.TestCase):
    def tags(self, text):
        return {x['skill_name']: x['requirement_type'] for x in tag_skills_for_job(text)}

    def test_preferred_sentence_inside_required_paragraph(self):
        text = ('Required qualifications: Typically requires a minimum of 7 years of related experience '
                'with a Bachelor’s degree; or 6 years and a Master’s degree; or 4 years with a PhD; '
                'or equivalent work experience. Powershell, Ansible and Python are nice to have. '
                'Must have top secret clearance. Linux required.')
        self.assertEqual(self.tags(text), {'python': 'preferred', 'linux': 'required'})
        self.assertIn('7 years', extract_experience(text))
        self.assertIn('4 years with a PhD', extract_experience(text))

    def test_local_preference_does_not_change_following_section(self):
        self.assertEqual(self.tags('Required skills:\nPython is nice to have.\nSQL'),
                         {'python': 'preferred', 'sql': 'required'})

    def test_preferred_section_and_required_override(self):
        self.assertEqual(self.tags('Preferred skills:\nNode.js and React\nPython required'),
                         {'python': 'required', 'react': 'preferred', 'node.js': 'preferred'})

    def test_encoded_legacy_description_does_not_become_experience_summary(self):
        text = 'Lantern is seeking a Senior Data Scientist.&amp;nbsp; Build AI systems.&amp;nbsp; Qualifications 5+ years of relevant experience.'
        self.assertEqual(extract_experience(text), 'Qualifications 5+ years of relevant experience.')
        text = 'Company introduction ' * 50 + '5+ years of relevant experience'
        self.assertEqual(extract_experience(text), '5+ years of relevant experience')

    def test_salary_range_in_employer_description(self):
        self.assertEqual(extract_salary('US Salary Range $146,000 — $220,000 USD The salary range is an estimate.'), '$146,000 – $220,000 USD')
        self.assertEqual(extract_salary('Pay range: $25.50 - $35.00 per hour'), '$25.50 – $35.00 per hour')
        self.assertIsNone(extract_salary('Benefits include $1,000 - $2,000 relocation assistance.'))
        self.assertEqual(with_salary({'salary_range': '$100,000', 'description': 'Salary range $146,000 - $220,000'})['salary_range'], '$100,000')
        self.assertEqual(with_salary({'description': 'US Salary Range $146,000 — $220,000 USD'})['salary_range'], '$146,000 – $220,000 USD')

    def test_overview_experience_is_concise(self):
        self.assertEqual(experience_summary('Who You Are: 2+ years building production software, or equivalent depth from internships. Working SQL.'), '2+ years')
        self.assertEqual(experience_summary('Requires 3–5 years of experience.'), '3–5 years')
        self.assertEqual(experience_summary('Senior'), 'Senior')
        self.assertIsNone(experience_summary('Long employer qualifications without stated years.'))

    def test_missing_experience_is_not_invented(self):
        self.assertIsNone(extract_experience('Senior engineer. Founded 7 years ago.'))
        self.assertIn('3+ years', extract_experience('Requires 3+ years of Python experience.'))

if __name__ == '__main__':
    unittest.main()
