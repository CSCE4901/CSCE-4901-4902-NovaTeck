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

    def test_sample_job_qualifications_extraction(self):
        html = """
        <h2>Required qualifications</h2>
        <ul>
            <li>5+ years of experience in full-stack application development with proven ownership of deployed solutions.</li>
            <li>Hands-on experience designing and building React application and TypeScipt/Javascript based backend (API)</li>
            <li>Strong skills in data modeling, working with large datasets, and building analytical workflows.</li>
            <li>Solid foundation in software design, testing, and documentation.</li>
            <li>Ability to deliver complex projects independently while collaborating effectively across teams.</li>
        </ul>
        <h2>Preferred qualifications</h2>
        <ul>
            <li>Familiarity with Palantir Foundry (ontology, pipelines, APIs, visualization) or other large-scale data platforms.</li>
            <li>Hands-on experience designing and operating Python data-processing pipelines</li>
            <li>Experience building software for manufacturing, supply chain or aircraft maintenance.</li>
            <li>Familiarity with modern software delivery practices (version control, testing, CI/CD).</li>
        </ul>
        """
        result = analyze_job_skills('', html)
        self.assertEqual(result['source'], 'qualification_html')
        tags = {tag['skill_name']: tag['requirement_type'] for tag in result['skills']}

        for skill in ['full-stack', 'react', 'javascript', 'api', 'data modeling', 'software design', 'testing', 'documentation']:
            self.assertEqual(tags.get(skill), 'required', f"Expected {skill} to be required")
        self.assertNotIn('typescript', tags)

        for skill in ['python', 'version control', 'ci/cd', 'palantir foundry', 'data visualization']:
            self.assertEqual(tags.get(skill), 'preferred', f"Expected {skill} to be preferred")
        self.assertNotIn('data pipelines', tags)

        self.assertIn(['javascript'], result['required_groups'])

    def test_sample_job_plain_text_fallback(self):
        plain_text = """
5+ years of experience in full-stack application development with proven ownership of deployed solutions. 
Hands-on experience designing and building React application and TypeScipt/Javascript based backend (API)
Strong skills in data modeling, working with large datasets, and building analytical workflows. 
Solid foundation in software design, testing, and documentation. 
Ability to deliver complex projects independently while collaborating effectively across teams.
        """
        result = analyze_job_skills(plain_text, None)
        self.assertEqual(result['source'], 'text_fallback')
        tags = {tag['skill_name']: tag['requirement_type'] for tag in result['skills']}
        for skill in ['full-stack', 'react', 'javascript', 'api', 'data modeling', 'software design', 'testing', 'documentation']:
            self.assertEqual(tags.get(skill), 'required', f"Expected {skill} to be required in plain text fallback")
        self.assertNotIn('typescript', tags)

    def test_overlap_and_or_grouping_html_path(self):
        cases = [
            ("<h2>Requirements</h2><ul><li>Experience with automated testing</li></ul>",
             [['automated testing', 'testing']]),
            ("<h2>Requirements</h2><ul><li>Experience with REST API development</li></ul>",
             [['api', 'api development', 'rest api']]),
            ("<h2>Requirements</h2><ul><li>Experience with software testing</li></ul>",
             [['testing']]),
            ("<h2>Requirements</h2><ul><li>backend (API)</li></ul>",
             [['api']]),
            ("<h2>Requirements</h2><ul><li>Experience with JavaScript/TypeScript</li></ul>",
             [['javascript', 'typescript']]),
        ]
        for html, expected_groups in cases:
            with self.subTest(html=html):
                res = analyze_job_skills('', html)
                self.assertEqual(res['required_groups'], expected_groups)

    def test_overlap_and_or_grouping_plain_text_path(self):
        cases = [
            ("Requirements:\n- Experience with automated testing",
             [['automated testing', 'testing']]),
            ("Requirements:\n- Experience with REST API development",
             [['api', 'api development', 'rest api']]),
            ("Requirements:\n- Experience with software testing",
             [['testing']]),
            ("Requirements:\n- backend (API)",
             [['api']]),
            ("Requirements:\n- Experience with JavaScript/TypeScript",
             [['javascript', 'typescript']]),
        ]
        for text, expected_groups in cases:
            with self.subTest(text=text):
                res = analyze_job_skills(text, None)
                self.assertEqual(res['source'], 'text_fallback')
                self.assertEqual(res['required_groups'], expected_groups)

    def test_plain_text_aliases_for_full_stack_and_apis(self):
        # Verify 'full stack' alias produces canonical 'full-stack' in text fallback
        res_fs = analyze_job_skills("Requirements:\n- 3+ years of full stack experience", None)
        self.assertIn('full-stack', [s['skill_name'] for s in res_fs['skills']])
        self.assertEqual(res_fs['required_groups'], [['full-stack']])

        # Verify 'APIs' alias produces canonical 'api' in text fallback
        res_api = analyze_job_skills("Requirements:\n- Experience building APIs", None)
        self.assertIn('api', [s['skill_name'] for s in res_api['skills']])
        self.assertEqual(res_api['required_groups'], [['api']])

    def test_software_cues_and_go_filtering_html_path(self):
        positives = [
            ("<h2>Required qualifications</h2><ul><li>software testing</li></ul>",
             'testing'),
            ("<h2>Required qualifications</h2><ul><li>Solid foundation in software design, testing, and documentation</li></ul>",
             'testing'),
            ("<h2>Required qualifications</h2><ul><li>Solid foundation in software design, testing, and documentation</li></ul>",
             'documentation'),
            ("<h2>Required qualifications</h2><ul><li>Node.js, Go, or Python</li></ul>",
             'go'),
        ]
        for html, expected_skill in positives:
            with self.subTest(pos=html, skill=expected_skill):
                res = analyze_job_skills('', html)
                skills = [s['skill_name'] for s in res['skills']]
                self.assertIn(expected_skill, skills)

        negatives = [
            ("<h2>Required qualifications</h2><ul><li>Plan and run design verification and certification testing</li></ul>",
             'testing'),
            ("<h2>Required qualifications</h2><ul><li>Conduct hands-on bring-up, lab testing, HIL testing, and flight test preparation</li></ul>",
             'testing'),
            ("<h2>Required qualifications</h2><ul><li>Develop and maintain revision-controlled product documentation</li></ul>",
             'documentation'),
            ("<h2>Required qualifications</h2><ul><li>Familiarity with go-to-market data</li></ul>",
             'go'),
            ("<h2>Required qualifications</h2><ul><li>Orchestrate business UAT, go-live readiness</li></ul>",
             'go'),
            ("<h2>Required qualifications</h2><ul><li>You can interpret system diagrams, APIs, integrations, data flows, migration approaches, and testing dependencies.</li></ul>",
             'testing'),
        ]
        for html, rejected_skill in negatives:
            with self.subTest(neg=html, rejected=rejected_skill):
                res = analyze_job_skills('', html)
                skills = [s['skill_name'] for s in res['skills']]
                self.assertNotIn(rejected_skill, skills)

    def test_software_cues_and_go_filtering_plain_text_path(self):
        positives = [
            ("Requirements:\n- software testing", 'testing'),
            ("Requirements:\n- Solid foundation in software design, testing, and documentation", 'testing'),
            ("Requirements:\n- Solid foundation in software design, testing, and documentation", 'documentation'),
            ("Requirements:\n- Node.js, Go, or Python", 'go'),
        ]
        for text, expected_skill in positives:
            with self.subTest(pos=text, skill=expected_skill):
                res = analyze_job_skills(text, None)
                self.assertEqual(res['source'], 'text_fallback')
                skills = [s['skill_name'] for s in res['skills']]
                self.assertIn(expected_skill, skills)

        negatives = [
            ("Requirements:\n- Plan and run design verification and certification testing", 'testing'),
            ("Requirements:\n- Conduct hands-on bring-up, lab testing, HIL testing, and flight test preparation", 'testing'),
            ("Requirements:\n- Develop and maintain revision-controlled product documentation", 'documentation'),
            ("Requirements:\n- Familiarity with go-to-market data", 'go'),
            ("Requirements:\n- Orchestrate business UAT, go-live readiness", 'go'),
            ("Requirements:\n- You can interpret system diagrams, APIs, integrations, data flows, migration approaches, and testing dependencies.", 'testing'),
        ]
        for text, rejected_skill in negatives:
            with self.subTest(neg=text, rejected=rejected_skill):
                res = analyze_job_skills(text, None)
                self.assertEqual(res['source'], 'text_fallback')
                skills = [s['skill_name'] for s in res['skills']]
                self.assertNotIn(rejected_skill, skills)

    def test_key_qualifications_job_246_structure(self):
        html = """
        <h3>Who You Are</h3>
        <ul>
            <li>Build user interfaces using React, TypeScript, and modern frontend frameworks.</li>
            <li>Follow established security, access control, deployment, and documentation practices.</li>
        </ul>
        <p><strong>Key Qualifications:</strong></p>
        <ul>
            <li>Working proficiency in programming languages such as TypeScript, Python, Go, Java, C#, or C++</li>
            <li>Solid understanding of programming fundamentals, data structures, debugging, and software testing.</li>
        </ul>
        <h3>Preferred:</h3>
        <ul><li>Docker</li></ul>
        """
        res = analyze_job_skills('', html)
        self.assertEqual(res['source'], 'qualification_html')
        tags = {s['skill_name']: s['requirement_type'] for s in res['skills']}
        self.assertEqual(tags.get('typescript'), 'required')
        self.assertEqual(tags.get('react'), 'required')
        self.assertEqual(tags.get('testing'), 'required')
        self.assertEqual(tags.get('python'), 'preferred')
        self.assertEqual(tags.get('go'), 'preferred')
        self.assertEqual(tags.get('docker'), 'preferred')

    def test_singleton_plus_or_list_html_path(self):
        html = """
        <h2>Required qualifications</h2>
        <ul>
            <li>Build UIs using React and TypeScript.</li>
            <li>Working proficiency in one or more programming languages such as TypeScript, Python, Go, Java, C#, or C++.</li>
        </ul>
        """
        res = analyze_job_skills('', html)
        tags = {s['skill_name']: s['requirement_type'] for s in res['skills']}
        self.assertEqual(tags.get('typescript'), 'required')
        self.assertEqual(tags.get('react'), 'required')
        for s in ['python', 'go', 'java', 'c#', 'c++']:
            self.assertEqual(tags.get(s), 'preferred')
        all_group_skills = set().union(*res['required_groups']) if res['required_groups'] else set()
        for s in ['python', 'go', 'java', 'c#', 'c++']:
            self.assertNotIn(s, all_group_skills)
        self.assertIn(['react'], res['required_groups'])
        self.assertIn(['typescript'], res['required_groups'])

    def test_singleton_plus_or_list_plain_text_path(self):
        text = """Requirements:
- Build UIs using React and TypeScript.
- Working proficiency in one or more programming languages such as TypeScript, Python, Go, Java, C#, or C++.
"""
        res = analyze_job_skills(text, None)
        self.assertEqual(res['source'], 'text_fallback')
        tags = {s['skill_name']: s['requirement_type'] for s in res['skills']}
        self.assertEqual(tags.get('typescript'), 'required')
        self.assertEqual(tags.get('react'), 'required')
        for s in ['python', 'go', 'java', 'c#', 'c++']:
            self.assertEqual(tags.get(s), 'preferred')
        all_group_skills = set().union(*res['required_groups']) if res['required_groups'] else set()
        for s in ['python', 'go', 'java', 'c#', 'c++']:
            self.assertNotIn(s, all_group_skills)
        self.assertIn(['react'], res['required_groups'])
        self.assertIn(['typescript'], res['required_groups'])

    def test_or_list_no_singleton_html_path(self):
        html = "<h2>Required qualifications</h2><ul><li>Experience with Python, Go, or Java.</li></ul>"
        res = analyze_job_skills('', html)
        tags = {s['skill_name']: s['requirement_type'] for s in res['skills']}
        self.assertEqual(tags.get('python'), 'required')
        self.assertEqual(tags.get('go'), 'required')
        self.assertEqual(tags.get('java'), 'required')
        self.assertEqual(res['required_groups'], [['go', 'java', 'python']])

    def test_or_list_no_singleton_plain_text_path(self):
        text = "Requirements:\n- Experience with Python, Go, or Java."
        res = analyze_job_skills(text, None)
        self.assertEqual(res['source'], 'text_fallback')
        tags = {s['skill_name']: s['requirement_type'] for s in res['skills']}
        self.assertEqual(tags.get('python'), 'required')
        self.assertEqual(tags.get('go'), 'required')
        self.assertEqual(tags.get('java'), 'required')
        self.assertEqual(res['required_groups'], [['go', 'java', 'python']])

    def test_frameworks_with_singleton_html_path(self):
        html = """
        <h2>Required qualifications</h2>
        <ul>
            <li>Experience building user interfaces with React.</li>
            <li>Experience building web applications or backend services using frameworks such as React, Next.js, Node.js, or FastAPI.</li>
        </ul>
        """
        res = analyze_job_skills('', html)
        tags = {s['skill_name']: s['requirement_type'] for s in res['skills']}
        self.assertEqual(tags.get('react'), 'required')
        self.assertEqual(tags.get('next.js'), 'preferred')
        self.assertEqual(tags.get('node.js'), 'preferred')
        self.assertEqual(tags.get('fastapi'), 'preferred')
        self.assertEqual(res['required_groups'], [['react']])

    def test_frameworks_with_singleton_plain_text_path(self):
        text = """Requirements:
- Experience building user interfaces with React.
- Experience building web applications or backend services using frameworks such as React, Next.js, Node.js, or FastAPI.
"""
        res = analyze_job_skills(text, None)
        self.assertEqual(res['source'], 'text_fallback')
        tags = {s['skill_name']: s['requirement_type'] for s in res['skills']}
        self.assertEqual(tags.get('react'), 'required')
        self.assertEqual(tags.get('next.js'), 'preferred')
        self.assertEqual(tags.get('node.js'), 'preferred')
        self.assertEqual(tags.get('fastapi'), 'preferred')
        self.assertEqual(res['required_groups'], [['react']])

    def test_prefix_headings_recognized(self):
        html_prefix = """
        <p><strong>Minimum requirements for the role:</strong></p>
        <ul><li>SQL experience</li></ul>
        <p><strong>An ideal candidate also has:</strong></p>
        <ul><li>Docker experience</li></ul>
        """
        res_prefix = analyze_job_skills('', html_prefix)
        self.assertEqual(res_prefix['source'], 'qualification_html')
        tags = {s['skill_name']: s['requirement_type'] for s in res_prefix['skills']}
        self.assertEqual(tags.get('sql'), 'required')
        self.assertEqual(tags.get('docker'), 'preferred')
