/** @jsxImportSource @opentui/react */

import { afterEach, describe, expect, it, vi } from "vitest";
import { HelpModal } from "./HelpModal.js";
import {
  destroyRenderers,
  pressEscape,
  renderTui,
  waitUntil,
} from "../test-support/render.js";

afterEach(destroyRenderers);

describe("HelpModal", () => {
  it("lists the navigation and action shortcuts", async () => {
    const setup = await renderTui(
      <HelpModal width={100} height={44} onClose={vi.fn()} />,
      { width: 100, height: 44 }
    );

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Keyboard Shortcuts");
    expect(frame).toContain("Navigation");
    expect(frame).toContain("Actions");
    expect(frame).toContain("Toggle follow mode");
    expect(frame).toContain("Replay request");
  });

  it("shows the proxy URL and CA path when the proxy is running", async () => {
    const setup = await renderTui(
      <HelpModal
        width={100}
        height={44}
        onClose={vi.fn()}
        proxyPort={8080}
        caCertPath="/tmp/ca.pem"
      />,
      { width: 100, height: 44 }
    );

    const frame = setup.captureCharFrame();
    expect(frame).toContain("http://127.0.0.1:8080");
    expect(frame).toContain("/tmp/ca.pem");
  });

  it("says the proxy is not running when there is no port", async () => {
    const setup = await renderTui(<HelpModal width={100} height={44} onClose={vi.fn()} />, {
      width: 100,
      height: 44,
    });

    expect(setup.captureCharFrame()).toContain("Proxy is not running");
  });

  it("closes on ?", async () => {
    const onClose = vi.fn();
    const setup = await renderTui(<HelpModal width={100} height={44} onClose={onClose} />, {
      width: 100,
      height: 44,
    });

    setup.mockInput.pressKey("?");

    await waitUntil(setup, () => expect(onClose).toHaveBeenCalled());
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    const setup = await renderTui(<HelpModal width={100} height={44} onClose={onClose} />, {
      width: 100,
      height: 44,
    });

    pressEscape(setup);

    await waitUntil(setup, () => expect(onClose).toHaveBeenCalled());
  });

  it("ignores other keys", async () => {
    const onClose = vi.fn();
    const setup = await renderTui(<HelpModal width={100} height={44} onClose={onClose} />, {
      width: 100,
      height: 44,
    });

    setup.mockInput.pressKey("j");
    setup.mockInput.pressKey("q");
    await setup.flush();

    expect(onClose).not.toHaveBeenCalled();
  });
});
