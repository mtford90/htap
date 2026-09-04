/** @jsxImportSource @opentui/react */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const copyToClipboard = vi.fn(async () => undefined);
const openInExternalApp = vi.fn(async () => ({ success: true, message: "Opened" }));
const saveBodyContent = vi.fn(async () => ({ success: true, message: "Saved to /tmp/body.json" }));

vi.mock("./utils/clipboard.js", () => ({ copyToClipboard }));
vi.mock("./utils/open-external.js", () => ({ openInExternalApp }));
vi.mock("./hooks/useBodyExport.js", async () => {
  const actual = await vi.importActual<typeof import("./hooks/useBodyExport.js")>(
    "./hooks/useBodyExport.js"
  );
  return { ...actual, saveBodyContent };
});

const { App } = await import("./App.js");
const {
  createHarness,
  destroyRenderers,
  fullRequest,
  pressEscape,
  renderTui,
  settle,
  summary,
  waitForText,
  waitForNoText,
  waitUntil,
} = await import("./test-support/render.js");

afterEach(destroyRenderers);
beforeEach(() => {
  copyToClipboard.mockClear();
  openInExternalApp.mockClear();
  saveBodyContent.mockClear();
});

const WIDTH = 140;
const HEIGHT = 30;

interface AppOptions {
  requests?: ReturnType<typeof summary>[];
  detail?: ReturnType<typeof fullRequest> | null;
  onExit?: () => void;
}

const renderApp = async ({ requests = [summary("a")], detail, onExit }: AppOptions = {}) => {
  // The engine reloads the detail for whatever the cursor lands on, so the fake
  // control client has to answer with the same request.
  const harness = createHarness({ getRequest: vi.fn(async () => detail ?? null) });
  harness.actions.setRequests(requests);

  const setup = await renderTui(
    <App
      store={harness.store}
      actions={harness.actions}
      engine={harness.engine}
      onExit={onExit ?? vi.fn()}
    />,
    { width: WIDTH, height: HEIGHT }
  );
  await settle(setup);
  return { ...harness, setup };
};

describe("App layout", () => {
  it("renders the list, the info bar and the status bar", async () => {
    const { setup } = await renderApp({ requests: [summary("alpha"), summary("beta")] });

    const frame = setup.captureCharFrame();
    expect(frame).toContain("[1] Requests");
    expect(frame).toContain("/alpha");
    expect(frame).toContain("2 requests captured");
    expect(frame).toContain("j/k nav");
  });

  it("gives the list the full width until a request is loaded", async () => {
    const { setup } = await renderApp();

    expect(setup.captureCharFrame()).not.toContain("[2] Request");
  });

  it("splits the screen once the detail arrives", async () => {
    const { setup } = await renderApp({ detail: fullRequest({ id: "a" }) });

    const frame = setup.captureCharFrame();
    expect(frame).toContain("[1] Requests");
    expect(frame).toContain("[2] Request");
  });

  it("refuses to draw in a terminal that is too small", async () => {
    const harness = createHarness();
    const setup = await renderTui(
      <App
        store={harness.store}
        actions={harness.actions}
        engine={harness.engine}
        onExit={vi.fn()}
      />,
      { width: 40, height: 8 }
    );

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Terminal too small");
    expect(frame).toContain("Current: 40x8");
    expect(frame).toContain("Required: 60x10");
  });

  it("reacts to a terminal resize", async () => {
    const { setup } = await renderApp({ requests: [summary("alpha")] });
    expect(setup.captureCharFrame()).toContain("[1] Requests");

    setup.resize(40, 8);
    await waitForText(setup, "Terminal too small");

    setup.resize(WIDTH, HEIGHT);
    await waitForText(setup, "[1] Requests");
  });

  it("shows a spinner before the first sync completes", async () => {
    const harness = createHarness();
    const setup = await renderTui(
      <App
        store={harness.store}
        actions={harness.actions}
        engine={harness.engine}
        onExit={vi.fn()}
      />,
      { width: WIDTH, height: HEIGHT }
    );

    expect(setup.captureCharFrame()).toContain("Loading...");
  });

  it("shows a connection error with a retry hint", async () => {
    const harness = createHarness();
    harness.actions.setError("Daemon not running.");
    const setup = await renderTui(
      <App
        store={harness.store}
        actions={harness.actions}
        engine={harness.engine}
        onExit={vi.fn()}
      />,
      { width: WIDTH, height: HEIGHT }
    );

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Error: Daemon not running.");
    expect(frame).toContain("Press 'q' to quit, 'r' to retry");
  });
});

