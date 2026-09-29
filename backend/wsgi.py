"""Fail closed if production authentication configuration is absent."""
import os
from app import app

secret = os.environ.get('JWT_SECRET', '')
if len(secret) < 32 or secret.startswith('replace-'):
    raise RuntimeError('Set JWT_SECRET to a random secret of at least 32 characters')

from nlp_tagger import skill_matcher
skill_matcher()  # Initialize once per worker before accepting resume requests.
