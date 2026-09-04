import { describe, expect, it } from "vitest";
import type { CapturedRequestSummary } from "../../../shared/types.js";
import { resolveEffectiveListScrollOffset } from "./list-scroll-offset.js";

function createSummary(id: string): CapturedRequestSummary {
  return {
    id,
    sessionId: "session-1",
    timestamp: 1,
    method: "GET",
    url: `https://example.com/${id}`,
    host: "example.com",
    path: `/${id}`,
    requestBodySize: 0,
    responseBodySize: 0,
  };
}

describe("resolveEffectiveListScrollOffset", () => {
  it("returns 0 while following", () => {
    const requests = [createSummary("a"), createSummary("b")];

    expect(
      resolveEffectiveListScrollOffset({
        requests,
        following: true,
        topVisibleRequestId: "b",
        selectedIndex: 1,
        maxListOffset: 1,
      })
    ).toBe(0);
  });

  it("uses top visible id when available", () => {
    const requests = [createSummary("a"), createSummary("b"), createSummary("c")];

    expect(
      resolveEffectiveListScrollOffset({
        requests,
        following: false,
        topVisibleRequestId: "b",
        selectedIndex: 2,
        maxListOffset: 2,
      })
    ).toBe(1);
  });

  it("falls back to selected index and respects max offset", () => {
    const requests = [createSummary("a"), createSummary("b"), createSummary("c")];

    expect(
      resolveEffectiveListScrollOffset({
        requests,
        following: false,
        topVisibleRequestId: null,
        selectedIndex: 2,
        maxListOffset: 1,
      })
    ).toBe(1);
  });
});
