/** @jsxImportSource @opentui/react */

/**
 * Destination picker for a captured body: clipboard, the project exports
 * folder, ~/Downloads, a custom directory, or the system's default viewer.
 */

import React, { useState } from "react";
import { useKeyboard } from "@opentui/react";
import { attributes, BOLD, DIM } from "./styles.js";

export type ExportAction = "clipboard" | "exports" | "downloads" | "custom" | "open-external";

interface Option {
  key: string;
  action: ExportAction;
  label: string;
  description: string;
}

const OPTIONS: Option[] = [
  {
    key: "1",
    action: "clipboard",
    label: "Copy to clipboard",
    description: "Copy body text to clipboard",
  },
  { key: "2", action: "exports", label: ".httap/exports/", description: "Project exports folder" },
  { key: "3", action: "downloads", label: "~/Downloads/", description: "Downloads folder" },
  { key: "4", action: "custom", label: "Custom path...", description: "Enter a custom directory" },
  {
    key: "5",
    action: "open-external",
    label: "Open externally",
    description: "Open in default app",
  },
];

export interface ExportModalProps {
  filename: string;
  fileSize: string;
  isBinary: boolean;
  width: number;
  height: number;
  onExport: (action: ExportAction, customPath?: string) => void;
  onClose: () => void;
}

export function ExportModal({
  filename,
  fileSize,
  isBinary,
  width,
  height,
  onExport,
  onClose,
}: ExportModalProps): React.ReactNode {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customPath, setCustomPath] = useState("");

  useKeyboard((key) => {
    key.stopPropagation();

    if (showCustomInput) {
      if (key.name === "return") {
        if (customPath.trim()) {
          onExport("custom", customPath.trim());
        }
      } else if (key.name === "backspace" || key.name === "delete") {
        setCustomPath((previous) => previous.slice(0, -1));
      } else if (key.name === "escape") {
        setShowCustomInput(false);
        setCustomPath("");
      } else if (key.sequence.length === 1 && !key.ctrl && !key.meta) {
        setCustomPath((previous) => previous + key.sequence);
      }
      return;
    }

    if (key.name === "escape") {
      onClose();
      return;
    }
    if (key.sequence === "j" || key.name === "down") {
      setSelectedIndex((previous) => Math.min(previous + 1, OPTIONS.length - 1));
      return;
    }
    if (key.sequence === "k" || key.name === "up") {
      setSelectedIndex((previous) => Math.max(previous - 1, 0));
      return;
    }

    const numbered = OPTIONS.find((option) => option.key === key.sequence);
    const chosen = numbered ?? (key.name === "return" ? OPTIONS[selectedIndex] : undefined);
    if (!chosen) {
      return;
    }
    if (chosen.action === "custom") {
      setShowCustomInput(true);
    } else {
      onExport(chosen.action);
    }
  });

  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      alignItems="center"
      justifyContent="center"
    >
      <box marginBottom={1}>
        <text fg="cyan" attributes={BOLD}>
          Export Body Content
        </text>
      </box>
      <box marginBottom={2}>
        <text attributes={DIM}>{`${filename} (${fileSize})`}</text>
      </box>

      {showCustomInput ? (
        <box flexDirection="column" alignItems="center">
          <text>Enter directory path:</text>
          <box marginTop={1}>
            <text>
              <span fg="cyan">&gt; </span>
              <span>{customPath}</span>
              <span fg="cyan">_</span>
            </text>
          </box>
          <box marginTop={2}>
            <text attributes={DIM}>Enter to save, Escape to go back</text>
          </box>
        </box>
      ) : (
        <box flexDirection="column">
          <box marginBottom={1}>
            <text>Select export action:</text>
          </box>
          {OPTIONS.map((option, index) => (
            <text key={option.key} marginLeft={2} wrapMode="none">
              <span fg={index === selectedIndex ? "cyan" : undefined}>
                {index === selectedIndex ? "❯ " : "  "}
              </span>
              <span fg="yellow" attributes={BOLD}>{`[${option.key}]`}</span>
              <span fg={index === selectedIndex ? "white" : "gray"}>{` ${option.label}`}</span>
              <span attributes={DIM}>{` - ${option.description}`}</span>
              {option.action === "clipboard" && isBinary ? (
                <span attributes={attributes({ dim: true, italic: true })}>
                  {" (binary — will copy raw bytes)"}
                </span>
              ) : null}
            </text>
          ))}
          <box marginTop={2}>
            <text attributes={DIM}>
              j/k navigate │ Enter or number to select │ Escape to cancel
            </text>
          </box>
        </box>
      )}
    </box>
  );
}
