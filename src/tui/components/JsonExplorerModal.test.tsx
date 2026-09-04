/** @jsxImportSource @opentui/react */

import { afterEach, describe, expect, it } from "vitest";
import { JsonExplorerModal } from "./JsonExplorerModal.js";
import {
  destroyRenderers,
  pressEscape,
  renderWithCommands,
  settle,
  waitForText,
  waitUntil,
} from "../test-support/render.js";

afterEach(destroyRenderers);

const data = {
  name: "httap",
  counts: { requests: 3, errors: 0 },
  tags: ["proxy", "tui"],
};

const render = (overrides: { data?: unknown } = {}) => {
  const payload = overrides.data ?? data;
  const modal = {
    kind: "json" as const,
    data: payload,
    title: "Response Body",
    contentType: "application/json; charset=utf-8",
    bodySize: 128,
  };
  return renderWithCommands(
    ({ store, actions }) => {
      actions.openModal(modal);
      return (
        <JsonExplorerModal
          store={store}
          actions={actions}
          data={payload}
          title={modal.title}
          contentType={modal.contentType}
          bodySize={modal.bodySize}
          width={100}
          height={24}
        />
      );
    },
    { width: 100, height: 24 }
  );
};

describe("JsonExplorerModal", () => {
  it("shows the header with the content type and size", async () => {
    const { setup } = await render();

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Response Body");
    expect(frame).toContain("application/json");
    expect(frame).toContain("128B");
  });

  it("renders the tree with the root expanded", async () => {
    const { setup } = await render();

    const frame = setup.captureCharFrame();
    expect(frame).toContain("(root)");
    expect(frame).toContain('name: "httap"');
    expect(frame).toContain("counts:");
    expect(frame).toContain("tags:");
  });

  it("moves the cursor and updates the breadcrumb", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("j");

    await waitForText(setup, "(root) > name");
  });

  it("collapses and expands a node with Enter", async () => {
    const { setup } = await render();
    setup.mockInput.pressKey("j");
    await settle(setup);
    setup.mockInput.pressKey("j");
    await waitForText(setup, "(root) > counts");
    // Depth-1 containers open with the tree, so the first Enter closes one.
    expect(setup.captureCharFrame()).toContain("requests: 3");

    setup.mockInput.pressEnter();
    await waitForText(setup, "counts: {2 keys}");

    setup.mockInput.pressEnter();
    await waitForText(setup, "requests: 3");
  });

  it("expands everything with e and collapses with c", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("e");
    await waitForText(setup, "requests: 3");

    setup.mockInput.pressKey("c");
    await waitForText(setup, "(root): {3 keys}");
  });

  it("jumps to the last row with G and back with g", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("G");
    await waitForText(setup, "(root) > tags");

    setup.mockInput.pressKey("g");
    await waitForText(setup, "(root)");
  });

  it("filters by path and moves the cursor to the match", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("/");
    await waitForText(setup, "filter:");
    await setup.mockInput.typeText("counts.requests");

    await waitForText(setup, "requests: 3");
  });

  it("restores the previous expansion when the filter is abandoned", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("/");
    await waitForText(setup, "filter:");
    await setup.mockInput.typeText("counts.requests");
    await waitForText(setup, "requests: 3");

    pressEscape(setup);

    await waitForText(setup, "counts: {2 keys}");
  });

  it("copies the value under the cursor", async () => {
    const { copyToClipboard, setup } = await render();

    setup.mockInput.pressKey("j");
    await waitForText(setup, "(root) > name");
    setup.mockInput.pressKey("y");

    await waitUntil(setup, () => expect(copyToClipboard).toHaveBeenCalledWith("httap"));
    await waitForText(setup, "Value copied to clipboard");
  });

  it("reports a failed copy", async () => {
    const { copyToClipboard, setup } = await render();
    copyToClipboard.mockRejectedValueOnce(new Error("no clipboard"));

    setup.mockInput.pressKey("y");

    await waitForText(setup, "Failed to copy to clipboard");
  });

  it("closes on q", async () => {
    const { store, setup } = await render();

    setup.mockInput.pressKey("q");

    await waitUntil(setup, () => expect(store.getState().ui.modal).toBeNull());
  });

  it("closes on Escape", async () => {
    const { store, setup } = await render();

    pressEscape(setup);

    await waitUntil(setup, () => expect(store.getState().ui.modal).toBeNull());
  });

  it("renders a primitive root", async () => {
    const { setup } = await render({ data: "just a string" });

    expect(setup.captureCharFrame()).toContain("just a string");
  });
});
