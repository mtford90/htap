/** @jsxImportSource @opentui/react */

/**
 * Shared fixtures for the OpenTUI component tests.
 *
 * Every wait here is driven by the rendered frame, never by a fixed delay, so
 * the tests do not depend on how fast the machine is.
 */

import React, { type ReactNode } from "react";
import { useKeyboard } from "@opentui/react";
import { testRender } from "@opentui/react/test-utils";
import type { TestRendererSetup } from "@opentui/core/testing";
import { vi } from "vitest";
import type {
  CapturedRequest,
  CapturedRequestSummary,
  InterceptorEvent,
} from "../../shared/types.js";
import { createTuiActions, createTuiStore } from "../store/store.js";
import { dispatchKey, type CommandDeps } from "../commands/table.js";
import { toKeyLike } from "../commands/keys.js";
import { SyncEngine, type SyncClient } from "../sync/engine.js";

// The reconciler warns about updates outside act(); the test renderer drives
// its own render passes instead, so the warning is noise here.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;

export const DEFAULT_WIDTH = 160;
const WAIT_TIMEOUT_MS = 3000;
const WAIT_INTERVAL_MS = 5;
export const DEFAULT_HEIGHT = 45;

const active: TestRendererSetup[] = [];

export interface RenderOptions {
  width?: number;
  height?: number;
}

export const renderTui = async (
  node: ReactNode,
  { width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT }: RenderOptions = {}
): Promise<TestRendererSetup> => {
  const setup = await testRender(node, { width, height });
  active.push(setup);
  await setup.renderOnce();
  return setup;
};

/** Tears down every renderer a test created. Call from `afterEach`. */
export const destroyRenderers = (): void => {
  for (const setup of active.splice(0)) {
    setup.renderer.destroy();
  }
};

/**
 * Renders until the frame satisfies the predicate.
 *
 * React commits state updates on its own scheduler and OpenTUI holds a lone
 * Escape briefly to see whether an escape sequence follows, so each pass
 * re-renders and retries instead of waiting a fixed time.
 */
export const waitForFrame = (
  setup: TestRendererSetup,
  predicate: (frame: string) => boolean
): Promise<string> =>
  vi.waitFor(
    async () => {
      await setup.flush();
      const frame = setup.captureCharFrame();
      if (!predicate(frame)) {
        throw new Error(`Frame did not match:\n${frame}`);
      }
      return frame;
    },
    { timeout: WAIT_TIMEOUT_MS, interval: WAIT_INTERVAL_MS }
  );

/** Retries an assertion while the frame keeps rendering. */
export const waitUntil = (setup: TestRendererSetup, assertion: () => void): Promise<void> =>
  vi.waitFor(
    async () => {
      await setup.flush();
      assertion();
    },
    { timeout: WAIT_TIMEOUT_MS, interval: WAIT_INTERVAL_MS }
  );

/** Waits until the frame contains the text, then returns the frame. */
export const waitForText = (setup: TestRendererSetup, text: string): Promise<string> =>
  waitForFrame(setup, (frame) => frame.includes(text));

/** Waits until the text is gone from the frame. */
export const waitForNoText = (setup: TestRendererSetup, text: string): Promise<string> =>
  waitForFrame(setup, (frame) => !frame.includes(text));

/** Lets every pending state update reach the frame. */
export const settle = async (setup: TestRendererSetup): Promise<void> => {
  await setup.flush();
  await new Promise((resolve) => setImmediate(resolve));
  await setup.flush();
};

/**
 * A lone Escape is held by the input parser until it can rule out an escape
 * sequence, so callers must wait for its effect rather than the next frame.
 */
export const pressEscape = (setup: TestRendererSetup): void => setup.mockInput.pressEscape();

export const summary = (
  id: string,
  overrides: Partial<CapturedRequestSummary> = {}
): CapturedRequestSummary => ({
  id,
  sessionId: "session",
  timestamp: 1_700_000_000_000,
  method: "GET",
  url: `http://example.test/${id}`,
  host: "example.test",
  path: `/${id}`,
  responseStatus: 200,
  durationMs: 12,
  requestBodySize: 0,
  responseBodySize: 0,
  ...overrides,
});

export const fullRequest = (overrides: Partial<CapturedRequest> = {}): CapturedRequest => ({
  id: "req-1",
  sessionId: "session",
  timestamp: 1_700_000_000_000,
  method: "GET",
  url: "http://example.test/api/items",
  host: "example.test",
  path: "/api/items",
  requestHeaders: { host: "example.test", accept: "*/*" },
  responseStatus: 200,
  responseHeaders: { "content-type": "application/json" },
  responseBody: Buffer.from('{"items":[1,2,3]}'),
  durationMs: 12,
  ...overrides,
});

export const event = (overrides: Partial<InterceptorEvent> = {}): InterceptorEvent => ({
  seq: 1,
  timestamp: 1_700_000_000_000,
  type: "observed",
  level: "info",
  interceptor: "logger",
  message: "hello",
  ...overrides,
});

export const stubSyncClient = (overrides: Partial<SyncClient> = {}): SyncClient => ({
  listRequestsSummaryDelta: vi.fn(async () => ({ entries: [], cursor: 0, hasMore: false })),
  searchBodies: vi.fn(async () => []),
  getRequest: vi.fn(async () => null),
  replayRequest: vi.fn(async () => ({ requestId: "replayed" })),
  saveRequest: vi.fn(async () => ({ success: true })),
  unsaveRequest: vi.fn(async () => ({ success: true })),
  clearRequests: vi.fn(async () => undefined),
  getInterceptorEvents: vi.fn(async () => ({
    events: [],
    counts: { info: 0, warn: 0, error: 0 },
  })),
  status: vi.fn(async () => ({})),
  close: vi.fn(),
  ...overrides,
});

/** A store, actions and an engine wired to a fake control client. */
export const createHarness = (clientOverrides: Partial<SyncClient> = {}) => {
  const store = createTuiStore({ startTime: Date.now(), caCertPath: "/tmp/ca.pem" });
  const actions = createTuiActions(store);
  const client = stubSyncClient(clientOverrides);
  const engine = new SyncEngine({ client, actions });
  return { store, actions, client, engine };
};

/**
 * Mounts the one keyboard listener the app has, so a modal under test is
 * driven the way it is in the real TUI: through the command table.
 */
export function KeyboardBridge({ deps }: { deps: CommandDeps }): React.ReactNode {
  useKeyboard((key) => {
    if (dispatchKey(deps, toKeyLike(key))) {
      key.stopPropagation();
    }
  });
  return null;
}

export interface ModalRenderOptions extends RenderOptions {
  client?: Partial<SyncClient>;
}

/** A store, actions, command deps and a rendered modal wired to the table. */
export const renderWithCommands = async (
  node: (harness: ReturnType<typeof createHarness>) => ReactNode,
  { client = {}, ...size }: ModalRenderOptions = {}
) => {
  const harness = createHarness(client);
  const exit = vi.fn();
  const copyToClipboard = vi.fn(async () => undefined);
  const deps: CommandDeps = {
    store: harness.store,
    actions: harness.actions,
    engine: harness.engine,
    exit,
    copyToClipboard,
  };
  const setup = await renderTui(
    <>
      <KeyboardBridge deps={deps} />
      {node(harness)}
    </>,
    size
  );
  return { ...harness, deps, exit, copyToClipboard, setup };
};
