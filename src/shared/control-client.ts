import * as net from "node:net";
import type { CapturedRequest, CapturedRequestSummary, DaemonStatus, Session } from "./types.js";

const CONTROL_TIMEOUT_MS = 5000;

/**
 * JSON-RPC style message format for control API.
 */
export interface ControlMessage {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface ControlResponse {
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * Recursively revive Buffer objects from JSON serialisation.
 * JSON.stringify(Buffer) produces { type: 'Buffer', data: [...] }
 * This converts them back to actual Buffer instances.
 */
function reviveBuffers<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Check if this is a serialised Buffer
  if (
    typeof obj === "object" &&
    "type" in obj &&
    "data" in obj &&
    (obj as Record<string, unknown>)["type"] === "Buffer" &&
    Array.isArray((obj as Record<string, unknown>)["data"])
  ) {
    return Buffer.from((obj as { data: number[] }).data) as T;
  }

  // Recurse into arrays
  if (Array.isArray(obj)) {
    return obj.map(reviveBuffers) as T;
  }

  // Recurse into objects
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = reviveBuffers(value);
    }
    return result as T;
  }

  return obj;
}

/**
 * Client for communicating with the control server via Unix socket.
 */
export class ControlClient {
  private socketPath: string;
  private requestId = 0;

  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  /**
   * Send a request to the control server and wait for response.
   */
  async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.socketPath);
      const id = String(++this.requestId);
      let buffer = "";

      socket.on("connect", () => {
        const message: ControlMessage = { id, method, params };
        socket.write(JSON.stringify(message) + "\n");
      });

      socket.on("data", (data) => {
        buffer += data.toString();

        const newlineIndex = buffer.indexOf("\n");
        if (newlineIndex !== -1) {
          const responseStr = buffer.slice(0, newlineIndex);

          try {
            const response = JSON.parse(responseStr) as ControlResponse;
            socket.end();

            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(reviveBuffers(response.result) as T);
            }
          } catch (err) {
            socket.end();
            reject(err);
          }
        }
      });

      socket.on("error", (err) => {
        reject(err);
      });

      socket.setTimeout(CONTROL_TIMEOUT_MS, () => {
        socket.destroy();
        reject(new Error("Control request timed out"));
      });
    });
  }

  /**
   * Check if the daemon is running by sending a ping.
   */
  async ping(): Promise<boolean> {
    try {
      await this.request<{ pong: boolean }>("ping");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get daemon status.
   */
  async status(): Promise<DaemonStatus> {
    return this.request<DaemonStatus>("status");
  }

  /**
   * Register a new session.
   */
  async registerSession(label?: string, pid?: number): Promise<Session> {
    return this.request<Session>("registerSession", { label, pid });
  }

  /**
   * List captured requests (full data including bodies).
   */
  async listRequests(options?: {
    sessionId?: string;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<CapturedRequest[]> {
    return this.request<CapturedRequest[]>("listRequests", options);
  }

  /**
   * List request summaries (excludes body/header data for performance).
   */
  async listRequestsSummary(options?: {
    sessionId?: string;
    label?: string;
    limit?: number;
    offset?: number;
  }): Promise<CapturedRequestSummary[]> {
    return this.request<CapturedRequestSummary[]>("listRequestsSummary", options);
  }

  /**
   * Get a specific request by ID.
   */
  async getRequest(id: string): Promise<CapturedRequest | null> {
    return this.request<CapturedRequest | null>("getRequest", { id });
  }

  /**
   * Count requests.
   */
  async countRequests(options?: { sessionId?: string; label?: string }): Promise<number> {
    return this.request<number>("countRequests", options);
  }

  /**
   * Clear all requests.
   */
  async clearRequests(): Promise<void> {
    await this.request<{ success: boolean }>("clearRequests");
  }
}
