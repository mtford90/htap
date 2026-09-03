/** @jsxImportSource @opentui/react */

/**
 * Renders whichever modal the store says is open. Modals replace the main view
 * rather than overlaying it, matching how the TUI has always behaved.
 */

import React from "react";
import type { CapturedRequest } from "../../shared/types.js";
import type { Modal } from "../store/types.js";
import type { ExportResult } from "../hooks/useExport.js";
import { generateFilename } from "../hooks/useBodyExport.js";
import { isBinaryContent } from "../utils/binary.js";
import { formatSize } from "../utils/formatters.js";
import { ExportModal, type ExportAction } from "./ExportModal.js";
import { FormatExportModal } from "./FormatExportModal.js";
import { HelpModal } from "./HelpModal.js";
import { InterceptorLogModal } from "./InterceptorLogModal.js";
import { JsonExplorerModal } from "./JsonExplorerModal.js";
import { TextViewerModal } from "./TextViewerModal.js";
import type { InterceptorEvent } from "../../shared/types.js";

export interface ModalHostProps {
  modal: Modal;
  request: CapturedRequest | null;
  events: InterceptorEvent[];
  proxyPort?: number;
  caCertPath: string;
  width: number;
  height: number;
  onClose: () => void;
  onStatus: (message: string) => void;
  onExportBody: (action: ExportAction, customPath?: string) => void;
}

/** The body a body-export modal is acting on, with its display metadata. */
const bodyForExport = (
  request: CapturedRequest,
  bodyType: "request" | "response"
): { body: Buffer | undefined; contentType: string | undefined } =>
  bodyType === "request"
    ? { body: request.requestBody, contentType: request.requestHeaders["content-type"] }
    : { body: request.responseBody, contentType: request.responseHeaders?.["content-type"] };

export function ModalHost({
  modal,
  request,
  events,
  proxyPort,
  caCertPath,
  width,
  height,
  onClose,
  onStatus,
  onExportBody,
}: ModalHostProps): React.ReactNode {
  if (modal.kind === "help") {
    return (
      <HelpModal
        width={width}
        height={height}
        onClose={onClose}
        proxyPort={proxyPort}
        caCertPath={caCertPath}
      />
    );
  }

  if (modal.kind === "interceptorLog") {
    return (
      <InterceptorLogModal events={events} width={width} height={height} onClose={onClose} />
    );
  }

  if (modal.kind === "json") {
    return (
      <JsonExplorerModal
        data={modal.data}
        title={modal.title}
        contentType={modal.contentType}
        bodySize={modal.bodySize}
        width={width}
        height={height}
        onClose={onClose}
        onStatus={onStatus}
      />
    );
  }

  if (modal.kind === "text") {
    return (
      <TextViewerModal
        text={modal.text}
        title={modal.title}
        contentType={modal.contentType}
        bodySize={modal.bodySize}
        width={width}
        height={height}
        onClose={onClose}
        onStatus={onStatus}
      />
    );
  }

  if (!request) {
    return null;
  }

  if (modal.kind === "formatExport") {
    return (
      <FormatExportModal
        request={request}
        width={width}
        height={height}
        onComplete={(result: ExportResult) => {
          onClose();
          onStatus(result.success ? result.message : `Error: ${result.message}`);
        }}
        onClose={onClose}
      />
    );
  }

  const { body, contentType } = bodyForExport(request, modal.bodyType);
  return (
    <ExportModal
      filename={generateFilename(request.id, contentType, request.url)}
      fileSize={formatSize(body?.length)}
      isBinary={isBinaryContent(body, contentType).isBinary}
      width={width}
      height={height}
      onExport={onExportBody}
      onClose={onClose}
    />
  );
}
