/**
 * Root TUI component for browsing captured HTTP traffic.
 */

import React, { useState, useCallback, useRef } from "react";
import { Box, Text, useInput, useApp, useStdin } from "ink";
import { MouseProvider, useOnClick, useOnWheel, useOnMouseEnter, useOnMouseLeave } from "@ink-tools/ink-mouse";
import { useStdoutDimensions } from "./hooks/useStdoutDimensions.js";
import { useRequests } from "./hooks/useRequests.js";
import { useExport } from "./hooks/useExport.js";
import { RequestList } from "./components/RequestList.js";
import { RequestDetails } from "./components/RequestDetails.js";
import { StatusBar } from "./components/StatusBar.js";

interface AppProps {
  /** Enable keyboard input in tests (bypasses TTY check) */
  __testEnableInput?: boolean;
}

type Panel = "list" | "details";

function AppContent({ __testEnableInput }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const [columns, rows] = useStdoutDimensions();

  const { requests, isLoading, error, refresh } = useRequests();
  const { exportCurl, exportHar } = useExport();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activePanel, setActivePanel] = useState<Panel>("list");
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [showFullUrl, setShowFullUrl] = useState(false);
  const [hoveredPanel, setHoveredPanel] = useState<Panel | null>(null);

  // Refs for mouse interaction
  const listPanelRef = useRef(null);
  const detailsPanelRef = useRef(null);

  // Get the currently selected request
  const selectedRequest = requests[selectedIndex];

  // Handle item click from the request list
  const handleItemClick = useCallback((index: number) => {
    setSelectedIndex(index);
    setActivePanel("list");
  }, []);

  // Handle scroll wheel on list panel
  useOnWheel(listPanelRef, (event) => {
    if (event.button === "wheel-up") {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.button === "wheel-down") {
      setSelectedIndex((prev) => Math.min(prev + 1, requests.length - 1));
    }
  });

  // Handle click on panels to activate them
  useOnClick(listPanelRef, () => setActivePanel("list"));
  useOnClick(detailsPanelRef, () => setActivePanel("details"));

  // Handle hover on panels
  useOnMouseEnter(listPanelRef, () => setHoveredPanel("list"));
  useOnMouseLeave(listPanelRef, () => setHoveredPanel((prev) => (prev === "list" ? null : prev)));
  useOnMouseEnter(detailsPanelRef, () => setHoveredPanel("details"));
  useOnMouseLeave(detailsPanelRef, () => setHoveredPanel((prev) => (prev === "details" ? null : prev)));

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
      } else if (input === "1") {
        setActivePanel("list");
      } else if (input === "2") {
        setActivePanel("details");
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
  const detailsWidth = columns - listWidth;
  // Status bar takes 2 rows (border line + content line)
  const contentHeight = rows - 2;

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
      {/* Main content */}
      <Box flexDirection="row" height={contentHeight}>
        <RequestList
          ref={listPanelRef}
          requests={requests}
          selectedIndex={selectedIndex}
          isActive={activePanel === "list"}
          isHovered={hoveredPanel === "list"}
          width={listWidth}
          height={contentHeight}
          showFullUrl={showFullUrl}
          onItemClick={handleItemClick}
        />
        <RequestDetails
          ref={detailsPanelRef}
          request={selectedRequest}
          isActive={activePanel === "details"}
          isHovered={hoveredPanel === "details"}
          width={detailsWidth}
          height={contentHeight}
        />
      </Box>

      {/* Status bar */}
      <StatusBar message={statusMessage} />
    </Box>
  );
}

export function App(props: AppProps): React.ReactElement {
  return (
    <MouseProvider>
      <AppContent {...props} />
    </MouseProvider>
  );
}
