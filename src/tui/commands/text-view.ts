/**
 * Keyboard commands of the text pager and its search prompt.
 */

import type { Mode, Scroller, TuiState } from "../store/types.js";
import { matchingLineIndices } from "../utils/text-search.js";
import type { Command, CommandContext } from "./types.js";

const TEXT: readonly Mode[] = ["text"];
const SEARCH: readonly Mode[] = ["textSearch"];

const pager = (state: TuiState): Scroller | undefined => state.scrollers.text;

/** The body the pager is showing, or an empty string in any other mode. */
const pagerText = (state: TuiState): string =>
  state.ui.modal?.kind === "text" ? state.ui.modal.text : "";

const matches = (state: TuiState): number[] =>
  matchingLineIndices(pagerText(state), state.modals.text.searchText);

const scrollBy = (context: CommandContext, rows: number): void =>
  pager(context.state)?.scrollBy(rows);

const page = (context: CommandContext): number => pager(context.state)?.viewportRows ?? 1;

/** A match is shown in the middle of the viewport, as `less` does. */
const centreOnMatch = (context: CommandContext, matchIndex: number): void => {
  const view = pager(context.state);
  const lineIndex = matches(context.state)[matchIndex];
  if (!view || lineIndex === undefined) {
    return;
  }
  view.scrollTo(Math.max(0, lineIndex - Math.floor(view.viewportRows / 2)));
};

const stepMatch = (context: CommandContext, step: 1 | -1): void => {
  const total = matches(context.state).length;
  if (total === 0) {
    return;
  }
  const next = (context.state.modals.text.matchIndex + step + total) % total;
  context.actions.patchTextView({ matchIndex: next });
  centreOnMatch(context, next);
};

export const TEXT_VIEW_COMMANDS: readonly Command[] = [
  {
    id: "text.down",
    keys: ["j", "down"],
    modes: TEXT,
    hint: { key: "j/k", action: "nav" },
    run: (context) => scrollBy(context, 1),
  },
  { id: "text.up", keys: ["k", "up"], modes: TEXT, run: (context) => scrollBy(context, -1) },
  {
    id: "text.pageDown",
    keys: ["ctrl+f", "space"],
    modes: TEXT,
    hint: { key: "^f/^b", action: "page" },
    run: (context) => scrollBy(context, page(context)),
  },
  {
    id: "text.pageUp",
    keys: ["ctrl+b"],
    modes: TEXT,
    run: (context) => scrollBy(context, -page(context)),
  },
  {
    id: "text.halfPageDown",
    keys: ["ctrl+d"],
    modes: TEXT,
    run: (context) => scrollBy(context, Math.floor(page(context) / 2)),
  },
  {
    id: "text.halfPageUp",
    keys: ["ctrl+u"],
    modes: TEXT,
    run: (context) => scrollBy(context, -Math.floor(page(context) / 2)),
  },
  {
    id: "text.top",
    keys: ["g"],
    modes: TEXT,
    hint: { key: "g/G", action: "top/bottom" },
    run: (context) => pager(context.state)?.scrollTo(0),
  },
  {
    id: "text.bottom",
    keys: ["G"],
    modes: TEXT,
    run: (context) => {
      const view = pager(context.state);
      view?.scrollTo(view.maxScrollTop);
    },
  },
  {
    id: "text.search",
    keys: ["/"],
    modes: TEXT,
    hint: { key: "/", action: "search" },
    run: (context) =>
      context.actions.patchTextView({ searchOpen: true, searchText: "", matchIndex: 0 }),
  },
  {
    id: "text.nextMatch",
    keys: ["n"],
    modes: TEXT,
    hint: { key: "n/N", action: "match" },
    run: (context) => stepMatch(context, 1),
  },
  { id: "text.prevMatch", keys: ["N"], modes: TEXT, run: (context) => stepMatch(context, -1) },
  {
    id: "text.copy",
    keys: ["y"],
    modes: TEXT,
    hint: { key: "y", action: "copy" },
    run: (context) => {
      void context.copyToClipboard(pagerText(context.state)).then(
        () => context.actions.flashStatus("Copied to clipboard"),
        () => context.actions.flashStatus("Failed to copy to clipboard")
      );
    },
  },
  {
    id: "text.close",
    keys: ["q", "escape"],
    modes: TEXT,
    hint: { key: "q/Esc", action: "close" },
    run: (context) => context.actions.closeModal(),
  },
  {
    id: "textSearch.cancel",
    keys: ["escape"],
    modes: SEARCH,
    run: (context) =>
      context.actions.patchTextView({ searchOpen: false, searchText: "", matchIndex: 0 }),
  },
  {
    id: "textSearch.submit",
    keys: ["return"],
    modes: SEARCH,
    run: (context) => {
      context.actions.patchTextView({ searchOpen: false, matchIndex: 0 });
      if (matches(context.state).length > 0) {
        centreOnMatch(context, 0);
      }
    },
  },
];
