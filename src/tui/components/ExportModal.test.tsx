/** @jsxImportSource @opentui/react */

import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportModal, type ExportModalProps } from "./ExportModal.js";
import {
  destroyRenderers,
  pressEscape,
  renderTui,
  settle,
  waitForText,
  waitUntil,
} from "../test-support/render.js";

afterEach(destroyRenderers);

const props = (overrides: Partial<ExportModalProps> = {}): ExportModalProps => ({
  filename: "response.json",
  fileSize: "1.2 KB",
  isBinary: false,
  width: 100,
  height: 30,
  onExport: vi.fn(),
  onClose: vi.fn(),
  ...overrides,
});

const render = (overrides: Partial<ExportModalProps> = {}) =>
  renderTui(<ExportModal {...props(overrides)} />, { width: 100, height: 30 });

describe("ExportModal", () => {
  it("lists the five destinations with the file details", async () => {
    const setup = await render();

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Export Body Content");
    expect(frame).toContain("response.json (1.2 KB)");
    expect(frame).toContain("[1] Copy to clipboard");
    expect(frame).toContain("[2] .httap/exports/");
    expect(frame).toContain("[3] ~/Downloads/");
    expect(frame).toContain("[4] Custom path...");
    expect(frame).toContain("[5] Open externally");
  });

  it("warns that the clipboard would receive raw bytes for a binary body", async () => {
    const setup = await render({ isBinary: true });

    expect(setup.captureCharFrame()).toContain("binary — will copy raw bytes");
  });

  it("exports straight away on a number key", async () => {
    const onExport = vi.fn();
    const setup = await render({ onExport });

    setup.mockInput.pressKey("3");

    await waitUntil(setup, () => expect(onExport).toHaveBeenCalledWith("downloads"));
  });

  it("moves the cursor with j and k and exports the highlighted option", async () => {
    const onExport = vi.fn();
    const setup = await render({ onExport });

    setup.mockInput.pressKey("j");
    await waitForText(setup, "❯ [2]");
    setup.mockInput.pressKey("k");
    await waitForText(setup, "❯ [1]");

    setup.mockInput.pressEnter();
    await waitUntil(setup, () => expect(onExport).toHaveBeenCalledWith("clipboard"));
  });

  it("stops the cursor at the last option", async () => {
    const setup = await render();

    for (let press = 0; press < 8; press += 1) {
      setup.mockInput.pressKey("j");
      await settle(setup);
    }

    await waitForText(setup, "❯ [5]");
  });

  it("asks for a directory when the custom option is chosen", async () => {
    const onExport = vi.fn();
    const setup = await render({ onExport });

    setup.mockInput.pressKey("4");
    await waitForText(setup, "Enter directory path:");
    await setup.mockInput.typeText("/tmp/out");
    await waitForText(setup, "/tmp/out");
    setup.mockInput.pressEnter();

    await waitUntil(setup, () => expect(onExport).toHaveBeenCalledWith("custom", "/tmp/out"));
  });

  it("ignores an empty custom path", async () => {
    const onExport = vi.fn();
    const setup = await render({ onExport });

    setup.mockInput.pressKey("4");
    await waitForText(setup, "Enter directory path:");
    setup.mockInput.pressEnter();
    await settle(setup);

    expect(onExport).not.toHaveBeenCalled();
  });

  it("goes back to the option list on Escape from the custom prompt", async () => {
    const onClose = vi.fn();
    const setup = await render({ onClose });

    setup.mockInput.pressKey("4");
    await waitForText(setup, "Enter directory path:");
    pressEscape(setup);

    await waitForText(setup, "Select export action:");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape from the option list", async () => {
    const onClose = vi.fn();
    const setup = await render({ onClose });

    pressEscape(setup);

    await waitUntil(setup, () => expect(onClose).toHaveBeenCalled());
  });
});
