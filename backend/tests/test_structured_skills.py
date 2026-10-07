import unittest
from pathlib import Path
from nlp_tagger import analyze_job_skills

FIXTURES = Path(__file__).parent / 'fixtures' / 'job_html'

class StructuredSkillTests(unittest.TestCase):
    def analyze(self, identity):
        return analyze_job_skills('', (FIXTURES / f'coreweave-{identity}.html').read_text())

    def test_real_senior_qualifications_preserve_required_and_preferred(self):
        result = self.analyze(4712385006)
        tags = {tag['skill_name']: tag['requirement_type'] for tag in result['skills']}
        for skill in ['sql', 'docker', 'ci/cd', 'helm', 'spark', 'kafka', 'observability']:
            self.assertEqual(tags[skill], 'required')
        self.assertEqual(tags['langgraph'], 'preferred')
        self.assertNotIn('hardware', tags)
        self.assertIn(['next.js', 'react'], result['required_groups'])

    def test_real_junior_stack_does_not_override_preferred_qualifications(self):
        result = self.analyze(4712428006)
        tags = {tag['skill_name']: tag['requirement_type'] for tag in result['skills']}
        self.assertEqual(tags['kubernetes'], 'preferred')
        self.assertEqual(tags['python'], 'preferred')
        self.assertEqual(tags['sql'], 'required')
        self.assertEqual(tags['typescript'], 'required')
        self.assertIn(['javascript', 'typescript'], result['required_groups'])
        self.assertIn(['next.js', 'react'], result['required_groups'])

    def test_unknown_headings_use_text_fallback_without_dropping_skills(self):
        result = analyze_job_skills('Python required.', '<p>Python required.</p>')
        self.assertEqual(result['source'], 'text_fallback')
        self.assertEqual(result['required_groups'], [['python']])

    def test_either_option_is_one_group_but_and_is_two(self):
        html = '<h2>Requirements</h2><ul><li>React or Angular</li><li>SQL and Python</li></ul>'
        result = analyze_job_skills('', html)
        self.assertEqual(result['required_groups'], [['angular', 'react'], ['python'], ['sql']])

    def test_real_broken_cards_keep_qualification_skills(self):
        for identity, expected in [(284, 'c#'), (279, 'java'), (270, 'react'), (260, 'typescript')]:
            result = analyze_job_skills('', (FIXTURES / f'job-{identity}.html').read_text())
            tags = {tag['skill_name']: tag['requirement_type'] for tag in result['skills']}
            with self.subTest(job=identity):
                self.assertEqual(result['source'], 'qualification_html')
                self.assertGreater(len(result['required_groups']), 0)
                self.assertIn(expected, tags)

    def test_nested_qualifications_stop_before_same_level_benefits(self):
        html = '<h3>Required Skills &amp; Experience</h3><h4>Core Engineering</h4><ul><li>Python required</li></ul><h3>Benefits</h3><p>We offer Java training.</p>'
        result = analyze_job_skills('', html)
        self.assertEqual(result['required_groups'], [['python']])
        self.assertNotIn('java', [tag['skill_name'] for tag in result['skills']])
