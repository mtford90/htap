/**
 * Core types for htpx
 */

export interface CapturedRequest {
  id: string;
  sessionId: string;
  label?: string;
  timestamp: number;
  method: string;
  url: string;
  host: string;
  path: string;
  requestHeaders: Record<string, string>;
  requestBody?: Buffer;
  requestBodyTruncated?: boolean;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: Buffer;
  responseBodyTruncated?: boolean;
  durationMs?: number;
}

/**
 * Summary version of CapturedRequest for list views.
 * Excludes body and header data to reduce transfer size.
 */
export interface CapturedRequestSummary {
  id: string;
  sessionId: string;
  label?: string;
  timestamp: number;
  method: string;
  url: string;
  host: string;
  path: string;
  responseStatus?: number;
  durationMs?: number;
  /** Size of request body in bytes (without transferring the body itself) */
  requestBodySize: number;
  /** Size of response body in bytes (without transferring the body itself) */
  responseBodySize: number;
}

export interface Session {
  id: string;
  label?: string;
  pid: number;
  startedAt: number;
}

export interface DaemonStatus {
  running: boolean;
  proxyPort?: number;
  sessionCount: number;
  requestCount: number;
  version: string;
}
