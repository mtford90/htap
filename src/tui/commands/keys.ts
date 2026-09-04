/**
 * Matching of OpenTUI key events against short specifications such as
 * `"j"`, `"G"`, `"ctrl+d"`, `"shift+tab"` and `"return"`.
 */

import type { KeyEvent } from "@opentui/core";

/** The parts of a key event that matter here, so tests need no renderer. */
export interface KeyLike {
  name: string;
  sequence: string;
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
}

export const matchesKey = (key: KeyLike, spec: string): boolean => {
  const parts = spec.split("+");
  const base = parts[parts.length - 1] ?? "";
  const wantCtrl = parts.includes("ctrl");
  const wantShift = parts.includes("shift");

  if (key.ctrl !== wantCtrl || key.meta) {
    return false;
  }

  // A printable spec compares the produced character, which already encodes
  // shift: "G" matches shift+g and never plain g.
  if (base.length === 1 && !wantCtrl) {
    return key.sequence === base;
  }

  return key.name === base && key.shift === wantShift;
};

export const matchesAnyKey = (key: KeyLike, specs: readonly string[]): boolean =>
  specs.some((spec) => matchesKey(key, spec));

export const toKeyLike = (key: KeyEvent): KeyLike => ({
  name: key.name,
  sequence: key.sequence,
  ctrl: key.ctrl,
  shift: key.shift,
  meta: key.meta,
});
