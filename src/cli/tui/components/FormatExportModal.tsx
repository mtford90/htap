/**
 * Two-phase export modal for captured requests.
 *
 * Phase 1 — Format selection: cURL, Fetch, Python, HTTPie (clipboard), or HAR (file).
 * Phase 2 — HAR destination picker: .htap/exports/, ~/Downloads/, or custom path.
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { CapturedRequest } from "../../../shared/types.js";
import { exportFormatToClipboard, exportHarToDir, type ExportResult } from "../hooks/useExport.js";
import { resolveTargetDir } from "../hooks/useBodyExport.js";

export interface FormatExportModalProps {
  request: CapturedRequest;
  width: number;
  height: number;
  onComplete: (result: ExportResult) => void;
  onClose: () => void;
  isActive?: boolean;
}

type Phase = "format" | "destination";

interface FormatOption {
  key: string;
  label: string;
  description: string;
}

const FORMAT_OPTIONS: FormatOption[] = [
  { key: "1", label: "cURL", description: "Copy to clipboard" },
  { key: "2", label: "Fetch", description: "Copy to clipboard" },
  { key: "3", label: "Python", description: "Copy to clipboard" },
  { key: "4", label: "HTTPie", description: "Copy to clipboard" },
  { key: "5", label: "HAR", description: "Save to file..." },
];

interface DestinationOption {
  key: string;
  label: string;
  description: string;
}

const DESTINATION_OPTIONS: DestinationOption[] = [
  { key: "1", label: ".htap/exports/", description: "Project exports folder" },
  { key: "2", label: "~/Downloads/", description: "Downloads folder" },
  { key: "3", label: "Custom path...", description: "Enter a custom directory" },
];

const FORMAT_KEY_MAP: Record<string, "curl" | "fetch" | "python" | "httpie"> = {
  "1": "curl",
  "2": "fetch",
  "3": "python",
  "4": "httpie",
};

/** Truncate a URL for display if it exceeds maxLen. */
function truncateUrl(url: string, maxLen: number): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 1) + "\u2026";
}

export function FormatExportModal({
  request,
  width,
  height,
  onComplete,
  onClose,
  isActive = true,
}: FormatExportModalProps): React.ReactElement {
  const [phase, setPhase] = useState<Phase>("format");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customPath, setCustomPath] = useState("");

  const currentOptions = phase === "format" ? FORMAT_OPTIONS : DESTINATION_OPTIONS;

  const handleFormatSelect = (index: number) => {
    if (index < 4) {
      // Clipboard formats
      const format = FORMAT_KEY_MAP[String(index + 1)];
      if (format) {
        void exportFormatToClipboard(request, format).then(onComplete);
      }
    } else {
      // HAR — go to destination picker
      setPhase("destination");
      setSelectedIndex(0);
    }
  };

  const handleDestinationSelect = (index: number) => {
    if (index === 2) {
      // Custom path
      setShowCustomInput(true);
      return;
    }

    const locationMap = ["exports", "downloads"] as const;
    const location = locationMap[index];
    if (location) {
      try {
        const targetDir = resolveTargetDir(location);
        const result = exportHarToDir([request], targetDir);
        onComplete(result);
      } catch (err) {
        onComplete({
          success: false,
          message: err instanceof Error ? err.message : "Failed to export HAR",
        });
      }
    }
  };

  const handleCustomPathSubmit = () => {
    const trimmed = customPath.trim();
    if (!trimmed) return;

    try {
      const targetDir = resolveTargetDir("custom", trimmed);
      const result = exportHarToDir([request], targetDir);
      onComplete(result);
    } catch (err) {
      onComplete({
        success: false,
        message: err instanceof Error ? err.message : "Failed to export HAR",
      });
    }
  };

  useInput(
    (input, key) => {
      // Custom path text input mode
      if (showCustomInput) {
        if (key.return) {
          handleCustomPathSubmit();
        } else if (key.backspace || key.delete) {
          setCustomPath((prev) => prev.slice(0, -1));
        } else if (key.escape) {
          setShowCustomInput(false);
          setCustomPath("");
        } else if (input && !key.ctrl && !key.meta) {
          setCustomPath((prev) => prev + input);
        }
        return;
      }

      if (key.escape) {
        if (phase === "destination") {
          // Go back to format selection
          setPhase("format");
          setSelectedIndex(4); // Re-select HAR option
        } else {
          onClose();
        }
        return;
      }

      // j/k navigation
      if (input === "j" || key.downArrow) {
        setSelectedIndex((prev) => Math.min(prev + 1, currentOptions.length - 1));
      } else if (input === "k" || key.upArrow) {
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (key.return) {
        // Select current option
        if (phase === "format") {
          handleFormatSelect(selectedIndex);
        } else {
          handleDestinationSelect(selectedIndex);
        }
      } else {
        // Number key shortcuts
        const num = parseInt(input, 10);
        if (num >= 1 && num <= currentOptions.length) {
          if (phase === "format") {
            handleFormatSelect(num - 1);
          } else {
            handleDestinationSelect(num - 1);
          }
        }
      }
    },
    { isActive },
  );

  const statusLine = `${request.method} ${truncateUrl(request.url, 50)}${request.responseStatus ? ` (${request.responseStatus})` : ""}`;

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      alignItems="center"
      justifyContent="center"
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          {phase === "format" ? "Export Request" : "Export as HAR"}
        </Text>
      </Box>

      {/* Request summary */}
      <Box marginBottom={2}>
        <Text dimColor>{statusLine}</Text>
      </Box>

      {showCustomInput ? (
        <Box flexDirection="column" alignItems="center">
          <Text>Enter directory path:</Text>
          <Box marginTop={1}>
            <Text color="cyan">&gt; </Text>
            <Text>{customPath}</Text>
            <Text color="cyan">_</Text>
          </Box>
          <Box marginTop={2}>
            <Text dimColor>Enter to save, Escape to go back</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>
              {phase === "format" ? "Select export format:" : "Select destination:"}
            </Text>
          </Box>

          {currentOptions.map((option, index) => (
            <Box key={option.key} marginLeft={2}>
              <Text color={index === selectedIndex ? "cyan" : undefined}>
                {index === selectedIndex ? "\u276F " : "  "}
              </Text>
              <Text color="yellow" bold>
                [{option.key}]
              </Text>
              <Text color={index === selectedIndex ? "white" : "gray"}>
                {" "}{option.label}
              </Text>
              <Text dimColor> — {option.description}</Text>
            </Box>
          ))}

          <Box marginTop={2}>
            <Text dimColor>
              {phase === "format"
                ? "j/k navigate \u2502 Enter or number to select \u2502 Escape to cancel"
                : "j/k navigate \u2502 Enter or number to select \u2502 Escape to go back"}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
