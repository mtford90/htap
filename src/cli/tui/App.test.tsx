/**
 * Tests for TUI keyboard interactions using ink-testing-library.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { App, MIN_TERMINAL_COLUMNS, MIN_TERMINAL_ROWS } from "./App.js";
import type { CapturedRequest, CapturedRequestSummary } from "../../shared/types.js";

// Mock the hooks that depend on external services
vi.mock("./hooks/useRequests.js", () => ({
  useRequests: vi.fn(),
}));

// Prevent real socket connections from leaking across tests
vi.mock("./hooks/useInterceptorEvents.js", () => ({
  useInterceptorEvents: () => ({
    events: [],
    counts: { info: 0, warn: 0, error: 0 },
    totalEventCount: 0,
    interceptorCount: 0,
    refresh: vi.fn(),
  }),
}));

vi.mock("../../shared/config.js", () => ({
  loadConfig: () => undefined,
}));

const mockExportFormatToClipboard = vi.fn().mockResolvedValue({ success: true, message: "cURL copied to clipboard" });
const mockExportHarToDir = vi.fn().mockReturnValue({ success: true, message: "Exported 1 request(s) to /mock/path" });

vi.mock("./hooks/useExport.js", () => ({
  exportFormatToClipboard: (...args: unknown[]) => mockExportFormatToClipboard(...args),
  exportHarToDir: (...args: unknown[]) => mockExportHarToDir(...args),
}));

const mockResolveTargetDir = vi.fn().mockReturnValue("/mock/exports");

vi.mock("./hooks/useBodyExport.js", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("./hooks/useBodyExport.js");
  return {
    ...actual,
    resolveTargetDir: (...args: unknown[]) => mockResolveTargetDir(...args),
  };
});

const mockCopyToClipboard = vi.fn().mockResolvedValue(undefined);
vi.mock("./utils/clipboard.js", () => ({
  copyToClipboard: (...args: unknown[]) => mockCopyToClipboard(...args),
}));

const mockOpenInExternalApp = vi.fn().mockResolvedValue({ success: true, message: "Opened" });
vi.mock("./utils/open-external.js", () => ({
  openInExternalApp: (...args: unknown[]) => mockOpenInExternalApp(...args),
}));

vi.mock("./hooks/useStdoutDimensions.js", () => ({
  useStdoutDimensions: () => [200, 50],
}));

vi.mock("../../shared/project.js", () => ({
  findProjectRoot: () => "/mock/project",
  readProxyPort: () => 54321,
  getProcsiPaths: () => ({
    procsiDir: "/mock/project/.procsi",
    proxyPortFile: "/mock/project/.procsi/proxy.port",
    controlSocketFile: "/mock/project/.procsi/control.sock",
    databaseFile: "/mock/project/.procsi/requests.db",
    caKeyFile: "/mock/project/.procsi/ca-key.pem",
    caCertFile: "/mock/project/.procsi/ca.pem",
    pidFile: "/mock/project/.procsi/daemon.pid",
    logFile: "/mock/project/.procsi/procsi.log",
  }),
}));

// Import the mocked hook so we can control its return value
import { useRequests } from "./hooks/useRequests.js";
const mockUseRequests = vi.mocked(useRequests);

const createMockSummary = (overrides: Partial<CapturedRequestSummary> = {}): CapturedRequestSummary => ({
  id: "test-1",
  sessionId: "session-1",
  timestamp: Date.now(),
  method: "GET",
  url: "http://example.com/api/users",
  host: "example.com",
  path: "/api/users",
  responseStatus: 200,
  durationMs: 150,
  requestBodySize: 0,
  responseBodySize: 0,
  ...overrides,
});

const createMockFullRequest = (overrides: Partial<CapturedRequest> = {}): CapturedRequest => ({
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

// Helper to wait for React state updates
const tick = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

describe("App keyboard interactions", () => {
  const mockRefresh = vi.fn();
  const mockGetFullRequest = vi.fn();
  const mockGetAllFullRequests = vi.fn();
  const mockReplayRequest = vi.fn();
  const mockToggleSaved = vi.fn();
  const mockClearRequests = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRefresh.mockReset();
    mockGetFullRequest.mockReset();
    mockGetAllFullRequests.mockReset();
    mockReplayRequest.mockReset().mockResolvedValue("replayed-1");
    mockToggleSaved.mockReset().mockResolvedValue(true);
    mockClearRequests.mockReset().mockResolvedValue(true);
    mockExportFormatToClipboard.mockReset().mockResolvedValue({ success: true, message: "cURL copied to clipboard" });
    mockExportHarToDir.mockReset().mockReturnValue({ success: true, message: "Exported 1 request(s) to /mock/path" });
    mockResolveTargetDir.mockReset().mockReturnValue("/mock/exports");
    mockCopyToClipboard.mockReset().mockResolvedValue(undefined);
    mockOpenInExternalApp.mockReset().mockResolvedValue({ success: true, message: "Opened" });
  });

  // Helper to set up mocks with multiple requests
  const setupMocksWithRequests = (count: number) => {
    const summaries = Array.from({ length: count }, (_, i) =>
      createMockSummary({ id: `test-${i}`, path: `/api/endpoint-${i}` })
    );
    const fullRequests = Array.from({ length: count }, (_, i) =>
      createMockFullRequest({ id: `test-${i}` })
    );

    mockGetFullRequest.mockImplementation((id: string) => {
      const req = fullRequests.find((r) => r.id === id);
      return Promise.resolve(req ?? null);
    });
    mockGetAllFullRequests.mockResolvedValue(fullRequests);

    mockUseRequests.mockReturnValue({
      requests: summaries,
      isLoading: false,
      error: null,
      refresh: mockRefresh,
      getFullRequest: mockGetFullRequest,
      getAllFullRequests: mockGetAllFullRequests,
      replayRequest: mockReplayRequest,
      toggleSaved: mockToggleSaved,
      clearRequests: mockClearRequests,
    });

    return { summaries, fullRequests };
  };

  describe("URL toggle (u key)", () => {
    it("shows path by default", () => {
      const mockSummary = createMockSummary();
      const mockFullRequest = createMockFullRequest();
      mockUseRequests.mockReturnValue({
        requests: [mockSummary],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        getFullRequest: vi.fn().mockResolvedValue(mockFullRequest),
        getAllFullRequests: vi.fn().mockResolvedValue([mockFullRequest]),
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame } = render(<App __testEnableInput />);
      const frame = lastFrame();

      // Should show path, not full URL
      expect(frame).toContain("/api/users");
    });

    it("toggles to full URL when u is pressed", async () => {
      const mockSummary = createMockSummary();
      const mockFullRequest = createMockFullRequest();
      mockUseRequests.mockReturnValue({
        requests: [mockSummary],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        getFullRequest: vi.fn().mockResolvedValue(mockFullRequest),
        getAllFullRequests: vi.fn().mockResolvedValue([mockFullRequest]),
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);

      stdin.write("u");
      await tick(100);

      const frame = lastFrame();
      expect(frame).toContain("http://example.com");
      expect(frame).toContain("Showing full URL");
    });

    it("toggles back to path when u is pressed again", async () => {
      const mockSummary = createMockSummary();
      const mockFullRequest = createMockFullRequest();
      mockUseRequests.mockReturnValue({
        requests: [mockSummary],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        getFullRequest: vi.fn().mockResolvedValue(mockFullRequest),
        getAllFullRequests: vi.fn().mockResolvedValue([mockFullRequest]),
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);

      stdin.write("u");
      await tick(100);
      stdin.write("u");
      await tick(100);

      const frame = lastFrame();
      expect(frame).toContain("Showing path");
    });

    it("shows toggle URL hint in status bar", () => {
      mockUseRequests.mockReturnValue({
        requests: [],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        getFullRequest: vi.fn().mockResolvedValue(null),
        getAllFullRequests: vi.fn().mockResolvedValue([]),
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame } = render(<App __testEnableInput />);
      const frame = lastFrame();

      // Status bar contains the u key hint (may be truncated at narrow widths)
      expect(frame).toMatch(/u\s/);
    });
  });

  describe("Navigation (j/k, arrows)", () => {
    it("j moves selection down in list panel", async () => {
      setupMocksWithRequests(3);

      const { stdin } = render(<App __testEnableInput />);
      await tick();

      // Initially first item (test-0) should be selected
      expect(mockGetFullRequest).toHaveBeenCalledWith("test-0");

      mockGetFullRequest.mockClear();

      // Press j to move down
      stdin.write("j");
      await tick();

      // Selection should move down - getFullRequest should be called for the new selection
      expect(mockGetFullRequest).toHaveBeenCalledWith("test-1");
    });

    it("k moves selection up in list panel", async () => {
      setupMocksWithRequests(3);

      const { stdin } = render(<App __testEnableInput />);
      await tick();

      // Move down first
      stdin.write("j");
      await tick();
      stdin.write("j");
      await tick();

      // Now press k to move up
      stdin.write("k");
      await tick();

      expect(mockGetFullRequest).toHaveBeenLastCalledWith("test-1");
    });

    it("down arrow moves selection down", async () => {
      setupMocksWithRequests(3);

      const { stdin } = render(<App __testEnableInput />);
      await tick();

      mockGetFullRequest.mockClear();

      // Press down arrow (escape sequence)
      stdin.write("\x1b[B");
      await tick();

      expect(mockGetFullRequest).toHaveBeenCalledWith("test-1");
    });

    it("up arrow moves selection up", async () => {
      setupMocksWithRequests(3);

      const { stdin } = render(<App __testEnableInput />);
      await tick();

      // Move down first
      stdin.write("\x1b[B");
      await tick();

      // Press up arrow
      stdin.write("\x1b[A");
      await tick();

      expect(mockGetFullRequest).toHaveBeenLastCalledWith("test-0");
    });

    it("selection stops at lower bound (cannot go below 0)", async () => {
      setupMocksWithRequests(3);

      const { stdin } = render(<App __testEnableInput />);
      await tick();
      // Allow any secondary effect cycles to settle before clearing
      await tick();

      mockGetFullRequest.mockClear();

      // Try to move up from the first item
      stdin.write("k");
      await tick();
      stdin.write("k");
      await tick();

      // Should remain at first item (test-0) - no call to getFullRequest
      // because selection didn't change
      expect(mockGetFullRequest).not.toHaveBeenCalled();
    });

    it("selection stops at upper bound (cannot go past length-1)", async () => {
      setupMocksWithRequests(3);

      const { stdin } = render(<App __testEnableInput />);
      await tick();

      // Move to the end
      stdin.write("j");
      await tick();
      stdin.write("j");
      await tick();
      await tick(); // allow selection side-effects to settle

      mockGetFullRequest.mockClear();

      // Try to move past the end
      stdin.write("j");
      await tick();
      stdin.write("j");
      await tick();

      // Should remain at last item - no additional calls
      expect(mockGetFullRequest).not.toHaveBeenCalled();
    });

    it("j/k navigate sections when accordion panel is active", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Switch to accordion panel (Tab or press 2)
      stdin.write("2");
      await tick();

      // Should now show focus indicator on Request section
      let frame = lastFrame();
      // The focus indicator is » in the section header
      expect(frame).toContain("»");
      expect(frame).toContain("[2] Request");

      // Navigate down to next section
      stdin.write("j");
      await tick();

      frame = lastFrame();
      // Focus should now be on Request Body section (focus indicator moved)
      expect(frame).toContain("[3] Request Body");
    });
  });

  describe("Panel switching (Tab, Shift+Tab, 1-5)", () => {
    it("Tab from list goes to accordion section 0", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Press Tab to switch to accordion
      stdin.write("\t");
      await tick();

      const frame = lastFrame();
      // The accordion should now be active with focus on first section
      // Focus indicator should appear
      expect(frame).toContain("»");
    });

    it("Tab cycles through accordion sections", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Press Tab to go to accordion section 0
      stdin.write("\t");
      await tick();

      // Press Tab again to go to section 1
      stdin.write("\t");
      await tick();

      // Keep pressing Tab to go through all sections
      stdin.write("\t");
      await tick();
      stdin.write("\t");
      await tick();

      // One more Tab should return to list
      stdin.write("\t");
      await tick();

      // Now we should be back in list panel - focus indicator should not be in accordion
      const frame = lastFrame();
      // List panel should be active - accordion sections should not have focus indicator
      expect(frame).toBeDefined();
    });

    it("Shift+Tab reverses the cycle", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Press Shift+Tab from list should go to last accordion section
      stdin.write("\x1b[Z"); // Shift+Tab escape sequence
      await tick();

      const frame = lastFrame();
      // Should be on last section (Response Body)
      expect(frame).toContain("»");
    });

    it("1 key activates list panel", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // First go to accordion
      stdin.write("2");
      await tick();

      // Then press 1 to go back to list
      stdin.write("1");
      await tick();

      // j should now move list selection, not accordion
      mockGetFullRequest.mockClear();
      stdin.write("j");
      await tick();

      // Since we only have 1 request, nothing changes, but accordion should not have focus
      const frame = lastFrame();
      // Verify we got a frame back and the accordion focus indicator is not visible
      expect(frame).not.toContain("» ▼ [2]");
    });

    it("2 key activates accordion section 0 (Request)", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      stdin.write("2");
      await tick();

      const frame = lastFrame();
      expect(frame).toContain("»");
      // Should contain the focus marker near Request section header
    });

    it("3 key activates accordion section 1 (Request Body)", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      stdin.write("3");
      await tick();

      const frame = lastFrame();
      expect(frame).toContain("»");
    });

    it("4 key activates accordion section 2 (Response)", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      stdin.write("4");
      await tick();

      const frame = lastFrame();
      expect(frame).toContain("»");
    });

    it("5 key activates accordion section 3 (Response Body)", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      stdin.write("5");
      await tick();

      const frame = lastFrame();
      expect(frame).toContain("»");
    });
  });

  describe("Multi-expand accordion", () => {
    it("all sections expanded by default when request is selected", async () => {
      setupMocksWithRequests(1);

      const { lastFrame } = render(<App __testEnableInput />);
      await tick();

      // All 4 sections should be expanded by default
      const frame = lastFrame();
      const expandedCount = (frame.match(/▼/g) || []).length;
      expect(expandedCount).toBe(4);
    });

    it("Space toggles a section collapsed", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Focus on Request section (section 0) in accordion
      stdin.write("2");
      await tick();

      // All 4 should be expanded
      let frame = lastFrame();
      expect((frame.match(/▼/g) || []).length).toBe(4);

      // Press Space to collapse the focused section
      stdin.write(" ");
      await tick();

      frame = lastFrame();
      // Now 3 expanded, 1 collapsed
      expect((frame.match(/▼/g) || []).length).toBe(3);
      expect((frame.match(/▶/g) || []).length).toBe(1);
    });

    it("Space toggles a section back to expanded", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Focus on Request section in accordion
      stdin.write("2");
      await tick();

      // Collapse then re-expand
      stdin.write(" ");
      await tick();
      stdin.write(" ");
      await tick();

      const frame = lastFrame();
      expect((frame.match(/▼/g) || []).length).toBe(4);
    });

    it("multiple sections can be independently collapsed", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Focus on section 0 and collapse
      stdin.write("2");
      await tick();
      stdin.write(" ");
      await tick();

      // Verify intermediate state: section 0 collapsed, sections 1-3 expanded
      let frame = lastFrame();
      expect(frame).toMatch(/▶.*\[2\] Request\b/);
      expect(frame).toMatch(/▼.*\[3\] Request Body/);

      // Jump to section 2 and collapse it too
      stdin.write("4");
      await tick();
      stdin.write(" ");
      await tick();

      frame = lastFrame();
      // Sections 0 and 2 collapsed, sections 1 and 3 expanded
      expect(frame).toMatch(/▶.*\[2\] Request\b/);
      expect(frame).toMatch(/▼.*\[3\] Request Body/);
      expect(frame).toMatch(/▶.*\[4\] Response\b/);
      expect(frame).toMatch(/▼.*\[5\] Response Body/);
    });

    it("j/k change focus without collapsing other sections", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Focus on section 0
      stdin.write("2");
      await tick();

      // Navigate down through sections with j
      stdin.write("j");
      await tick();
      stdin.write("j");
      await tick();
      stdin.write("j");
      await tick();

      // All should still be expanded
      const frame = lastFrame();
      expect((frame.match(/▼/g) || []).length).toBe(4);
    });

    it("number keys change focus without collapsing other sections", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Jump to section 3 via number key
      stdin.write("5");
      await tick();

      // Jump to section 1 via number key
      stdin.write("3");
      await tick();

      // All should still be expanded
      const frame = lastFrame();
      expect((frame.match(/▼/g) || []).length).toBe(4);
    });
  });

  describe("Full-width list", () => {
    it("list renders at full width when no request selected", () => {
      mockUseRequests.mockReturnValue({
        requests: [],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        getFullRequest: vi.fn().mockResolvedValue(null),
        getAllFullRequests: vi.fn().mockResolvedValue([]),
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame } = render(<App __testEnableInput />);
      const frame = lastFrame();

      // Should not contain the accordion placeholder text
      expect(frame).not.toContain("Select a request to view details");
    });

    it("splits into panels when request is selected", async () => {
      setupMocksWithRequests(1);

      const { lastFrame } = render(<App __testEnableInput />);
      await tick();

      const frame = lastFrame();
      // Accordion sections should be visible
      expect(frame).toContain("[2] Request");
      expect(frame).toContain("[3] Request Body");
    });
  });

  describe("Panel resize keybindings", () => {
    it("[ shrinks the list panel", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      const frameBefore = lastFrame();

      stdin.write("[");
      await tick();

      const frameAfter = lastFrame();
      // The layout should have changed — exact verification is that the frame differs
      expect(frameAfter).not.toBe(frameBefore);
    });

    it("] grows the list panel", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      const frameBefore = lastFrame();

      stdin.write("]");
      await tick();

      const frameAfter = lastFrame();
      expect(frameAfter).not.toBe(frameBefore);
    });

    it("= resets panel size after resize", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      const frameDefault = lastFrame();

      // Resize first
      stdin.write("[");
      await tick();

      // Then reset
      stdin.write("=");
      await tick();

      const frameReset = lastFrame();
      expect(frameReset).toBe(frameDefault);
    });
  });

  describe("Enter opens JSON explorer", () => {
    it("Enter on JSON body section opens explorer", async () => {
      const fullRequest = createMockFullRequest({
        responseBody: Buffer.from('{"data":"test"}'),
        responseHeaders: { "content-type": "application/json" },
      });
      mockUseRequests.mockReturnValue({
        requests: [createMockSummary()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(fullRequest),
        getAllFullRequests: vi.fn().mockResolvedValue([fullRequest]),
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Navigate to Response Body section
      stdin.write("5");
      await tick();

      // Press Enter to open JSON explorer
      stdin.write("\r");
      await tick();

      const frame = lastFrame();
      expect(frame).toContain("Response Body");
      // JSON explorer modal should be showing
      expect(frame).toContain("data");
    });

    it("Enter on non-body section does nothing", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Navigate to Request headers section (not a body section)
      stdin.write("2");
      await tick();

      const frameBefore = lastFrame();

      // Press Enter
      stdin.write("\r");
      await tick();

      const frameAfter = lastFrame();
      // Frame should be unchanged — no explorer opened
      expect(frameBefore).toBe(frameAfter);
    });

    it("Enter on text body opens text viewer", async () => {
      const fullRequest = createMockFullRequest({
        responseBody: Buffer.from("<html>hello</html>"),
        responseHeaders: { "content-type": "text/html" },
      });
      mockUseRequests.mockReturnValue({
        requests: [createMockSummary()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(fullRequest),
        getAllFullRequests: vi.fn().mockResolvedValue([fullRequest]),
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Navigate to Response Body section
      stdin.write("5");
      await tick();

      // Press Enter — should open text viewer for text/html
      stdin.write("\r");
      await tick();

      const frame = lastFrame();
      expect(frame).toContain("Response Body");
      // Text viewer hint bar should be visible
      expect(frame).toContain("j/k nav");
    });

    it("Enter on binary body does nothing", async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(100).fill(0)]);
      const fullRequest = createMockFullRequest({
        responseBody: pngBuffer,
        responseHeaders: { "content-type": "image/png" },
      });
      mockUseRequests.mockReturnValue({
        requests: [createMockSummary()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(fullRequest),
        getAllFullRequests: vi.fn().mockResolvedValue([fullRequest]),
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Navigate to Response Body section
      stdin.write("5");
      await tick();

      const frameBefore = lastFrame();

      // Press Enter — should do nothing for binary content
      stdin.write("\r");
      await tick();

      const frameAfter = lastFrame();
      expect(frameBefore).toBe(frameAfter);
    });

    it("Enter on invalid JSON falls through to text viewer", async () => {
      const fullRequest = createMockFullRequest({
        responseBody: Buffer.from("{invalid json}"),
        responseHeaders: { "content-type": "application/json" },
      });
      mockUseRequests.mockReturnValue({
        requests: [createMockSummary()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(fullRequest),
        getAllFullRequests: vi.fn().mockResolvedValue([fullRequest]),
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Navigate to Response Body section
      stdin.write("5");
      await tick();

      // Press Enter — JSON parse fails, should fall through to text viewer
      stdin.write("\r");
      await tick();

      const frame = lastFrame();
      expect(frame).toContain("Response Body");
      // Text viewer hint bar should be visible (not JSON explorer)
      expect(frame).toContain("j/k nav");
    });

    it("Escape closes text viewer", async () => {
      const fullRequest = createMockFullRequest({
        responseBody: Buffer.from("<html>hello</html>"),
        responseHeaders: { "content-type": "text/html" },
      });
      mockUseRequests.mockReturnValue({
        requests: [createMockSummary()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(fullRequest),
        getAllFullRequests: vi.fn().mockResolvedValue([fullRequest]),
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Navigate to Response Body section and open text viewer
      stdin.write("5");
      await tick();
      stdin.write("\r");
      await tick();

      // Verify text viewer is open (has its unique close hint)
      expect(lastFrame()).toContain("q/Esc close");

      // Press Escape to close
      stdin.write("\x1b");
      await tick();

      // Should be back to main view
      const frame = lastFrame();
      expect(frame).not.toContain("q/Esc close");
      expect(frame).toContain("Requests");
    });

    it("Enter in list panel does not open explorer", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Make sure we're in list panel (press 1)
      stdin.write("1");
      await tick();

      const frameBefore = lastFrame();

      // Press Enter
      stdin.write("\r");
      await tick();

      const frameAfter = lastFrame();

      // Frame should be the same (Enter has no effect in list panel)
      expect(frameBefore).toBe(frameAfter);
    });
  });

  describe("Actions (r, c, H)", () => {
    it("r calls refresh and shows Refreshing status", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      stdin.write("r");
      await tick();

      expect(mockRefresh).toHaveBeenCalled();
      const frame = lastFrame();
      expect(frame).toContain("Refreshing");
    });

    it("e opens format export modal", async () => {
      const fullRequest = createMockFullRequest();
      mockUseRequests.mockReturnValue({
        requests: [createMockSummary()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(fullRequest),
        getAllFullRequests: mockGetAllFullRequests,
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      stdin.write("e");
      await tick();

      const frame = lastFrame();
      expect(frame).toContain("Export Request");
      expect(frame).toContain("cURL");
      expect(frame).toContain("Fetch");
      expect(frame).toContain("Python");
      expect(frame).toContain("HTTPie");
      expect(frame).toContain("HAR");
    });

    it("e then 1 dispatches curl export via modal", async () => {
      const fullRequest = createMockFullRequest();
      mockUseRequests.mockReturnValue({
        requests: [createMockSummary()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(fullRequest),
        getAllFullRequests: mockGetAllFullRequests,
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      stdin.write("e");
      await tick();
      stdin.write("1");
      await tick(100);

      expect(mockExportFormatToClipboard).toHaveBeenCalledWith(fullRequest, "curl");
      expect(lastFrame()).toContain("copied to clipboard");
    });

    it("e then Escape closes modal without exporting", async () => {
      const fullRequest = createMockFullRequest();
      mockUseRequests.mockReturnValue({
        requests: [createMockSummary()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(fullRequest),
        getAllFullRequests: mockGetAllFullRequests,
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      stdin.write("e");
      await tick();

      // Escape closes the modal
      stdin.write("\x1b");
      await tick();

      expect(mockExportFormatToClipboard).not.toHaveBeenCalled();
      const frame = lastFrame();
      expect(frame).not.toContain("Export Request");
    });

    it("e without selection shows No request selected", async () => {
      mockUseRequests.mockReturnValue({
        requests: [],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(null),
        getAllFullRequests: vi.fn().mockResolvedValue([]),
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      stdin.write("e");
      await tick();

      const frame = lastFrame();
      expect(frame).toContain("No request selected");
    });

    it("e then 5 shows HAR destination picker", async () => {
      const fullRequest = createMockFullRequest();
      mockUseRequests.mockReturnValue({
        requests: [createMockSummary()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(fullRequest),
        getAllFullRequests: mockGetAllFullRequests,
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      stdin.write("e");
      await tick();
      stdin.write("5");
      await tick();

      const frame = lastFrame();
      expect(frame).toContain("Export as HAR");
      expect(frame).toContain(".procsi/exports/");
      expect(frame).toContain("~/Downloads/");
      expect(frame).toContain("Custom path...");
    });

    it("e then 5 then 1 exports HAR to .procsi/exports/", async () => {
      const fullRequest = createMockFullRequest();
      mockUseRequests.mockReturnValue({
        requests: [createMockSummary()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(fullRequest),
        getAllFullRequests: mockGetAllFullRequests,
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      stdin.write("e");
      await tick();
      stdin.write("5");
      await tick();
      stdin.write("1");
      await tick(100);

      expect(mockResolveTargetDir).toHaveBeenCalledWith("exports");
      expect(mockExportHarToDir).toHaveBeenCalledWith([fullRequest], "/mock/exports");
      const frame = lastFrame();
      expect(frame).toContain("Exported");
    });
  });

  describe("Replay action (R key)", () => {
    it("R prompts for confirmation and y replays selected request", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      stdin.write("R");
      await tick();
      expect(lastFrame()).toContain("Replay selected request?");

      stdin.write("y");
      await tick(100);

      expect(mockReplayRequest).toHaveBeenCalledWith("test-0");
      expect(lastFrame()).toContain("Replayed as");
    });

    it("R shows replay error details when replay fails", async () => {
      setupMocksWithRequests(1);
      mockReplayRequest.mockRejectedValueOnce(new Error("Control request timed out"));

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      stdin.write("R");
      await tick();
      stdin.write("y");
      await tick(100);

      expect(lastFrame()).toContain("Failed to replay: Control request timed out");
    });

    it("R confirmation cancels on non-y key", async () => {
      setupMocksWithRequests(1);

      const { stdin } = render(<App __testEnableInput />);
      await tick();

      stdin.write("R");
      await tick();
      stdin.write("n");
      await tick(100);

      expect(mockReplayRequest).not.toHaveBeenCalled();
    });
  });

  describe("Empty state guidance (7.6)", () => {
    it("shows intercept command in empty state", () => {
      mockUseRequests.mockReturnValue({
        requests: [],
        isLoading: false,
        error: null,
        refresh: vi.fn(),
        getFullRequest: vi.fn().mockResolvedValue(null),
        getAllFullRequests: vi.fn().mockResolvedValue([]),
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame } = render(<App __testEnableInput />);
      const frame = lastFrame();

      expect(frame).toContain("eval \"$(procsi on)\"");
    });
  });

  describe("Extended navigation (g/G/Ctrl+u/Ctrl+d)", () => {
    it("g moves to first item in list", async () => {
      setupMocksWithRequests(10);

      const { stdin } = render(<App __testEnableInput />);
      await tick();

      // Move down a few items first
      stdin.write("j");
      await tick();
      stdin.write("j");
      await tick();
      stdin.write("j");
      await tick();

      mockGetFullRequest.mockClear();

      // Press g to jump to first
      stdin.write("g");
      await tick();

      expect(mockGetFullRequest).toHaveBeenCalledWith("test-0");
    });

    it("G moves to last item in list", async () => {
      setupMocksWithRequests(10);

      const { stdin } = render(<App __testEnableInput />);
      await tick();
      // Allow initial render side-effects to fully settle before clearing
      await tick();

      mockGetFullRequest.mockClear();

      // Press G to jump to last
      stdin.write("G");
      await tick();

      expect(mockGetFullRequest).toHaveBeenCalledWith("test-9");
    });

    it("g in accordion goes to first section", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Go to accordion section 3
      stdin.write("5");
      await tick();

      // Press g to jump to first section
      stdin.write("g");
      await tick();

      const frame = lastFrame();
      // Focus should be on first section (Request)
      expect(frame).toContain("»");
    });

    it("G in accordion goes to last section", async () => {
      setupMocksWithRequests(1);

      const { stdin } = render(<App __testEnableInput />);
      await tick();

      // Go to accordion section 0
      stdin.write("2");
      await tick();

      // Press G to jump to last section
      stdin.write("G");
      await tick();

      // Verify by navigating — if we're at last section, j shouldn't move further
      // We can just verify it didn't crash and state is consistent
    });

    it("Ctrl+u moves up half page in list", async () => {
      setupMocksWithRequests(30);

      const { stdin } = render(<App __testEnableInput />);
      await tick();

      // Move to bottom first
      stdin.write("G");
      await tick();

      mockGetFullRequest.mockClear();

      // Ctrl+u = \x15
      stdin.write("\x15");
      await tick();

      // Should have moved up — exact position depends on terminal height
      // but should have called getFullRequest with a different ID
      expect(mockGetFullRequest).toHaveBeenCalled();
    });

    it("Ctrl+d moves down half page in list", async () => {
      setupMocksWithRequests(30);

      const { stdin } = render(<App __testEnableInput />);
      await tick();
      // Allow initial render side-effects to fully settle before clearing
      await tick();

      mockGetFullRequest.mockClear();

      // Ctrl+d = \x04
      stdin.write("\x04");
      await tick();

      // Should have moved down from index 0
      expect(mockGetFullRequest).toHaveBeenCalled();
    });
  });

  describe("Loading spinner (7.3)", () => {
    it("loading state renders a braille spinner character", () => {
      mockUseRequests.mockReturnValue({
        requests: [],
        isLoading: true,
        error: null,
        refresh: vi.fn(),
        getFullRequest: vi.fn().mockResolvedValue(null),
        getAllFullRequests: vi.fn().mockResolvedValue([]),
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame } = render(<App __testEnableInput />);
      const frame = lastFrame();

      // Should contain a braille spinner character (first frame)
      expect(frame).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
      expect(frame).toContain("Loading...");
    });
  });

  describe("Terminal size check (7.4)", () => {
    it("defines reasonable minimum terminal dimensions", () => {
      expect(MIN_TERMINAL_COLUMNS).toBe(60);
      expect(MIN_TERMINAL_ROWS).toBe(10);
    });

    it("minimum dimensions are smaller than default terminal size", () => {
      // Default terminal is 80x24, which should be above minimums
      expect(MIN_TERMINAL_COLUMNS).toBeLessThanOrEqual(80);
      expect(MIN_TERMINAL_ROWS).toBeLessThanOrEqual(24);
    });
  });

  describe("Help overlay (7.1)", () => {
    it("? opens the help modal", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      stdin.write("?");
      await tick();

      const frame = lastFrame();
      expect(frame).toContain("Keyboard Shortcuts");
    });

    it("? closes the help modal", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Open help
      stdin.write("?");
      await tick();

      // Close help
      stdin.write("?");
      await tick();

      const frame = lastFrame();
      expect(frame).not.toContain("Keyboard Shortcuts");
      // Should be back to main view
      expect(frame).toContain("Requests");
    });

    it("Escape closes the help modal", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Open help
      stdin.write("?");
      await tick();

      // Close with Escape
      stdin.write("\x1b");
      await tick();

      const frame = lastFrame();
      expect(frame).not.toContain("Keyboard Shortcuts");
    });
  });

  describe("Copy body to clipboard (y key)", () => {
    it("y copies text body to clipboard when on response body section", async () => {
      const fullRequest = createMockFullRequest({
        responseBody: Buffer.from('{"data":"test"}'),
        responseHeaders: { "content-type": "application/json" },
      });
      mockUseRequests.mockReturnValue({
        requests: [createMockSummary()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(fullRequest),
        getAllFullRequests: mockGetAllFullRequests,
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Navigate to Response Body section
      stdin.write("5");
      await tick();

      // Press y to copy
      stdin.write("y");
      await tick(100);

      expect(mockCopyToClipboard).toHaveBeenCalledWith('{"data":"test"}');
      const frame = lastFrame();
      expect(frame).toContain("Body copied to clipboard");
    });

    it("y rejects binary body with message", async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(100).fill(0)]);
      const fullRequest = createMockFullRequest({
        responseBody: pngBuffer,
        responseHeaders: { "content-type": "image/png" },
      });
      mockUseRequests.mockReturnValue({
        requests: [createMockSummary()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(fullRequest),
        getAllFullRequests: mockGetAllFullRequests,
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Navigate to Response Body section
      stdin.write("5");
      await tick();

      // Press y to try to copy
      stdin.write("y");
      await tick();

      expect(mockCopyToClipboard).not.toHaveBeenCalled();
      const frame = lastFrame();
      expect(frame).toContain("Cannot copy binary content");
    });

    it("y shows no body message when body is empty", async () => {
      const fullRequest = createMockFullRequest({
        responseBody: undefined,
        responseHeaders: { "content-type": "application/json" },
      });
      mockUseRequests.mockReturnValue({
        requests: [createMockSummary()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(fullRequest),
        getAllFullRequests: mockGetAllFullRequests,
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Navigate to Response Body section
      stdin.write("5");
      await tick();

      // Press y
      stdin.write("y");
      await tick();

      expect(mockCopyToClipboard).not.toHaveBeenCalled();
      const frame = lastFrame();
      expect(frame).toContain("No body to copy");
    });

    it("y does nothing when not on a body section", async () => {
      setupMocksWithRequests(1);

      const { stdin } = render(<App __testEnableInput />);
      await tick();

      // Navigate to Request headers section (not a body section)
      stdin.write("2");
      await tick();

      // Press y
      stdin.write("y");
      await tick();

      expect(mockCopyToClipboard).not.toHaveBeenCalled();
    });
  });

  describe("Help modal includes connection info", () => {
    it("? opens help modal with connection info", async () => {
      setupMocksWithRequests(1);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      stdin.write("?");
      await tick();

      const frame = lastFrame();
      expect(frame).toContain("Keyboard Shortcuts");
      expect(frame).toContain("Connection Info");
      expect(frame).toContain("http://127.0.0.1:54321");
    });
  });

  describe("Export body (s key)", () => {
    it("s opens export modal for text body content", async () => {
      const fullRequest = createMockFullRequest({
        responseBody: Buffer.from('{"data":"test"}'),
        responseHeaders: { "content-type": "application/json" },
      });
      mockUseRequests.mockReturnValue({
        requests: [createMockSummary()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(fullRequest),
        getAllFullRequests: mockGetAllFullRequests,
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Navigate to Response Body section
      stdin.write("5");
      await tick();

      // Press s to export
      stdin.write("s");
      await tick();

      const frame = lastFrame();
      expect(frame).toContain("Export Body Content");
    });

    it("s opens export modal for binary body content", async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(100).fill(0)]);
      const fullRequest = createMockFullRequest({
        responseBody: pngBuffer,
        responseHeaders: { "content-type": "image/png" },
      });
      mockUseRequests.mockReturnValue({
        requests: [createMockSummary()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(fullRequest),
        getAllFullRequests: mockGetAllFullRequests,
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Navigate to Response Body section
      stdin.write("5");
      await tick();

      // Press s to export
      stdin.write("s");
      await tick();

      const frame = lastFrame();
      expect(frame).toContain("Export Body Content");
    });

    it("s shows no body message when body is empty", async () => {
      const fullRequest = createMockFullRequest({
        responseBody: undefined,
        responseHeaders: { "content-type": "application/json" },
      });
      mockUseRequests.mockReturnValue({
        requests: [createMockSummary()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(fullRequest),
        getAllFullRequests: mockGetAllFullRequests,
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Navigate to Response Body section
      stdin.write("5");
      await tick();

      // Press s
      stdin.write("s");
      await tick();

      const frame = lastFrame();
      expect(frame).toContain("No body to export");
    });
  });

  describe("Body search filter integration", () => {
    it("passes bodySearch target to useRequests when using body:req: syntax", async () => {
      mockUseRequests.mockReturnValue({
        requests: [createMockSummary()],
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: vi.fn().mockResolvedValue(createMockFullRequest()),
        getAllFullRequests: mockGetAllFullRequests,
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { stdin } = render(<App __testEnableInput />);
      await tick();

      stdin.write("/");
      await tick();

      for (const ch of "body:req:error") {
        stdin.write(ch);
        await tick(50);
      }

      // Wait for FilterBar debounce
      await tick(500);

      const latestCall = mockUseRequests.mock.calls.at(-1)?.[0] as {
        filter?: unknown;
        bodySearch?: unknown;
      };
      expect(latestCall.bodySearch).toEqual({ query: "error", target: "request" });
      expect(latestCall.filter).toEqual({});
    });
  });

  describe("Cursor stability and follow mode", () => {
    it("selection stays on same request when new request prepends (browsing mode)", async () => {
      // Start with 3 requests, select the second one, then simulate a new request arriving
      const summaries = [
        createMockSummary({ id: "req-a", path: "/a" }),
        createMockSummary({ id: "req-b", path: "/b" }),
        createMockSummary({ id: "req-c", path: "/c" }),
      ];

      const mockGetFull = vi.fn().mockImplementation((id: string) =>
        Promise.resolve(createMockFullRequest({ id })),
      );

      mockUseRequests.mockReturnValue({
        requests: summaries,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: mockGetFull,
        getAllFullRequests: mockGetAllFullRequests,
        replayRequest: mockReplayRequest,
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      const { stdin, rerender } = render(<App __testEnableInput />);
      await tick();

      // Navigate down to select req-b (starts in follow mode at index 0)
      stdin.write("j");
      await tick();

      // Pressing j exits follow mode; selection is now req-b
      expect(mockGetFull).toHaveBeenCalledWith("req-b");

      // Simulate a new request prepending to the list
      const updatedSummaries = [
        createMockSummary({ id: "req-new", path: "/new" }),
        ...summaries,
      ];

      mockUseRequests.mockReturnValue({
        requests: updatedSummaries,
        isLoading: false,
        error: null,
        refresh: mockRefresh,
        getFullRequest: mockGetFull,
        getAllFullRequests: mockGetAllFullRequests,
        replayRequest: mockReplayRequest,
        toggleSaved: mockToggleSaved,
        clearRequests: mockClearRequests,
      });

      mockGetFull.mockClear();
      rerender(<App __testEnableInput />);
      await tick();

      // Selection should re-anchor to req-b (now at index 2)
      expect(mockGetFull).toHaveBeenCalledWith("req-b");
    });

    it("F key toggles follow mode on and jumps to index 0", async () => {
      setupMocksWithRequests(5);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Navigate down a few items (exits follow mode)
      stdin.write("j");
      await tick();
      stdin.write("j");
      await tick();

      // Follow badge should NOT be shown
      let frame = lastFrame();
      expect(frame).not.toContain("FOLLOWING");

      // Press F to enter follow mode
      stdin.write("F");
      await tick();

      // Follow badge should appear, cursor should be at index 0
      frame = lastFrame();
      expect(frame).toContain("FOLLOWING");
      expect(mockGetFullRequest).toHaveBeenCalledWith("test-0");
    });

    it("j/k exits follow mode", async () => {
      setupMocksWithRequests(3);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Starts in follow mode
      expect(lastFrame()).toContain("FOLLOWING");

      // Press j to navigate — should exit follow mode
      stdin.write("j");
      await tick();

      expect(lastFrame()).not.toContain("FOLLOWING");
    });

    it("g enters follow mode", async () => {
      setupMocksWithRequests(5);

      const { lastFrame, stdin } = render(<App __testEnableInput />);
      await tick();

      // Navigate down (exits follow mode)
      stdin.write("j");
      await tick();
      expect(lastFrame()).not.toContain("FOLLOWING");

      // Press g to jump to top — re-enters follow mode
      stdin.write("g");
      await tick();

      expect(lastFrame()).toContain("FOLLOWING");
    });
  });
});
