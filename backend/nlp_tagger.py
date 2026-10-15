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
    "helm", "spark", "kafka", "starrocks", "snowflake", "bigquery", "palantir foundry",
    "langgraph", "iceberg", "delta lake", "hudi", "llm", "http api", "api",
    "relational data modeling", "data modeling", "data pipelines",
    "automated testing", "testing", "software design", "documentation", "observability",
    "distributed systems", "version control", "code review", "full-stack",
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


def _extract_sentence_groups(sentence, required_mentions):
    """Group required mentions into OR-alternative sets based on span overlaps and OR bridges."""
    if not required_mentions:
        return []
    sorted_mentions = sorted(required_mentions, key=lambda m: (m[0], -m[1]))
    line_groups = [{skill} for _, _, skill in sorted_mentions]
    n = len(sorted_mentions)

    # 1. Merge mentions whose character spans overlap into a single OR group
    max_end = sorted_mentions[0][1]
    cluster_first = 0
    for i in range(1, n):
        start_i, end_i, _ = sorted_mentions[i]
        if start_i < max_end:
            combined = set().union(*line_groups[cluster_first:i + 1])
            for m in range(cluster_first, i + 1):
                line_groups[m] = combined
            max_end = max(max_end, end_i)
        else:
            cluster_first = i
            max_end = end_i

    # 2. Merge explicit OR bridges: 'or', 'and/or', '/'
    for index in range(1, n):
        prev_end = sorted_mentions[index - 1][1]
        curr_start = sorted_mentions[index][0]
        if curr_start >= prev_end:
            bridge = sentence[prev_end:curr_start]
            if re.fullmatch(r'\s*(?:,?\s*or|and/or|/)\s*', bridge, re.I):
                first = index - 1
                while first > 0 and re.fullmatch(r'\s*,\s*', sentence[sorted_mentions[first - 1][1]:sorted_mentions[first][0]]):
                    first -= 1
                combined = set().union(*line_groups[first:index + 1])
                for member in range(first, index + 1):
                    line_groups[member] = combined

    # 3. Handle trailing framework alternatives
    if len(sorted_mentions) >= 2:
        first, second = sorted_mentions[-2:]
        frameworks = {'react', 'angular', 'vue', 'next.js'}
        tail = sentence[second[1]:]
        bridge = sentence[first[1]:second[0]]
        if first[2] in frameworks and second[2] in frameworks and re.fullmatch(r'\s*,\s*', bridge) and re.match(r'\s*,?\s*or\s+(?:a\s+)?comparable\b', tail, re.I):
            line_groups[-2] = line_groups[-1] = {first[2], second[2]}

    return [sorted(group) for group in line_groups]


_PROGRAMMING_LANGUAGES = {
    'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'go', 'ruby',
    'swift', 'kotlin', 'scala', 'r', 'matlab', 'php', 'rust', 'node.js',
}
_SOFTWARE_SKILLS = set(_PROGRAMMING_LANGUAGES) - {'go', 'r'} | {'sql', 'docker'}
_SOFTWARE_CUES_RE = re.compile(r"\b(?:software|code|coding|automated|qa|ci/cd|unit\s+tests?)\b", re.IGNORECASE)
_GO_LANG_CUES_RE = re.compile(r"\b(?:golang|programming\s+languages?)\b", re.IGNORECASE)


def _is_valid_go_mention(sentence, start, end, other_skills):
    if (start > 0 and sentence[start - 1] == '-') or (end < len(sentence) and sentence[end] == '-'):
        return False
    if any(s in _PROGRAMMING_LANGUAGES for s in other_skills if s not in ('go', 'r')):
        return True
    return bool(_GO_LANG_CUES_RE.search(sentence))


def _is_valid_evidence_mention(skill, sentence, start, end, all_skills):
    if skill == 'hardware' and not hardware_skill_evidence(sentence):
        return False
    if skill in ('testing', 'documentation'):
        has_cue = bool(_SOFTWARE_CUES_RE.search(sentence)) or any(s in _SOFTWARE_SKILLS for s in all_skills if s != skill)
        if not has_cue:
            return False
    if skill == 'go' and not _is_valid_go_mention(sentence, start, end, all_skills):
        return False
    return True


