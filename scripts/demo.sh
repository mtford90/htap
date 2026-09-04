#!/usr/bin/env bash
# Sets up the httap demo in one command: starts the proxy against
# examples/demo, seeds a burst of traffic through it, then prints the
# command to open the TUI. See examples/demo/README.md for the manual
# three-command flow this automates.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DEMO_DIR="examples/demo"
CLI="node dist/cli/index.js --dir $DEMO_DIR"

if [ ! -f dist/cli/index.js ]; then
  echo "dist/cli/index.js not found — run 'pnpm build' first." >&2
  exit 1
fi

echo "Starting httap for $DEMO_DIR ..."
eval "$($CLI on -l demo --no-restart)"

echo "Seeding a burst of traffic ..."
node "$DEMO_DIR/app/traffic.mjs" --once

cat <<EOF

httap is running against $DEMO_DIR.

Open the TUI with:

  $CLI tui

To keep live traffic flowing while you look around, run in another terminal:

  node $DEMO_DIR/app/traffic.mjs
EOF
