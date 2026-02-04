import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CapturedRequest } from "../../../src/shared/types.js";

// Mock the clipboard module before importing
const mockCopyToClipboard = vi.fn();
vi.mock("../../../src/cli/tui/utils/clipboard.js", () => ({
  copyToClipboard: mockCopyToClipboard,
}));

// Import after mocking
const { exportCurlToClipboard } = await import("../../../src/cli/tui/hooks/useExport.js");

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

describe("exportCurlToClipboard", () => {
  beforeEach(() => {
    mockCopyToClipboard.mockReset();
  });

  it("should copy curl command to clipboard", async () => {
    mockCopyToClipboard.mockResolvedValue(undefined);

    const request = createMockRequest();
    const result = await exportCurlToClipboard(request);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Copied to clipboard");
    expect(mockCopyToClipboard).toHaveBeenCalledTimes(1);

    // Verify the curl command was generated correctly
    const copiedText = mockCopyToClipboard.mock.calls[0][0] as string;
    expect(copiedText).toContain("curl");
    expect(copiedText).toContain("https://example.com/api/test");
  });

  it("should return error when clipboard fails", async () => {
    mockCopyToClipboard.mockRejectedValue(new Error("No clipboard available"));

    const request = createMockRequest();
    const result = await exportCurlToClipboard(request);

    expect(result.success).toBe(false);
    expect(result.message).toBe("No clipboard available");
  });

  it("should include headers in copied curl command", async () => {
    mockCopyToClipboard.mockResolvedValue(undefined);

    const request = createMockRequest({
      requestHeaders: {
        Authorization: "Bearer token123",
      },
    });
    await exportCurlToClipboard(request);

    const copiedText = mockCopyToClipboard.mock.calls[0][0] as string;
    expect(copiedText).toContain("Authorization: Bearer token123");
  });

  it("should include body in copied curl command for POST requests", async () => {
    mockCopyToClipboard.mockResolvedValue(undefined);

    const request = createMockRequest({
      method: "POST",
      requestBody: Buffer.from('{"name":"test"}'),
    });
    await exportCurlToClipboard(request);

    const copiedText = mockCopyToClipboard.mock.calls[0][0] as string;
    expect(copiedText).toContain("-X POST");
    expect(copiedText).toContain('{"name":"test"}');
  });
});