describe("App keyboard", () => {
  it("moves the cursor and loads the detail for the new row", async () => {
    const getRequest = vi.fn(async (id: string) => fullRequest({ id, path: `/${id}` }));
    const harness = createHarness({ getRequest });
    harness.actions.setRequests([summary("first"), summary("second")]);
    const setup = await renderTui(
      <App
        store={harness.store}
        actions={harness.actions}
        engine={harness.engine}
        onExit={vi.fn()}
      />,
      { width: WIDTH, height: HEIGHT }
    );

    setup.mockInput.pressKey("j");

    await waitUntil(setup, () =>
      expect(harness.store.getState().selection.selectedId).toBe("second")
    );
    await waitForText(setup, "[2] Request");
  });

  it("quits on q", async () => {
    const onExit = vi.fn();
    const { setup } = await renderApp({ onExit });

    setup.mockInput.pressKey("q");

    await waitUntil(setup, () => expect(onExit).toHaveBeenCalled());
  });

  it("exits on ctrl+c", async () => {
    const onExit = vi.fn();
    const { setup } = await renderApp({ onExit });

    setup.mockInput.pressKey("c", { ctrl: true });

    await waitUntil(setup, () => expect(onExit).toHaveBeenCalled());
  });

  it("exits on ctrl+c while a modal is open", async () => {
    const onExit = vi.fn();
    const { setup } = await renderApp({ onExit });
    setup.mockInput.pressKey("?");
    await waitForText(setup, "Toggle follow mode");

    setup.mockInput.pressKey("c", { ctrl: true });

    await waitUntil(setup, () => expect(onExit).toHaveBeenCalled());
  });

  it("opens and closes the help modal", async () => {
    const { setup } = await renderApp();

    setup.mockInput.pressKey("?");
    await waitForText(setup, "Toggle follow mode");

    setup.mockInput.pressKey("?");
    await waitForText(setup, "[1] Requests");
  });

  it("keeps the list position across the help modal", async () => {
    const requests = Array.from({ length: 100 }, (_, index) => summary(`r${index}`));
    const { setup, store } = await renderApp({ requests });
    setup.mockInput.pressKey("G");
    await waitForText(setup, "76-100/100");

    setup.mockInput.pressKey("?");
    await waitForText(setup, "Toggle follow mode");
    setup.mockInput.pressKey("?");
    await waitForText(setup, "[1] Requests");

    const frame = setup.captureCharFrame();
    expect(frame).toContain("76-100/100");
    expect(frame).toContain("/r99");
    expect(store.getState().scrollers.list?.scrollTop).toBe(75);
  });

  it("keeps the list position across the interceptor log", async () => {
    const requests = Array.from({ length: 100 }, (_, index) => summary(`r${index}`));
    const { setup, store } = await renderApp({ requests });
    setup.mockInput.pressKey("G");
    await waitForText(setup, "76-100/100");

    setup.mockInput.pressKey("L");
    await waitForText(setup, "Interceptor Log");
    setup.mockInput.pressKey("q");
    await waitForText(setup, "[1] Requests");

    const frame = setup.captureCharFrame();
    expect(frame).toContain("76-100/100");
    expect(frame).toContain("/r99");
    expect(store.getState().scrollers.list?.scrollTop).toBe(75);
  });

  it("opens the interceptor log with L", async () => {
    const { setup } = await renderApp();

    setup.mockInput.pressKey("L");

    await waitForText(setup, "Interceptor Log");
  });

  it("opens the filter bar with / and closes it with Escape", async () => {
    const { setup } = await renderApp();

    setup.mockInput.pressKey("/");
    await waitForText(setup, "method:ALL");
    expect(setup.captureCharFrame()).toContain("Esc close filter");

    pressEscape(setup);
    await waitForNoText(setup, "method:ALL");
  });

  it("reports the URL mode in the status bar", async () => {
    const { setup } = await renderApp();

    setup.mockInput.pressKey("u");

    await waitForText(setup, "Showing full URL");
  });

  it("asks before clearing and cancels on any other key", async () => {
    const { setup, client } = await renderApp();

    setup.mockInput.pressKey("x");
    await waitForText(setup, "Clear all requests?");

    setup.mockInput.pressKey("n");
    await waitForNoText(setup, "Clear all requests?");
    expect(client.clearRequests).not.toHaveBeenCalled();
  });

  it("clears on confirmation", async () => {
    const { setup, client } = await renderApp();

    setup.mockInput.pressKey("x");
    await waitForText(setup, "Clear all requests?");
    setup.mockInput.pressKey("y");

    await waitUntil(setup, () => expect(client.clearRequests).toHaveBeenCalled());
  });

  it("moves between the list and the detail sections with Tab", async () => {
    const { setup, store } = await renderApp({ detail: fullRequest({ id: "a" }) });

    setup.mockInput.pressKey("\t");
    await waitUntil(setup, () => expect(store.getState().selection.activePanel).toBe("detail"));
  });
});

