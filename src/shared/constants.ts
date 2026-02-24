/**
 * Shared constants used across daemon, CLI, and overrides.
 */

/** Internal header carrying the htap session ID (injected by runtime overrides). */
export const HTAP_SESSION_ID_HEADER = "x-htap-internal-session-id";

/** Internal header carrying the htap session token (injected by runtime overrides). */
export const HTAP_SESSION_TOKEN_HEADER = "x-htap-internal-session-token";

/** Internal header carrying a best-effort runtime source hint (e.g. "node"). */
export const HTAP_RUNTIME_SOURCE_HEADER = "x-htap-internal-runtime";

/** Internal header used to correlate daemon-initiated replay requests. */
export const HTAP_REPLAY_TOKEN_HEADER = "x-htap-internal-replay-token";
