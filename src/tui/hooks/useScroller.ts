/**
 * Lends a `<scrollbox>` to the command table.
 *
 * The scrollbox owns its position, so nothing mirrors it into the store; only
 * the readouts that show it need a React value, which `scrollTop` provides.
 * Every method reads the ref when called, so a scrollbox that mounts later or
 * remounts behind an empty state is picked up without re-registering.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { TuiActions } from "../store/store.js";
import type { Scroller, ScrollerName } from "../store/types.js";

export interface ScrollerHandle {
  ref: RefObject<ScrollBoxRenderable | null>;
  /** Rows scrolled past the top, for the "1-20/300" style readouts. */
  scrollTop: number;
  /** Call whenever the scrollbox moved itself, so the readout follows. */
  syncScrollTop: () => void;
}

export const useScroller = (name: ScrollerName, actions: TuiActions): ScrollerHandle => {
  const ref = useRef<ScrollBoxRenderable | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const syncScrollTop = useCallback(() => setScrollTop(ref.current?.scrollTop ?? 0), []);

  useEffect(() => {
    const scroller: Scroller = {
      scrollBy: (delta) => {
        ref.current?.scrollBy(delta);
        syncScrollTop();
      },
      scrollTo: (offset) => {
        ref.current?.scrollTo(offset);
        syncScrollTop();
      },
      scrollIntoView: (childId) => {
        ref.current?.scrollChildIntoView(childId);
        syncScrollTop();
      },
      get scrollTop() {
        return ref.current?.scrollTop ?? 0;
      },
      get viewportRows() {
        return ref.current?.viewport.height ?? 0;
      },
      get maxScrollTop() {
        const box = ref.current;
        return box ? Math.max(0, box.scrollHeight - box.viewport.height) : 0;
      },
    };

    actions.registerScroller(name, scroller);
    return () => actions.registerScroller(name, null);
  }, [actions, name, syncScrollTop]);

  return { ref, scrollTop, syncScrollTop };
};
