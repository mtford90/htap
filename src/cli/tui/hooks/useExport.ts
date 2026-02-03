/**
 * Hook for exporting captured requests to various formats.
 */

import { useCallback } from "react";
import * as fs from "node:fs";
import * as path from "node:path";
import type { CapturedRequest } from "../../../shared/types.js";
import { generateCurl } from "../utils/curl.js";
import { generateHarString } from "../utils/har.js";

interface ExportResult {
  success: boolean;
  message: string;
}

interface UseExportResult {
  exportCurl: (request: CapturedRequest) => ExportResult;
  exportHar: (requests: CapturedRequest[], filename?: string) => ExportResult;
}

/**
 * Hook providing export functionality for captured requests.
 */
export function useExport(): UseExportResult {
  /**
   * Generate curl command for a request.
   * Returns the curl string to be displayed/copied.
   */
  const exportCurl = useCallback((request: CapturedRequest): ExportResult => {
    try {
      const curl = generateCurl(request);
      return {
        success: true,
        message: curl,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Failed to generate curl",
      };
    }
  }, []);

  /**
   * Export requests to HAR file.
   */
  const exportHar = useCallback(
    (requests: CapturedRequest[], filename?: string): ExportResult => {
      try {
        const harFilename = filename ?? `htpx-export-${Date.now()}.har`;
        const harPath = path.resolve(process.cwd(), harFilename);
        const harContent = generateHarString(requests);

        fs.writeFileSync(harPath, harContent, "utf-8");

        return {
          success: true,
          message: `Exported ${requests.length} request(s) to ${harPath}`,
        };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : "Failed to export HAR",
        };
      }
    },
    []
  );

  return {
    exportCurl,
    exportHar,
  };
}
