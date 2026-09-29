"""Nlp tagger."""

import re
from functools import lru_cache

from nltk.tokenize import RegexpTokenizer


@lru_cache(maxsize=1)
def skill_matcher():
    """Skill matcher."""
    import spacy
    from spacy.matcher import PhraseMatcher
    language = spacy.blank("en")
    matcher = PhraseMatcher(language.vocab, attr="LOWER")
    for skill in KNOWN_SKILLS:
        matcher.add(skill, [language.make_doc(skill)])
    return language, matcher

KNOWN_SKILLS = [
    "python", "java", "javascript", "typescript", "c++", "c#", "go", "ruby",
    "swift", "kotlin", "scala", "r", "matlab", "php", "rust",
    "react", "angular", "vue", "html", "css", "sass", "bootstrap", "tailwind",
    "next.js", "node.js", "express", "jquery",
    "flask", "django", "fastapi", "spring boot", "rest api", "graphql",
    "microservices", "api development",
    "mysql", "postgresql", "sqlite", "mongodb", "redis", "oracle", "sql server",
    "sql", "nosql", "database design",
    "aws", "azure", "gcp", "docker", "kubernetes", "ci/cd", "jenkins",
    "terraform", "linux", "bash", "git", "github",
    "machine learning", "deep learning", "nlp", "tensorflow", "pytorch",
    "scikit-learn", "pandas", "numpy", "data analysis", "data visualization",
    "tableau", "power bi", "excel",
    "agile", "scrum", "jira", "communication", "teamwork", "problem solving",
    "project management",
    "systems engineering", "quality engineering", "reliability engineering",
    "test engineering", "electrical engineering", "mechanical engineering",
    "embedded systems", "hardware", "electronics", "aerospace", "aviation",
    "autonomous systems", "uavs", "flight test", "verification", "validation",
    "failure analysis", "root cause analysis", "risk management", "fmea", "fracas",
    "as9100", "do-178c", "do-254", "simulink", "cad", "salesforce",
]

REQUIRED_SIGNALS = [
    r"\brequired\b", r"\bmust\s+have\b", r"\bmust\s+be\b",
    r"\bminimum\b",  r"\bessential\b",   r"\bmandatory\b",
    r"\bnecessary\b", r"\bexpected\b",
]

PREFERRED_SIGNALS = [
    r"\bpreferred\b", r"\bnice\s+to\s+have\b", r"\ba\s+plus\b",
    r"\bbonus\b",     r"\bdesired\b",           r"\bwould\s+be\s+an\s+asset\b",
    r"\badvantage\b", r"\bideal\b",
]

_REQUIRED_RE  = re.compile("|".join(REQUIRED_SIGNALS),  re.IGNORECASE)
_PREFERRED_RE = re.compile("|".join(PREFERRED_SIGNALS), re.IGNORECASE)

_REQUIRED_SECTION_RE = re.compile(
    r"(required\s+(qualifications?|skills?|experience)|"
    r"minimum\s+(qualifications?|requirements?)|"
    r"what\s+you('ll)?\s+(need|bring)|"
    r"you\s+must\s+have)",
    re.IGNORECASE,
)

_PREFERRED_SECTION_RE = re.compile(
    r"(preferred\s+(qualifications?|skills?|experience)|"
    r"nice\s+to\s+have|"
    r"bonus\s+(points?|skills?)|"
    r"what\s+would\s+be\s+(great|a\s+plus))",
    re.IGNORECASE,
)


def _split_into_sections(text):
    """ split into sections."""
    lines = RegexpTokenizer(r"[^\n]+").tokenize(text)
    current_tag = "unknown"
    sections = []
    for line in lines:
        if _REQUIRED_SECTION_RE.match(line.strip()):
            current_tag = "required"
        elif _PREFERRED_SECTION_RE.match(line.strip()):
            current_tag = "preferred"
        sections.append((current_tag, line))
    return sections


def _tag_sentence(sentence, section_default):
    """Return 'required' or 'preferred' for one sentence."""
    if _REQUIRED_RE.search(sentence):
        return "required"
    if _PREFERRED_RE.search(sentence):
        return "preferred"
    if section_default in ("required", "preferred"):
        return section_default
    return "required"


def _skill_pattern(skill):
    """Match punctuated skills (for example C++ and CI/CD) correctly."""
    return r"(?<!\w)" + re.escape(skill) + r"(?!\w)"


def tag_skills_for_job(description):
    """Tag skills for job."""
    if not description:
        return []

    language, matcher = skill_matcher()
    tagged = {}
    for section_tag, line in _split_into_sections(description):
        # Split requirements without breaking names like Node.js.
        for sentence in re.split(r"(?<=[.!?;])\s+|\s+(?:but|whereas)\s+", line):
            document = language.make_doc(sentence)
            for match_id, start, end in matcher(document):
                skill = language.vocab.strings[match_id]
                if not re.search(_skill_pattern(skill), sentence, re.IGNORECASE):
                    continue
                tag = _tag_sentence(sentence, section_tag)
                if tagged.get(skill) != "required":
                    tagged[skill] = tag
    return [{"skill_name": skill, "requirement_type": tagged[skill]}
            for skill in KNOWN_SKILLS if skill in tagged]


def run_pipeline():
    """Run pipeline."""
    import db
    print("[nlp_tagger] Starting NLP pipeline...")

    # Include all active jobs.
    jobs = db.get_jobs(limit=500)
    if not jobs:
        print("[nlp_tagger] No jobs found. Run the crawler first.")
        return

    total_tagged = 0

    for job in jobs:
        job_id      = job.get("job_id")
        description = job.get("description", "")

        if not description:
            print(f"[nlp_tagger] Job {job_id}: no description, skipping.")
            continue

        skills = tag_skills_for_job(description)
        # Replace old skill tags.
        db.clear_job_skills(job_id)

        for item in skills:
            skill_name       = item["skill_name"]
            requirement_type = item["requirement_type"]

            skill_id = db.insert_skill(skill_name)
            if not skill_id:
                print(f"[nlp_tagger] Warning: could not insert skill '{skill_name}'")
                continue

            db.link_job_skill(
                job_id=job_id,
                skill_id=skill_id,
                requirement_type=requirement_type,
            )
            total_tagged += 1

        print(f"[nlp_tagger] Job {job_id}: tagged {len(skills)} skills.")

    print(f"[nlp_tagger] Done. Total skill tags inserted: {total_tagged}")


if __name__ == "__main__":
    sample = """
Software Engineer - DFW

Required Qualifications:
- 2+ years of experience with Python and SQL
- Experience with REST API development using Flask or Django
- Proficiency in Git and Linux environments

Preferred Qualifications:
- Experience with React or Angular for frontend development
- Familiarity with AWS or Azure cloud platforms
- Knowledge of Docker and CI/CD pipelines
"""
    print("=== NLP Tagger - Standalone Test ===\n")
    results = tag_skills_for_job(sample)
    required  = [r for r in results if r["requirement_type"] == "required"]
    preferred = [r for r in results if r["requirement_type"] == "preferred"]
    print(f"REQUIRED  ({len(required)}):")
    for r in required:
        print(f"  - {r['skill_name']}")
    print(f"\nPREFERRED ({len(preferred)}):")
    for r in preferred:
        print(f"  - {r['skill_name']}")