describe("App body actions", () => {
  const jsonRequest = fullRequest({
    id: "a",
    responseHeaders: { "content-type": "application/json" },
    responseBody: Buffer.from('{"ok":true}'),
  });

  const focusResponseBody = async (
    result: Awaited<ReturnType<typeof renderApp>>
  ): Promise<void> => {
    result.setup.mockInput.pressKey("5");
    await waitUntil(result.setup, () =>
      expect(result.store.getState().selection.focusedSection).toBe(3)
    );
  };

  it("opens the JSON explorer with Enter", async () => {
    const result = await renderApp({ detail: jsonRequest });
    await focusResponseBody(result);

    result.setup.mockInput.pressEnter();

    await waitForText(result.setup, "Enter/l toggle");
  });

  it("copies the focused body with y", async () => {
    const result = await renderApp({ detail: jsonRequest });
    await focusResponseBody(result);

    result.setup.mockInput.pressKey("y");

    await waitUntil(result.setup, () =>
      expect(copyToClipboard).toHaveBeenCalledWith('{"ok":true}')
    );
    await waitForText(result.setup, "Body copied to clipboard");
  });

  it("opens the body export modal with s and saves to a folder", async () => {
    const result = await renderApp({ detail: jsonRequest });
    await focusResponseBody(result);

    result.setup.mockInput.pressKey("s");
    await waitForText(result.setup, "Export Body Content");
    result.setup.mockInput.pressKey("2");

    await waitUntil(result.setup, () =>
      expect(saveBodyContent).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("a-"),
        "exports",
        undefined
      )
    );
    await waitForText(result.setup, "Saved to /tmp/body.json");
  });

  it("opens the body externally", async () => {
    const result = await renderApp({ detail: jsonRequest });
    await focusResponseBody(result);

    result.setup.mockInput.pressKey("s");
    await waitForText(result.setup, "Export Body Content");
    result.setup.mockInput.pressKey("5");

    await waitUntil(result.setup, () => expect(openInExternalApp).toHaveBeenCalled());
    await waitForText(result.setup, "Opened");
  });

  it("refuses to copy a binary body to the clipboard", async () => {
    const result = await renderApp({
      detail: fullRequest({
        id: "a",
        responseHeaders: { "content-type": "image/png" },
        responseBody: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]),
      }),
    });
    await focusResponseBody(result);

    result.setup.mockInput.pressKey("s");
    await waitForText(result.setup, "Export Body Content");
    result.setup.mockInput.pressKey("1");

    await waitForText(result.setup, "Cannot copy binary content to clipboard");
    expect(copyToClipboard).not.toHaveBeenCalled();
  });

  it("opens the request export modal with e", async () => {
    const result = await renderApp({ detail: jsonRequest });

    result.setup.mockInput.pressKey("e");

    await waitForText(result.setup, "Export Request");
  });
});

describe("App stale detail", () => {
  it("shows the response section once the delta reports it", async () => {
    const pending = fullRequest({ id: "a", responseStatus: undefined, responseHeaders: undefined });
    const completed = fullRequest({
      id: "a",
      responseStatus: 200,
      responseHeaders: { "content-type": "application/json" },
    });
    const responses = [pending, completed];
    const getRequest = vi.fn(async () => responses.shift() ?? completed);
    const deltas = [
      {
        entries: [
          { summary: summary("a", { responseStatus: undefined }), orderSeq: 1, changeSeq: 1 },
        ],
        cursor: 1,
        hasMore: false,
      },
      {
        entries: [{ summary: summary("a"), orderSeq: 2, changeSeq: 2 }],
        cursor: 2,
        hasMore: false,
      },
      { entries: [], cursor: 2, hasMore: false },
    ];
    const listRequestsSummaryDelta = vi.fn(
      async () => deltas.shift() ?? { entries: [], cursor: 2, hasMore: false }
    );

    const harness = createHarness({ getRequest, listRequestsSummaryDelta });
    const setup = await renderTui(
      <App
        store={harness.store}
        actions={harness.actions}
        engine={harness.engine}
        onExit={vi.fn()}
      />,
      { width: WIDTH, height: HEIGHT }
    );

    await harness.engine.syncRequests();
    await waitForText(setup, "(pending response)");

    await harness.engine.syncRequests();

    await waitForText(setup, "200 OK");
  });
});

describe("App mouse", () => {
  it("selects the clicked row", async () => {
    const requests = Array.from({ length: 10 }, (_, index) => summary(`r${index}`));
    const { setup, store } = await renderApp({ requests });

    await setup.mockMouse.click(10, 3);

    await waitUntil(setup, () => expect(store.getState().selection.selectedId).toBe("r2"));
    expect(store.getState().selection.following).toBe(false);
  });

  it("scrolls the list with the wheel without moving the cursor", async () => {
    const requests = Array.from({ length: 60 }, (_, index) => summary(`r${index}`));
    const { setup, store } = await renderApp({ requests });

    await setup.mockMouse.scroll(10, 5, "down");

    await waitUntil(setup, () => expect(store.getState().selection.following).toBe(false));
    expect(store.getState().selection.selectedId).toBeNull();
  });
});
