/** @jsxImportSource @opentui/react */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { BodySearchOptions, RequestFilter } from "../../shared/types.js";
import {
  buildFilterState,
  FilterBar,
  getBodySearchDisplayParts,
  type FilterBarProps,
} from "./FilterBar.js";
import {
  destroyRenderers,
  renderTui,
  settle,
  waitForNoText,
  waitForText,
  waitUntil,
  pressEscape,
} from "../test-support/render.js";

afterEach(destroyRenderers);

const props = (overrides: Partial<FilterBarProps> = {}): FilterBarProps => ({
  filter: {},
  onFilterChange: vi.fn(),
  onClose: vi.fn(),
  onCancel: vi.fn(),
  width: 140,
  ...overrides,
});

/** The bar applies its filter on a debounce, so wait for the call rather than sleeping. */
const lastFilterCall = (onFilterChange: ReturnType<typeof vi.fn>) =>
  vi.waitFor(() => {
    expect(onFilterChange).toHaveBeenCalled();
    return onFilterChange.mock.calls.at(-1) as [RequestFilter, BodySearchOptions | undefined];
  });

describe("buildFilterState", () => {
  const fields = {
    search: "",
    methodIndex: 0,
    statusIndex: 0,
    savedIndex: 0,
    source: "",
  };

  it("returns an empty filter when nothing is set", () => {
    expect(buildFilterState(fields)).toEqual({ filter: {}, bodySearch: undefined });
  });

  it("treats plain text as a substring search", () => {
    expect(buildFilterState({ ...fields, search: "api" }).filter).toEqual({ search: "api" });
  });

  it("reads a regex literal with its flags", () => {
    expect(buildFilterState({ ...fields, search: "/user.*/i" }).filter).toEqual({
      regex: "user.*",
      regexFlags: "i",
    });
  });

  it("falls back to a substring search for an unfinished regex", () => {
    expect(buildFilterState({ ...fields, search: "/user[" }).filter).toEqual({ search: "/user[" });
  });

  it("reads a scoped body search", () => {
    expect(buildFilterState({ ...fields, search: "body:req:error" })).toEqual({
      filter: {},
      bodySearch: { query: "error", target: "request" },
    });
  });

  it("maps the method, status, saved and source fields", () => {
    expect(
      buildFilterState({
        search: "",
        methodIndex: 2,
        statusIndex: 3,
        savedIndex: 1,
        source: " node ",
      }).filter
    ).toEqual({ methods: ["POST"], statusRange: "4xx", saved: true, source: "node" });
  });
});

describe("getBodySearchDisplayParts", () => {
  it("returns nothing for plain text", () => {
    expect(getBodySearchDisplayParts("api")).toBeUndefined();
  });

  it("splits the scope, the target and the query", () => {
    expect(getBodySearchDisplayParts("body:res:oops")).toEqual({
      bodyPrefix: "body:",
      targetPrefix: "res:",
      query: "oops",
    });
  });

  it("treats an unknown target as part of the query", () => {
    expect(getBodySearchDisplayParts("body:foo:bar")).toEqual({
      bodyPrefix: "body:",
      query: "foo:bar",
    });
  });
});

