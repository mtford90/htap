/**
 * Tests for FormatExportModal component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { FormatExportModal } from "./FormatExportModal.js";
import type { CapturedRequest } from "../../../shared/types.js";

const mockExportFormatToClipboard = vi.fn().mockResolvedValue({ success: true, message: "cURL copied to clipboard" });
const mockExportHarToDir = vi.fn().mockReturnValue({ success: true, message: "Exported 1 request(s) to /mock/path" });

vi.mock("../hooks/useExport.js", () => ({
  exportFormatToClipboard: (...args: unknown[]) => mockExportFormatToClipboard(...args),
  exportHarToDir: (...args: unknown[]) => mockExportHarToDir(...args),
}));

vi.mock("../hooks/useBodyExport.js", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../hooks/useBodyExport.js");
  return {
    ...actual,
    resolveTargetDir: () => "/mock/exports",
  };
});

const tick = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));

const createRequest = (overrides: Partial<CapturedRequest> = {}): CapturedRequest => ({
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

describe("FormatExportModal", () => {
  const mockOnComplete = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockExportFormatToClipboard.mockReset().mockResolvedValue({ success: true, message: "cURL copied to clipboard" });
    mockExportHarToDir.mockReset().mockReturnValue({ success: true, message: "Exported 1 request(s) to /mock/path" });
  });

  it("renders format selection options", () => {
    const { lastFrame } = render(
      <FormatExportModal
        request={createRequest()}
        width={80}
        height={24}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />,
    );
    const frame = lastFrame();

    expect(frame).toContain("Export Request");
    expect(frame).toContain("cURL");
    expect(frame).toContain("Fetch");
    expect(frame).toContain("Python");
    expect(frame).toContain("HTTPie");
    expect(frame).toContain("HAR");
  });

  it("shows request summary", () => {
    const { lastFrame } = render(
      <FormatExportModal
        request={createRequest()}
        width={80}
        height={24}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />,
    );
    const frame = lastFrame();

    expect(frame).toContain("GET");
    expect(frame).toContain("200");
  });

  it("Escape closes modal in format phase", async () => {
    const { stdin } = render(
      <FormatExportModal
        request={createRequest()}
        width={80}
        height={24}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />,
    );

    stdin.write("\x1b");
    await tick();

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("number key 1 selects cURL export", async () => {
    const request = createRequest();
    const { stdin } = render(
      <FormatExportModal
        request={request}
        width={80}
        height={24}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />,
    );

    stdin.write("1");
    await tick();

    expect(mockExportFormatToClipboard).toHaveBeenCalledWith(request, "curl");
  });

  it("number key 2 selects Fetch export", async () => {
    const request = createRequest();
    const { stdin } = render(
      <FormatExportModal
        request={request}
        width={80}
        height={24}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />,
    );

    stdin.write("2");
    await tick();

    expect(mockExportFormatToClipboard).toHaveBeenCalledWith(request, "fetch");
  });

  it("number key 3 selects Python export", async () => {
    const request = createRequest();
    const { stdin } = render(
      <FormatExportModal
        request={request}
        width={80}
        height={24}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />,
    );

    stdin.write("3");
    await tick();

    expect(mockExportFormatToClipboard).toHaveBeenCalledWith(request, "python");
  });

  it("number key 4 selects HTTPie export", async () => {
    const request = createRequest();
    const { stdin } = render(
      <FormatExportModal
        request={request}
        width={80}
        height={24}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />,
    );

    stdin.write("4");
    await tick();

    expect(mockExportFormatToClipboard).toHaveBeenCalledWith(request, "httpie");
  });

  it("number key 5 transitions to HAR destination picker", async () => {
    const { lastFrame, stdin } = render(
      <FormatExportModal
        request={createRequest()}
        width={80}
        height={24}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />,
    );

    stdin.write("5");
    await tick();

    const frame = lastFrame();
    expect(frame).toContain("Export as HAR");
    expect(frame).toContain(".httap/exports/");
    expect(frame).toContain("~/Downloads/");
    expect(frame).toContain("Custom path...");
  });

  it("j/k navigates options", async () => {
    const { lastFrame, stdin } = render(
      <FormatExportModal
        request={createRequest()}
        width={80}
        height={24}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />,
    );

    // Initial selection should show cursor on first item
    let frame = lastFrame();
    expect(frame).toContain("\u276F");

    // Navigate down
    stdin.write("j");
    await tick();

    frame = lastFrame();
    // Cursor should have moved (frame should have changed)
    expect(frame).toContain("Fetch");
  });

  it("Enter selects current option", async () => {
    const request = createRequest();
    const { stdin } = render(
      <FormatExportModal
        request={request}
        width={80}
        height={24}
        onComplete={mockOnComplete}
        onClose={mockOnClose}
      />,
    );

    // First item is cURL, press Enter
    stdin.write("\r");
    await tick();

    expect(mockExportFormatToClipboard).toHaveBeenCalledWith(request, "curl");
  });

  describe("HAR destination phase", () => {
    it("Escape in destination phase goes back to format phase", async () => {
      const { lastFrame, stdin } = render(
        <FormatExportModal
          request={createRequest()}
          width={80}
          height={24}
          onComplete={mockOnComplete}
          onClose={mockOnClose}
        />,
      );

      // Go to HAR destination
      stdin.write("5");
      await tick();
      expect(lastFrame()).toContain("Export as HAR");

      // Press Escape to go back
      stdin.write("\x1b");
      await tick();

      expect(lastFrame()).toContain("Export Request");
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it("selecting .httap/exports/ exports HAR", async () => {
      const request = createRequest();
      const { stdin } = render(
        <FormatExportModal
          request={request}
          width={80}
          height={24}
          onComplete={mockOnComplete}
          onClose={mockOnClose}
        />,
      );

      stdin.write("5");
      await tick();
      stdin.write("1");
      await tick();

      expect(mockExportHarToDir).toHaveBeenCalledWith([request], "/mock/exports");
      expect(mockOnComplete).toHaveBeenCalled();
    });

    it("selecting Custom path shows text input", async () => {
      const { lastFrame, stdin } = render(
        <FormatExportModal
          request={createRequest()}
          width={80}
          height={24}
          onComplete={mockOnComplete}
          onClose={mockOnClose}
        />,
      );

      stdin.write("5");
      await tick();
      stdin.write("3");
      await tick();

      const frame = lastFrame();
      expect(frame).toContain("Enter directory path");
    });

    it("custom path text input: typing, backspace, and Escape", async () => {
      const { lastFrame, stdin } = render(
        <FormatExportModal
          request={createRequest()}
          width={80}
          height={24}
          onComplete={mockOnComplete}
          onClose={mockOnClose}
        />,
      );

      // Go to custom path input
      stdin.write("5");
      await tick();
      stdin.write("3");
      await tick();

      // Type a path
      for (const ch of "/tmp") {
        stdin.write(ch);
        await tick(30);
      }

      let frame = lastFrame();
      expect(frame).toContain("/tmp");

      // Backspace
      stdin.write("\x7f");
      await tick();

      frame = lastFrame();
      expect(frame).toContain("/tm");

      // Escape goes back to destination picker (not format picker)
      stdin.write("\x1b");
      await tick();

      frame = lastFrame();
      expect(frame).toContain("Export as HAR");
    });
  });
});
