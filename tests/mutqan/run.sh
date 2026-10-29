#!/usr/bin/env bash
# Integration tests for the Mutqan backend: a sqlite-backed WordPress stand-in + php -S + HTTP tests.
# Usage: tests/mutqan/run.sh   (needs php with pdo_sqlite, node >= 18)
set -euo pipefail
cd "$(dirname "$0")"
DATA="${TMPDIR:-/tmp}/mutqan-test-data"
rm -rf "$DATA"
php setup_owner.php 'Test-Only-Pw-1234' >/dev/null
php cfg_ai.php >/dev/null
php -S 127.0.0.1:8099 router.php >/dev/null 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
sleep 1
php ac_floor.php
php promo.php
php inhouse.php
php wa.php
php notif.php
MQ_DATA="$(mktemp -d)" php passkey.php
node itest.mjs
