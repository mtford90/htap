import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { generateFilename, saveBinaryContent } from "../../../src/cli/tui/hooks/useSaveBinary.js";

// Mock clipboard - it uses child_process which is hard to test
vi.mock("../../../src/cli/tui/utils/clipboard.js", () => ({
  copyToClipboard: vi.fn().mockResolvedValue(undefined),
}));

// Mock project root finding
vi.mock("../../../src/shared/project.js", () => ({
  findOrCreateProjectRoot: vi.fn().mockReturnValue("/mock/project"),
  ensureHtpxDir: vi.fn().mockReturnValue("/mock/project/.htpx"),
}));

describe("generateFilename", () => {
  it("should extract extension from URL", () => {
    const filename = generateFilename("abc123", "image/png", "https://example.com/image.jpg");
    expect(filename).toMatch(/^abc123-\d+\.jpg$/);
  });

  it("should use content-type when URL has no extension", () => {
    const filename = generateFilename("abc123", "image/png", "https://example.com/image");
    expect(filename).toMatch(/^abc123-\d+\.png$/);
  });

  it("should use .bin for unknown types", () => {
    const filename = generateFilename("abc123", undefined, "https://example.com/data");
    expect(filename).toMatch(/^abc123-\d+\.bin$/);
  });

  it("should handle various content types", () => {
    expect(generateFilename("id", "image/jpeg", "https://x.com/f")).toMatch(/\.jpg$/);
    expect(generateFilename("id", "image/gif", "https://x.com/f")).toMatch(/\.gif$/);
    expect(generateFilename("id", "application/pdf", "https://x.com/f")).toMatch(/\.pdf$/);
    expect(generateFilename("id", "application/zip", "https://x.com/f")).toMatch(/\.zip$/);
    expect(generateFilename("id", "video/mp4", "https://x.com/f")).toMatch(/\.mp4$/);
    expect(generateFilename("id", "audio/mpeg", "https://x.com/f")).toMatch(/\.mp3$/);
  });

  it("should include short request ID and timestamp", () => {
    const filename = generateFilename(
      "abc12345-6789-0000-1111-222233334444",
      "image/png",
      "https://example.com/img"
    );
    // Should use first 8 chars of ID
    expect(filename).toMatch(/^abc12345-\d+\.png$/);
  });

  it("should handle invalid URLs gracefully", () => {
    // Invalid URL should fall through to content-type detection
    const filename = generateFilename("abc123", "image/png", "not-a-valid-url");
    expect(filename).toMatch(/^abc123-\d+\.png$/);
  });

  it("should use .bin for invalid URL with no content-type", () => {
    const filename = generateFilename("abc123", undefined, ":::invalid:::");
    expect(filename).toMatch(/^abc123-\d+\.bin$/);
  });
});

describe("saveBinaryContent", () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a real temp directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "htpx-test-"));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it("should save file to custom path", async () => {
    const body = Buffer.from("test binary content");
    const filename = "test-file.bin";

    const result = await saveBinaryContent(body, filename, "custom", tempDir);

    expect(result.success).toBe(true);
    expect(result.filePath).toBe(path.join(tempDir, filename));

    // Verify file was written
    const content = fs.readFileSync(path.join(tempDir, filename));
    expect(content.toString()).toBe("test binary content");
  });

  it("should create directory if it does not exist", async () => {
    const body = Buffer.from("test content");
    const filename = "test.bin";
    const nestedDir = path.join(tempDir, "nested", "path");

    const result = await saveBinaryContent(body, filename, "custom", nestedDir);

    expect(result.success).toBe(true);
    expect(fs.existsSync(nestedDir)).toBe(true);
    expect(fs.existsSync(path.join(nestedDir, filename))).toBe(true);
  });

  it("should expand ~ in custom path", async () => {
    // We can't easily test this without mocking os.homedir
    // Just verify the function handles ~ paths without error
    const body = Buffer.from("test");
    const filename = "test.bin";

    // This will fail to save but shouldn't throw
    const result = await saveBinaryContent(body, filename, "custom", "~/nonexistent-htpx-test-dir");

    // Should succeed (creates directory)
    expect(result.success).toBe(true);

    // Clean up the created directory
    const homeDir = os.homedir();
    const createdDir = path.join(homeDir, "nonexistent-htpx-test-dir");
    if (fs.existsSync(createdDir)) {
      fs.rmSync(createdDir, { recursive: true });
    }
  });

  it("should return error for invalid custom path", async () => {
    const body = Buffer.from("test");
    const filename = "test.bin";

    const result = await saveBinaryContent(body, filename, "custom", undefined);

    expect(result.success).toBe(false);
    expect(result.message).toBe("Custom path required");
  });

  it("should include path copied message on success", async () => {
    const body = Buffer.from("test");
    const filename = "test.bin";

    const result = await saveBinaryContent(body, filename, "custom", tempDir);

    expect(result.success).toBe(true);
    expect(result.message).toContain("path copied");
  });
});
