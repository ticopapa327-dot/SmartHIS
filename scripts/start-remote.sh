#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/home/deploy/apps/smarthis/current}"
SHARED_ROOT="${SHARED_ROOT:-/home/deploy/apps/smarthis/shared}"
NODE_HOME="${NODE_HOME:-/home/deploy/.local/node-current}"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-7070}"

mkdir -p "$SHARED_ROOT/logs"

if [ -f "$SHARED_ROOT/logs/server.pid" ]; then
  OLD_PID="$(cat "$SHARED_ROOT/logs/server.pid")"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "SmartHIS is already running with PID $OLD_PID"
    exit 0
  fi
fi

cd "$APP_ROOT"
export PATH="$NODE_HOME/bin:$PATH"
export HOST PORT

nohup node src/server.js > "$SHARED_ROOT/logs/server.log" 2> "$SHARED_ROOT/logs/server.err.log" &
echo "$!" > "$SHARED_ROOT/logs/server.pid"
echo "SmartHIS started with PID $(cat "$SHARED_ROOT/logs/server.pid") on $HOST:$PORT"
