import { describe, it, expect } from "vitest";
import { generateHar, generateHarString } from "../../../src/cli/tui/utils/har.js";
import type { CapturedRequest } from "../../../src/shared/types.js";

function createMockRequest(overrides: Partial<CapturedRequest> = {}): CapturedRequest {
  return {
    id: "test-id",
    sessionId: "session-id",
    timestamp: 1705320000000, // Fixed timestamp for consistent tests
    method: "GET",
    url: "https://example.com/api/test",
    host: "example.com",
    path: "/api/test",
    requestHeaders: {},
    ...overrides,
  };
}

describe("generateHar", () => {
  it("should generate valid HAR structure", () => {
    const requests = [createMockRequest()];
    const har = generateHar(requests);

    expect(har.log.version).toBe("1.2");
    expect(har.log.creator.name).toBe("htpx");
    expect(har.log.entries).toHaveLength(1);
  });

  it("should include request details", () => {
    const request = createMockRequest({
      method: "POST",
      url: "https://example.com/api/test?foo=bar",
      requestHeaders: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
      requestBody: Buffer.from('{"name":"test"}'),
    });

    const har = generateHar([request]);
    const entry = har.log.entries[0];
    expect(entry).toBeDefined();

    expect(entry.request.method).toBe("POST");
    expect(entry.request.url).toBe("https://example.com/api/test?foo=bar");
    expect(entry.request.headers).toContainEqual({
      name: "Content-Type",
      value: "application/json",
    });
    expect(entry.request.headers).toContainEqual({
      name: "Authorization",
      value: "Bearer token",
    });
    expect(entry.request.postData).toEqual({
      mimeType: "application/json",
      text: '{"name":"test"}',
    });
  });

  it("should include response details", () => {
    const request = createMockRequest({
      responseStatus: 200,
      responseHeaders: {
        "Content-Type": "application/json",
        "X-Request-Id": "abc123",
      },
      responseBody: Buffer.from('{"success":true}'),
      durationMs: 150,
    });

    const har = generateHar([request]);
    const entry = har.log.entries[0];
    expect(entry).toBeDefined();

    expect(entry.response.status).toBe(200);
    expect(entry.response.statusText).toBe("OK");
    expect(entry.response.headers).toContainEqual({
      name: "Content-Type",
      value: "application/json",
    });
    expect(entry.response.content.text).toBe('{"success":true}');
    expect(entry.response.content.mimeType).toBe("application/json");
  });

  it("should include timing information", () => {
    const request = createMockRequest({
      durationMs: 250,
    });

    const har = generateHar([request]);
    const entry = har.log.entries[0];
    expect(entry).toBeDefined();

    expect(entry.time).toBe(250);
    expect(entry.timings.wait).toBe(250);
  });

  it("should parse query string", () => {
    const request = createMockRequest({
      url: "https://example.com/api?name=test&count=5",
    });

    const har = generateHar([request]);
    const entry = har.log.entries[0];
    expect(entry).toBeDefined();

    expect(entry.request.queryString).toContainEqual({ name: "name", value: "test" });
    expect(entry.request.queryString).toContainEqual({ name: "count", value: "5" });
  });

  it("should format timestamp as ISO string", () => {
    const request = createMockRequest({
      timestamp: 1705320000000,
    });

    const har = generateHar([request]);
    const entry = har.log.entries[0];
    expect(entry).toBeDefined();

    expect(entry.startedDateTime).toBe("2024-01-15T12:00:00.000Z");
  });

  it("should handle multiple requests", () => {
    const requests = [
      createMockRequest({ id: "1", path: "/api/one" }),
      createMockRequest({ id: "2", path: "/api/two" }),
      createMockRequest({ id: "3", path: "/api/three" }),
    ];

    const har = generateHar(requests);

    expect(har.log.entries).toHaveLength(3);
  });

  it("should handle missing optional fields", () => {
    const request = createMockRequest({
      responseStatus: undefined,
      responseHeaders: undefined,
      responseBody: undefined,
      durationMs: undefined,
    });

    const har = generateHar([request]);
    const entry = har.log.entries[0];
    expect(entry).toBeDefined();

    expect(entry.response.status).toBe(0);
    expect(entry.response.headers).toEqual([]);
    expect(entry.response.content.text).toBeUndefined();
    expect(entry.time).toBe(0);
  });

  it("should handle various status codes", () => {
    const testCases = [
      { status: 201, text: "Created" },
      { status: 204, text: "No Content" },
      { status: 301, text: "Moved Permanently" },
      { status: 302, text: "Found" },
      { status: 400, text: "Bad Request" },
      { status: 401, text: "Unauthorized" },
      { status: 403, text: "Forbidden" },
      { status: 404, text: "Not Found" },
      { status: 500, text: "Internal Server Error" },
      { status: 502, text: "Bad Gateway" },
      { status: 503, text: "Service Unavailable" },
      { status: 418, text: "" }, // Unknown status
    ];

    for (const { status, text } of testCases) {
      const request = createMockRequest({ responseStatus: status });
      const har = generateHar([request]);
      const entry = har.log.entries[0];
      expect(entry).toBeDefined();
      expect(entry.response.statusText).toBe(text);
    }
  });
});

describe("generateHarString", () => {
  it("should generate valid JSON string", () => {
    const requests = [createMockRequest()];
    const harString = generateHarString(requests);

    expect(() => JSON.parse(harString)).not.toThrow();
  });

  it("should be pretty-printed", () => {
    const requests = [createMockRequest()];
    const harString = generateHarString(requests);

    expect(harString).toContain("\n");
    expect(harString).toContain("  ");
  });

  it("should generate empty entries for empty array", () => {
    const harString = generateHarString([]);
    const har = JSON.parse(harString) as { log: { entries: unknown[] } };

    expect(har.log.entries).toEqual([]);
  });
});
