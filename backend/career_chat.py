"""Server-side career chat; credentials and provider errors never reach the browser."""
import os
import requests

INSTRUCTIONS = '''You are Nova, NovaTeck's student career assistant for DFW technology careers.
Help with skill learning plans, resume wording, interview practice and using NovaTeck.
Be concise, practical and encouraging. Cover software, data, IT, electrical, mechanical,
aerospace and other tech disciplines. Ask for context when needed. You have no access to
profiles, resumes, job listings or live websites. Do not claim to have read those or invent
specific openings, employer requirements, match scores or application outcomes. Never
claim to add skills or apply for jobs. Explain that users can do those actions in the app.'''


def validate_messages(messages):
    if not isinstance(messages, list) or not 1 <= len(messages) <= 20:
        raise ValueError('Send between 1 and 20 chat messages.')
    cleaned = []
    for item in messages:
        if not isinstance(item, dict) or item.get('role') not in ('user', 'assistant'):
            raise ValueError('Invalid chat message.')
        content = item.get('content')
        if not isinstance(content, str) or not content.strip() or len(content) > 2000:
            raise ValueError('Each message must contain 1–2,000 characters.')
        cleaned.append({'role': item['role'], 'content': content.strip()})
    if cleaned[-1]['role'] != 'user':
        raise ValueError('The last message must be your question.')
    return cleaned


def reply(messages):
    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        return {'error': 'Nova AI is not connected yet. The app administrator needs to configure the AI service.'}, 503
    try:
        model = os.environ.get('GEMINI_MODEL', 'gemini-3.1-flash-lite')
        response = requests.post(
            f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
            headers={'x-goog-api-key': key, 'Content-Type': 'application/json'},
            json={'systemInstruction': {'parts': [{'text': INSTRUCTIONS}]},
                  'contents': [{'role': 'model' if message['role'] == 'assistant' else 'user',
                                'parts': [{'text': message['content']}]} for message in messages],
                  'generationConfig': {'maxOutputTokens': 700}}, timeout=(5, 40))
        if response.status_code == 429:
            return {'error': 'Nova AI has reached its request limit. Please try again later.'}, 429
        if not response.ok:
            return {'error': 'Nova AI could not respond. Please try again later.'}, 502
        data = response.json()
        candidates = data.get('candidates', [])
        parts = candidates[0].get('content', {}).get('parts', []) if candidates else []
        answer = '\n'.join(part['text'] for part in parts
                           if part.get('text') and not part.get('thought')).strip()
        if not answer:
            return {'error': 'Nova AI returned no answer. Please try another question.'}, 502
        return {'reply': answer}, 200
    except (requests.RequestException, ValueError, KeyError, TypeError):
        return {'error': 'Nova AI is temporarily unavailable. Please try again.'}, 502
