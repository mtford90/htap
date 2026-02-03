import { describe, it, expect } from "vitest";
import { generateCurl } from "../../../src/cli/tui/utils/curl.js";
import type { CapturedRequest } from "../../../src/shared/types.js";

function createMockRequest(overrides: Partial<CapturedRequest> = {}): CapturedRequest {
  return {
    id: "test-id",
    sessionId: "session-id",
    timestamp: Date.now(),
    method: "GET",
    url: "https://example.com/api/test",
    host: "example.com",
    path: "/api/test",
    requestHeaders: {},
    ...overrides,
  };
}

describe("generateCurl", () => {
  it("should generate basic GET request", () => {
    const request = createMockRequest();
    const curl = generateCurl(request);

    expect(curl).toContain("curl");
    expect(curl).toContain("'https://example.com/api/test'");
    expect(curl).not.toContain("-X");
  });

  it("should include method for non-GET requests", () => {
    const request = createMockRequest({ method: "POST" });
    const curl = generateCurl(request);

    expect(curl).toContain("-X POST");
    expect(curl).toContain("'https://example.com/api/test'");
  });

  it("should include custom headers", () => {
    const request = createMockRequest({
      requestHeaders: {
        Authorization: "Bearer token123",
        "Content-Type": "application/json",
      },
    });
    const curl = generateCurl(request);

    expect(curl).toContain("-H 'Authorization: Bearer token123'");
    expect(curl).toContain("-H 'Content-Type: application/json'");
  });

  it("should exclude automatic headers", () => {
    const request = createMockRequest({
      requestHeaders: {
        Host: "example.com",
        "Content-Length": "100",
        Connection: "keep-alive",
        "Accept-Encoding": "gzip",
      },
    });
    const curl = generateCurl(request);

    expect(curl).not.toContain("Host:");
    expect(curl).not.toContain("Content-Length:");
    expect(curl).not.toContain("Connection:");
    expect(curl).not.toContain("Accept-Encoding:");
  });

  it("should include request body", () => {
    const request = createMockRequest({
      method: "POST",
      requestBody: Buffer.from('{"name":"test"}'),
    });
    const curl = generateCurl(request);

    expect(curl).toContain("-d '{\"name\":\"test\"}'");
  });

  it("should escape single quotes in URL", () => {
    const request = createMockRequest({
      url: "https://example.com/api?name=O'Brien",
    });
    const curl = generateCurl(request);

    expect(curl).toContain("O'\"'\"'Brien");
  });

  it("should escape single quotes in headers", () => {
    const request = createMockRequest({
      requestHeaders: {
        "X-Custom": "It's a test",
      },
    });
    const curl = generateCurl(request);

    expect(curl).toContain("It'\"'\"'s a test");
  });

  it("should escape single quotes in body", () => {
    const request = createMockRequest({
      method: "POST",
      requestBody: Buffer.from("It's a test"),
    });
    const curl = generateCurl(request);

    expect(curl).toContain("-d 'It'\"'\"'s a test'");
  });

  it("should format as multiline with backslashes", () => {
    const request = createMockRequest({
      method: "POST",
      requestHeaders: {
        Authorization: "Bearer token",
      },
      requestBody: Buffer.from("body"),
    });
    const curl = generateCurl(request);

    expect(curl).toContain(" \\\n  ");
  });

  it("should handle DELETE method", () => {
    const request = createMockRequest({ method: "DELETE" });
    const curl = generateCurl(request);

    expect(curl).toContain("-X DELETE");
  });

  it("should handle PATCH method", () => {
    const request = createMockRequest({
      method: "PATCH",
      requestBody: Buffer.from('{"update":true}'),
    });
    const curl = generateCurl(request);

    expect(curl).toContain("-X PATCH");
    expect(curl).toContain("-d '{\"update\":true}'");
  });
});
