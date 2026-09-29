import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from nlp_tagger import tag_skills_for_job
from job_metadata import extract_experience


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

    def test_missing_experience_is_not_invented(self):
        self.assertIsNone(extract_experience('Senior engineer. Founded 7 years ago.'))
        self.assertIn('3+ years', extract_experience('Requires 3+ years of Python experience.'))

if __name__ == '__main__':
    unittest.main()
