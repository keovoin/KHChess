#!/bin/sh
# KHChess container entrypoint.
#
# Starts the single shared Stockfish engine daemon (api/engine-daemon.js),
# then the Motia server. The daemon owns the ONLY engine process in the
# container; all Motia step workers (short-lived, one per request) talk to it
# over localhost TCP — so no matter how many workers run concurrently, RAM
# stays ~320-400MB, safely under the 512MB limit. See
# api/services/chess/stockfish.ts for the rationale (per-worker engines
# OOM-killed the container before this).
set -u

export STOCKFISH_DAEMON_PORT="${STOCKFISH_DAEMON_PORT:-7878}"
export STOCKFISH_DAEMON_HOST="${STOCKFISH_DAEMON_HOST:-127.0.0.1}"

node /app/api/engine-daemon.js &
DAEMON_PID=$!

npx motia start -p "${PORT:-3000}" &
APP_PID=$!

# Forward termination signals to the daemon so nothing lingers.
trap 'kill "$DAEMON_PID" "$APP_PID" 2>/dev/null; exit 143' TERM INT

wait "$APP_PID"
STATUS=$?
kill "$DAEMON_PID" 2>/dev/null
exit "$STATUS"
