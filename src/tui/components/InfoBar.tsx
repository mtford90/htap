/** @jsxImportSource @opentui/react */

/**
 * One-line session summary above the status bar, replaced by an alert whenever
 * an interceptor has reported errors.
 */

import React, { useEffect, useState } from "react";
import { BOLD, DIM } from "./styles.js";

const UPTIME_TICK_MS = 1000;

export interface InfoBarProps {
  interceptorErrorCount: number;
  requestCount: number;
  interceptorCount: number;
  /** Epoch ms the TUI started. */
  startTime: number;
  width: number;
}

const formatUptime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((part) => String(part).padStart(2, "0")).join(":");
};

const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export function InfoBar({
  interceptorErrorCount,
  requestCount,
  interceptorCount,
  startTime,
  width,
}: InfoBarProps): React.ReactNode {
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const update = (): void => setUptime(Math.floor((Date.now() - startTime) / UPTIME_TICK_MS));
    update();
    const timer = setInterval(update, UPTIME_TICK_MS);
    return () => clearInterval(timer);
  }, [startTime]);

  if (interceptorErrorCount > 0) {
    return (
      <box width={width} height={1} paddingLeft={1} paddingRight={1}>
        <text wrapMode="none" fg="red" attributes={BOLD}>
          {`⚠ ${plural(interceptorErrorCount, "interceptor error")} — press L to view`}
        </text>
      </box>
    );
  }

  if (requestCount > 0 || interceptorCount > 0 || uptime > 0) {
    return (
      <box width={width} height={1} paddingLeft={1} paddingRight={1}>
        <text wrapMode="none" attributes={DIM}>
          {`${plural(requestCount, "request")} captured │ ${plural(interceptorCount, "interceptor")} loaded │ uptime: ${formatUptime(uptime)}`}
        </text>
      </box>
    );
  }

  return <box width={width} height={1} />;
}
