#!/usr/bin/env bash
set -euo pipefail

SHARED_ROOT="${SHARED_ROOT:-/home/deploy/apps/smarthis/shared}"
PID_FILE="$SHARED_ROOT/logs/server.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "SmartHIS is not running: PID file not found"
  exit 0
fi

PID="$(cat "$PID_FILE")"
if [ -z "$PID" ] || ! kill -0 "$PID" 2>/dev/null; then
  rm -f "$PID_FILE"
  echo "SmartHIS is not running: stale PID file removed"
  exit 0
fi

kill "$PID"
for _ in 1 2 3 4 5; do
  if ! kill -0 "$PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    echo "SmartHIS stopped"
    exit 0
  fi
  sleep 1
done

kill -9 "$PID" 2>/dev/null || true
rm -f "$PID_FILE"
echo "SmartHIS stopped with SIGKILL"
