/**
 * Full-screen save dialog for binary content.
 *
 * Replaces the main TUI when active (terminals don't support true overlays).
 *
 * Provides three options:
 * [1] .htpx/exports/ - Project exports folder
 * [2] ~/Downloads/ - Downloads folder
 * [3] Custom path... - Text input
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

export type SaveLocation = "exports" | "downloads" | "custom";

export interface SaveModalProps {
  /** Filename being saved */
  filename: string;
  /** File size for display */
  fileSize: string;
  /** Screen width */
  width: number;
  /** Screen height */
  height: number;
  /** Called when user selects a location */
  onSave: (location: SaveLocation, customPath?: string) => void;
  /** Called when modal should close */
  onClose: () => void;
  /** Whether input is active (for testing) */
  isActive?: boolean;
}

interface Option {
  key: string;
  location: SaveLocation;
  label: string;
  description: string;
}

const OPTIONS: Option[] = [
  {
    key: "1",
    location: "exports",
    label: ".htpx/exports/",
    description: "Project exports folder",
  },
  {
    key: "2",
    location: "downloads",
    label: "~/Downloads/",
    description: "Downloads folder",
  },
  {
    key: "3",
    location: "custom",
    label: "Custom path...",
    description: "Enter a custom directory",
  },
];

export function SaveModal({
  filename,
  fileSize,
  width,
  height,
  onSave,
  onClose,
  isActive = true,
}: SaveModalProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customPath, setCustomPath] = useState("");

  useInput(
    (input, key) => {
      if (showCustomInput) {
        // Handle custom path input
        if (key.return) {
          if (customPath.trim()) {
            onSave("custom", customPath.trim());
          }
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

      // Handle option selection
      if (key.escape) {
        onClose();
      } else if (input === "j" || key.downArrow) {
        setSelectedIndex((prev) => Math.min(prev + 1, OPTIONS.length - 1));
      } else if (input === "k" || key.upArrow) {
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (input === "1") {
        onSave("exports");
      } else if (input === "2") {
        onSave("downloads");
      } else if (input === "3") {
        setShowCustomInput(true);
      } else if (key.return) {
        const option = OPTIONS[selectedIndex];
        if (option) {
          if (option.location === "custom") {
            setShowCustomInput(true);
          } else {
            onSave(option.location);
          }
        }
      }
    },
    { isActive }
  );

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
          Save Binary Content
        </Text>
      </Box>

      {/* File info */}
      <Box marginBottom={2}>
        <Text dimColor>
          {filename} ({fileSize})
        </Text>
      </Box>

      {showCustomInput ? (
        // Custom path input mode
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
        // Option selection mode
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Select save location:</Text>
          </Box>

          {OPTIONS.map((option, index) => (
            <Box key={option.key} marginLeft={2}>
              <Text color={index === selectedIndex ? "cyan" : undefined}>
                {index === selectedIndex ? "❯ " : "  "}
              </Text>
              <Text color="yellow" bold>
                [{option.key}]
              </Text>
              <Text color={index === selectedIndex ? "white" : "gray"}>
                {" "}
                {option.label}
              </Text>
              <Text dimColor> - {option.description}</Text>
            </Box>
          ))}

          <Box marginTop={2}>
            <Text dimColor>j/k navigate │ Enter or number to select │ Escape to cancel</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
