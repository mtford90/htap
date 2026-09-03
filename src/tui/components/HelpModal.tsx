/** @jsxImportSource @opentui/react */

/**
 * Full-screen keyboard reference plus the proxy connection details.
 */

import React from "react";
import { useKeyboard } from "@opentui/react";
import { buildProxyInfo } from "../../shared/proxy-info.js";
import { BOLD, DIM } from "./styles.js";

const KEY_COLUMN_WIDTH = 20;
const MAX_INNER_WIDTH = 64;

interface HelpEntry {
  key: string;
  description: string;
}

interface HelpSection {
  title: string;
  entries: HelpEntry[];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: "Navigation",
    entries: [
      { key: "j / ↓", description: "Move down" },
      { key: "k / ↑", description: "Move up" },
      { key: "F", description: "Toggle follow mode (auto-select newest)" },
      { key: "g / G", description: "First / last item" },
      { key: "Ctrl+u / Ctrl+d", description: "Half page up / down" },
      { key: "Ctrl+f / Ctrl+b", description: "Full page down / up" },
      { key: "Tab / Shift+Tab", description: "Next / prev panel" },
      { key: "1-5", description: "Jump to section" },
      { key: "Space", description: "Toggle section expand/collapse" },
      { key: "[ / ]", description: "Resize panels" },
      { key: "=", description: "Reset panel size" },
    ],
  },
  {
    title: "Actions",
    entries: [
      { key: "Enter", description: "View body content" },
      { key: "e", description: "Export: cURL / Fetch / Python / HTTPie / HAR" },
      { key: "R", description: "Replay request" },
      { key: "y", description: "Copy body to clipboard" },
      { key: "s", description: "Export body content" },
      { key: "b", description: "Toggle bookmark" },
      { key: "x / D", description: "Clear requests" },
      { key: "u", description: "Toggle full URL" },
      { key: "/", description: "Filter (URL, /regex/, body:req:…)" },
      { key: "r", description: "Refresh" },
      { key: "L", description: "Interceptor events" },
      { key: "?", description: "Toggle help" },
      { key: "q", description: "Quit" },
    ],
  },
];

export interface HelpModalProps {
  width: number;
  height: number;
  onClose: () => void;
  proxyPort?: number;
  caCertPath?: string;
}

function ConnectionInfo({
  proxyPort,
  caCertPath,
}: {
  proxyPort?: number;
  caCertPath?: string;
}): React.ReactNode {
  if (proxyPort === undefined) {
    return (
      <box flexDirection="column" marginBottom={1}>
        <text fg="yellow" attributes={BOLD}>
          Connection Info
        </text>
        <text fg="yellow">Proxy is not running</text>
      </box>
    );
  }

  const info = buildProxyInfo(proxyPort, caCertPath ?? "");

  return (
    <box flexDirection="column" marginBottom={1}>
      <text fg="yellow" attributes={BOLD}>
        Connection Info
      </text>
      <text wrapMode="none">
        <span attributes={BOLD}>{"Proxy  "}</span>
        <span fg="green">{info.proxyUrl}</span>
      </text>
      <text wrapMode="none">
        <span attributes={BOLD}>{"CA     "}</span>
        <span fg="green">{info.caCertPath}</span>
      </text>
    </box>
  );
}

export function HelpModal({
  width,
  height,
  onClose,
  proxyPort,
  caCertPath,
}: HelpModalProps): React.ReactNode {
  useKeyboard((key) => {
    key.stopPropagation();
    if (key.sequence === "?" || key.name === "escape") {
      onClose();
    }
  });

  const innerWidth = Math.min(MAX_INNER_WIDTH, width - 4);

  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      alignItems="center"
      justifyContent="center"
    >
      <box flexDirection="column" width={innerWidth}>
        <box marginBottom={1} justifyContent="center">
          <text fg="cyan" attributes={BOLD}>
            Keyboard Shortcuts
          </text>
        </box>

        {HELP_SECTIONS.map((section) => (
          <box key={section.title} flexDirection="column" marginBottom={1}>
            <text fg="yellow" attributes={BOLD}>
              {section.title}
            </text>
            {section.entries.map((entry) => (
              <text key={entry.key} wrapMode="none">
                <span fg="cyan">{entry.key.padEnd(KEY_COLUMN_WIDTH)}</span>
                <span>{entry.description}</span>
              </text>
            ))}
          </box>
        ))}

        <ConnectionInfo proxyPort={proxyPort} caCertPath={caCertPath} />

        <box marginTop={1} justifyContent="center">
          <text attributes={DIM}>Press ? or Escape to close</text>
        </box>
      </box>
    </box>
  );
}
