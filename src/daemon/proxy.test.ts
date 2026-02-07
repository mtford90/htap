import { describe, it, expect } from "vitest";
import { flattenHeaders } from "./proxy.js";

describe("flattenHeaders", () => {
  it("passes string values through unchanged", () => {
    const input = {
      "content-type": "application/json",
      host: "example.com",
      "user-agent": "test-agent",
    };

    const result = flattenHeaders(input);

    expect(result).toEqual({
      "content-type": "application/json",
      host: "example.com",
      "user-agent": "test-agent",
    });
  });

  it("joins array values with comma-space separator", () => {
    const input = {
      "accept-encoding": ["gzip", "deflate", "br"],
    };

    const result = flattenHeaders(input);

    expect(result).toEqual({
      "accept-encoding": "gzip, deflate, br",
    });
  });

  it("handles single-element arrays", () => {
    const input = {
      authorization: ["Bearer token123"],
    };

    const result = flattenHeaders(input);

    expect(result).toEqual({
      authorization: "Bearer token123",
    });
  });

  it("excludes undefined values", () => {
    const input = {
      "content-type": "text/html",
      "x-optional": undefined,
      host: "example.com",
      "x-another-optional": undefined,
    };

    const result = flattenHeaders(input);

    expect(result).toEqual({
      "content-type": "text/html",
      host: "example.com",
    });
    expect(result).not.toHaveProperty("x-optional");
    expect(result).not.toHaveProperty("x-another-optional");
  });

  it("returns empty object for empty input", () => {
    const result = flattenHeaders({});
    expect(result).toEqual({});
  });

  it("handles mixed types: string, array, and undefined", () => {
    const input = {
      host: "api.example.com",
      "accept-language": ["en-US", "en"],
      "content-type": "application/json",
      "x-deprecated": undefined,
      "cache-control": ["no-cache", "no-store"],
      connection: "keep-alive",
      "x-removed": undefined,
    };

    const result = flattenHeaders(input);

    expect(result).toEqual({
      host: "api.example.com",
      "accept-language": "en-US, en",
      "content-type": "application/json",
      "cache-control": "no-cache, no-store",
      connection: "keep-alive",
    });
  });

  it("produces empty string for empty array", () => {
    const input = {
      "x-empty": [],
    };

    const result = flattenHeaders(input);

    expect(result).toEqual({
      "x-empty": "",
    });
  });

  it("preserves header name casing", () => {
    const input = {
      "Content-Type": "text/plain",
      "X-Custom-Header": ["value1", "value2"],
      HOST: "example.com",
    };

    const result = flattenHeaders(input);

    expect(result).toEqual({
      "Content-Type": "text/plain",
      "X-Custom-Header": "value1, value2",
      HOST: "example.com",
    });
    expect(result).toHaveProperty("Content-Type");
    expect(result).toHaveProperty("X-Custom-Header");
    expect(result).toHaveProperty("HOST");
  });

  it("handles array with empty strings", () => {
    const input = {
      "x-test": ["", "value", ""],
    };

    const result = flattenHeaders(input);

    expect(result).toEqual({
      "x-test": ", value, ",
    });
  });

  it("handles typical HTTP request headers", () => {
    const input = {
      host: "api.example.com",
      "user-agent": "Mozilla/5.0",
      accept: ["text/html", "application/json"],
      "accept-encoding": ["gzip", "deflate"],
      "accept-language": "en-GB",
      connection: "keep-alive",
      "content-type": "application/x-www-form-urlencoded",
      "content-length": "42",
    };

    const result = flattenHeaders(input);

    expect(result).toEqual({
      host: "api.example.com",
      "user-agent": "Mozilla/5.0",
      accept: "text/html, application/json",
      "accept-encoding": "gzip, deflate",
      "accept-language": "en-GB",
      connection: "keep-alive",
      "content-type": "application/x-www-form-urlencoded",
      "content-length": "42",
    });
  });
});
