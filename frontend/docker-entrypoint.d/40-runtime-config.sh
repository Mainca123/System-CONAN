#!/bin/sh
set -eu

if [ -n "${IDENTITY_URL:-}" ]; then
  printf 'window.CONAN_IDENTITY_URL = "%s";\n' "$IDENTITY_URL" > /usr/share/nginx/html/runtime.js
fi
