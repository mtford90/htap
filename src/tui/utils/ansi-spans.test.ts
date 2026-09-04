import { describe, expect, it } from "vitest";
import { highlightCode } from "./syntax-highlight.js";
import { parseAnsi, parseAnsiLines, stripAnsi } from "./ansi-spans.js";

const ESC = "";

describe("parseAnsi", () => {
  it("returns one plain segment for text with no escapes", () => {
    expect(parseAnsi("hello")).toEqual([{ text: "hello" }]);
  });

  it("returns nothing for an empty string", () => {
    expect(parseAnsi("")).toEqual([]);
  });

  it("splits a coloured run from its surroundings", () => {
    const segments = parseAnsi(`plain ${ESC}[31mred${ESC}[39m tail`);

    expect(segments).toEqual([
      { text: "plain " },
      { text: "red", fg: "#cd3131" },
      { text: " tail" },
    ]);
  });

  it("reads bold, dim, italic and underline", () => {
    const segments = parseAnsi(
      `${ESC}[1mb${ESC}[0m${ESC}[2md${ESC}[0m${ESC}[3mi${ESC}[0m${ESC}[4mu`
    );

    expect(segments).toEqual([
      { text: "b", bold: true },
      { text: "d", dim: true },
      { text: "i", italic: true },
      { text: "u", underline: true },
    ]);
  });

  it("resets every attribute on code 0", () => {
    const segments = parseAnsi(`${ESC}[1;31mstyled${ESC}[0mplain`);

    expect(segments[0]).toEqual({ text: "styled", bold: true, fg: "#cd3131" });
    expect(segments[1]).toEqual({ text: "plain" });
  });

  it("treats a bare escape as a reset", () => {
    const segments = parseAnsi(`${ESC}[31mred${ESC}[mplain`);

    expect(segments[1]).toEqual({ text: "plain" });
  });

  it("reads 24-bit colour", () => {
    expect(parseAnsi(`${ESC}[38;2;255;128;0mo`)).toEqual([{ text: "o", fg: "#ff8000" }]);
  });

  it("reads 256-colour indices", () => {
    expect(parseAnsi(`${ESC}[38;5;231mw`)[0]?.fg).toBe("#ffffff");
    expect(parseAnsi(`${ESC}[38;5;196mr`)[0]?.fg).toBe("#ff0000");
    expect(parseAnsi(`${ESC}[38;5;244mg`)[0]?.fg).toBe("#808080");
  });

  it("keeps bright colours distinct from their base colours", () => {
    expect(parseAnsi(`${ESC}[91mx`)[0]?.fg).toBe("#f14c4c");
    expect(parseAnsi(`${ESC}[31mx`)[0]?.fg).toBe("#cd3131");
  });

  it("drops only the colour on code 39", () => {
    const segments = parseAnsi(`${ESC}[1;31ma${ESC}[39mb`);

    expect(segments[1]).toEqual({ text: "b", bold: true });
  });

  it("ignores escape codes it does not model", () => {
    expect(parseAnsi(`${ESC}[7mx`)).toEqual([{ text: "x" }]);
  });
});

describe("parseAnsiLines", () => {
  it("splits on newlines and carries the style across the break", () => {
    const lines = parseAnsiLines(`${ESC}[31mone\ntwo${ESC}[0m`);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual([{ text: "one", fg: "#cd3131" }]);
    expect(lines[1]).toEqual([{ text: "two", fg: "#cd3131" }]);
  });

  it("keeps blank lines as empty rows", () => {
    expect(parseAnsiLines("a\n\nb")).toEqual([[{ text: "a" }], [], [{ text: "b" }]]);
  });

  it("returns one empty row for empty input", () => {
    expect(parseAnsiLines("")).toEqual([[]]);
  });
});

describe("stripAnsi", () => {
  it("removes escapes and keeps the text", () => {
    expect(stripAnsi(`${ESC}[31mred${ESC}[39m`)).toBe("red");
  });

  it("leaves text containing bracket sequences alone", () => {
    expect(stripAnsi("array[0m1]")).toBe("array[0m1]");
  });
});

describe("cli-highlight output", () => {
  /** What cli-highlight emits for `{"a":1}` when the stream supports colour. */
  const HIGHLIGHTED_JSON = `{${ESC}[36m"a"${ESC}[39m:${ESC}[32m1${ESC}[39m}`;

  it("converts a highlighted line into coloured segments", () => {
    expect(parseAnsi(HIGHLIGHTED_JSON)).toEqual([
      { text: "{" },
      { text: '"a"', fg: "#11a8cd" },
      { text: ":" },
      { text: "1", fg: "#0dbc79" },
      { text: "}" },
    ]);
  });

  it("keeps the highlighted text identical to the source", () => {
    expect(stripAnsi(HIGHLIGHTED_JSON)).toBe('{"a":1}');
  });

  it("round-trips real highlighter output for a multi-line body", () => {
    const source = '{\n  "name": "httap",\n  "count": 3\n}';

    const highlighted = highlightCode(source, "application/json");

    expect(stripAnsi(highlighted)).toBe(source);
    expect(
      parseAnsiLines(highlighted)
        .map((line) => line.map((part) => part.text).join(""))
        .join("\n")
    ).toBe(source);
  });

  it("leaves an unknown content type untouched", () => {
    expect(highlightCode("plain body", "text/plain")).toBe("plain body");
  });
});
