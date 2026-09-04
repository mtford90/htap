/** @jsxImportSource @opentui/react */

import { afterEach, describe, expect, it } from "vitest";
import { InterceptorLogModal } from "./InterceptorLogModal.js";
import { eventLines, passesFilter } from "./event-log-rows.js";
import {
  destroyRenderers,
  event,
  pressEscape,
  renderWithCommands,
  settle,
  waitForText,
  waitUntil,
} from "../test-support/render.js";

afterEach(destroyRenderers);

const infoEvent = event({
  seq: 1,
  level: "info",
  interceptor: "logger",
  message: "first message",
});
const warnEvent = event({
  seq: 2,
  level: "warn",
  interceptor: "auth",
  message: "second message",
});
const errorEvent = event({
  seq: 3,
  level: "error",
  interceptor: "auth",
  message: "third message",
  error: "Error: boom\n    at handler",
});
const events = [infoEvent, warnEvent, errorEvent];

const render = (overrides: { events?: typeof events } = {}) =>
  renderWithCommands(
    ({ store, actions }) => {
      actions.openModal({ kind: "interceptorLog" });
      return (
        <InterceptorLogModal
          store={store}
          actions={actions}
          events={overrides.events ?? events}
          width={120}
          height={24}
        />
      );
    },
    { width: 120, height: 24 }
  );

describe("passesFilter", () => {
  it("keeps everything when nothing is set", () => {
    expect(passesFilter(infoEvent, {})).toBe(true);
  });

  it("keeps only errors at the error level", () => {
    expect(passesFilter(errorEvent, { level: "error" })).toBe(true);
    expect(passesFilter(warnEvent, { level: "error" })).toBe(false);
  });

  it("keeps warnings and errors at the warn level", () => {
    expect(passesFilter(warnEvent, { level: "warn" })).toBe(true);
    expect(passesFilter(errorEvent, { level: "warn" })).toBe(true);
    expect(passesFilter(infoEvent, { level: "warn" })).toBe(false);
  });

  it("matches the interceptor name exactly", () => {
    expect(passesFilter(warnEvent, { interceptor: "auth" })).toBe(true);
    expect(passesFilter(infoEvent, { interceptor: "auth" })).toBe(false);
  });

  it("matches the message case-insensitively", () => {
    expect(passesFilter(infoEvent, { search: "FIRST" })).toBe(true);
    expect(passesFilter(infoEvent, { search: "missing" })).toBe(false);
  });
});

describe("eventLines", () => {
  it("prefixes the time, level and interceptor", () => {
    const { main } = eventLines(infoEvent, 120);

    expect(main).toMatch(/^\[\d{2}:\d{2}:\d{2}] \[INFO ] \[logger] first message$/);
  });

  it("clips a message that will not fit", () => {
    const { main } = eventLines(event({ message: "x".repeat(200) }), 60);

    expect(main).toHaveLength(60);
    expect(main.endsWith("…")).toBe(true);
  });

  it("indents each error detail line", () => {
    const { details } = eventLines(errorEvent, 120);

    expect(details).toEqual(["    Error: boom", "        at handler"]);
  });

  it("returns no details for an event without an error", () => {
    expect(eventLines(infoEvent, 120).details).toEqual([]);
  });
});

describe("InterceptorLogModal", () => {
  it("shows the newest event first with the row count", async () => {
    const { setup } = await render();

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Interceptor Log");
    expect(frame).toContain("3 events");
    const lines = frame.split("\n").filter((line) => line.includes("message"));
    expect(lines[0]).toContain("third message");
    expect(lines[2]).toContain("first message");
  });

  it("shows the error detail lines under their event", async () => {
    const { setup } = await render();

    expect(setup.captureCharFrame()).toContain("Error: boom");
  });

  it("waits for events when there are none", async () => {
    const { setup } = await render({ events: [] });

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Waiting for interceptor events...");
    expect(frame).toContain("0 events");
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

  it("scrolls with j and k", async () => {
    const many = Array.from({ length: 60 }, (_, index) =>
      event({ seq: index + 1, message: `line ${index + 1}` })
    );
    const { setup } = await render({ events: many });

    setup.mockInput.pressKey("j");
    await waitForText(setup, "Showing 2–");

    setup.mockInput.pressKey("k");
    await waitForText(setup, "Showing 1–");
  });

  it("jumps to the end with G and back with g", async () => {
    const many = Array.from({ length: 60 }, (_, index) =>
      event({ seq: index + 1, message: `line ${index + 1}` })
    );
    const { setup } = await render({ events: many });

    setup.mockInput.pressKey("G");
    await waitForText(setup, "line 1 ");

    setup.mockInput.pressKey("g");
    await waitForText(setup, "line 60");
  });

  it("filters by level through the filter bar", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("/");
    await waitForText(setup, "level:ALL");

    setup.mockInput.pressTab();
    await settle(setup);
    setup.mockInput.pressArrow("right");

    await waitForText(setup, "1 event");
    expect(setup.captureCharFrame()).not.toContain("first message");
  });

  it("reverts the filter on Escape", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("/");
    await waitForText(setup, "level:ALL");
    setup.mockInput.pressTab();
    await settle(setup);
    setup.mockInput.pressArrow("right");
    await waitForText(setup, "1 event");

    pressEscape(setup);

    await waitForText(setup, "3 events");
  });

  it("says when a filter matches nothing", async () => {
    const { setup } = await render();

    setup.mockInput.pressKey("/");
    await waitForText(setup, "level:ALL");
    await setup.mockInput.typeText("nothing-matches");

    await waitForText(setup, "No matching events");
  });
});
