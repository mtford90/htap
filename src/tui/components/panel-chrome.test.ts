import { describe, expect, it } from "vitest";
import {
  buildBottomBorder,
  buildDivider,
  buildDividerLine,
  buildModalHeader,
  buildTitleLine,
} from "./panel-chrome.js";

describe("buildTitleLine", () => {
  it("fills the width with the title and the right value", () => {
    const segments = buildTitleLine("[1] Requests", 40, 7);

    expect(segments.before).toHaveLength(40);
    expect(segments.before.startsWith("┌─ [1] Requests ")).toBe(true);
    expect(segments.before.endsWith(" 7 ─┐")).toBe(true);
    expect(segments.center).toBe("");
  });

  it("splits the dashes around a centred badge", () => {
    const segments = buildTitleLine("[1] Requests", 60, 7, "Following");

    expect(segments.center).toBe(" Following ");
    expect(segments.before.length + segments.center.length + segments.after.length).toBe(60);
    expect(segments.after.endsWith(" 7 ─┐")).toBe(true);
  });

  it("drops the badge when there is no room for it", () => {
    const segments = buildTitleLine("[1] Requests", 24, 7, "Following");

    expect(segments.center).toBe("");
    expect(segments.after).toBe("");
  });

  it("omits the right value when there is none", () => {
    expect(buildTitleLine("Title", 20).before).toBe("┌─ Title ──────────┐");
  });

  it("keeps at least one dash on a very narrow panel", () => {
    expect(buildTitleLine("Title", 4).before).toBe("┌─ Title ─┐");
  });
});

describe("buildDividerLine", () => {
  it("uses the top corners for the first section", () => {
    const line = buildDividerLine("[2] Request", true, false, 40, true);

    expect(line.startsWith("┌")).toBe(true);
    expect(line.endsWith("┐")).toBe(true);
    expect(line).toHaveLength(40);
  });

  it("uses the tee corners for later sections", () => {
    const line = buildDividerLine("[3] Body", true, false, 40, false);

    expect(line.startsWith("├")).toBe(true);
    expect(line.endsWith("┤")).toBe(true);
  });

  it("shows the collapsed indicator and the focus marker", () => {
    expect(buildDividerLine("[3] Body", false, true, 40, false)).toContain("» ▶ [3] Body");
    expect(buildDividerLine("[3] Body", true, false, 40, false)).toContain("  ▼ [3] Body");
  });

  it("right-aligns an accessory value", () => {
    expect(buildDividerLine("[4] Response", true, false, 40, false, "200 OK")).toContain(
      " 200 OK ─┤"
    );
  });
});

describe("borders", () => {
  it("builds a bottom border of the given width", () => {
    expect(buildBottomBorder(6)).toBe("└────┘");
  });

  it("builds a divider of the given width", () => {
    expect(buildDivider(6)).toBe("├────┤");
  });

  it("builds a modal header with a right-aligned value", () => {
    const header = buildModalHeader("Response Body", 40, " json 1.2 KB ");

    expect(header).toHaveLength(40);
    expect(header).toContain(" Response Body ");
    expect(header.endsWith(" json 1.2 KB ─┐")).toBe(true);
  });
});
