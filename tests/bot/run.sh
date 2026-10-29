#!/usr/bin/env bash
# Chatbot conversation tests (no network, no AI): bundles the bot with esbuild and runs the scenarios.
set -euo pipefail
cd "$(dirname "$0")"
T="${TMPDIR:-/tmp}"
ESB=../../mutqan-app/node_modules/.bin/esbuild
$ESB run.mjs --bundle --platform=node --format=esm --outfile="$T/mutqan-bot-test.mjs" --log-level=error
$ESB blind.mjs --bundle --platform=node --format=esm --outfile="$T/mutqan-bot-blind.mjs" --log-level=error
$ESB v2.mjs --bundle --platform=node --format=esm --outfile="$T/mutqan-bot-v2.mjs" --log-level=error
$ESB kb.mjs --bundle --platform=node --format=esm --outfile="$T/mutqan-bot-kb.mjs" --log-level=error
$ESB sales.mjs --bundle --platform=node --format=esm --outfile="$T/mutqan-bot-sales.mjs" --log-level=error
node "$T/mutqan-bot-test.mjs"
node "$T/mutqan-bot-blind.mjs"
node "$T/mutqan-bot-v2.mjs"
node "$T/mutqan-bot-kb.mjs"
node "$T/mutqan-bot-sales.mjs"
