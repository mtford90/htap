#!/usr/bin/env bash
#
# Shell integration tests for htap
#
# Run with: bash tests/shell/intercept.test.sh
#
# Requirements:
# - pnpm build must have been run first
# - Tests use a temporary directory as the project root
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HTAP_BIN="$PROJECT_ROOT/dist/cli/index.js"

# Colours for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No colour

TESTS_PASSED=0
TESTS_FAILED=0

# Create temp directory for testing
TEST_DIR=$(mktemp -d)
trap 'cleanup' EXIT

cleanup() {
  # Stop any daemon that might be running
  if [[ -f "$TEST_DIR/.htap/daemon.pid" ]]; then
    local pid
    pid=$(cat "$TEST_DIR/.htap/daemon.pid" 2>/dev/null || true)
    if [[ -n "$pid" ]]; then
      kill "$pid" 2>/dev/null || true
    fi
  fi
  rm -rf "$TEST_DIR"
}

pass() {
  echo -e "${GREEN}✓ $1${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
  echo -e "${RED}✗ $1${NC}"
  echo "  $2"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

# Initialise test project
init_test_project() {
  mkdir -p "$TEST_DIR/.git"  # Create git dir so it's recognised as a project
  cd "$TEST_DIR"
}

# ------------------------------------------------------------------------------
# Test: htap on outputs env vars
# ------------------------------------------------------------------------------
test_on_outputs_env_vars() {
  init_test_project

  local output
  output=$(node "$HTAP_BIN" on --label=test-session 2>&1)

  # Check for HTTP_PROXY
  if echo "$output" | grep -q 'export HTTP_PROXY='; then
    pass "htap on outputs HTTP_PROXY"
  else
    fail "htap on outputs HTTP_PROXY" "Output: $output"
    return
  fi

  # Check for HTTPS_PROXY
  if echo "$output" | grep -q 'export HTTPS_PROXY='; then
    pass "htap on outputs HTTPS_PROXY"
  else
    fail "htap on outputs HTTPS_PROXY" "Output: $output"
  fi

  # Check for SSL_CERT_FILE
  if echo "$output" | grep -q 'export SSL_CERT_FILE='; then
    pass "htap on outputs SSL_CERT_FILE"
  else
    fail "htap on outputs SSL_CERT_FILE" "Output: $output"
  fi

  # Check for NODE_EXTRA_CA_CERTS
  if echo "$output" | grep -q 'export NODE_EXTRA_CA_CERTS='; then
    pass "htap on outputs NODE_EXTRA_CA_CERTS"
  else
    fail "htap on outputs NODE_EXTRA_CA_CERTS" "Output: $output"
  fi

  # Check for session ID
  if echo "$output" | grep -q 'export HTAP_SESSION_ID='; then
    pass "htap on outputs HTAP_SESSION_ID"
  else
    fail "htap on outputs HTAP_SESSION_ID" "Output: $output"
  fi

  # Check for session token
  if echo "$output" | grep -q 'export HTAP_SESSION_TOKEN='; then
    pass "htap on outputs HTAP_SESSION_TOKEN"
  else
    fail "htap on outputs HTAP_SESSION_TOKEN" "Output: $output"
  fi

  # Check for label
  if echo "$output" | grep -q 'export HTAP_LABEL='; then
    pass "htap on outputs HTAP_LABEL when provided"
  else
    fail "htap on outputs HTAP_LABEL when provided" "Output: $output"
  fi

  # Stop daemon after test
  node "$HTAP_BIN" daemon stop >/dev/null 2>&1 || true
}

# ------------------------------------------------------------------------------
# Test: htap on env vars can be evaluated
# ------------------------------------------------------------------------------
test_on_env_vars_evaluable() {
  init_test_project

  # Evaluate the output
  eval "$(node "$HTAP_BIN" on --label=eval-test 2>&1 | grep '^export')"

  # Check env vars are set
  if [[ -n "${HTTP_PROXY:-}" ]]; then
    pass "HTTP_PROXY is set after eval"
  else
    fail "HTTP_PROXY is set after eval" "HTTP_PROXY is empty or unset"
    return
  fi

  if [[ -n "${HTTPS_PROXY:-}" ]]; then
    pass "HTTPS_PROXY is set after eval"
  else
    fail "HTTPS_PROXY is set after eval" "HTTPS_PROXY is empty or unset"
  fi

  if [[ -n "${HTAP_SESSION_ID:-}" ]]; then
    pass "HTAP_SESSION_ID is set after eval"
  else
    fail "HTAP_SESSION_ID is set after eval" "HTAP_SESSION_ID is empty or unset"
  fi

  if [[ -n "${HTAP_SESSION_TOKEN:-}" ]]; then
    pass "HTAP_SESSION_TOKEN is set after eval"
  else
    fail "HTAP_SESSION_TOKEN is set after eval" "HTAP_SESSION_TOKEN is empty or unset"
  fi

  # Stop daemon after test
  node "$HTAP_BIN" daemon stop >/dev/null 2>&1 || true
}

# ------------------------------------------------------------------------------
# Test: htap status shows running daemon
# ------------------------------------------------------------------------------
test_status_shows_running() {
  init_test_project

  # Start daemon via on
  eval "$(node "$HTAP_BIN" on 2>&1 | grep '^export')"

  # Check status
  local output
  output=$(node "$HTAP_BIN" status 2>&1)

  if echo "$output" | grep -q "running"; then
    pass "htap status shows daemon is running"
  else
    fail "htap status shows daemon is running" "Output: $output"
    return
  fi

  if echo "$output" | grep -q "Proxy port:"; then
    pass "htap status shows proxy port"
  else
    fail "htap status shows proxy port" "Output: $output"
  fi

  # Stop daemon after test
  node "$HTAP_BIN" daemon stop >/dev/null 2>&1 || true
}

# ------------------------------------------------------------------------------
# Test: htap daemon stop stops the daemon
# ------------------------------------------------------------------------------
test_stop_daemon() {
  init_test_project

  # Start daemon via on
  eval "$(node "$HTAP_BIN" on 2>&1 | grep '^export')"

  # Stop daemon
  local output
  output=$(node "$HTAP_BIN" daemon stop 2>&1)

  if echo "$output" | grep -q "Daemon stopped"; then
    pass "htap daemon stop confirms daemon stopped"
  else
    fail "htap daemon stop confirms daemon stopped" "Output: $output"
    return
  fi

  # Verify it's actually stopped
  sleep 1
  output=$(node "$HTAP_BIN" status 2>&1)

  if echo "$output" | grep -q "not running"; then
    pass "daemon is stopped after htap daemon stop"
  else
    fail "daemon is stopped after htap daemon stop" "Output: $output"
  fi
}

# ------------------------------------------------------------------------------
# Test: htap clear clears captured requests
# ------------------------------------------------------------------------------
test_clear_requests() {
  init_test_project

  # Start daemon via on
  eval "$(node "$HTAP_BIN" on 2>&1 | grep '^export')"

  # Clear requests
  local output
  output=$(node "$HTAP_BIN" clear 2>&1)

  if echo "$output" | grep -q "Requests cleared"; then
    pass "htap clear confirms requests cleared"
  else
    fail "htap clear confirms requests cleared" "Output: $output"
    return
  fi

  # Verify request count is 0
  output=$(node "$HTAP_BIN" status 2>&1)

  if echo "$output" | grep -q "Requests:      0"; then
    pass "request count is 0 after clear"
  else
    fail "request count is 0 after clear" "Output: $output"
  fi

  # Stop daemon after test
  node "$HTAP_BIN" daemon stop >/dev/null 2>&1 || true
}

# ------------------------------------------------------------------------------
# Run all tests
# ------------------------------------------------------------------------------
echo "=== htap shell integration tests ==="
echo ""

test_on_outputs_env_vars
test_on_env_vars_evaluable
test_status_shows_running
test_clear_requests
test_stop_daemon

echo ""
echo "=== Results ==="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
if [[ $TESTS_FAILED -gt 0 ]]; then
  echo -e "${RED}Failed: $TESTS_FAILED${NC}"
  exit 1
else
  echo "Failed: 0"
fi
