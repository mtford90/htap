import * as crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  detectBrowsers,
  findBrowser,
  generateChromeExtension,
  generateFirefoxExtension,
  generateFirefoxProfile,
  computeSpkiHash,
  type BrowserInfo,
} from "./browser.js";

// ── Test Helpers ─────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "httap-browser-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── detectBrowsers ───────────────────────────────────────────────────────────

describe("detectBrowsers", () => {
  it("returns an array", () => {
    const browsers = detectBrowsers();
    expect(Array.isArray(browsers)).toBe(true);
  });

  it("returns empty array for unsupported platform", () => {
    const browsers = detectBrowsers("aix");
    expect(browsers).toEqual([]);
  });

  it("each detected browser has the required shape", () => {
    const browsers = detectBrowsers();
    for (const browser of browsers) {
      expect(browser).toHaveProperty("type");
      expect(browser).toHaveProperty("name");
      expect(browser).toHaveProperty("execPath");
      expect(["chrome", "firefox"]).toContain(browser.type);
      expect(typeof browser.name).toBe("string");
      expect(typeof browser.execPath).toBe("string");
    }
  });
});

// ── findBrowser ──────────────────────────────────────────────────────────────

describe("findBrowser", () => {
  const browsers: BrowserInfo[] = [
    { type: "chrome", name: "Google Chrome", execPath: "/usr/bin/google-chrome" },
    { type: "chrome", name: "Chromium", execPath: "/usr/bin/chromium" },
    { type: "firefox", name: "Firefox", execPath: "/usr/bin/firefox" },
  ];

  it("returns first browser when no preference given", () => {
    expect(findBrowser(browsers)).toEqual(browsers[0]);
  });

  it("returns undefined for empty browser list", () => {
    expect(findBrowser([])).toBeUndefined();
  });

  it("returns undefined for empty list even with preference", () => {
    expect(findBrowser([], "chrome")).toBeUndefined();
  });

  it("matches by type (case-insensitive)", () => {
    expect(findBrowser(browsers, "firefox")).toEqual(browsers[2]);
    expect(findBrowser(browsers, "chrome")).toEqual(browsers[0]);
  });

  it("matches by name substring (case-insensitive)", () => {
    expect(findBrowser(browsers, "Chromium")).toEqual(browsers[1]);
    expect(findBrowser(browsers, "chromium")).toEqual(browsers[1]);
    expect(findBrowser(browsers, "Google")).toEqual(browsers[0]);
  });

  it("returns undefined when no match found", () => {
    expect(findBrowser(browsers, "safari")).toBeUndefined();
  });
});

// ── generateChromeExtension ──────────────────────────────────────────────────

describe("generateChromeExtension", () => {
  it("creates manifest.json and rules.json", () => {
    const extDir = path.join(tmpDir, "chrome-ext");
    generateChromeExtension(extDir, "session-123", "token-abc");

    expect(fs.existsSync(path.join(extDir, "manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(extDir, "rules.json"))).toBe(true);
  });

  it("manifest is MV3 with correct permissions", () => {
    const extDir = path.join(tmpDir, "chrome-ext");
    generateChromeExtension(extDir, "s1", "t1");

    const manifest = JSON.parse(
      fs.readFileSync(path.join(extDir, "manifest.json"), "utf-8")
    ) as Record<string, unknown>;

    expect(manifest["manifest_version"]).toBe(3);
    expect(manifest["permissions"]).toContain("declarativeNetRequest");
    expect(manifest["host_permissions"]).toContain("<all_urls>");
  });

  it("rules contain correct session headers", () => {
    const extDir = path.join(tmpDir, "chrome-ext");
    generateChromeExtension(extDir, "sess-42", "tok-xyz");

    interface RuleHeader {
      header: string;
      value: string;
      operation: string;
    }

    interface Rule {
      action: { requestHeaders: RuleHeader[] };
    }

    const rules = JSON.parse(fs.readFileSync(path.join(extDir, "rules.json"), "utf-8")) as Rule[];

    expect(rules).toHaveLength(1);
    const firstRule = rules[0];
    expect(firstRule).toBeDefined();
    if (!firstRule) return;
    const headers = firstRule.action.requestHeaders;
    expect(headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          header: "x-httap-internal-session-id",
          operation: "set",
          value: "sess-42",
        }),
        expect.objectContaining({
          header: "x-httap-internal-session-token",
          operation: "set",
          value: "tok-xyz",
        }),
      ])
    );
  });
});

// ── generateFirefoxExtension ─────────────────────────────────────────────────