def hardware_skill_evidence(sentence):
    """Require an explicit competency, not a mention of an employer's hardware."""
    return bool(re.search(
        r"(?:experience|knowledge|proficien\w*|familiar\w*|expertise|skills?|ability)\b[^.!?;]{0,90}\bhardware\b"
        r"|\bhardware\s+(?:design|engineering|troubleshooting|interfaces?|testing|debugging|development|repair)\b"
        r"|\bhardware\b[^.!?;]{0,50}\b(?:experience|knowledge|proficiency|expertise|skills?)\b",
        sentence, re.IGNORECASE))


def _tag_plain_text(description, return_groups=False):
    """Tag skills for job."""
    if not description:
        return ([], []) if return_groups else []

    for alias, canonical in _ALIASES.items():
        description = re.sub(_skill_pattern(alias), canonical, description, flags=re.IGNORECASE)
    language, matcher = skill_matcher()
    tagged = {}
    groups = []
    for section_tag, line in _split_into_sections(description):
        # Split requirements without breaking names like Node.js.
        for sentence in re.split(r"(?<=[.!?;])\s+|\s+(?:but|whereas)\s+", line):
            document = language.make_doc(sentence)
            raw_sentence_matches = []
            for match_id, start, end in matcher(document):
                skill = language.vocab.strings[match_id]
                if not re.search(_skill_pattern(skill), sentence, re.IGNORECASE):
                    continue
                span = document[start:end]
                raw_sentence_matches.append((span.start_char, span.end_char, skill))
            all_skills = set(s for _, _, s in raw_sentence_matches)
            required_mentions = []
            for s_start, s_end, skill in raw_sentence_matches:
                if not _is_valid_evidence_mention(skill, sentence, s_start, s_end, all_skills):
                    continue
                tag = _tag_sentence(sentence, section_tag)
                if tagged.get(skill) != "required":
                    tagged[skill] = tag
                if tag == "required":
                    required_mentions.append((s_start, s_end, skill))
            if return_groups and required_mentions:
                groups.extend(_extract_sentence_groups(sentence, required_mentions))

    if return_groups:
        unique = {tuple(sorted(group)) for group in groups if group}
        resolved_groups = [sorted(group) for group in sorted(unique) if not any(set(other) < set(group) for other in unique)]
        covered = set().union(*resolved_groups) if resolved_groups else set()
        for skill, kind in tagged.items():
            if kind == "required" and skill not in covered:
                tagged[skill] = "preferred"
        skills = [{"skill_name": skill, "requirement_type": tagged[skill]}
                  for skill in KNOWN_SKILLS if skill in tagged]
        return skills, resolved_groups
    skills = [{"skill_name": skill, "requirement_type": tagged[skill]}
              for skill in KNOWN_SKILLS if skill in tagged]
    return skills


# These labels classify source-provided headings for extraction, never display cards.
_REQUIRED_HEADINGS = {
    'who you are', 'what you bring', 'what you need', 'what you will need',
    'what youll need', 'what youll bring', 'requirements', 'qualifications',
    'required qualifications', 'required skills', 'required experience',
    'minimum qualifications', 'minimum requirements', 'basic qualifications',
    'your qualifications', 'skills and experience', 'essential qualifications',
    'requirements and qualifications', 'required skills and experience',
    'what experience should you have', 'experience', 'key qualifications',
}
_PREFERRED_HEADINGS = {
    'preferred', 'preferred qualifications', 'preferred skills', 'preferred experience',
    'nice to have', 'bonus points', 'bonus skills', 'desired qualifications', 'desired skills',
}
_ALIASES = {
    'postgres': 'postgresql', 'k8s': 'kubernetes', 'llms': 'llm',
    'http apis': 'http api', 'rest apis': 'rest api', 'delta': 'delta lake',
    'full stack': 'full-stack', 'apis': 'api',
    'visualization': 'data visualization',
    'data pipeline': 'data pipelines',
}


def _mentions(text):
    raw_mentions = []
    for skill in KNOWN_SKILLS:
        for match in re.finditer(_skill_pattern(skill), text, re.IGNORECASE):
            raw_mentions.append((match.start(), match.end(), skill))
    for alias, skill in _ALIASES.items():
        for match in re.finditer(_skill_pattern(alias), text, re.IGNORECASE):
            raw_mentions.append((match.start(), match.end(), skill))
    all_skills = set(s for _, _, s in raw_mentions)
    filtered = [
        (start, end, skill) for start, end, skill in raw_mentions
        if _is_valid_evidence_mention(skill, text, start, end, all_skills)
    ]
    return sorted(set(filtered))


