import unittest
from nlp_tagger import tag_skills_for_job

class HardwareSkillsTest(unittest.TestCase):
    def hardware(self, text):
        return any(item['skill_name'] == 'hardware' for item in tag_skills_for_job(text))

    def test_company_hardware_is_not_a_requirement(self):
        self.assertFalse(self.hardware('Our software decides which data centers get which hardware and when.'))
        self.assertFalse(self.hardware('Required Qualifications:\nBuild Python services for our hardware business.'))

    def test_explicit_hardware_competencies_remain(self):
        for text in ['Experience with hardware interfaces required.', 'Strong knowledge of Windows OS and hardware.', 'Lead hardware design for embedded systems.']:
            with self.subTest(text=text):
                self.assertTrue(self.hardware(text))
