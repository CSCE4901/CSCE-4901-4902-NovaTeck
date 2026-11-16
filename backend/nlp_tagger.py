"""Nlp tagger."""

import re
from functools import lru_cache

from nltk.tokenize import RegexpTokenizer


@lru_cache(maxsize=1)
def skill_matcher():
    """Compile patterns shared by HTML and plain-text extraction."""
    names = [(skill, skill) for skill in KNOWN_SKILLS] + list(_ALIASES.items())
    return [(re.compile(_skill_pattern(name), re.IGNORECASE), skill) for name, skill in names]

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
    "ansible", "apache airflow", "databricks", "elasticsearch", "figma",
    "github actions", "grafana", "jupyter", "oauth", "prometheus",
    "rabbitmq", "selenium", "splunk", "spring framework", "vhdl", "verilog",
    "artificial intelligence", "generative ai", "ai-assisted development",
    "claude code", "github copilot", "cursor", "openai codex",
    "chatgpt", "gemini cli", "windsurf", "amazon q developer",
    "prompt engineering", "retrieval-augmented generation",
    ".net", "replit", "v0.dev", "bolt.new", "collaboration", "debugging",
    "cypress", "playwright", "pulumi", "infrastructure as code", "devops",
    "asp.net", "web development", "relational databases", "data integration",
    "system architecture", "llm apis", "agent frameworks", "agentic ai",
    "erp", "manufacturing operations", "business intelligence", "logistics",
    "data science", "containerization", "web design", "dashboard development",
    "networking", "troubleshooting", "cisco ios", "junos", "comptia server+",
    "comptia network+", "time management", "leadership", "data center operations",
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
_PLAIN_QUALIFICATION_RE = re.compile(
    r"^\s*(?:qualifications|requirements|skills(?: and tools)?|what we(?:['’]re| are) looking for)\s*:\s*$", re.I
)


def _split_into_sections(text):
    """ split into sections."""
    lines = RegexpTokenizer(r"[^\n]+").tokenize(text)
    current_tag = "unknown"
    sections = []
    for line in lines:
        if _REQUIRED_SECTION_RE.match(line.strip()) or _PLAIN_QUALIFICATION_RE.match(line):
            current_tag = "required"
        elif _PREFERRED_SECTION_RE.match(line.strip().replace('-', ' ')):
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


_EXAMPLE_LIST = re.compile(r"\((?:e\.g\.\s*([^()]+)|([^()]+),\s*(?:etc\.|or similar))\)", re.I)
_TOOL_EXAMPLES = re.compile(r"\b(?:tools?|platforms?|frameworks?|technologies)\s*\(([^()]+)\)", re.I)


def _extract_sentence_groups(sentence, required_mentions, example_groups=None):
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

    # Parenthetical examples describe ways to satisfy one qualification.
    for example in _EXAMPLE_LIST.finditer(sentence):
        start, end = example.span(1 if example.group(1) is not None else 2)
        members = [index for index, (left, right, _) in enumerate(sorted_mentions)
                   if start <= left and right <= end]
        if members:
            members.extend(index for index, (_, right, skill) in enumerate(sorted_mentions)
                           if skill == 'ai-assisted development' and right <= example.start()
                           and not sentence[right:example.start()].strip())
            combined = set().union(*(line_groups[index] for index in members))
            for index in members:
                line_groups[index] = combined
            if example_groups is not None:
                example_groups.add(tuple(sorted(combined)))

    # Handle trailing framework alternatives
    if len(sorted_mentions) >= 2:
        first, second = sorted_mentions[-2:]
        frameworks = {'react', 'angular', 'vue', 'next.js'}
        tail = sentence[second[1]:]
        bridge = sentence[first[1]:second[0]]
        if first[2] in frameworks and second[2] in frameworks and re.fullmatch(r'\s*,\s*', bridge) and re.match(r'\s*,?\s*or\s+(?:a\s+)?comparable\b', tail, re.I):
            line_groups[-2] = line_groups[-1] = {first[2], second[2]}

    return [sorted(group) for group in line_groups]


def _tool_candidates(sentence, mentions, kind):
    for examples in _TOOL_EXAMPLES.finditer(sentence):
        for item in re.finditer(r"[^,]+", examples[1]):
            name = re.sub(r"^(?:e\.g\.\s*|(?:and|or)\s+)", "", item[0].strip(), flags=re.I)
            start = examples.start(1) + item.start()
            end = examples.start(1) + item.end()
            if (name.lower().rstrip('.') != 'etc' and
                    re.fullmatch(r"[A-Z0-9.][\w.+#-]*(?: [\w.+#-]+){0,2}", name)
                    and not any(start <= left and right <= end for left, right, _ in mentions)):
                yield {'name': name, 'requirement_type': kind, 'evidence': sentence}


