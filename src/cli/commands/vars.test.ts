import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import {
  formatEnvVars,
  formatUnsetVars,
  formatNodeOptionsExport,
  formatNodeOptionsRestore,
} from "./vars.js";

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

  describe("shell injection prevention", () => {
    it("escapes dollar signs (command substitution)", () => {
      const result = formatEnvVars({ HTPX_LABEL: "$(rm -rf /)" });
      expect(result).toBe('export HTPX_LABEL="\\$(rm -rf /)"');
    });

    it("escapes backticks (legacy command substitution)", () => {
      const result = formatEnvVars({ HTPX_LABEL: "`whoami`" });
      expect(result).toBe('export HTPX_LABEL="\\`whoami\\`"');
    });

    it("escapes double quotes", () => {
      const result = formatEnvVars({ HTPX_LABEL: 'say "hello"' });
      expect(result).toBe('export HTPX_LABEL="say \\"hello\\""');
    });

    it("escapes backslashes", () => {
      const result = formatEnvVars({ HTPX_LABEL: "path\\to\\file" });
      expect(result).toBe('export HTPX_LABEL="path\\\\to\\\\file"');
    });

    it("escapes exclamation marks (history expansion)", () => {
      const result = formatEnvVars({ HTPX_LABEL: "hello!world" });
      expect(result).toBe('export HTPX_LABEL="hello\\!world"');
    });

    it("escapes multiple dangerous characters combined", () => {
      const result = formatEnvVars({ HTPX_LABEL: '$(cmd) `cmd` "quoted" \\path!' });
      expect(result).toBe('export HTPX_LABEL="\\$(cmd) \\`cmd\\` \\"quoted\\" \\\\path\\!"');
    });
  });
});

describe("formatUnsetVars", () => {
  it("formats single var", () => {
    const result = formatUnsetVars(["FOO"]);
    expect(result).toBe("unset FOO");
  });

  it("formats multiple vars", () => {
    const result = formatUnsetVars(["HTTP_PROXY", "HTTPS_PROXY"]);

    const lines = result.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("unset HTTP_PROXY");
    expect(lines[1]).toBe("unset HTTPS_PROXY");
  });

  it("handles empty array", () => {
    const result = formatUnsetVars([]);
    expect(result).toBe("");
  });

  it("includes all standard htpx env vars", () => {
    const result = formatUnsetVars([
      "HTTP_PROXY",
      "HTTPS_PROXY",
      "SSL_CERT_FILE",
      "REQUESTS_CA_BUNDLE",
      "NODE_EXTRA_CA_CERTS",
      "HTPX_SESSION_ID",
      "HTPX_LABEL",
    ]);

    expect(result).toContain("unset HTTP_PROXY");
    expect(result).toContain("unset HTTPS_PROXY");
    expect(result).toContain("unset SSL_CERT_FILE");
    expect(result).toContain("unset REQUESTS_CA_BUNDLE");
    expect(result).toContain("unset NODE_EXTRA_CA_CERTS");
    expect(result).toContain("unset HTPX_SESSION_ID");
    expect(result).toContain("unset HTPX_LABEL");
  });
});

describe("formatNodeOptionsExport", () => {
  const preloadPath = "/Users/test/.htpx/proxy-preload.cjs";

  it("saves original NODE_OPTIONS via ${param-word} guard", () => {
    const result = formatNodeOptionsExport(preloadPath);
    // Uses ${HTPX_ORIG_NODE_OPTIONS-...} (without colon) so it only falls through when truly unset
    expect(result).toContain("HTPX_ORIG_NODE_OPTIONS");
    expect(result).toContain("${HTPX_ORIG_NODE_OPTIONS-${NODE_OPTIONS:-}}");
  });

  it("appends --require with the preload path", () => {
    const result = formatNodeOptionsExport(preloadPath);
    expect(result).toContain("--require");
    expect(result).toContain(preloadPath);
  });

  it("does not wrap the preload path in single quotes", () => {
    const result = formatNodeOptionsExport(preloadPath);
    // Single quotes inside double-quoted shell strings are literal — they must not appear
    expect(result).not.toContain(`'${preloadPath}'`);
    expect(result).not.toMatch(/--require\s+'/);
  });

  it("preserves existing NODE_OPTIONS when appending", () => {
    const result = formatNodeOptionsExport(preloadPath);
    // Should use ${HTPX_ORIG_NODE_OPTIONS:+...} to conditionally prepend original value
    expect(result).toContain("${HTPX_ORIG_NODE_OPTIONS:+");
  });

  it("exports NODE_OPTIONS", () => {
    const result = formatNodeOptionsExport(preloadPath);
    expect(result).toContain("export NODE_OPTIONS=");
  });

  it("does not use if/then/fi (breaks in eval $() under zsh)", () => {
    const result = formatNodeOptionsExport(preloadPath);
    expect(result).not.toContain("if ");
    expect(result).not.toContain("then");
    expect(result).not.toContain("fi");
  });

  it("produces NODE_OPTIONS without literal quote characters after shell eval", () => {
    const result = formatNodeOptionsExport(preloadPath);
    // Evaluate the shell output and inspect the resulting NODE_OPTIONS value
    const nodeOptions = execSync(`bash -c '${result.replace(/'/g, "'\\''")}\necho "$NODE_OPTIONS"'`)
      .toString()
      .trim();
    expect(nodeOptions).toBe(`--require ${preloadPath}`);
    expect(nodeOptions).not.toContain("'");
  });

  it("handles paths with spaces correctly after shell eval", () => {
    const spacePath = "/Users/test user/.htpx/proxy-preload.cjs";
    const result = formatNodeOptionsExport(spacePath);
    const nodeOptions = execSync(`bash -c '${result.replace(/'/g, "'\\''")}\necho "$NODE_OPTIONS"'`)
      .toString()
      .trim();
    expect(nodeOptions).toBe(`--require ${spacePath}`);
    expect(nodeOptions).not.toContain("'");
  });

  it("escapes double-quote-significant characters in the path", () => {
    const trickyPath = "/Users/test/.htpx/proxy-preload.cjs";
    const result = formatNodeOptionsExport(trickyPath);
    // The path should be escaped for double-quoted context (backslash, $, `, ", !)
    // but should not contain single quotes
    expect(result).not.toMatch(/--require\s+'/);
  });
});

describe("formatNodeOptionsRestore", () => {
  it("restores NODE_OPTIONS from saved value when non-empty", () => {
    const result = formatNodeOptionsRestore();
    expect(result).toContain("HTPX_ORIG_NODE_OPTIONS");
    expect(result).toContain("export NODE_OPTIONS=");
  });

  it("unsets NODE_OPTIONS when original was empty", () => {
    const result = formatNodeOptionsRestore();
    expect(result).toContain("unset NODE_OPTIONS");
  });

  it("cleans up HTPX_ORIG_NODE_OPTIONS", () => {
    const result = formatNodeOptionsRestore();
    expect(result).toContain("unset HTPX_ORIG_NODE_OPTIONS");
  });
});
