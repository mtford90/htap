/**
 * Braille spinner frames for the initial load.
 */

import { useEffect, useState } from "react";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const SPINNER_INTERVAL_MS = 80;

export function useSpinner(active = true): string {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = setInterval(
      () => setFrameIndex((previous) => (previous + 1) % SPINNER_FRAMES.length),
      SPINNER_INTERVAL_MS
    );
    return () => clearInterval(timer);
  }, [active]);

  return SPINNER_FRAMES[frameIndex] ?? SPINNER_FRAMES[0];
}
