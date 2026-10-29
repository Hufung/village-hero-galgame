#!/bin/sh
# 交付物：web/ = production build。gate: 語法檢查 + 引用完整性。
set -e
cd "$(dirname "$0")"
node --check web/game.js
node --check web/story.js
node --check web/sw.js
for ref in index.html ui.css story.js game.js manifest.webmanifest icon.png sw.js; do
  test -f "web/$ref" || { echo "BUILD FAIL: missing $ref"; exit 1; }
done
rm -rf dist && cp -r web dist
echo "BUILD OK -> dist/ ($(ls dist | wc -l | tr -d ' ') files)"
