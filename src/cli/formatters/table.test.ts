import { describe, it, expect, vi, afterEach } from "vitest";
import type { CapturedRequestSummary } from "../../shared/types.js";
import { formatRequestTable, SHORT_ID_LENGTH } from "./table.js";

// Disable colours for consistent test output
vi.stubEnv("NO_COLOR", "1");

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeSummary(overrides: Partial<CapturedRequestSummary> = {}): CapturedRequestSummary {
  return {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    sessionId: "session-1",
    timestamp: Date.now(),
    method: "GET",
    url: "https://api.example.com/users",
    host: "api.example.com",
    path: "/users",
    responseStatus: 200,
    durationMs: 45,
    requestBodySize: 0,
    responseBodySize: 1234,
    ...overrides,
  };
}

describe("formatRequestTable", () => {
  it("should render a table with header and rows", () => {
    const summaries = [makeSummary()];
    const output = formatRequestTable(summaries, 1);

    expect(output).toContain("ID");
    expect(output).toContain("Method");
    expect(output).toContain("Status");
    expect(output).toContain("URL");
    expect(output).toContain("Duration");
    expect(output).toContain("Size");
  });

  it("should use short IDs", () => {
    const summaries = [makeSummary()];
    const output = formatRequestTable(summaries, 1);

    const shortId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890".slice(0, SHORT_ID_LENGTH);
    expect(output).toContain(shortId);
    // Full ID should not appear
    expect(output).not.toContain("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
  });

  it("should show showing count when less than total", () => {
    const summaries = [makeSummary(), makeSummary()];
    const output = formatRequestTable(summaries, 100);

    expect(output).toContain("Showing 2 of 100 requests");
  });

  it("should show simple count when all shown", () => {
    const summaries = [makeSummary()];
    const output = formatRequestTable(summaries, 1);

    expect(output).toContain("Showing 1 request");
  });

  it("should handle plural correctly", () => {
    const summaries = [makeSummary(), makeSummary()];
    const output = formatRequestTable(summaries, 2);

    expect(output).toContain("Showing 2 requests");
  });

  it("should display interception indicators", () => {
    const mocked = makeSummary({ interceptionType: "mocked" });
    const modified = makeSummary({ interceptionType: "modified" });

    const mockedOutput = formatRequestTable([mocked], 1);
    expect(mockedOutput).toContain("[M]");

    const modifiedOutput = formatRequestTable([modified], 1);
    expect(modifiedOutput).toContain("[I]");
  });

  it("should handle empty list", () => {
    const output = formatRequestTable([], 0);
    expect(output).toContain("Showing 0 requests");
  });

  it("should handle missing status (pending request)", () => {
    const pending = makeSummary({ responseStatus: undefined, durationMs: undefined });
    const output = formatRequestTable([pending], 1);

    expect(output).toContain("...");
  });
});

describe("SHORT_ID_LENGTH", () => {
  it("should be 7", () => {
    expect(SHORT_ID_LENGTH).toBe(7);
  });
});
