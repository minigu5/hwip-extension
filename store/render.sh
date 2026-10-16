#!/bin/bash
# 사용법: ./render.sh <src/xxx.html> <out.png> <width> <height>
# 헤드리스 크롬으로 HTML을 PNG로 렌더한다 (알파 채널 제거 — 스토어는 24bit PNG 요구)
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP=$(mktemp -d)
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run --user-data-dir="$TMP" \
  --window-size="$3,$4" --virtual-time-budget=8000 --screenshot="$TMP/o.png" "file://$(cd "$(dirname "$1")" && pwd)/$(basename "$1")" >/dev/null 2>&1
magick "$TMP/o.png" -background white -alpha remove -alpha off -crop "${3}x${4}+0+0" +repage "$2"
rm -rf "$TMP"
