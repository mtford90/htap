/**
 * Tests for TUI keyboard interactions using ink-testing-library.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../../../src/cli/tui/App.js";
import type { CapturedRequest } from "../../../src/shared/types.js";

// Mock the hooks that depend on external services
vi.mock("../../../src/cli/tui/hooks/useRequests.js", () => ({
  useRequests: vi.fn(),
}));

vi.mock("../../../src/cli/tui/hooks/useExport.js", () => ({
  useExport: () => ({
    exportCurl: vi.fn().mockResolvedValue({ success: true, message: "Copied" }),
    exportHar: vi.fn().mockReturnValue({ success: true, message: "Exported" }),
  }),
}));

// Import the mocked hook so we can control its return value
import { useRequests } from "../../../src/cli/tui/hooks/useRequests.js";
const mockUseRequests = vi.mocked(useRequests);

const createMockRequest = (overrides: Partial<CapturedRequest> = {}): CapturedRequest => ({
  id: "test-1",
  sessionId: "session-1",
  timestamp: Date.now(),
  method: "GET",
  url: "http://example.com/api/users",
  host: "example.com",
  path: "/api/users",
  requestHeaders: { "content-type": "application/json" },
  responseStatus: 200,
  responseHeaders: { "content-type": "application/json" },
  durationMs: 150,
  ...overrides,
});

describe("App keyboard interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("URL toggle (u key)", () => {
    it("shows path by default", () => {
      const mockRequest = createMockRequest();
      mockUseRequests.mockReturnValue({
        requests: [mockRequest],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      const { lastFrame } = render(<App __testEnableInput />);
      const frame = lastFrame();

      // Should show path, not full URL
      expect(frame).toContain("/api/users");
      // The full URL includes the host, which shouldn't appear in the path column
      // (it may appear elsewhere in the details pane, so we check the pattern)
    });

    it("toggles to full URL when u is pressed", async () => {
      const mockRequest = createMockRequest();
      mockUseRequests.mockReturnValue({
        requests: [mockRequest],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);

      // Press 'u' to toggle
      stdin.write("u");

      // Wait for React to process the state update
      await new Promise((resolve) => setTimeout(resolve, 50));

      const frame = lastFrame();

      // Should now show full URL
      expect(frame).toContain("http://example.com");
      // Should show status message
      expect(frame).toContain("Showing full URL");
    });

    it("toggles back to path when u is pressed again", async () => {
      const mockRequest = createMockRequest();
      mockUseRequests.mockReturnValue({
        requests: [mockRequest],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);

      // Press 'u' twice
      stdin.write("u");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("u");
      await new Promise((resolve) => setTimeout(resolve, 50));

      const frame = lastFrame();

      // Should show status message for path mode
      expect(frame).toContain("Showing path");
    });

    it("shows toggle URL hint in status bar", () => {
      mockUseRequests.mockReturnValue({
        requests: [],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      const { lastFrame } = render(<App __testEnableInput />);
      const frame = lastFrame();

      expect(frame).toContain("u");
      expect(frame).toContain("URL");
    });
  });
});
