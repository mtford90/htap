/**
 * Root TUI component for browsing captured HTTP traffic.
 */

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Box, Text, useInput, useApp, useStdin } from "ink";
import { MouseProvider, useOnClick, useOnWheel, useOnMouseEnter, useOnMouseLeave } from "@ink-tools/ink-mouse";
import { useStdoutDimensions } from "./hooks/useStdoutDimensions.js";
import { useRequests } from "./hooks/useRequests.js";
import { useExport } from "./hooks/useExport.js";
import { useSaveBinary, generateFilename } from "./hooks/useSaveBinary.js";
import { formatSize } from "./utils/formatters.js";
import { RequestList } from "./components/RequestList.js";
import {
  AccordionPanel,
  SECTION_REQUEST,
  SECTION_REQUEST_BODY,
  SECTION_RESPONSE,
  SECTION_RESPONSE_BODY,
  isSaveableBody,
} from "./components/AccordionPanel.js";
import { StatusBar } from "./components/StatusBar.js";
import { SaveModal, type SaveLocation } from "./components/SaveModal.js";

interface AppProps {
  /** Enable keyboard input in tests (bypasses TTY check) */
  __testEnableInput?: boolean;
}

type Panel = "list" | "accordion";

function AppContent({ __testEnableInput }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const [columns, rows] = useStdoutDimensions();

  const { requests, isLoading, error, refresh } = useRequests();
  const { exportCurl, exportHar } = useExport();
  const { saveBinary } = useSaveBinary();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activePanel, setActivePanel] = useState<Panel>("list");
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [showFullUrl, setShowFullUrl] = useState(false);
  const [hoveredPanel, setHoveredPanel] = useState<Panel | null>(null);
  const [listScrollOffset, setListScrollOffset] = useState(0);

  // Accordion state
  const [focusedSection, setFocusedSection] = useState(SECTION_REQUEST);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    () => new Set([SECTION_REQUEST, SECTION_RESPONSE_BODY]),
  );

  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savingBodyType, setSavingBodyType] = useState<"request" | "response" | null>(null);

  // Refs for mouse interaction
  const listPanelRef = useRef(null);
  const accordionPanelRef = useRef(null);

  // Get the currently selected request
  const selectedRequest = requests[selectedIndex];

  // Handle item click from the request list
  const handleItemClick = useCallback((index: number) => {
    setSelectedIndex(index);
    setActivePanel("list");
  }, []);

  // Toggle a section's expanded state
  const handleSectionToggle = useCallback((index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Handle scroll wheel on list panel - scrolls the view, not the selection
  useOnWheel(listPanelRef, (event) => {
    // Calculate visible height (accounting for border - 2 lines for top/bottom)
    const visibleHeight = Math.max(1, contentHeight - 2);
    const maxOffset = Math.max(0, requests.length - visibleHeight);
    if (event.button === "wheel-up") {
      setListScrollOffset((prev) => Math.max(prev - 1, 0));
    } else if (event.button === "wheel-down") {
      setListScrollOffset((prev) => Math.min(prev + 1, maxOffset));
    }
  });

  // Handle scroll wheel on accordion panel for navigating sections
  useOnWheel(accordionPanelRef, (event) => {
    if (event.button === "wheel-up") {
      setFocusedSection((prev) => Math.max(prev - 1, 0));
    } else if (event.button === "wheel-down") {
      setFocusedSection((prev) => Math.min(prev + 1, 3));
    }
  });

  // Handle click on panels to activate them
  useOnClick(listPanelRef, () => setActivePanel("list"));
  useOnClick(accordionPanelRef, () => setActivePanel("accordion"));

  // Handle hover on panels
  useOnMouseEnter(listPanelRef, () => setHoveredPanel("list"));
  useOnMouseLeave(listPanelRef, () => setHoveredPanel((prev) => (prev === "list" ? null : prev)));
  useOnMouseEnter(accordionPanelRef, () => setHoveredPanel("accordion"));
  useOnMouseLeave(accordionPanelRef, () => setHoveredPanel((prev) => (prev === "accordion" ? null : prev)));

  // Clear status message after a delay
  const showStatus = useCallback((message: string) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(undefined), 3000);
  }, []);

  // Determine if the currently focused body section is saveable (binary content)
  const currentBodyIsSaveable = useMemo(() => {
    if (!selectedRequest || activePanel !== "accordion") return false;

    if (focusedSection === SECTION_REQUEST_BODY) {
      return isSaveableBody(
        selectedRequest.requestBody,
        selectedRequest.requestHeaders["content-type"],
        selectedRequest.requestBodyTruncated
      );
    }
    if (focusedSection === SECTION_RESPONSE_BODY) {
      return isSaveableBody(
        selectedRequest.responseBody,
        selectedRequest.responseHeaders?.["content-type"],
        selectedRequest.responseBodyTruncated
      );
    }
    return false;
  }, [selectedRequest, activePanel, focusedSection]);

  // Handle save from modal
  const handleSave = useCallback(
    async (location: SaveLocation, customPath?: string) => {
      if (!selectedRequest || !savingBodyType) return;

      const isRequestBody = savingBodyType === "request";
      const body = isRequestBody ? selectedRequest.requestBody : selectedRequest.responseBody;
      const contentType = isRequestBody
        ? selectedRequest.requestHeaders["content-type"]
        : selectedRequest.responseHeaders?.["content-type"];

      if (!body) {
        showStatus("No body to save");
        setShowSaveModal(false);
        setSavingBodyType(null);
        return;
      }

      const result = await saveBinary(
        body,
        selectedRequest.id,
        contentType,
        selectedRequest.url,
        location,
        customPath
      );

      showStatus(result.success ? result.message : `Error: ${result.message}`);
      setShowSaveModal(false);
      setSavingBodyType(null);
    },
    [selectedRequest, savingBodyType, saveBinary, showStatus]
  );

  // Handle keyboard input (only when raw mode is supported, i.e. running in a TTY)
  useInput(
    (input, key) => {
      // Navigation - behaviour depends on active panel
      if (input === "j" || key.downArrow) {
        if (activePanel === "list") {
          setSelectedIndex((prev) => Math.min(prev + 1, requests.length - 1));
        } else {
          // Navigate sections in accordion
          setFocusedSection((prev) => Math.min(prev + 1, 3));
        }
      } else if (input === "k" || key.upArrow) {
        if (activePanel === "list") {
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else {
          // Navigate sections in accordion
          setFocusedSection((prev) => Math.max(prev - 1, 0));
        }
      } else if (key.tab) {
        // Tab cycles through all 5 panels: 1 (list), 2, 3, 4, 5 (accordion sections)
        if (key.shift) {
          // Shift+Tab cycles backwards
          if (activePanel === "accordion") {
            if (focusedSection > SECTION_REQUEST) {
              setFocusedSection((prev) => prev - 1);
            } else {
              setActivePanel("list");
            }
          } else {
            setActivePanel("accordion");
            setFocusedSection(SECTION_RESPONSE_BODY);
          }
        } else {
          // Tab cycles forwards
          if (activePanel === "list") {
            setActivePanel("accordion");
            setFocusedSection(SECTION_REQUEST);
          } else {
            // Cycle through accordion sections, then back to list
            if (focusedSection < SECTION_RESPONSE_BODY) {
              setFocusedSection((prev) => prev + 1);
            } else {
              setActivePanel("list");
            }
          }
        }
      } else if (input === "1") {
        setActivePanel("list");
      } else if (input === "2") {
        setActivePanel("accordion");
        setFocusedSection(SECTION_REQUEST);
      } else if (input === "3") {
        setActivePanel("accordion");
        setFocusedSection(SECTION_REQUEST_BODY);
      } else if (input === "4") {
        setActivePanel("accordion");
        setFocusedSection(SECTION_RESPONSE);
      } else if (input === "5") {
        setActivePanel("accordion");
        setFocusedSection(SECTION_RESPONSE_BODY);
      }

      // Toggle section expansion with Enter
      else if (key.return && activePanel === "accordion") {
        handleSectionToggle(focusedSection);
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
        const newShowFullUrl = !showFullUrl;
        setShowFullUrl(newShowFullUrl);
        showStatus(newShowFullUrl ? "Showing full URL" : "Showing path only");
      } else if (input === "s") {
        // Save binary content
        if (currentBodyIsSaveable) {
          setSavingBodyType(focusedSection === SECTION_REQUEST_BODY ? "request" : "response");
          setShowSaveModal(true);
        } else if (activePanel === "accordion" && (focusedSection === SECTION_REQUEST_BODY || focusedSection === SECTION_RESPONSE_BODY)) {
          showStatus("No binary content to save");
        }
      }
    },
    { isActive: (__testEnableInput || isRawModeSupported === true) && !showSaveModal },
  );

  // Calculate layout
  const listWidth = Math.floor(columns * 0.4);
  const accordionWidth = columns - listWidth;
  // Status bar takes 2 rows (border line + content line)
  const contentHeight = rows - 2;

  // Keep selection in bounds when requests change
  React.useEffect(() => {
    if (selectedIndex >= requests.length && requests.length > 0) {
      setSelectedIndex(requests.length - 1);
    }
  }, [requests.length, selectedIndex]);

  // Auto-scroll list view when selection moves outside visible area
  React.useEffect(() => {
    const visibleHeight = Math.max(1, contentHeight - 2);
    if (selectedIndex < listScrollOffset) {
      setListScrollOffset(selectedIndex);
    } else if (selectedIndex >= listScrollOffset + visibleHeight) {
      setListScrollOffset(selectedIndex - visibleHeight + 1);
    }
  }, [selectedIndex, contentHeight, listScrollOffset]);

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

  // Save modal - full screen replacement (terminals don't support true overlays)
  if (showSaveModal && selectedRequest && savingBodyType) {
    const isRequestBody = savingBodyType === "request";
    const body = isRequestBody ? selectedRequest.requestBody : selectedRequest.responseBody;
    const contentType = isRequestBody
      ? selectedRequest.requestHeaders["content-type"]
      : selectedRequest.responseHeaders?.["content-type"];
    const filename = generateFilename(selectedRequest.id, contentType, selectedRequest.url);
    const fileSize = formatSize(body?.length);

    return (
      <SaveModal
        filename={filename}
        fileSize={fileSize}
        width={columns}
        height={rows}
        onSave={(location, customPath) => void handleSave(location, customPath)}
        onClose={() => {
          setShowSaveModal(false);
          setSavingBodyType(null);
        }}
        isActive={__testEnableInput || isRawModeSupported === true}
      />
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
          scrollOffset={listScrollOffset}
        />
        <AccordionPanel
          ref={accordionPanelRef}
          request={selectedRequest}
          isActive={activePanel === "accordion"}
          width={accordionWidth}
          height={contentHeight}
          focusedSection={focusedSection}
          expandedSections={expandedSections}
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