_PROGRAMMING_LANGUAGES = {
    'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'go', 'ruby',
    'swift', 'kotlin', 'scala', 'r', 'matlab', 'php', 'rust', 'node.js',
}
_SOFTWARE_SKILLS = set(_PROGRAMMING_LANGUAGES) - {'go', 'r'} | {'sql', 'docker'}
_SOFTWARE_CUES_RE = re.compile(r"\b(?:software|code|coding|automated|qa|ci/cd|unit\s+tests?)\b", re.IGNORECASE)
_GO_LANG_CUES_RE = re.compile(r"\b(?:golang|programming\s+languages?)\b", re.IGNORECASE)
_AI_SKILL_CUES_RE = re.compile(
    r"\b(?:experience|exposure|familiarity|proficiency|knowledge|expertise|"
    r"skills?|hands-on|working with|using|use|leverage|implement(?:ing)?|"
    r"integrat(?:e|ing)|develop(?:ing)?|required|preferred)\b", re.IGNORECASE,
)
_CODING_ASSISTANT_CUES_RE = re.compile(
    r"\b(?:ai[- ](?:assisted|powered)|coding\s+(?:assistants?|tools?|agents?)|"
    r"(?:dev|developer)\s+tools?|github copilot|claude code|gemini cli|openai codex)\b", re.IGNORECASE,
)


def _is_valid_go_mention(sentence, start, end, other_skills):
    if sentence[start:end].lower() == 'golang':
        return True
    if (start > 0 and sentence[start - 1] == '-') or (end < len(sentence) and sentence[end] == '-'):
        return False
    if any(s in _PROGRAMMING_LANGUAGES for s in other_skills if s not in ('go', 'r')):
        return True
    return bool(_GO_LANG_CUES_RE.search(sentence))


def _is_valid_evidence_mention(skill, sentence, start, end, all_skills, qualification):
    if skill == 'hardware' and not hardware_skill_evidence(sentence):
        return False
    if skill in ('testing', 'documentation'):
        has_cue = bool(_SOFTWARE_CUES_RE.search(sentence)) or any(s in _SOFTWARE_SKILLS for s in all_skills if s != skill)
        if not has_cue:
            return False
    if skill == 'go' and not _is_valid_go_mention(sentence, start, end, all_skills):
        return False
    mention = sentence[start:end].lower()
    if skill == 'bolt.new' and mention == 'bolt':
        return bool(re.search(r"\b(?:rapid prototyping|replit|v0\.dev)\b", sentence, re.I))
    if skill == 'cypress':
        return qualification or bool(re.search(r"\b(?:test(?:s|ing)?|playwright|selenium)\b", sentence, re.I))
    if skill == 'artificial intelligence':
        # Keep generic AI branding out of tags and avoid matching AI inside a more specific skill.
        adjacent = sentence[end:]
        if mention == 'ai' and (sentence[start - 1:start] in ('-', '‑') or
                                re.match(r'[-‑](?:assisted|powered|driven)\b', adjacent, re.I)):
            return False
        return qualification or bool(_AI_SKILL_CUES_RE.search(sentence))
    if mention == 'rag':
        return bool(re.search(r'\b(?:llms?|retrieval|generative ai|vector search)\b', sentence, re.I))
    if skill in {'cursor', 'windsurf'} or mention in {'claude', 'copilot', 'codex'}:
        return bool(_CODING_ASSISTANT_CUES_RE.search(sentence))
    return True


def hardware_skill_evidence(sentence):
    """Require an explicit competency, not a mention of an employer's hardware."""
    return bool(re.search(
        r"(?:experience|knowledge|proficien\w*|familiar\w*|expertise|skills?|ability)\b[^.!?;]{0,90}\bhardware\b"
        r"|\bhardware\s+(?:design|engineering|troubleshooting|interfaces?|testing|debugging|development|repair)\b"
        r"|\bhardware\b[^.!?;]{0,50}\b(?:experience|knowledge|proficiency|expertise|skills?)\b",
        sentence, re.IGNORECASE))


