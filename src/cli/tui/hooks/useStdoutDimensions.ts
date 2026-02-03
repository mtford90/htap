/**
 * Hook for subscribing to stdout dimensions.
 *
 * Replaces ink-use-stdout-dimensions which has compatibility issues with
 * Node.js 24 due to CJS/ESM interop problems.
 */

import { useState, useEffect } from "react";
import { useStdout } from "ink";

/**
 * Returns [columns, rows] of the terminal, updating when the terminal is resized.
 */
export function useStdoutDimensions(): [number, number] {
  const { stdout } = useStdout();

  const [dimensions, setDimensions] = useState<[number, number]>([
    stdout.columns || 80,
    stdout.rows || 24,
  ]);

  useEffect(() => {
    const handler = () => {
      setDimensions([stdout.columns || 80, stdout.rows || 24]);
    };

    stdout.on("resize", handler);

    return () => {
      stdout.off("resize", handler);
    };
  }, [stdout]);

  return dimensions;
}
