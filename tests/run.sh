#!/bin/sh
# Run the rules tests with macOS's built-in JavaScriptCore if it's there,
# otherwise with Node (>= 22). Run from the repository root.
set -e
cd "$(dirname "$0")/.."
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
if [ -x "$JSC" ]; then
  exec "$JSC" -m tests/run.js
else
  exec node tests/run.js
fi