def _tag_plain_text(description):
    """Tag skills for job."""
    tagged, evidence, candidates = {}, {}, {}
    groups = []
    examples, explicit = set(), set()
    for section_tag, line in _split_into_sections(description or ''):
        # Split requirements without breaking names like Node.js.
        for sentence in re.split(r"(?<!e\.g\.)(?<=[.!?;])\s+|\s+(?:but|whereas)\s+", line, flags=re.I):
            required_mentions = []
            mentions = _mentions(sentence, qualification=section_tag != 'unknown')
            tag = _tag_sentence(sentence, section_tag)
            if section_tag != 'unknown' or _AI_SKILL_CUES_RE.search(sentence):
                for candidate in _tool_candidates(sentence, mentions, tag):
                    candidates.setdefault(candidate['name'].casefold(), candidate)
            for s_start, s_end, skill in mentions:
                if tagged.get(skill) != "required":
                    tagged[skill] = tag
                evidence.setdefault((skill, tag), sentence)
                if tag == "required":
                    required_mentions.append((s_start, s_end, skill))
            _collect_groups(sentence, required_mentions, groups, examples, explicit)
    return _skill_analysis(tagged, groups, examples, explicit, evidence, candidates, 'text_fallback')


# These labels classify source-provided headings for extraction, never display cards.
_REQUIRED_HEADINGS = {
    'who you are', 'what you bring', 'what you need', 'what you will need',
    'what youll need', 'what youll bring', 'requirements', 'qualifications',
    'required qualifications', 'required skills', 'required experience',
    'minimum qualifications', 'minimum requirements', 'basic qualifications',
    'your qualifications', 'skills and experience', 'essential qualifications',
    'requirements and qualifications', 'required skills and experience',
    'what experience should you have', 'experience', 'key qualifications',
    'basic requirements', 'minimum skills and experience', 'must have',
    'must haves', 'what you must have', 'what you bring to the table',
    'skills and tools', 'what were looking for', 'what we are looking for',
}
_PREFERRED_HEADINGS = {
    'preferred', 'preferred qualifications', 'preferred skills', 'preferred experience',
    'nice to have', 'bonus points', 'bonus skills', 'desired qualifications', 'desired skills',
    'nice to haves', 'additional preferred qualifications',
}
_ALIASES = {
    'postgres': 'postgresql', 'k8s': 'kubernetes', 'llms': 'llm',
    'http apis': 'http api', 'rest apis': 'rest api', 'delta': 'delta lake',
    'full stack': 'full-stack', 'apis': 'api',
    'visualization': 'data visualization',
    'data pipeline': 'data pipelines',
    'react.js': 'react', 'reactjs': 'react', 'nodejs': 'node.js',
    'nextjs': 'next.js', 'vue.js': 'vue', 'golang': 'go',
    'amazon web services': 'aws', 'google cloud platform': 'gcp',
    'ai': 'artificial intelligence', 'genai': 'generative ai',
    'gen ai': 'generative ai', 'ai-assisted development tools': 'ai-assisted development',
    'ai coding assistants': 'ai-assisted development', 'ai coding tools': 'ai-assisted development',
    'ai dev tools': 'ai-assisted development', 'ai developer tools': 'ai-assisted development',
    'bolt': 'bolt.new', 'restful apis': 'rest api', 'restful api': 'rest api',
    'web applications': 'web development', 'relational database': 'relational databases',
    'systems architecture': 'system architecture', 'llm api': 'llm apis',
    'agent framework': 'agent frameworks', 'ai-assisted coding': 'ai-assisted development',
    'containers': 'containerization', 'software dashboards': 'dashboard development',
    'claude': 'claude code', 'copilot': 'github copilot', 'codex': 'openai codex',
    'rag': 'retrieval-augmented generation', 'retrieval augmented generation': 'retrieval-augmented generation',
    'computer networking': 'networking', 'network administration': 'networking',
    'juniper junos': 'junos', 'server+': 'comptia server+', 'network+': 'comptia network+',
    'troubleshoot': 'troubleshooting', 'diagnose and resolve technical issues': 'troubleshooting',
    'lead a team': 'leadership', 'leading and mentoring': 'leadership',
    'computer hardware': 'hardware', 'data centers': 'data center operations',
    'data center': 'data center operations',
}


def _mentions(text, qualification=False):
    raw_mentions = []
    for pattern, skill in skill_matcher():
        for match in pattern.finditer(text):
            raw_mentions.append((match.start(), match.end(), skill))
    all_skills = set(s for _, _, s in raw_mentions)
    specific_ai = [(start, end) for start, end, skill in raw_mentions
                   if skill in {'generative ai', 'ai-assisted development', 'agentic ai'}]
    qualified_tools = [(start, end, skill) for start, end, skill in raw_mentions
                       if text[start:end].lower() in {'claude code', 'github copilot', 'openai codex'}]
    filtered = [
        (start, end, skill) for start, end, skill in raw_mentions
        if _is_valid_evidence_mention(skill, text, start, end, all_skills, qualification)
        and not (skill == 'artificial intelligence' and any(a <= start < end <= b for a, b in specific_ai))
        and not (skill == 'github' and any(a <= start < end <= b and other == 'github copilot'
                                          for a, b, other in qualified_tools))
        and not any(other == skill and a <= start < end <= b and (a, b) != (start, end)
                    for a, b, other in qualified_tools)
    ]
    return sorted(set(filtered))


