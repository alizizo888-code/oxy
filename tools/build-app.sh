#!/usr/bin/env bash
# Build the PWA into the plugin. Keeps the PREVIOUS build's hashed files too, so tabs opened before a release never hit a missing chunk.
set -euo pipefail
cd "$(dirname "$0")/.."
OLD=$(mktemp -d)
[ -d oxygen-ac-automation/app/assets ] && cp -r oxygen-ac-automation/app/assets "$OLD/assets" || mkdir -p "$OLD/assets"
[ -f oxygen-ac-automation/app/gen.txt ] && cp oxygen-ac-automation/app/gen.txt "$OLD/gen.txt" || true
(cd mutqan-app && VITE_BASE=/wp-content/plugins/oxygen-ac-automation/app/ npx vite build --logLevel error)
ls mutqan-app/dist/assets > mutqan-app/dist/gen.txt
[ -f "$OLD/gen.txt" ] || ls "$OLD/assets" > "$OLD/gen.txt"
while read -r f; do if [ -f "$OLD/assets/$f" ] && [ ! -f "mutqan-app/dist/assets/$f" ]; then cp "$OLD/assets/$f" "mutqan-app/dist/assets/$f"; fi; done < "$OLD/gen.txt"
rm -rf oxygen-ac-automation/app && cp -r mutqan-app/dist oxygen-ac-automation/app
echo "app files: $(ls oxygen-ac-automation/app/assets | wc -l)"
