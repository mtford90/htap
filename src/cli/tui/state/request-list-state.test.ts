import { describe, expect, it } from "vitest";
import type { CapturedRequestSummary } from "../../../shared/types.js";
import {
  countPrependedRequests,
  resolveEffectiveListScrollOffset,
  resolveSelectedIndex,
} from "./request-list-state.js";

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

describe("resolveSelectedIndex", () => {
  it("returns -1 for empty request list", () => {
    expect(resolveSelectedIndex({ requests: [], selectedRequestId: null, following: true })).toBe(
      -1
    );
  });

  it("anchors to selected request id when present", () => {
    const requests = [createSummary("a"), createSummary("b"), createSummary("c")];

    expect(resolveSelectedIndex({ requests, selectedRequestId: "b", following: false })).toBe(1);
  });

  it("falls back to index 0 when selected id is missing", () => {
    const requests = [createSummary("a"), createSummary("b")];

    expect(resolveSelectedIndex({ requests, selectedRequestId: "missing", following: false })).toBe(
      0
    );
  });
});

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

describe("countPrependedRequests", () => {
  it("returns 0 when there is no previous state", () => {
    const next = [createSummary("new"), createSummary("old")];
    expect(countPrependedRequests([], next)).toBe(0);
  });

  it("counts newly prepended items until first known id", () => {
    const next = [
      createSummary("new-2"),
      createSummary("new-1"),
      createSummary("a"),
      createSummary("b"),
    ];
    expect(countPrependedRequests(["a", "b"], next)).toBe(2);
  });

  it("returns full length when no previous ids remain", () => {
    const next = [createSummary("x"), createSummary("y")];
    expect(countPrependedRequests(["a", "b"], next)).toBe(2);
  });
});
