/**
 * Tests for AccordionPanel component using ink-testing-library.
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import {
  AccordionPanel,
  SECTION_REQUEST,
  SECTION_REQUEST_BODY,
  SECTION_RESPONSE,
  SECTION_RESPONSE_BODY,
  calculateHeights,
} from "./AccordionPanel.js";
import type { CapturedRequest } from "../../../shared/types.js";

const createMockRequest = (overrides: Partial<CapturedRequest> = {}): CapturedRequest => ({
  id: "test-1",
  sessionId: "session-1",
  timestamp: Date.now(),
  method: "GET",
  url: "http://example.com/api/users",
  host: "example.com",
  path: "/api/users",
  requestHeaders: {
    "content-type": "application/json",
    "accept": "application/json",
    "user-agent": "test-agent/1.0",
  },
  responseStatus: 200,
  responseHeaders: {
    "content-type": "application/json",
    "cache-control": "no-cache",
  },
  responseBody: Buffer.from('{"data":"test"}'),
  durationMs: 150,
  ...overrides,
});

describe("AccordionPanel", () => {
  const defaultProps = {
    width: 60,
    height: 20,
    isActive: true,
    focusedSection: SECTION_REQUEST,
    expandedSections: new Set([SECTION_REQUEST]),
  };

  describe("Rendering", () => {
    it("renders all 4 section headers", () => {
      const request = createMockRequest();
      const { lastFrame } = render(<AccordionPanel {...defaultProps} request={request} />);
      const frame = lastFrame();

      expect(frame).toContain("[2] Request");
      expect(frame).toContain("[3] Request Body");
      expect(frame).toContain("[4] Response");
      expect(frame).toContain("[5] Response Body");
    });

    it("shows empty state when no request", () => {
      const { lastFrame } = render(<AccordionPanel {...defaultProps} request={null} />);
      const frame = lastFrame();

      expect(frame).toContain("Select a request to view details");
    });

    it("shows request method and URL in Request section when expanded", () => {
      const request = createMockRequest();
      const { lastFrame } = render(<AccordionPanel {...defaultProps} request={request} />);
      const frame = lastFrame();

      expect(frame).toContain("GET");
      // URL contains a zero-width space after :// to prevent terminal hyperlinking
      expect(frame).toContain("http://\u200Bexample.com/api/users");
    });

    it("shows request headers when Request section is expanded", () => {
      const request = createMockRequest();
      const { lastFrame } = render(<AccordionPanel {...defaultProps} request={request} />);
      const frame = lastFrame();

      expect(frame).toContain("content-type");
      expect(frame).toContain("application/json");
    });

    it("shows response body content when Response Body section is expanded", () => {
      const request = createMockRequest();
      const props = {
        ...defaultProps,
        focusedSection: SECTION_RESPONSE_BODY,
        expandedSections: new Set([SECTION_RESPONSE_BODY]),
      };
      const { lastFrame } = render(<AccordionPanel {...props} request={request} />);
      const frame = lastFrame();

      // JSON body should be formatted
      expect(frame).toContain("data");
      expect(frame).toContain("test");
    });

    it("shows status code in Response section header", () => {
      const request = createMockRequest({ responseStatus: 404 });
      const { lastFrame } = render(<AccordionPanel {...defaultProps} request={request} />);
      const frame = lastFrame();

      expect(frame).toContain("404");
      expect(frame).toContain("Not Found");
    });

    it("shows content type shorthand in section headers", () => {
      const request = createMockRequest();
      const { lastFrame } = render(<AccordionPanel {...defaultProps} request={request} />);
      const frame = lastFrame();

      // Content type should appear as "json" not "application/json" in headers
      expect(frame).toContain("json");
    });
  });

  describe("Expansion state", () => {
    it("shows expanded indicator (▼) for expanded sections", () => {
      const request = createMockRequest();
      const { lastFrame } = render(<AccordionPanel {...defaultProps} request={request} />);
      const frame = lastFrame();

      // Should have expanded indicators
      expect(frame).toContain("▼");
    });

    it("shows collapsed indicator (▶) for collapsed sections", () => {
      const request = createMockRequest();
      const { lastFrame } = render(<AccordionPanel {...defaultProps} request={request} />);
      const frame = lastFrame();

      // Request Body and Response are collapsed by default
      expect(frame).toContain("▶");
    });

    it("collapsed sections show minimal height", () => {
      const request = createMockRequest();
      // All collapsed
      const props = {
        ...defaultProps,
        expandedSections: new Set<number>(),
      };
      const { lastFrame } = render(<AccordionPanel {...props} request={request} />);
      const frame = lastFrame();

      // All should show collapsed indicators
      const collapsedCount = (frame.match(/▶/g) || []).length;
      expect(collapsedCount).toBe(4);
    });
  });

  describe("Focus indicator", () => {
    it("shows focus indicator (») on focused section when active", () => {
      const request = createMockRequest();
      const { lastFrame } = render(<AccordionPanel {...defaultProps} request={request} />);
      const frame = lastFrame();

      expect(frame).toContain("»");
    });

    it("does not show focus indicator when panel is not active", () => {
      const request = createMockRequest();
      const props = { ...defaultProps, isActive: false };
      const { lastFrame } = render(<AccordionPanel {...props} request={request} />);
      const frame = lastFrame();

      // Focus indicator should not appear (space instead of »)
      // Note: The buildDividerLine adds a space for non-focused sections
      // so we check that » specifically is not present
      expect(frame).not.toContain("»");
    });

    it("focus indicator moves with focusedSection", () => {
      const request = createMockRequest();

      // Focus on Request Body
      const props1 = { ...defaultProps, focusedSection: SECTION_REQUEST_BODY };
      const { lastFrame: frame1 } = render(<AccordionPanel {...props1} request={request} />);

      // Focus on Response
      const props2 = { ...defaultProps, focusedSection: SECTION_RESPONSE };
      const { lastFrame: frame2 } = render(<AccordionPanel {...props2} request={request} />);

      // Both frames should have focus indicator, but in different positions
      expect(frame1()).toContain("»");
      expect(frame2()).toContain("»");
    });
  });

  describe("Body content display", () => {
    it("shows (no body) for empty request body", () => {
      const request = createMockRequest({ requestBody: undefined });
      const props = {
        ...defaultProps,
        expandedSections: new Set([SECTION_REQUEST_BODY]),
      };
      const { lastFrame } = render(<AccordionPanel {...props} request={request} />);
      const frame = lastFrame();

      expect(frame).toContain("(no body)");
    });

    it("shows (no body) for zero-length response body", () => {
      const request = createMockRequest({ responseBody: Buffer.from("") });
      const props = {
        ...defaultProps,
        expandedSections: new Set([SECTION_RESPONSE_BODY]),
      };
      const { lastFrame } = render(<AccordionPanel {...props} request={request} />);
      const frame = lastFrame();

      // Component treats zero-length buffer same as undefined
      expect(frame).toContain("(no body)");
    });

    it("shows binary content message for image content", () => {
      // Create a buffer that looks like PNG (starts with PNG magic bytes)
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(100).fill(0)]);
      const request = createMockRequest({
        responseBody: pngBuffer,
        responseHeaders: { "content-type": "image/png" },
      });
      const props = {
        ...defaultProps,
        expandedSections: new Set([SECTION_RESPONSE_BODY]),
      };
      const { lastFrame } = render(<AccordionPanel {...props} request={request} />);
      const frame = lastFrame();

      expect(frame).toContain("content");
      expect(frame).toContain("Press 's' to export");
    });

    it("shows truncation message for truncated body", () => {
      const request = createMockRequest({
        responseBody: undefined,
        responseBodyTruncated: true,
        responseHeaders: { "content-type": "application/json", "content-length": "1048576" },
      });
      const props = {
        ...defaultProps,
        expandedSections: new Set([SECTION_RESPONSE_BODY]),
      };
      const { lastFrame } = render(<AccordionPanel {...props} request={request} />);
      const frame = lastFrame();

      expect(frame).toContain("too large");
    });

    it("formats JSON body with indentation", () => {
      const request = createMockRequest({
        responseBody: Buffer.from('{"nested":{"key":"value"}}'),
        responseHeaders: { "content-type": "application/json" },
      });
      const props = {
        ...defaultProps,
        expandedSections: new Set([SECTION_RESPONSE_BODY]),
      };
      const { lastFrame } = render(<AccordionPanel {...props} request={request} />);
      const frame = lastFrame();

      // JSON should be formatted across multiple lines
      expect(frame).toContain("nested");
      expect(frame).toContain("key");
      expect(frame).toContain("value");
    });

    it("pretty-prints +json content types", () => {
      const request = createMockRequest({
        responseBody: Buffer.from('{"key":"value"}'),
        responseHeaders: { "content-type": "application/vnd.api+json" },
      });
      const props = {
        ...defaultProps,
        expandedSections: new Set([SECTION_RESPONSE_BODY]),
      };
      const { lastFrame } = render(<AccordionPanel {...props} request={request} />);
      const frame = lastFrame();

      expect(frame).toContain("key");
      expect(frame).toContain("value");
    });

    it("renders invalid JSON as-is without crashing", () => {
      const request = createMockRequest({
        responseBody: Buffer.from("{not valid json}"),
        responseHeaders: { "content-type": "application/json" },
      });
      const props = {
        ...defaultProps,
        expandedSections: new Set([SECTION_RESPONSE_BODY]),
      };
      const { lastFrame } = render(<AccordionPanel {...props} request={request} />);
      const frame = lastFrame();

      expect(frame).toContain("{not valid json}");
    });

    it("does not reformat non-JSON content even if it starts with {", () => {
      const request = createMockRequest({
        responseBody: Buffer.from('{"key":"value"}'),
        responseHeaders: { "content-type": "text/plain" },
      });
      const props = {
        ...defaultProps,
        expandedSections: new Set([SECTION_RESPONSE_BODY]),
      };
      const { lastFrame } = render(<AccordionPanel {...props} request={request} />);
      const frame = lastFrame();

      // Should be on a single line (not pretty-printed)
      expect(frame).toContain('{"key":"value"}');
    });

    it("does not reformat text/html content", () => {
      const request = createMockRequest({
        responseBody: Buffer.from("<html><body>hello</body></html>"),
        responseHeaders: { "content-type": "text/html" },
      });
      const props = {
        ...defaultProps,
        expandedSections: new Set([SECTION_RESPONSE_BODY]),
      };
      const { lastFrame } = render(<AccordionPanel {...props} request={request} />);
      const frame = lastFrame();

      expect(frame).toContain("<html>");
    });
  });

  describe("Response headers", () => {
    it("shows response headers when Response section is expanded", () => {
      const request = createMockRequest();
      const props = {
        ...defaultProps,
        expandedSections: new Set([SECTION_RESPONSE]),
      };
      const { lastFrame } = render(<AccordionPanel {...props} request={request} />);
      const frame = lastFrame();

      expect(frame).toContain("cache-control");
      expect(frame).toContain("no-cache");
    });

    it("shows (pending response) when no response headers", () => {
      const request = createMockRequest({ responseHeaders: undefined, responseStatus: undefined });
      const props = {
        ...defaultProps,
        expandedSections: new Set([SECTION_RESPONSE]),
      };
      const { lastFrame } = render(<AccordionPanel {...props} request={request} />);
      const frame = lastFrame();

      expect(frame).toContain("(pending response)");
    });
  });

  describe("Size display", () => {
    it("shows body size in section header", () => {
      const request = createMockRequest({
        responseBody: Buffer.from('{"data":"test value with some length"}'),
      });
      const { lastFrame } = render(<AccordionPanel {...defaultProps} request={request} />);
      const frame = lastFrame();

      // Should show size (e.g., "38 B" or similar)
      expect(frame).toMatch(/\d+\s*B/);
    });
  });

  describe("Multi-expand rendering", () => {
    it("renders multiple sections expanded simultaneously", () => {
      const request = createMockRequest();
      const props = {
        ...defaultProps,
        expandedSections: new Set([SECTION_REQUEST, SECTION_RESPONSE]),
      };
      const { lastFrame } = render(<AccordionPanel {...props} request={request} />);
      const frame = lastFrame();

      // Both Request and Response sections should be expanded
      const expandedCount = (frame.match(/▼/g) || []).length;
      expect(expandedCount).toBe(2);

      // Other two should be collapsed
      const collapsedCount = (frame.match(/▶/g) || []).length;
      expect(collapsedCount).toBe(2);
    });

    it("renders all 4 sections expanded", () => {
      const request = createMockRequest();
      const props = {
        ...defaultProps,
        expandedSections: new Set([SECTION_REQUEST, SECTION_REQUEST_BODY, SECTION_RESPONSE, SECTION_RESPONSE_BODY]),
      };
      const { lastFrame } = render(<AccordionPanel {...props} request={request} />);
      const frame = lastFrame();

      const expandedCount = (frame.match(/▼/g) || []).length;
      expect(expandedCount).toBe(4);
    });
  });
});

describe("calculateHeights", () => {
  const sectionCount = 4;

  it("gives all sections 1 row when none expanded", () => {
    const heights = calculateHeights(20, new Set(), sectionCount);
    expect(heights).toEqual([1, 1, 1, 1]);
  });

  it("gives expanded section the remaining height when 1 expanded", () => {
    const heights = calculateHeights(20, new Set([0]), sectionCount);
    // Total 20, minus 1 for bottom border = 19 available
    // 3 collapsed = 3 rows, remaining = 16 for the expanded section
    expect(heights[0]).toBe(16);
    expect(heights[1]).toBe(1);
    expect(heights[2]).toBe(1);
    expect(heights[3]).toBe(1);
  });

  it("splits remaining height equally when 2 expanded", () => {
    const heights = calculateHeights(20, new Set([0, 2]), sectionCount);
    // 19 available, 2 collapsed = 2, remaining = 17, split between 2 = 8 each
    expect(heights[0]).toBe(8);
    expect(heights[1]).toBe(1);
    expect(heights[2]).toBe(8);
    expect(heights[3]).toBe(1);
  });

  it("splits remaining height equally when 3 expanded", () => {
    const heights = calculateHeights(20, new Set([0, 1, 2]), sectionCount);
    // 19 available, 1 collapsed = 1, remaining = 18, split between 3 = 6 each
    expect(heights[0]).toBe(6);
    expect(heights[1]).toBe(6);
    expect(heights[2]).toBe(6);
    expect(heights[3]).toBe(1);
  });

  it("splits remaining height equally when all 4 expanded", () => {
    const heights = calculateHeights(20, new Set([0, 1, 2, 3]), sectionCount);
    // 19 available, 0 collapsed, remaining = 19, split between 4 = 4 each
    expect(heights[0]).toBe(4);
    expect(heights[1]).toBe(4);
    expect(heights[2]).toBe(4);
    expect(heights[3]).toBe(4);
  });

  it("enforces minimum height of 3 for expanded sections", () => {
    // Very small total height
    const heights = calculateHeights(8, new Set([0, 1, 2, 3]), sectionCount);
    // Each expanded section should get at least 3
    for (const h of heights) {
      expect(h).toBeGreaterThanOrEqual(3);
    }
  });
});
