/**
 * Carries out the destination the body-export modal chose.
 */

import type { CapturedRequest } from "../shared/types.js";
import type { BodyType } from "./store/types.js";
import type { ExportAction } from "./components/ExportModal.js";
import { generateFilename, saveBodyContent } from "./hooks/useBodyExport.js";
import { isBinaryContent } from "./utils/binary.js";
import { copyToClipboard } from "./utils/clipboard.js";
import { openInExternalApp } from "./utils/open-external.js";

export interface ExportBodyOptions {
  request: CapturedRequest;
  bodyType: BodyType;
  action: ExportAction;
  customPath?: string;
  showStatus: (message: string) => void;
}

const selectBody = (
  request: CapturedRequest,
  bodyType: BodyType
): { body: Buffer | undefined; contentType: string | undefined } =>
  bodyType === "request"
    ? { body: request.requestBody, contentType: request.requestHeaders["content-type"] }
    : { body: request.responseBody, contentType: request.responseHeaders?.["content-type"] };

const reportResult = (
  showStatus: (message: string) => void,
  result: { success: boolean; message: string }
): void => showStatus(result.success ? result.message : `Error: ${result.message}`);

export const exportBody = ({
  request,
  bodyType,
  action,
  customPath,
  showStatus,
}: ExportBodyOptions): void => {
  const { body, contentType } = selectBody(request, bodyType);
  if (!body) {
    showStatus("No body to export");
    return;
  }

  if (action === "clipboard") {
    if (isBinaryContent(body, contentType).isBinary) {
      showStatus("Cannot copy binary content to clipboard — use a file export option");
      return;
    }
    void copyToClipboard(body.toString("utf-8")).then(
      () => showStatus("Body copied to clipboard"),
      () => showStatus("Failed to copy to clipboard")
    );
    return;
  }

  const filename = generateFilename(request.id, contentType, request.url);

  if (action === "open-external") {
    void openInExternalApp(body, filename).then((result) => reportResult(showStatus, result));
    return;
  }

  void saveBodyContent(body, filename, action, customPath).then((result) =>
    reportResult(showStatus, result)
  );
};
