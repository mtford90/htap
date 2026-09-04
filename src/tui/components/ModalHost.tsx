/** @jsxImportSource @opentui/react */

/**
 * Renders whichever modal the store says is open. Modals replace the main view
 * rather than overlaying it, matching how the TUI has always behaved.
 */

import React from "react";
import type { CapturedRequest, InterceptorEvent } from "../../shared/types.js";
import type { TuiActions, TuiStore } from "../store/store.js";
import type { Modal } from "../store/types.js";
import { generateFilename } from "../hooks/useBodyExport.js";
import { isBinaryContent } from "../utils/binary.js";
import { formatSize } from "../utils/formatters.js";
import { ExportModal } from "./ExportModal.js";
import { FormatExportModal } from "./FormatExportModal.js";
import { HelpModal } from "./HelpModal.js";
import { InterceptorLogModal } from "./InterceptorLogModal.js";
import { JsonExplorerModal } from "./JsonExplorerModal.js";
import { TextViewerModal } from "./TextViewerModal.js";

export interface ModalHostProps {
  store: TuiStore;
  actions: TuiActions;
  modal: Modal;
  request: CapturedRequest | null;
  events: InterceptorEvent[];
  proxyPort?: number;
  caCertPath: string;
  width: number;
  height: number;
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
  store,
  actions,
  modal,
  request,
  events,
  proxyPort,
  caCertPath,
  width,
  height,
}: ModalHostProps): React.ReactNode {
  if (modal.kind === "help") {
    return (
      <HelpModal width={width} height={height} proxyPort={proxyPort} caCertPath={caCertPath} />
    );
  }

  if (modal.kind === "interceptorLog") {
    return (
      <InterceptorLogModal
        store={store}
        actions={actions}
        events={events}
        width={width}
        height={height}
      />
    );
  }

  if (modal.kind === "json") {
    return (
      <JsonExplorerModal
        store={store}
        actions={actions}
        data={modal.data}
        title={modal.title}
        contentType={modal.contentType}
        bodySize={modal.bodySize}
        width={width}
        height={height}
      />
    );
  }

  if (modal.kind === "text") {
    return (
      <TextViewerModal
        store={store}
        actions={actions}
        text={modal.text}
        title={modal.title}
        contentType={modal.contentType}
        bodySize={modal.bodySize}
        width={width}
        height={height}
      />
    );
  }

  if (!request) {
    return null;
  }

  if (modal.kind === "formatExport") {
    return (
      <FormatExportModal
        store={store}
        actions={actions}
        request={request}
        width={width}
        height={height}
      />
    );
  }

  const { body, contentType } = bodyForExport(request, modal.bodyType);
  return (
    <ExportModal
      store={store}
      actions={actions}
      filename={generateFilename(request.id, contentType, request.url)}
      fileSize={formatSize(body?.length)}
      isBinary={isBinaryContent(body, contentType).isBinary}
      width={width}
      height={height}
    />
  );
}
