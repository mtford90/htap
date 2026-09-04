/** @jsxImportSource @opentui/react */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exportFormatToClipboard = vi.fn(async () => ({ success: true, message: "Copied cURL" }));
const exportHarToDir = vi.fn(() => ({ success: true, message: "Exported HAR" }));
const resolveTargetDir = vi.fn((location: string, custom?: string) => custom ?? `/tmp/${location}`);
const generateFilename = vi.fn(() => "body.json");
const saveBodyContent = vi.fn(async () => ({ success: true, message: "Saved" }));

vi.mock("../hooks/useExport.js", () => ({ exportFormatToClipboard, exportHarToDir }));
vi.mock("../hooks/useBodyExport.js", () => ({
  resolveTargetDir,
  generateFilename,
  saveBodyContent,
}));

const { FormatExportModal } = await import("./FormatExportModal.js");
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
beforeEach(() => {
  exportFormatToClipboard.mockClear();
  exportHarToDir.mockClear();
  resolveTargetDir.mockClear();
});

const render = () =>
  renderWithCommands(
    ({ store, actions }) => {
      actions.setDetail("req-1", fullRequest());
      actions.openModal({ kind: "formatExport" });
      return (
        <FormatExportModal
          store={store}
          actions={actions}
          request={fullRequest()}
          width={110}
          height={30}
        />
      );
    },
    { width: 110, height: 30 }
  );

describe("FormatExportModal", () => {
  it("lists the five formats and the request being exported", async () => {
    const { setup } = await render();

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Export Request");
    expect(frame).toContain("GET http://example.test/api/items (200)");
    expect(frame).toContain("[1] cURL");
    expect(frame).toContain("[5] HAR");
  });

  it("copies a clipboard format on a number key", async () => {
    const { store, setup } = await render();

    setup.mockInput.pressKey("2");

    await waitUntil(setup, () =>
      expect(exportFormatToClipboard).toHaveBeenCalledWith(expect.anything(), "fetch")
    );
    await waitUntil(setup, () => expect(store.getState().ui.modal).toBeNull());
  });

  it("moves to the destination picker for HAR", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("5");

    await waitForText(setup, "Export as HAR");
    expect(setup.captureCharFrame()).toContain("[1] .httap/exports/");
  });

  it("writes the HAR to the chosen directory", async () => {
    const { store, setup } = await render();

    setup.mockInput.pressKey("5");
    await waitForText(setup, "Select destination:");
    setup.mockInput.pressKey("2");

    await waitUntil(setup, () =>
      expect(resolveTargetDir).toHaveBeenCalledWith("downloads", undefined)
    );
    expect(exportHarToDir).toHaveBeenCalledWith([expect.anything()], "/tmp/downloads");
    expect(store.getState().ui.statusMessage).toBe("Exported HAR");
  });

  it("accepts a custom directory for the HAR", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("5");
    await waitForText(setup, "Select destination:");
    setup.mockInput.pressKey("3");
    await waitForText(setup, "Enter directory path:");
    await setup.mockInput.typeText("/tmp/har");
    await waitForText(setup, "/tmp/har");
    setup.mockInput.pressEnter();

    await waitUntil(setup, () =>
      expect(exportHarToDir).toHaveBeenCalledWith([expect.anything()], "/tmp/har")
    );
  });

  it("reports a failed HAR export instead of throwing", async () => {
    resolveTargetDir.mockImplementationOnce(() => {
      throw new Error("permission denied");
    });
    const { store, setup } = await render();

    setup.mockInput.pressKey("5");
    await waitForText(setup, "Select destination:");
    setup.mockInput.pressKey("1");

    await waitUntil(setup, () =>
      expect(store.getState().ui.statusMessage).toBe("Error: permission denied")
    );
  });

  it("goes back to the format list on Escape from the destinations", async () => {
    const { store, setup } = await render();

    setup.mockInput.pressKey("5");
    await waitForText(setup, "Select destination:");
    pressEscape(setup);

    await waitForText(setup, "Select export format:");
    expect(store.getState().ui.modal).not.toBeNull();
  });

  it("closes on Escape from the format list", async () => {
    const { store, setup } = await render();

    pressEscape(setup);

    await waitUntil(setup, () => expect(store.getState().ui.modal).toBeNull());
  });

  it("selects with j, k and Enter", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("j");
    await waitForText(setup, "❯ [2]");
    setup.mockInput.pressKey("j");
    await waitForText(setup, "❯ [3]");
    setup.mockInput.pressEnter();

    await waitUntil(setup, () =>
      expect(exportFormatToClipboard).toHaveBeenCalledWith(expect.anything(), "python")
    );
  });

  it("stops the cursor at the last format", async () => {
    const { setup } = await render();

    for (let press = 0; press < 8; press += 1) {
      setup.mockInput.pressKey("j");
      await settle(setup);
    }

    await waitForText(setup, "❯ [5]");
  });
});
