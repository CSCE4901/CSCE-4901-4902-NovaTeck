#!/bin/sh
# Run job sync from cron or launchd.
set -eu
PROJECT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$PROJECT_DIR/backend"
exec "$PROJECT_DIR/.venv/bin/python" job_sync.py
