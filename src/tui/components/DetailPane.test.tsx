/** @jsxImportSource @opentui/react */

import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateHeights, DetailPane, type DetailPaneProps } from "./DetailPane.js";
import {
  SECTION_REQUEST,
  SECTION_REQUEST_BODY,
  SECTION_RESPONSE,
  SECTION_RESPONSE_BODY,
} from "../store/types.js";
import { destroyRenderers, fullRequest, renderTui } from "../test-support/render.js";

afterEach(destroyRenderers);

const ALL = new Set([
  SECTION_REQUEST,
  SECTION_REQUEST_BODY,
  SECTION_RESPONSE,
  SECTION_RESPONSE_BODY,
]);

const props = (overrides: Partial<DetailPaneProps> = {}): DetailPaneProps => ({
  request: fullRequest(),
  width: 70,
  height: 30,
  isActive: true,
  focusedSection: SECTION_REQUEST,
  expandedSections: ALL,
  onActivate: vi.fn(),
  onHoverChange: vi.fn(),
  ...overrides,
});

describe("calculateHeights", () => {
  it("gives every section one row when all are collapsed", () => {
    expect(calculateHeights(30, new Set(), 4)).toEqual([1, 1, 1, 1]);
  });

  it("shares the remaining rows between the expanded sections", () => {
    expect(calculateHeights(21, new Set([0, 2]), 4)).toEqual([9, 1, 9, 1]);
  });

  it("never squeezes an expanded section below three rows", () => {
    expect(calculateHeights(6, ALL, 4)).toEqual([3, 3, 3, 3]);
  });
});

describe("DetailPane", () => {
  it("prompts when no request is loaded", async () => {
    const setup = await renderTui(<DetailPane {...props({ request: null })} />, {
      width: 70,
      height: 30,
    });

    expect(setup.captureCharFrame()).toContain("Select a request to view details");
  });

  it("renders all four section headers", async () => {
    const setup = await renderTui(<DetailPane {...props()} />, { width: 70, height: 30 });

    const frame = setup.captureCharFrame();
    expect(frame).toContain("[2] Request");
    expect(frame).toContain("[3] Request Body");
    expect(frame).toContain("[4] Response");
    expect(frame).toContain("[5] Response Body");
  });

  it("shows the status text and content type in the section headers", async () => {
    const setup = await renderTui(<DetailPane {...props()} />, { width: 70, height: 30 });

    const frame = setup.captureCharFrame();
    expect(frame).toContain("200 OK");
    expect(frame).toContain("json");
  });

  it("marks the focused section", async () => {
    const setup = await renderTui(
      <DetailPane {...props({ focusedSection: SECTION_RESPONSE })} />,
      { width: 70, height: 30 }
    );

    const focusedLine = setup
      .captureCharFrame()
      .split("\n")
      .find((line) => line.includes("[4] Response"));
    expect(focusedLine).toContain("»");
  });

  it("collapses a section to its header row", async () => {
    const setup = await renderTui(
      <DetailPane {...props({ expandedSections: new Set([SECTION_REQUEST]) })} />,
      { width: 70, height: 30 }
    );

    const frame = setup.captureCharFrame();
    expect(frame).toContain("▼ [2] Request");
    expect(frame).toContain("▶ [3] Request Body");
    expect(frame).not.toContain("(no body)");
  });

  it("pretty-prints and highlights a JSON body", async () => {
    const setup = await renderTui(<DetailPane {...props()} />, { width: 70, height: 30 });

    const frame = setup.captureCharFrame();
    expect(frame).toContain('"items"');
  });

  it("reports an empty body", async () => {
    const setup = await renderTui(
      <DetailPane {...props({ request: fullRequest({ responseBody: undefined }) })} />,
      { width: 70, height: 30 }
    );

    expect(setup.captureCharFrame()).toContain("(no body)");
  });

  it("explains a body that was too large to capture", async () => {
    const request = fullRequest({
      responseBody: undefined,
      responseBodyTruncated: true,
      responseHeaders: { "content-type": "application/json", "content-length": "9999999" },
    });
    const setup = await renderTui(<DetailPane {...props({ request })} />, {
      width: 70,
      height: 30,
    });

    expect(setup.captureCharFrame()).toContain("Body too large to capture");
  });

  it("offers an export for binary content instead of rendering it", async () => {
    const request = fullRequest({
      responseHeaders: { "content-type": "image/png" },
      responseBody: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02]),
    });
    const setup = await renderTui(<DetailPane {...props({ request })} />, {
      width: 70,
      height: 30,
    });

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Image content (7B)");
    expect(frame).toContain("Press 's' to export");
  });

  it("shows the interceptor and replay provenance", async () => {
    const request = fullRequest({
      interceptedBy: "mock-api",
      interceptionType: "mocked",
      replayedFromId: "abcdef1234",
      replayInitiator: "tui",
    });
    const setup = await renderTui(<DetailPane {...props({ request })} />, {
      width: 70,
      height: 30,
    });

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Intercepted by: mock-api");
    expect(frame).toContain("Replayed from: abcdef1");
  });

  it("says the response is still pending when there are no response headers", async () => {
    const request = fullRequest({ responseHeaders: undefined, responseStatus: undefined });
    const setup = await renderTui(<DetailPane {...props({ request })} />, {
      width: 70,
      height: 30,
    });

    expect(setup.captureCharFrame()).toContain("(pending response)");
  });

  it("activates on a click", async () => {
    const onActivate = vi.fn();
    const setup = await renderTui(<DetailPane {...props({ onActivate })} />, {
      width: 70,
      height: 30,
    });

    await setup.mockMouse.click(10, 5);

    expect(onActivate).toHaveBeenCalled();
  });
});
