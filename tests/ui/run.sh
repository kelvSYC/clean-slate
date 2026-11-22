#!/bin/sh
# Run the browser checks in tests/ui/checks.html with a headless Chrome or
# Chromium. Needs only python3 (for a local web server) and a Chrome-family
# browser; set CHROME=/path/to/browser to choose one. Run from anywhere.
set -eu
cd "$(dirname "$0")/../.."

if [ -z "${CHROME:-}" ]; then
  for candidate in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "$(command -v google-chrome || true)" \
    "$(command -v chromium || true)" \
    "$(command -v chromium-browser || true)"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then CHROME="$candidate"; break; fi
  done
fi
[ -n "${CHROME:-}" ] || { echo "No Chrome or Chromium found; set CHROME=/path/to/browser" >&2; exit 2; }

PORT="${PORT:-8731}"
profile="$(mktemp -d)"
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null; rm -rf "$profile"' EXIT INT TERM
sleep 1

# A fresh profile each run, so a cached older script can never be tested.
output="$("$CHROME" --headless=new --disable-gpu --no-first-run --no-sandbox \
  --user-data-dir="$profile" --virtual-time-budget=10000 \
  --dump-dom "http://127.0.0.1:$PORT/tests/ui/checks.html" 2>/dev/null)"

# Keep only the result lines, undoing the HTML escaping of the dump.
report="$(printf '%s\n' "$output" | sed 's/.*<pre id="out">//' | sed -n '/^RESULTS/,/^END/p' | sed -e 's/&lt;/</g' -e 's/&gt;/>/g' -e 's/&amp;/\&/g')"
if [ -z "$report" ]; then
  echo "The checks page never finished; the game or the checks threw an error." >&2
  exit 1
fi
printf '%s\n' "$report" | grep -E '^(PASS|FAIL)'
passed=$(printf '%s\n' "$report" | grep -c '^PASS' || true)
failed=$(printf '%s\n' "$report" | grep -c '^FAIL' || true)
echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
