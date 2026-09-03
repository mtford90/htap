/** @jsxImportSource @opentui/react */

/**
 * Two-phase export of a whole request: pick a format, and for HAR also pick
 * where the file goes.
 */

import React, { useState } from "react";
import { useKeyboard } from "@opentui/react";
import type { CapturedRequest } from "../../shared/types.js";
import { exportFormatToClipboard, exportHarToDir, type ExportResult } from "../hooks/useExport.js";
import { resolveTargetDir } from "../hooks/useBodyExport.js";
import { BOLD, DIM } from "./styles.js";

const MAX_URL_LENGTH = 50;

interface ModalOption {
  key: string;
  label: string;
  description: string;
}

const FORMAT_OPTIONS: ModalOption[] = [
  { key: "1", label: "cURL", description: "Copy to clipboard" },
  { key: "2", label: "Fetch", description: "Copy to clipboard" },
  { key: "3", label: "Python", description: "Copy to clipboard" },
  { key: "4", label: "HTTPie", description: "Copy to clipboard" },
  { key: "5", label: "HAR", description: "Save to file..." },
];

const DESTINATION_OPTIONS: ModalOption[] = [
  { key: "1", label: ".httap/exports/", description: "Project exports folder" },
  { key: "2", label: "~/Downloads/", description: "Downloads folder" },
  { key: "3", label: "Custom path...", description: "Enter a custom directory" },
];

const CLIPBOARD_FORMATS = ["curl", "fetch", "python", "httpie"] as const;
const HAR_OPTION_INDEX = 4;
const CUSTOM_DESTINATION_INDEX = 2;

type Phase = "format" | "destination";

const truncateUrl = (url: string): string =>
  url.length <= MAX_URL_LENGTH ? url : `${url.slice(0, MAX_URL_LENGTH - 1)}…`;

export interface FormatExportModalProps {
  request: CapturedRequest;
  width: number;
  height: number;
  onComplete: (result: ExportResult) => void;
  onClose: () => void;
}

export function FormatExportModal({
  request,
  width,
  height,
  onComplete,
  onClose,
}: FormatExportModalProps): React.ReactNode {
  const [phase, setPhase] = useState<Phase>("format");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customPath, setCustomPath] = useState("");

  const options = phase === "format" ? FORMAT_OPTIONS : DESTINATION_OPTIONS;

  /** Both the directory resolution and the write can throw on a bad path. */
  const exportHar = (location: "exports" | "downloads" | "custom", customDir?: string): void => {
    try {
      onComplete(exportHarToDir([request], resolveTargetDir(location, customDir)));
    } catch (error) {
      onComplete({
        success: false,
        message: error instanceof Error ? error.message : "Failed to export HAR",
      });
    }
  };

  const selectFormat = (index: number): void => {
    if (index === HAR_OPTION_INDEX) {
      setPhase("destination");
      setSelectedIndex(0);
      return;
    }
    const format = CLIPBOARD_FORMATS[index];
    if (format) {
      void exportFormatToClipboard(request, format).then(onComplete);
    }
  };

  const selectDestination = (index: number): void => {
    if (index === CUSTOM_DESTINATION_INDEX) {
      setShowCustomInput(true);
      return;
    }
    const location = (["exports", "downloads"] as const)[index];
    if (location) {
      exportHar(location);
    }
  };

  useKeyboard((key) => {
    key.stopPropagation();

    if (showCustomInput) {
      if (key.name === "return") {
        const trimmed = customPath.trim();
        if (trimmed) {
          exportHar("custom", trimmed);
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
      if (phase === "destination") {
        setPhase("format");
        setSelectedIndex(HAR_OPTION_INDEX);
      } else {
        onClose();
      }
      return;
    }

    if (key.sequence === "j" || key.name === "down") {
      setSelectedIndex((previous) => Math.min(previous + 1, options.length - 1));
      return;
    }
    if (key.sequence === "k" || key.name === "up") {
      setSelectedIndex((previous) => Math.max(previous - 1, 0));
      return;
    }

    const select = phase === "format" ? selectFormat : selectDestination;
    if (key.name === "return") {
      select(selectedIndex);
      return;
    }

    const number = Number.parseInt(key.sequence, 10);
    if (number >= 1 && number <= options.length) {
      select(number - 1);
    }
  });

  const statusLine = `${request.method} ${truncateUrl(request.url)}${
    request.responseStatus ? ` (${request.responseStatus})` : ""
  }`;

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
          {phase === "format" ? "Export Request" : "Export as HAR"}
        </text>
      </box>
      <box marginBottom={2}>
        <text attributes={DIM}>{statusLine}</text>
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
            <text>{phase === "format" ? "Select export format:" : "Select destination:"}</text>
          </box>
          {options.map((option, index) => (
            <text key={option.key} marginLeft={2} wrapMode="none">
              <span fg={index === selectedIndex ? "cyan" : undefined}>
                {index === selectedIndex ? "❯ " : "  "}
              </span>
              <span fg="yellow" attributes={BOLD}>{`[${option.key}]`}</span>
              <span fg={index === selectedIndex ? "white" : "gray"}>{` ${option.label}`}</span>
              <span attributes={DIM}>{` — ${option.description}`}</span>
            </text>
          ))}
          <box marginTop={2}>
            <text attributes={DIM}>
              {phase === "format"
                ? "j/k navigate │ Enter or number to select │ Escape to cancel"
                : "j/k navigate │ Enter or number to select │ Escape to go back"}
            </text>
          </box>
        </box>
      )}
    </box>
  );
}
