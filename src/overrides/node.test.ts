import * as path from "node:path";
import { describe, it, expect } from "vitest";
import { resolveDependencyPath, generateNodePreloadScript, getNodeEnvVars } from "./node.js";

describe("resolveDependencyPath", () => {
  it("returns an absolute path for global-agent", () => {
    const result = resolveDependencyPath("global-agent");
    expect(path.isAbsolute(result)).toBe(true);
    expect(result).toContain("global-agent");
  });

  it("returns an absolute path for undici", () => {
    const result = resolveDependencyPath("undici");
    expect(path.isAbsolute(result)).toBe(true);
    expect(result).toContain("undici");
  });

  it("throws for a non-existent dependency", () => {
    expect(() => resolveDependencyPath("__nonexistent_package_12345__")).toThrow();
  });
});

describe("generateNodePreloadScript", () => {
  it("contains global-agent bootstrap call", () => {
    const script = generateNodePreloadScript();
    expect(script).toContain(".bootstrap()");
    expect(script).toContain("global-agent");
  });

  it("contains undici setGlobalDispatcher call", () => {
    const script = generateNodePreloadScript();
    expect(script).toContain("setGlobalDispatcher");
    expect(script).toContain("EnvHttpProxyAgent");
    expect(script).toContain("undici");
  });

  it("wraps each block in try/catch for resilience", () => {
    const script = generateNodePreloadScript();
    const tryCount = (script.match(/try\s*\{/g) ?? []).length;
    const catchCount = (script.match(/\}\s*catch/g) ?? []).length;
    expect(tryCount).toBe(2);
    expect(catchCount).toBe(2);
  });

  it("uses absolute paths to dependencies", () => {
    const script = generateNodePreloadScript();
    // Extract all paths from require('...') calls
    const requirePattern = /require\('([^']+)'\)/g;
    const paths: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = requirePattern.exec(script)) !== null) {
      const captured = m[1];
      if (captured !== undefined) {
        paths.push(captured);
      }
    }
    expect(paths).toHaveLength(2);
    for (const p of paths) {
      expect(path.isAbsolute(p)).toBe(true);
    }
  });

  it("is valid CJS (starts with 'use strict')", () => {
    const script = generateNodePreloadScript();
    expect(script).toMatch(/^'use strict';/);
  });
});

describe("getNodeEnvVars", () => {
  const proxyUrl = "http://127.0.0.1:9000";

  it("returns GLOBAL_AGENT_HTTP_PROXY", () => {
    const vars = getNodeEnvVars(proxyUrl);
    expect(vars["GLOBAL_AGENT_HTTP_PROXY"]).toBe(proxyUrl);
  });

  it("returns GLOBAL_AGENT_HTTPS_PROXY", () => {
    const vars = getNodeEnvVars(proxyUrl);
    expect(vars["GLOBAL_AGENT_HTTPS_PROXY"]).toBe(proxyUrl);
  });

  it("returns NODE_USE_ENV_PROXY", () => {
    const vars = getNodeEnvVars(proxyUrl);
    expect(vars["NODE_USE_ENV_PROXY"]).toBe("1");
  });

  it("does not include standard proxy vars (those are set elsewhere)", () => {
    const vars = getNodeEnvVars(proxyUrl);
    expect(vars).not.toHaveProperty("HTTP_PROXY");
    expect(vars).not.toHaveProperty("HTTPS_PROXY");
    expect(vars).not.toHaveProperty("http_proxy");
    expect(vars).not.toHaveProperty("https_proxy");
  });
});
