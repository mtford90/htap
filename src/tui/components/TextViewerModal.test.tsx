/** @jsxImportSource @opentui/react */

import { afterEach, describe, expect, it } from "vitest";
import { TextViewerModal } from "./TextViewerModal.js";
import {
  destroyRenderers,
  pressEscape,
  renderWithCommands,
  waitForText,
  waitUntil,
} from "../test-support/render.js";

afterEach(destroyRenderers);

const lines = Array.from({ length: 60 }, (_, index) => `line ${index + 1}`).join("\n");

const render = (overrides: { text?: string; contentType?: string } = {}) => {
  const text = overrides.text ?? lines;
  return renderWithCommands(
    ({ store, actions }) => {
      actions.openModal({
        kind: "text",
        text,
        title: "Response Body",
        contentType: overrides.contentType ?? "text/plain",
        bodySize: 1024,
      });
      return (
        <TextViewerModal
          store={store}
          actions={actions}
          text={text}
          title="Response Body"
          contentType={overrides.contentType ?? "text/plain"}
          bodySize={1024}
          width={100}
          height={24}
        />
      );
    },
    { width: 100, height: 24 }
  );
};

describe("TextViewerModal", () => {
  it("shows the header, the line counter and numbered lines", async () => {
    const { setup } = await render();

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Response Body");
    expect(frame).toContain("text/plain");
    expect(frame).toContain("Line 1/60");
    expect(frame).toContain(" 1 │ line 1");
  });

  it("scrolls one line with j and back with k", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("j");
    await waitForText(setup, "Line 2/60");

    setup.mockInput.pressKey("k");
    await waitForText(setup, "Line 1/60");
  });

  it("jumps to the bottom with G and back with g", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("G");
    await waitForText(setup, "line 60");

    setup.mockInput.pressKey("g");
    await waitForText(setup, "Line 1/60");
  });

  it("pages down with Ctrl+f and up with Ctrl+b", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("f", { ctrl: true });
    await waitForText(setup, "Line 19/60");

    setup.mockInput.pressKey("b", { ctrl: true });
    await waitForText(setup, "Line 1/60");
  });

  it("counts search matches and centres the first one", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("/");
    await waitForText(setup, "search:");
    await setup.mockInput.typeText("line 42");
    await waitForText(setup, "search: line 42");
    setup.mockInput.pressEnter();

    await waitForText(setup, "1 match (1/1)");
    expect(setup.captureCharFrame()).toContain("42 │ line 42");
  });

  it("edits the search text with the cursor keys", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("/");
    await waitForText(setup, "search:");
    await setup.mockInput.typeText("lne 42");
    for (let press = 0; press < 5; press += 1) {
      setup.mockInput.pressArrow("left");
    }
    await setup.mockInput.typeText("i");

    await waitForText(setup, "search: line 42");
  });

  it("steps between matches with n and N", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("/");
    await waitForText(setup, "search:");
    await setup.mockInput.typeText("line 1");
    await waitForText(setup, "search: line 1");
    setup.mockInput.pressEnter();
    await waitForText(setup, "matches (1/");

    setup.mockInput.pressKey("n");
    await waitForText(setup, "(2/");

    setup.mockInput.pressKey("N");
    await waitForText(setup, "(1/");
  });

  it("abandons the search on Escape", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("/");
    await waitForText(setup, "search:");
    await setup.mockInput.typeText("line 42");

    pressEscape(setup);

    await waitForText(setup, "Line 1/60");
  });

  it("copies the whole body with y", async () => {
    const { copyToClipboard, setup } = await render();

    setup.mockInput.pressKey("y");

    await waitUntil(setup, () => expect(copyToClipboard).toHaveBeenCalledWith(lines));
    await waitForText(setup, "Copied to clipboard");
  });

  it("reports a failed copy", async () => {
    const { copyToClipboard, setup } = await render();
    copyToClipboard.mockRejectedValueOnce(new Error("no clipboard"));

    setup.mockInput.pressKey("y");

    await waitForText(setup, "Failed to copy to clipboard");
  });

  it("closes on q and on Escape", async () => {
    const { store, actions, setup } = await render();

    setup.mockInput.pressKey("q");
    await waitUntil(setup, () => expect(store.getState().ui.modal).toBeNull());

    actions.openModal({
      kind: "text",
      text: lines,
      title: "Response Body",
      contentType: "text/plain",
      bodySize: 1024,
    });
    pressEscape(setup);
    await waitUntil(setup, () => expect(store.getState().ui.modal).toBeNull());
  });

  it("renders highlighted JSON as plain text without escape codes", async () => {
    const { setup } = await render({
      text: '{\n  "ok": true\n}',
      contentType: "application/json",
    });

    const frame = setup.captureCharFrame();
    expect(frame).toContain('"ok": true');
    expect(frame).not.toContain("[3");
  });
});
