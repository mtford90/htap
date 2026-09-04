/**
 * Lends a `<scrollbox>` to the command table.
 *
 * The scrollbox owns its position, so nothing mirrors it into the store; only
 * the readouts that show it need a React value, which `scrollTop` provides.
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
    const box = ref.current;
    if (!box) {
      return;
    }

    const scroller: Scroller = {
      scrollBy: (delta) => {
        box.scrollBy(delta);
        syncScrollTop();
      },
      scrollTo: (offset) => {
        box.scrollTo(offset);
        syncScrollTop();
      },
      scrollIntoView: (childId) => {
        box.scrollChildIntoView(childId);
        syncScrollTop();
      },
      get scrollTop() {
        return box.scrollTop;
      },
      get viewportRows() {
        return box.viewport.height;
      },
      get maxScrollTop() {
        return Math.max(0, box.scrollHeight - box.viewport.height);
      },
    };

    actions.registerScroller(name, scroller);
    return () => actions.registerScroller(name, null);
  }, [actions, name, syncScrollTop]);

  return { ref, scrollTop, syncScrollTop };
};