describe("FilterBar", () => {
  it("renders every field with its default value", async () => {
    const setup = await renderTui(<FilterBar {...props()} />, { width: 140, height: 4 });

    const frame = setup.captureCharFrame();
    expect(frame).toContain("method:ALL");
    expect(frame).toContain("status:ALL");
    expect(frame).toContain("saved:ALL");
    expect(frame).toContain("source:ALL");
  });

  it("shows the existing filter when it opens", async () => {
    const setup = await renderTui(
      <FilterBar {...props({ filter: { search: "api", methods: ["POST"], statusRange: "4xx" } })} />,
      { width: 140, height: 4 }
    );

    const frame = setup.captureCharFrame();
    expect(frame).toContain("api");
    expect(frame).toContain("method:POST");
    expect(frame).toContain("status:4xx");
  });

  it("shows a regex filter back as a literal", async () => {
    const setup = await renderTui(
      <FilterBar {...props({ filter: { regex: "user.*", regexFlags: "i" } })} />,
      { width: 140, height: 4 }
    );

    expect(setup.captureCharFrame()).toContain("/user.*/i");
  });

  it("types into the search field and applies the filter", async () => {
    const onFilterChange = vi.fn();
    const setup = await renderTui(<FilterBar {...props({ onFilterChange })} />, {
      width: 140,
      height: 4,
    });

    await setup.mockInput.typeText("api");
    await waitForText(setup, "api");

    expect(await lastFilterCall(onFilterChange)).toEqual([{ search: "api" }, undefined]);
  });

  it("deletes the last character on backspace", async () => {
    const onFilterChange = vi.fn();
    const setup = await renderTui(<FilterBar {...props({ onFilterChange })} />, {
      width: 140,
      height: 4,
    });
    await setup.mockInput.typeText("api");
    await waitForText(setup, "api");

    setup.mockInput.pressBackspace();
    await waitForNoText(setup, "api");

    await vi.waitFor(() => {
      expect(onFilterChange.mock.calls.at(-1)?.[0]).toEqual({ search: "ap" });
    });
  });

  it("cycles the method field with the arrow keys after Tab", async () => {
    const onFilterChange = vi.fn();
    const setup = await renderTui(<FilterBar {...props({ onFilterChange })} />, {
      width: 140,
      height: 4,
    });

    setup.mockInput.pressTab();
    await settle(setup);
    setup.mockInput.pressArrow("right");
    await waitForText(setup, "method:GET");

    await vi.waitFor(() => {
      expect(onFilterChange.mock.calls.at(-1)?.[0]).toEqual({ methods: ["GET"] });
    });
  });

  it("wraps the method field back to ALL", async () => {
    const setup = await renderTui(<FilterBar {...props()} />, { width: 140, height: 4 });

    setup.mockInput.pressTab();
    await settle(setup);
    setup.mockInput.pressArrow("left");
    await waitForText(setup, "method:DELETE");

    setup.mockInput.pressArrow("right");
    await waitForText(setup, "method:ALL");
  });

  it("toggles the saved field", async () => {
    const setup = await renderTui(<FilterBar {...props()} />, { width: 140, height: 4 });

    for (let field = 0; field < 3; field += 1) {
      setup.mockInput.pressTab();
      await settle(setup);
    }
    setup.mockInput.pressArrow("right");

    await waitForText(setup, "saved:YES");
  });

  it("types into the source field", async () => {
    const onFilterChange = vi.fn();
    const setup = await renderTui(<FilterBar {...props({ onFilterChange })} />, {
      width: 140,
      height: 4,
    });

    for (let field = 0; field < 4; field += 1) {
      setup.mockInput.pressTab();
      await settle(setup);
    }
    await setup.mockInput.typeText("node");
    await waitForText(setup, "source:node");

    await vi.waitFor(() => {
      expect(onFilterChange.mock.calls.at(-1)?.[0]).toEqual({ source: "node" });
    });
  });

  it("colours the parts of a scoped body search", async () => {
    const onFilterChange = vi.fn();
    const setup = await renderTui(<FilterBar {...props({ onFilterChange })} />, {
      width: 140,
      height: 4,
    });

    await setup.mockInput.typeText("body:req:oops");
    await waitForText(setup, "body:req:oops");

    const call = await lastFilterCall(onFilterChange);
    expect(call[1]).toEqual({ query: "oops", target: "request" });
  });

  it("closes on Enter without reverting", async () => {
    const onClose = vi.fn();
    const onCancel = vi.fn();
    const setup = await renderTui(<FilterBar {...props({ onClose, onCancel })} />, {
      width: 140,
      height: 4,
    });

    setup.mockInput.pressEnter();

    await waitUntil(setup, () => expect(onClose).toHaveBeenCalled());
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("reverts on Escape", async () => {
    const onClose = vi.fn();
    const onCancel = vi.fn();
    const setup = await renderTui(<FilterBar {...props({ onClose, onCancel })} />, {
      width: 140,
      height: 4,
    });

    pressEscape(setup);

    await waitUntil(setup, () => expect(onCancel).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });
});
