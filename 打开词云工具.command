#!/bin/bash
cd "$(dirname "$0")"
PORT=8765
URL="http://127.0.0.1:${PORT}/"
if ! command -v python3 >/dev/null 2>&1; then
  echo "需要 python3 才能在本机打开这个工具。"
  exit 1
fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  open "$URL"
  exit 0
fi
python3 -m http.server "$PORT" &
server=$!
for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    break
  fi
  sleep 0.15
done
open "$URL"
wait "$server"