def _html_lines(soup):
    """Keep qualification lines separate across lists, paragraphs and breaks."""
    from bs4 import Comment, NavigableString

    boundaries = {'br', 'p', 'li', 'ul', 'ol', 'h2', 'h3', 'h4'}
    def text_parts(element):
        if isinstance(element, Comment):
            return
        if isinstance(element, NavigableString):
            yield str(element)
            return
        if element.name in boundaries:
            yield '\n'
        for child in element.children:
            yield from text_parts(child)
        if element.name in boundaries:
            yield '\n'

    for line in ''.join(text_parts(soup)).splitlines():
        if line.strip():
            yield line.strip()


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
        if getattr(element, 'name', None) in {'p', 'h2', 'h3', 'h4'}:
            title = element.get_text(' ', strip=True).lower().replace('&', ' and ').replace('-', ' ')
            title = re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', '', title)).strip()
            if title in _REQUIRED_HEADINGS or title.startswith('minimum requirements'):
                kind = 'required'
            elif title in _PREFERRED_HEADINGS or re.match(
                r'^(?:an ideal candidate|bonus points|nice to have|extra credit|preferred qualifications)(?:\b|$)', title
            ):
                kind = 'preferred'
            else:
                kind = None
            if not is_heading(element) and not kind:
                if scope:
                    content += str(element)
                continue
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
        return _tag_plain_text(description or '\n'.join(_html_lines(soup)))
    tagged, groups = {}, []
    evidence, examples, explicit = {}, set(), set()
    candidates = {}
    for default, fragment in labeled:
        soup = BeautifulSoup(fragment, 'html.parser')
        for line in _html_lines(soup):
            for sentence in re.split(r'(?<!e\.g\.)(?<=[.!?;])\s+', line, flags=re.I):
                mentions = _mentions(sentence, qualification=True)
                for candidate in _tool_candidates(sentence, mentions, default):
                    candidates.setdefault(candidate['name'].casefold(), candidate)
                required_mentions = []
                for start, end, skill in mentions:
                    # A local "Python preferred" must not downgrade JavaScript or TypeScript.
                    before, after = sentence[max(0, start - 35):start], sentence[end:end + 45]
                    local_preference = bool(re.match(r'\s*(?:is\s+)?(?:preferred|desired|is a plus|would be a plus|nice to have)\b', after, re.I)
                                            or re.search(r'\b(?:preferably|ideally)\s*$', before, re.I))
                    whole_preference = bool(re.match(r'^\s*(?:preferred|nice[- ]to[- ]have|bonus)\b', sentence, re.I)
                                            or re.search(r'\b(?:is|would be) a plus[.!]?$', sentence, re.I))
                    kind = 'preferred' if local_preference or whole_preference else default
                    if default == 'preferred' and _REQUIRED_RE.search(sentence):
                        kind = 'required'
                    if tagged.get(skill) != 'required':
                        tagged[skill] = kind
                    evidence.setdefault((skill, kind), sentence)
                    if kind == 'required':
                        required_mentions.append((start, end, skill))
                _collect_groups(sentence, required_mentions, groups, examples, explicit)
    return _skill_analysis(tagged, groups, examples, explicit, evidence, candidates, 'qualification_html')


def _collect_groups(sentence, mentions, groups, examples, explicit):
    sentence_examples = set()
    sentence_groups = _extract_sentence_groups(sentence, mentions, sentence_examples)
    examples.update(sentence_examples)
    explicit.update(tuple(group) for group in sentence_groups if tuple(group) not in sentence_examples)
    groups.extend(sentence_groups)


def _skill_analysis(tagged, groups, examples, explicit, evidence, candidates, source):
    # A single explicit mention elsewhere still makes a skill individually required.
    unique = {tuple(sorted(group)) for group in groups if group}
    groups = [sorted(group) for group in sorted(unique) if not any(set(other) < set(group) for other in unique)]
    covered = set().union(*groups) if groups else set()
    for skill, kind in tagged.items():
        if kind == "required" and skill not in covered:
            tagged[skill] = "preferred"
    return {'skills': [{'skill_name': skill, 'requirement_type': tagged[skill]} for skill in KNOWN_SKILLS if skill in tagged],
            'required_groups': groups, 'example_groups': [group for group in groups if tuple(group) in examples - explicit],
            'evidence': {skill: evidence[(skill, kind)] if (skill, kind) in evidence else evidence[(skill, 'required')]
                         for skill, kind in tagged.items()},
            'candidates': list(candidates.values()), 'source': source}


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
