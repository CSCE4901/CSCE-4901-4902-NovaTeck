"""Job metadata."""
import re


def extract_experience(description):
    # Keep the full experience requirement.
    for sentence in re.split(r"(?<=[.!?])\s+|\n", description or ""):
        if re.search(r"\b\d+\s*(?:\+|[-–]\s*\d+)?\s*years?\b", sentence, re.I) and re.search(r"\bexperience\b", sentence, re.I):
            return re.sub(r"^\s*(?:required|minimum|preferred)\s+(?:qualifications?|requirements?|experience)\s*:+\s*", "", sentence, flags=re.I).strip()
    return None
