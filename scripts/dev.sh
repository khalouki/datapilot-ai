#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -x .venv/bin/uvicorn || ! -d frontend/node_modules ]]; then
  echo 'Install backend and frontend dependencies first; see README.md.' >&2
  exit 1
fi
.venv/bin/uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 &
backend_pid=$!
(cd frontend && exec node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1) &
frontend_pid=$!
trap 'kill "$backend_pid" "$frontend_pid" 2>/dev/null || true' EXIT INT TERM
wait -n "$backend_pid" "$frontend_pid"
