import { describe, it, expect } from "vitest";
import { formatEnvVars } from "./intercept.js";

describe("formatEnvVars", () => {
  it("formats single env var", () => {
    const result = formatEnvVars({ FOO: "bar" });
    expect(result).toBe('export FOO="bar"');
  });

  it("formats multiple env vars", () => {
    const result = formatEnvVars({
      HTTP_PROXY: "http://localhost:8080",
      HTTPS_PROXY: "http://localhost:8080",
    });

    const lines = result.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('export HTTP_PROXY="http://localhost:8080"');
    expect(lines[1]).toBe('export HTTPS_PROXY="http://localhost:8080"');
  });

  it("handles empty object", () => {
    const result = formatEnvVars({});
    expect(result).toBe("");
  });

  it("handles paths with special characters", () => {
    const result = formatEnvVars({
      SSL_CERT_FILE: "/Users/test/.htpx/ca.pem",
    });
    expect(result).toBe('export SSL_CERT_FILE="/Users/test/.htpx/ca.pem"');
  });

  it("formats all standard htpx env vars", () => {
    const result = formatEnvVars({
      HTTP_PROXY: "http://127.0.0.1:9000",
      HTTPS_PROXY: "http://127.0.0.1:9000",
      SSL_CERT_FILE: "/path/to/ca.pem",
      REQUESTS_CA_BUNDLE: "/path/to/ca.pem",
      NODE_EXTRA_CA_CERTS: "/path/to/ca.pem",
      HTPX_SESSION_ID: "abc-123",
      HTPX_LABEL: "test-session",
    });

    expect(result).toContain("export HTTP_PROXY=");
    expect(result).toContain("export HTTPS_PROXY=");
    expect(result).toContain("export SSL_CERT_FILE=");
    expect(result).toContain("export REQUESTS_CA_BUNDLE=");
    expect(result).toContain("export NODE_EXTRA_CA_CERTS=");
    expect(result).toContain("export HTPX_SESSION_ID=");
    expect(result).toContain("export HTPX_LABEL=");
  });
});
