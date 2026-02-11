import { describe, it, expect } from "vitest";
import { generateShellFunction } from "./init.js";

describe("generateShellFunction", () => {
  it("generates valid shell function syntax", () => {
    const output = generateShellFunction();

    // Should define a function named htpx
    expect(output).toContain("htpx()");

    // Should map "on" to "vars" and "off" to "vars --clear"
    expect(output).toContain('if [[ "$1" == "on" ]]');
    expect(output).toContain('elif [[ "$1" == "off" ]]');
    expect(output).toContain("command htpx vars");
    expect(output).toContain("command htpx vars --clear");

    // Should use eval and shift for on/off
    expect(output).toContain("eval");
    expect(output).toContain("shift");

    // Should pass through other commands
    expect(output).toContain('command htpx "$@"');

    // Should be properly structured
    expect(output).toContain("{");
    expect(output).toContain("}");
  });

  it("passes through all arguments", () => {
    const output = generateShellFunction();

    // Should pass all arguments to command
    expect(output).toContain('command htpx "$@"');
  });
});
