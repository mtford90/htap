/**
 * Root TUI component for browsing captured HTTP traffic.
 */

import React, { useState, useCallback } from "react";
import { Box, Text, useInput, useApp, useStdin } from "ink";
import { useStdoutDimensions } from "./hooks/useStdoutDimensions.js";
import { useRequests } from "./hooks/useRequests.js";
import { useExport } from "./hooks/useExport.js";
import { RequestList } from "./components/RequestList.js";
import { RequestDetails } from "./components/RequestDetails.js";
import { StatusBar } from "./components/StatusBar.js";

interface AppProps {
  label?: string;
  /** Enable keyboard input in tests (bypasses TTY check) */
  __testEnableInput?: boolean;
}

type Panel = "list" | "details";

export function App({ label, __testEnableInput }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const [columns, rows] = useStdoutDimensions();

  const { requests, isLoading, error, refresh } = useRequests({ label });
  const { exportCurl, exportHar } = useExport();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activePanel, setActivePanel] = useState<Panel>("list");
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [showFullUrl, setShowFullUrl] = useState(false);

  // Get the currently selected request
  const selectedRequest = requests[selectedIndex];

  // Clear status message after a delay
  const showStatus = useCallback((message: string) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(undefined), 3000);
  }, []);

  // Handle keyboard input (only when raw mode is supported, i.e. running in a TTY)
  useInput(
    (input, key) => {
      // Navigation
      if (input === "j" || key.downArrow) {
        setSelectedIndex((prev) => Math.min(prev + 1, requests.length - 1));
      } else if (input === "k" || key.upArrow) {
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (key.tab) {
        setActivePanel((prev) => (prev === "list" ? "details" : "list"));
      }

      // Actions
      else if (input === "q") {
        exit();
      } else if (input === "r") {
        void refresh();
        showStatus("Refreshing...");
      } else if (input === "c") {
        if (selectedRequest) {
          void exportCurl(selectedRequest).then((result) => {
            showStatus(result.success ? result.message : `Error: ${result.message}`);
          });
        } else {
          showStatus("No request selected");
        }
      } else if (input === "h") {
        if (requests.length > 0) {
          const result = exportHar(requests);
          showStatus(result.success ? result.message : `Error: ${result.message}`);
        } else {
          showStatus("No requests to export");
        }
      } else if (input === "u") {
        setShowFullUrl((prev) => !prev);
        showStatus(showFullUrl ? "Showing path" : "Showing full URL");
      }
    },
    { isActive: __testEnableInput || isRawModeSupported === true },
  );

  // Keep selection in bounds when requests change
  React.useEffect(() => {
    if (selectedIndex >= requests.length && requests.length > 0) {
      setSelectedIndex(requests.length - 1);
    }
  }, [requests.length, selectedIndex]);

  // Calculate layout
  const listWidth = Math.floor(columns * 0.4);
  const contentHeight = rows - 3; // Leave room for status bar

  // Loading state
  if (isLoading && requests.length === 0) {
    return (
      <Box flexDirection="column" height={rows}>
        <Box flexGrow={1} alignItems="center" justifyContent="center">
          <Text>Loading...</Text>
        </Box>
        <StatusBar />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box flexDirection="column" height={rows}>
        <Box flexGrow={1} alignItems="center" justifyContent="center">
          <Text color="red">Error: {error}</Text>
        </Box>
        <StatusBar message="Press 'q' to quit, 'r' to retry" />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={rows}>
      {/* Header */}
      <Box paddingX={1}>
        <Text bold color="cyan">
          htpx
        </Text>
        {label && (
          <>
            <Text> │ </Text>
            <Text dimColor>label: </Text>
            <Text color="yellow">{label}</Text>
          </>
        )}
      </Box>

      {/* Main content */}
      <Box flexDirection="row" flexGrow={1}>
        <RequestList
          requests={requests}
          selectedIndex={selectedIndex}
          isActive={activePanel === "list"}
          width={listWidth}
          height={contentHeight}
          showFullUrl={showFullUrl}
        />
        <RequestDetails
          request={selectedRequest}
          isActive={activePanel === "details"}
          height={contentHeight}
        />
      </Box>

      {/* Status bar */}
      <StatusBar message={statusMessage} />
    </Box>
  );
}
