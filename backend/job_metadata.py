"""Job metadata."""
import re


def extract_experience(description):
    # Decode legacy feed text before splitting it into individual requirements.
    import html
    text = description or ''
    for _ in range(2):
        text = html.unescape(text)
    text = re.sub(r'<(?:br|/?p|/?div|/?li)\b[^>]*>', '\n', text, flags=re.I)
    text = re.sub(r'<[^>]+>', '', text).replace('\xa0', ' ')
    for sentence in re.split(r"(?<=[.!?])\s+|\n", text):
        if re.search(r"\b\d+\s*(?:\+|[-–]\s*\d+)?\s*years?\b", sentence, re.I) and re.search(r"\bexperience\b", sentence, re.I):
            if len(sentence) > 450:
                requirement = re.search(r"\b\d+\s*(?:\+|[-–]\s*\d+)?\s*years?\b[^.!?\n]{0,100}\bexperience\b", sentence, re.I)
                if requirement:
                    return requirement.group().strip()
                continue
            return re.sub(r"^\s*(?:required|minimum|preferred)\s+(?:qualifications?|requirements?|experience)\s*:+\s*", "", sentence, flags=re.I).strip()
    requirement = re.search(r'\b\d+\s*(?:\+|[-–]\s*\d+)?\s*years?\s+(?:building|developing|working|of professional|of relevant)\b[^.!?\n]{0,150}', text, re.I)
    return requirement.group().strip() if requirement else None


def canonical_job_url(value):
    """Remove known advertising parameters while preserving job identity and fragments."""
    from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
    parts = urlsplit(value)
    trackers = {'gclid', 'fbclid', 'msclkid'}
    query = [(key, val) for key, val in parse_qsl(parts.query, keep_blank_values=True)
             if not key.lower().startswith('utm_') and key.lower() not in trackers]
    if len(query) == len(parse_qsl(parts.query, keep_blank_values=True)):
        return value
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def extract_salary(description):
    """Read an explicitly labelled pay range without estimating missing pay."""
    import html
    text = html.unescape(html.unescape(description or ''))
    text = re.sub(r'<[^>]+>', ' ', text).replace('\xa0', ' ')
    amount = r'\$\s*\d[\d,]*(?:\.\d{1,2})?(?:[kK])?'
    pattern = (r'\b(?:salary(?:\s+range)?|base\s+(?:salary|pay)|pay\s+range|compensation\s+range)'
               r'[^$\n.!?]{0,80}(' + amount + r')\s*(?:[-–—]|to)\s*('
               + amount + r')(?:\s*(USD|CAD|AUD))?(?:\s*(per\s+(?:hour|year|annum)|/\s*(?:hr|hour|year)|annually|hourly))?')
    match = re.search(pattern, text, re.I)
    if not match:
        return None
    low, high, currency, period = match.groups()
    return re.sub(r'\$\s+', '$', low) + ' – ' + re.sub(r'\$\s+', '$', high) + (f' {currency.upper()}' if currency else '') + (f' {period}' if period else '')


def with_salary(job):
    """Prefer structured source pay; fill missing pay from employer text."""
    if job and not job.get('salary_range'):
        job['salary_range'] = extract_salary(job.get('description'))
    return job


def experience_summary(value):
    """Keep the overview limited to stated years or a short seniority label."""
    import html
    text = html.unescape(html.unescape(value or ''))
    years = re.search(r'\b\d+\s*(?:\+|[-–]\s*\d+)?\s*years?\b', text, re.I)
    if years:
        return years.group().strip()
    if text.strip().lower() in {'entry', 'entry-level', 'junior', 'mid', 'mid-level', 'senior', 'lead', 'principal', 'internship'}:
        return text.strip()
    return None


def extract_work_type(description):
    """Only report work arrangements explicitly stated in the posting."""
    text = re.sub(r'<[^>]+>', ' ', description or '')
    if re.search(r'\bhybrid[ -](?:role|work|position|schedule|arrangement|model)\b|\b(?:role|position|work arrangement)\b[^.!?]{0,60}\bhybrid\b', text, re.I):
        return 'Hybrid'
    if re.search(r'\b(?:fully remote|100% remote|remote (?:role|position|work|job))\b', text, re.I):
        return 'Remote'
    if re.search(r'\b(?:on[ -]site|in[ -]office) (?:role|position|work|job|schedule)\b', text, re.I):
        return 'On-site'
    return None


def rank_similar_jobs(target, candidates):
    """Recommend jobs sharing requirements and at least one verified skill match."""
    def requirements(job):
        return {skill.lower() for group in job.get('resume_requirement_groups', []) for skill in group['skills']}
    needed = requirements(target)
    ranked = []
    for job in candidates:
        score = job.get('resume_match_pct')
        if job['job_id'] == target['job_id'] or not isinstance(score, (int, float)) or score <= 0:
            continue
        shared = needed & requirements(job)
        if not shared:
            continue
        union = needed | requirements(job)
        ranked.append({**job, 'similarity_score': len(shared) / len(union), 'shared_required_skills': sorted(shared)})
    return sorted(ranked, key=lambda job: (job['similarity_score'], job['resume_match_pct'], job['job_id']), reverse=True)
