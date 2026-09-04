/**
 * Keyboard commands of the interceptor log and its filter bar.
 */

import type { Mode, Scroller, TuiState } from "../store/types.js";
import type { Command, CommandContext } from "./types.js";

const LOG: readonly Mode[] = ["interceptorLog"];
const FILTER: readonly Mode[] = ["logFilter"];

const log = (state: TuiState): Scroller | undefined => state.scrollers.log;

const scrollBy = (context: CommandContext, rows: number): void =>
  log(context.state)?.scrollBy(rows);

const halfPage = (context: CommandContext): number =>
  Math.floor((log(context.state)?.viewportRows ?? 1) / 2);

export const LOG_VIEW_COMMANDS: readonly Command[] = [
  {
    id: "log.down",
    keys: ["j", "down"],
    modes: LOG,
    hint: { key: "j/k", action: "nav" },
    run: (context) => scrollBy(context, 1),
  },
  { id: "log.up", keys: ["k", "up"], modes: LOG, run: (context) => scrollBy(context, -1) },
  {
    id: "log.halfPageDown",
    keys: ["ctrl+d"],
    modes: LOG,
    hint: { key: "^u/^d", action: "half-page" },
    run: (context) => scrollBy(context, halfPage(context)),
  },
  {
    id: "log.halfPageUp",
    keys: ["ctrl+u"],
    modes: LOG,
    run: (context) => scrollBy(context, -halfPage(context)),
  },
  {
    id: "log.top",
    keys: ["g"],
    modes: LOG,
    hint: { key: "g/G", action: "top/bottom" },
    run: (context) => log(context.state)?.scrollTo(0),
  },
  {
    id: "log.bottom",
    keys: ["G"],
    modes: LOG,
    run: (context) => {
      const view = log(context.state);
      view?.scrollTo(view.maxScrollTop);
    },
  },
  {
    id: "log.filter",
    keys: ["/"],
    modes: LOG,
    hint: { key: "/", action: "filter" },
    run: (context) => context.actions.openLogFilter(),
  },
  {
    id: "log.close",
    keys: ["q", "escape"],
    modes: LOG,
    hint: { key: "q/Esc", action: "close" },
    run: (context) => context.actions.closeModal(),
  },
  {
    id: "logFilter.cancel",
    keys: ["escape"],
    modes: FILTER,
    run: (context) => context.actions.closeLogFilter(true),
  },
  {
    id: "logFilter.submit",
    keys: ["return"],
    modes: FILTER,
    run: (context) => context.actions.closeLogFilter(false),
  },
];
