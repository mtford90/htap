/**
 * Shared constants used across daemon, CLI, and overrides.
 */

/** Internal header carrying the httap session ID (injected by runtime overrides). */
export const HTTAP_SESSION_ID_HEADER = "x-httap-internal-session-id";

/** Internal header carrying the httap session token (injected by runtime overrides). */
export const HTTAP_SESSION_TOKEN_HEADER = "x-httap-internal-session-token";

/** Internal header carrying a best-effort runtime source hint (e.g. "node"). */
export const HTTAP_RUNTIME_SOURCE_HEADER = "x-httap-internal-runtime";

/** Internal header used to correlate daemon-initiated replay requests. */
export const HTTAP_REPLAY_TOKEN_HEADER = "x-httap-internal-replay-token";
