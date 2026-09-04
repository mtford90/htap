/** @jsxImportSource @opentui/react */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exportBody = vi.fn();
vi.mock("../export-body.js", () => ({ exportBody }));

const { ExportModal } = await import("./ExportModal.js");
const {
  destroyRenderers,
  fullRequest,
  pressEscape,
  renderWithCommands,
  settle,
  waitForText,
  waitUntil,
} = await import("../test-support/render.js");

afterEach(destroyRenderers);
beforeEach(() => exportBody.mockClear());

const render = (overrides: { isBinary?: boolean } = {}) =>
  renderWithCommands(
    ({ store, actions }) => {
      actions.setDetail("req-1", fullRequest());
      actions.openModal({ kind: "bodyExport", bodyType: "response" });
      return (
        <ExportModal
          store={store}
          actions={actions}
          filename="response.json"
          fileSize="1.2 KB"
          isBinary={overrides.isBinary ?? false}
          width={100}
          height={30}
        />
      );
    },
    { width: 100, height: 30 }
  );

/** The destination the command handed to the exporter. */
const lastAction = (): string | undefined => exportBody.mock.calls.at(-1)?.[0]?.action;

describe("ExportModal", () => {
  it("lists the five destinations with the file details", async () => {
    const { setup } = await render();

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
    const { setup } = await render({ isBinary: true });

    expect(setup.captureCharFrame()).toContain("binary — will copy raw bytes");
  });

  it("exports straight away on a number key", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("3");

    await waitUntil(setup, () => expect(lastAction()).toBe("downloads"));
  });

  it("moves the cursor with j and k and exports the highlighted option", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("j");
    await waitForText(setup, "❯ [2]");
    setup.mockInput.pressKey("k");
    await waitForText(setup, "❯ [1]");

    setup.mockInput.pressEnter();
    await waitUntil(setup, () => expect(lastAction()).toBe("clipboard"));
  });

  it("stops the cursor at the last option", async () => {
    const { setup } = await render();

    for (let press = 0; press < 8; press += 1) {
      setup.mockInput.pressKey("j");
      await settle(setup);
    }

    await waitForText(setup, "❯ [5]");
  });

  it("asks for a directory when the custom option is chosen", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("4");
    await waitForText(setup, "Enter directory path:");
    await setup.mockInput.typeText("/tmp/out");
    await waitForText(setup, "/tmp/out");
    setup.mockInput.pressEnter();

    await waitUntil(setup, () => {
      expect(exportBody.mock.calls.at(-1)?.[0]).toMatchObject({
        action: "custom",
        customPath: "/tmp/out",
      });
    });
  });

  it("ignores an empty custom path", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("4");
    await waitForText(setup, "Enter directory path:");
    setup.mockInput.pressEnter();
    await settle(setup);

    expect(exportBody).not.toHaveBeenCalled();
  });

  it("goes back to the option list on Escape from the custom prompt", async () => {
    const { store, setup } = await render();

    setup.mockInput.pressKey("4");
    await waitForText(setup, "Enter directory path:");
    pressEscape(setup);

    await waitForText(setup, "Select export action:");
    expect(store.getState().ui.modal).not.toBeNull();
  });

  it("closes on Escape from the option list", async () => {
    const { store, setup } = await render();

    pressEscape(setup);

    await waitUntil(setup, () => expect(store.getState().ui.modal).toBeNull());
  });
});
