import { describe, it, expect, vi, beforeEach } from "vitest";
import { highlightCode } from "./syntax-highlight.js";

/**
 * cli-highlight respects terminal colour support detection, so ANSI output
 * is not guaranteed in test environments. We mock the library to verify
 * correct language resolution and error handling independently of colour
 * support.
 */

vi.mock("cli-highlight", () => {
  return {
    highlight: vi.fn((code: string, opts?: { language?: string }) => {
      // Return a tagged string so tests can verify it was called
      return `[highlighted:${opts?.language ?? "auto"}]${code}`;
    }),
    supportsLanguage: vi.fn((name: string) => {
      const supported = new Set(["json", "xml", "html", "javascript", "css"]);
      return supported.has(name);
    }),
  };
});

// Import the mocked module so we can inspect calls and override behaviour
const cliHighlight = await import("cli-highlight");
const highlightMock = vi.mocked(cliHighlight.highlight);

beforeEach(() => {
  highlightMock.mockClear();
  // Restore default mock implementation
  highlightMock.mockImplementation(
    (code: string, opts?: { language?: string }) =>
      `[highlighted:${opts?.language ?? "auto"}]${code}`
  );
});

describe("highlightCode", () => {
  describe("language mapping", () => {
    it("should map application/json to json language", () => {
      const result = highlightCode('{"key": "value"}', "application/json");
      expect(highlightMock).toHaveBeenCalledWith(
        '{"key": "value"}',
        expect.objectContaining({ language: "json" })
      );
      expect(result).toBe('[highlighted:json]{"key": "value"}');
    });

    it("should map text/xml to xml language", () => {
      highlightCode("<root/>", "text/xml");
      expect(highlightMock).toHaveBeenCalledWith(
        "<root/>",
        expect.objectContaining({ language: "xml" })
      );
    });

    it("should map text/html to html language", () => {
      highlightCode("<html></html>", "text/html");
      expect(highlightMock).toHaveBeenCalledWith(
        "<html></html>",
        expect.objectContaining({ language: "html" })
      );
    });

    it("should map text/css to css language", () => {
      highlightCode("body { color: red; }", "text/css");
      expect(highlightMock).toHaveBeenCalledWith(
        "body { color: red; }",
        expect.objectContaining({ language: "css" })
      );
    });

    it("should map application/javascript to javascript language", () => {
      highlightCode("const x = 1;", "application/javascript");
      expect(highlightMock).toHaveBeenCalledWith(
        "const x = 1;",
        expect.objectContaining({ language: "javascript" })
      );
    });

    it("should map application/xhtml+xml to xml language", () => {
      highlightCode("<html/>", "application/xhtml+xml");
      expect(highlightMock).toHaveBeenCalledWith(
        "<html/>",
        expect.objectContaining({ language: "xml" })
      );
    });

    it("should map application/svg+xml to xml language", () => {
      highlightCode("<svg/>", "application/svg+xml");
      expect(highlightMock).toHaveBeenCalledWith(
        "<svg/>",
        expect.objectContaining({ language: "xml" })
      );
    });

    it("should map application/rss+xml to xml language", () => {
      highlightCode("<rss/>", "application/rss+xml");
      expect(highlightMock).toHaveBeenCalledWith(
        "<rss/>",
        expect.objectContaining({ language: "xml" })
      );
    });

    it("should map application/atom+xml to xml language", () => {
      highlightCode("<feed/>", "application/atom+xml");
      expect(highlightMock).toHaveBeenCalledWith(
        "<feed/>",
        expect.objectContaining({ language: "xml" })
      );
    });

    it("should map application/x-javascript to javascript language", () => {
      highlightCode("var x;", "application/x-javascript");
      expect(highlightMock).toHaveBeenCalledWith(
        "var x;",
        expect.objectContaining({ language: "javascript" })
      );
    });

    it("should pass ignoreIllegals: true to highlight", () => {
      highlightCode('{"key": "value"}', "application/json");
      expect(highlightMock).toHaveBeenCalledWith(
        '{"key": "value"}',
        expect.objectContaining({ ignoreIllegals: true })
      );
    });
  });

  describe("content-type with parameters", () => {
    it("should handle content type with charset parameter", () => {
      highlightCode('{"key": "value"}', "application/json; charset=utf-8");
      expect(highlightMock).toHaveBeenCalledWith(
        '{"key": "value"}',
        expect.objectContaining({ language: "json" })
      );
    });

    it("should handle content type with multiple parameters", () => {
      highlightCode("<html/>", "text/html; charset=utf-8; boundary=something");
      expect(highlightMock).toHaveBeenCalledWith(
        "<html/>",
        expect.objectContaining({ language: "html" })
      );
    });
  });

  describe("unknown or missing content types", () => {
    it("should return original string for unknown content type", () => {
      const input = "some plain text";
      const result = highlightCode(input, "text/plain");
      expect(result).toBe(input);
      expect(highlightMock).not.toHaveBeenCalled();
    });

    it("should return original string for undefined content type", () => {
      const input = "some data";
      const result = highlightCode(input, undefined);
      expect(result).toBe(input);
      expect(highlightMock).not.toHaveBeenCalled();
    });

    it("should return original string for empty content type", () => {
      const input = "some data";
      const result = highlightCode(input, "");
      expect(result).toBe(input);
      expect(highlightMock).not.toHaveBeenCalled();
    });

    it("should return original string for application/octet-stream", () => {
      const input = "binary-ish stuff";
      const result = highlightCode(input, "application/octet-stream");
      expect(result).toBe(input);
      expect(highlightMock).not.toHaveBeenCalled();
    });

    it("should return original string for image content types", () => {
      const input = "image data";
      const result = highlightCode(input, "image/png");
      expect(result).toBe(input);
      expect(highlightMock).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should return empty string for empty input", () => {
      const result = highlightCode("", "application/json");
      expect(result).toBe("");
      expect(highlightMock).not.toHaveBeenCalled();
    });

    it("should gracefully handle highlight throwing an error", () => {
      highlightMock.mockImplementation(() => {
        throw new Error("highlight.js internal error");
      });

      const input = "some code";
      const result = highlightCode(input, "application/json");
      expect(result).toBe(input);
    });

    it("should handle multiline content", () => {
      const input = '{\n  "key": "value",\n  "num": 42\n}';
      const result = highlightCode(input, "application/json");
      expect(result).toContain(input);
      expect(highlightMock).toHaveBeenCalled();
    });

    it("should handle content with existing ANSI codes", () => {
      const input = `\x1b[31mred text\x1b[0m`;
      const result = highlightCode(input, "application/json");
      expect(typeof result).toBe("string");
    });

    it("should handle very long single-line content", () => {
      const longJson = JSON.stringify({ key: "a".repeat(10000) });
      const result = highlightCode(longJson, "application/json");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should not call highlight when content type has no language mapping", () => {
      highlightCode("plain text", "text/plain");
      expect(highlightMock).not.toHaveBeenCalled();
    });
  });
});