def analyze_job_skills(description, description_html=None):
    """Extract known competencies from actual qualification headings and bullets.

    Unrecognized/no-heading postings retain the legacy text extraction. Required
    groups record explicit OR alternatives so either option can satisfy one group.
    """
    from bs4 import BeautifulSoup
    from job_html import clean_html, is_heading
    soup = BeautifulSoup(clean_html(description_html) or '', 'html.parser')
    labeled = []
    scope, scope_level, content = None, None, ''
    for element in soup.children:
        if getattr(element, 'name', None) and is_heading(element):
            title = element.get_text(' ', strip=True).lower().replace('&', ' and ')
            title = re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', '', title)).strip()
            if title in _REQUIRED_HEADINGS or title.startswith('minimum requirements'):
                kind = 'required'
            elif title in _PREFERRED_HEADINGS or title.startswith('an ideal candidate'):
                kind = 'preferred'
            else:
                kind = None
            level = int(element.name[1]) if element.name in ('h2', 'h3', 'h4') else 2
            if not kind and scope and level > scope_level:
                # A lower-level heading belongs to its qualification parent.
                content += str(element)
                continue
            if scope:
                labeled.append((scope, content))
            scope, scope_level, content = kind, level, ''
        elif scope:
            content += str(element)
    if scope:
        labeled.append((scope, content))
    # Preferred-only recognition is insufficient to exclude unknown main requirements.
    if not any(kind == 'required' for kind, _ in labeled):
        labeled = []
    if not labeled:
        tags, groups = _tag_plain_text(description, return_groups=True)
        return {'skills': tags, 'required_groups': groups, 'source': 'text_fallback'}
    tagged, groups = {}, []
    for default, fragment in labeled:
        soup = BeautifulSoup(fragment, 'html.parser')
        blocks = soup.find_all(['li', 'p'])
        # Nested paragraphs in list items must not be processed twice.
        blocks = [block for block in blocks if not (block.name == 'p' and block.find_parent('li'))]
        lines = [block.get_text(' ', strip=True) for block in blocks] or [soup.get_text(' ', strip=True)]
        for line in lines:
            for sentence in re.split(r'(?<=[.!?;])\s+', line):
                mentions = _mentions(sentence)
                required_mentions = []
                for start, end, skill in mentions:
                    # A local "Python preferred" must not downgrade JavaScript or TypeScript.
                    before, after = sentence[max(0, start - 35):start], sentence[end:end + 45]
                    local_preference = bool(re.match(r'\s*(?:is\s+)?(?:preferred|desired|is a plus|would be a plus|nice to have)\b', after, re.I)
                                            or re.search(r'\b(?:preferably|ideally)\s*$', before, re.I))
                    whole_preference = bool(re.match(r'^\s*(?:preferred|nice to have|bonus)\b', sentence, re.I))
                    kind = 'preferred' if local_preference or whole_preference else default
                    if default == 'preferred' and _REQUIRED_RE.search(sentence):
                        kind = 'required'
                    if tagged.get(skill) != 'required':
                        tagged[skill] = kind
                    if kind == 'required':
                        required_mentions.append((start, end, skill))
                groups.extend(_extract_sentence_groups(sentence, required_mentions))
    # A single explicit mention elsewhere still makes a skill individually required.
    unique = {tuple(sorted(group)) for group in groups if group}
    groups = [sorted(group) for group in sorted(unique) if not any(set(other) < set(group) for other in unique)]
    covered = set().union(*groups) if groups else set()
    for skill, kind in tagged.items():
        if kind == "required" and skill not in covered:
            tagged[skill] = "preferred"
    return {'skills': [{'skill_name': skill, 'requirement_type': tagged[skill]} for skill in KNOWN_SKILLS if skill in tagged],
            'required_groups': groups, 'source': 'qualification_html'}


def tag_skills_for_job(description, description_html=None):
    return analyze_job_skills(description, description_html)['skills']


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

        skills = tag_skills_for_job(description, job.get("description_html"))
        db.replace_job_skills(job_id, skills)
        total_tagged += len(skills)

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