describe("generateFirefoxExtension", () => {
  it("creates manifest.json and background.js", () => {
    const extDir = path.join(tmpDir, "ff-ext");
    generateFirefoxExtension(extDir, "session-123", "token-abc");

    expect(fs.existsSync(path.join(extDir, "manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(extDir, "background.js"))).toBe(true);
  });

  it("manifest is MV2 with webRequest permissions", () => {
    const extDir = path.join(tmpDir, "ff-ext");
    generateFirefoxExtension(extDir, "s1", "t1");

    const manifest = JSON.parse(
      fs.readFileSync(path.join(extDir, "manifest.json"), "utf-8")
    ) as Record<string, unknown>;

    expect(manifest["manifest_version"]).toBe(2);
    expect(manifest["permissions"]).toContain("webRequest");
    expect(manifest["permissions"]).toContain("webRequestBlocking");
    expect(manifest["permissions"]).toContain("<all_urls>");
  });

  it("background.js contains session ID and token", () => {
    const extDir = path.join(tmpDir, "ff-ext");
    generateFirefoxExtension(extDir, "sess-99", "tok-secret");

    const bg = fs.readFileSync(path.join(extDir, "background.js"), "utf-8");

    expect(bg).toContain("x-httap-internal-session-id");
    expect(bg).toContain("sess-99");
    expect(bg).toContain("x-httap-internal-session-token");
    expect(bg).toContain("tok-secret");
    expect(bg).toContain("onBeforeSendHeaders");
  });

  it("manifest includes gecko extension ID", () => {
    const extDir = path.join(tmpDir, "ff-ext");
    generateFirefoxExtension(extDir, "s1", "t1");

    const manifest = JSON.parse(
      fs.readFileSync(path.join(extDir, "manifest.json"), "utf-8")
    ) as Record<string, unknown>;

    const geckoSettings = (manifest["browser_specific_settings"] as Record<string, unknown>)?.[
      "gecko"
    ] as Record<string, unknown> | undefined;
    expect(geckoSettings?.["id"]).toBe("httap@httap.dev");
  });
});

// ── generateFirefoxProfile ───────────────────────────────────────────────────

describe("generateFirefoxProfile", () => {
  it("creates user.js in the profile directory", () => {
    const profileDir = path.join(tmpDir, "ff-profile");
    generateFirefoxProfile(profileDir, 8080, "/path/to/ca.pem");

    expect(fs.existsSync(path.join(profileDir, "user.js"))).toBe(true);
  });

  it("user.js contains proxy configuration with correct port", () => {
    const profileDir = path.join(tmpDir, "ff-profile");
    generateFirefoxProfile(profileDir, 9999, "/path/to/ca.pem");

    const userJs = fs.readFileSync(path.join(profileDir, "user.js"), "utf-8");

    expect(userJs).toContain('"network.proxy.type", 1');
    expect(userJs).toContain('"network.proxy.http", "127.0.0.1"');
    expect(userJs).toContain('"network.proxy.http_port", 9999');
    expect(userJs).toContain('"network.proxy.ssl", "127.0.0.1"');
    expect(userJs).toContain('"network.proxy.ssl_port", 9999');
    expect(userJs).toContain('"network.proxy.no_proxies_on", ""');
  });

  it("user.js disables extension signing requirement", () => {
    const profileDir = path.join(tmpDir, "ff-profile");
    generateFirefoxProfile(profileDir, 8080, "/ca.pem");

    const userJs = fs.readFileSync(path.join(profileDir, "user.js"), "utf-8");
    expect(userJs).toContain('"xpinstall.signatures.required", false');
  });

  it("user.js disables telemetry and first-run prompts", () => {
    const profileDir = path.join(tmpDir, "ff-profile");
    generateFirefoxProfile(profileDir, 8080, "/ca.pem");

    const userJs = fs.readFileSync(path.join(profileDir, "user.js"), "utf-8");
    expect(userJs).toContain('"app.normandy.enabled", false');
    expect(userJs).toContain('"datareporting.policy.dataSubmissionEnabled", false');
    expect(userJs).toContain('"browser.shell.checkDefaultBrowser", false');
  });
});

// ── computeSpkiHash ──────────────────────────────────────────────────────────

describe("computeSpkiHash", () => {
  it("computes a base64-encoded SHA-256 hash", () => {
    const { privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });

    const keyPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    const keyPath = path.join(tmpDir, "test-key.pem");
    fs.writeFileSync(keyPath, keyPem);

    const certPath = path.join(tmpDir, "test-cert.pem");

    try {
      execFileSync("openssl", [
        "req",
        "-new",
        "-x509",
        "-key",
        keyPath,
        "-out",
        certPath,
        "-days",
        "1",
        "-subj",
        "/CN=httap-test-ca",
      ]);
    } catch {
      // Skip test if openssl is not available
      return;
    }

    const hash = computeSpkiHash(certPath);

    // Verify it's valid base64
    expect(hash).toMatch(/^[A-Za-z0-9+/]+=*$/);

    // SHA-256 hash in base64 should be 44 characters (32 bytes -> 44 base64 chars)
    expect(hash).toHaveLength(44);

    // Calling twice should produce the same result (deterministic)
    expect(computeSpkiHash(certPath)).toBe(hash);
  });

  it("throws for non-existent file", () => {
    expect(() => computeSpkiHash("/nonexistent/cert.pem")).toThrow();
  });

  it("throws for invalid PEM", () => {
    const badPath = path.join(tmpDir, "bad.pem");
    fs.writeFileSync(badPath, "not a certificate");
    expect(() => computeSpkiHash(badPath)).toThrow();
  });
});
