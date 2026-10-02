"""Validation for optional profile data from the wireframe form."""
import base64
import datetime
from urllib.parse import urlsplit


def validate_details(data):
    """Validate details."""
    if not isinstance(data, dict):
        raise ValueError('Invalid profile details')
    result = {}
    for key, limit in [('phone', 50), ('location', 255), ('salary_range', 100), ('preferred_location', 255)]:
        value = data.get(key, '')
        if not isinstance(value, str) or len(value) > limit:
            raise ValueError(f'Invalid {key.replace("_", " ")}')
        result[key] = value.strip()
    majors = {
        'Computer Science': 'software', 'Software Engineering': 'software',
        'Data Science': 'data_ai', 'Artificial Intelligence': 'data_ai',
        'Information Technology': 'it_cloud_security', 'Information Systems': 'it_cloud_security', 'Cybersecurity': 'it_cloud_security',
        'Computer Engineering': 'electrical_hardware', 'Electrical Engineering': 'electrical_hardware',
        'Mechanical Engineering': 'mechanical', 'Aerospace Engineering': 'aerospace',
        'Industrial Engineering': 'quality_systems', 'Systems Engineering': 'quality_systems', 'Other / Undecided': '',
    }
    major = data.get('college_major', '')
    if not isinstance(major, str) or major and major not in majors:
        raise ValueError('Invalid college major')
    result['college_major'] = major
    # Derive focus on the server; preserve legacy preferences until a major is chosen.
    focus = majors[major] if major else data.get('career_focus', '')
    if focus not in ('', 'software', 'data_ai', 'it_cloud_security', 'electrical_hardware', 'mechanical', 'aerospace', 'quality_systems'):
        raise ValueError('Invalid career focus')
    result['career_focus'] = focus
    work_types = data.get('work_types', [])
    if not isinstance(work_types, list) or any(x not in ['Full-time', 'Part-time', 'Contract', 'Internship'] for x in work_types):
        raise ValueError('Invalid work types')
    result['work_types'] = list(dict.fromkeys(work_types))
    levels = data.get('proficiency', {})
    if not isinstance(levels, dict) or len(levels) > 100 or any(len(k) > 100 or v not in ['Beginner', 'Intermediate', 'Advanced'] for k, v in levels.items()):
        raise ValueError('Invalid skill proficiency')
    result['proficiency'] = levels
    experiences = data.get('experience', [])
    if not isinstance(experiences, list) or len(experiences) > 20:
        raise ValueError('Provide at most 20 experience entries')
    result['experience'] = []
    for item in experiences:
        if not isinstance(item, dict):
            raise ValueError('Invalid experience')
        record = {}
        for key in ['company', 'title', 'start', 'end', 'description']:
            value = item.get(key, '')
            if not isinstance(value, str) or len(value) > (3000 if key == 'description' else 255):
                raise ValueError('Invalid experience field')
            record[key] = value.strip()
        for key in ['start', 'end']:
            if record[key]:
                try:
                    datetime.date.fromisoformat(record[key])
                except ValueError:
                    raise ValueError('Enter valid experience dates')
        if record['start'] and record['end'] and record['end'] < record['start']:
            raise ValueError('Experience end date must not precede start date')
        result['experience'].append(record)
    projects = data.get('projects', [])
    if not isinstance(projects, list) or len(projects) > 20:
        raise ValueError('Provide at most 20 projects')
    result['projects'] = []
    for item in projects:
        if not isinstance(item, dict):
            raise ValueError('Invalid project')
        record = {}
        for key, limit in [('title', 255), ('technologies', 500), ('url', 1000), ('description', 3000)]:
            value = item.get(key, '')
            if not isinstance(value, str) or len(value) > limit:
                raise ValueError('Invalid project field')
            record[key] = value.strip()
        if not any(record.values()):
            continue
        if not record['title']:
            raise ValueError('Enter a title for each project')
        if record['url']:
            parsed = urlsplit(record['url'])
            if parsed.scheme not in ('http', 'https') or not parsed.hostname:
                raise ValueError('Project links must start with http:// or https://')
        result['projects'].append(record)
    photo = data.get('photo', '')
    if not isinstance(photo, str) or len(photo) > 700000:
        raise ValueError('Profile photo must be smaller than 500 KB')
    if photo:
        try:
            header, encoded = photo.split(',', 1)
            raw = base64.b64decode(encoded, validate=True)
            valid = (header == 'data:image/png;base64' and raw.startswith(b'\x89PNG\r\n\x1a\n')) or (header == 'data:image/jpeg;base64' and raw.startswith(b'\xff\xd8\xff'))
            if not valid or len(raw) > 500000:
                raise ValueError()
        except Exception:
            raise ValueError('Upload a PNG or JPEG photo smaller than 500 KB')
    result['photo'] = photo
    return result
