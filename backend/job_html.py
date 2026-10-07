"""Sanitize employer HTML and preserve only source-defined section boundaries."""
import html
import nh3
from bs4 import BeautifulSoup, NavigableString

ALLOWED_TAGS = {'p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'h2', 'h3', 'h4', 'a'}


def clean_html(raw, source_url=None):
    if not raw:
        return None
    text = str(raw)
    # Some board APIs entity-encode their HTML fragment.
    if '&lt;' in text and '<' not in text:
        text = html.unescape(text)
    soup = BeautifulSoup(text, 'html.parser')
    for heading in soup.find_all(['h1', 'h5', 'h6']):
        heading.name = 'h2' if heading.name == 'h1' else 'h4'
    cleaned = nh3.clean(str(soup), tags=ALLOWED_TAGS, attributes={'a': {'href'}},
                       clean_content_tags={'script', 'style', 'iframe', 'svg', 'math', 'object', 'template'},
                       url_schemes={'https', 'http', 'mailto'},
                       url_relative=('rewrite_with_base', source_url) if source_url else 'deny',
                       link_rel='noopener noreferrer')
    return cleaned if BeautifulSoup(cleaned, 'html.parser').get_text(strip=True) else None


def is_heading(element):
    if element.name in {'h2', 'h3', 'h4'}:
        return True
    if element.name == 'p':
        children = [child for child in element.children if str(child).strip()]
        return len(children) == 1 and getattr(children[0], 'name', None) in {'strong', 'b'}
    return False


def group_by_headings(clean):
    sections = [{'title': None, 'html': ''}]
    for element in BeautifulSoup(clean or '', 'html.parser').children:
        if isinstance(element, NavigableString):
            if str(element).strip():
                sections[-1]['html'] += '<p>' + html.escape(str(element)) + '</p>'
        elif is_heading(element):
            sections.append({'title': element.get_text(' ', strip=True).rstrip(':'), 'html': ''})
        else:
            sections[-1]['html'] += str(element)
    return [section for section in sections if section['title'] or section['html'].strip()]


def lever_html(item):
    parts = [item.get('description') or '']
    if not parts[0] and item.get('descriptionPlain'):
        parts[0] = ''.join('<p>' + html.escape(line) + '</p>' for line in item['descriptionPlain'].splitlines() if line.strip())
    for section in item.get('lists') or []:
        if section.get('text'):
            parts.append('<h2>' + html.escape(section['text']) + '</h2>')
        parts.append(section.get('content') or '')
    parts.append(item.get('additional') or '')
    return ''.join(parts)
