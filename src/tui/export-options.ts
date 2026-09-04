/**
 * The option lists behind the two export pickers.
 *
 * They live outside the components so the command table can act on a choice
 * and the modals only have to draw it.
 */

export type ExportAction = "clipboard" | "exports" | "downloads" | "custom" | "open-external";

export interface ExportOption {
  key: string;
  label: string;
  description: string;
}

interface BodyExportOption extends ExportOption {
  action: ExportAction;
}

export const BODY_EXPORT_OPTIONS: readonly BodyExportOption[] = [
  {
    key: "1",
    action: "clipboard",
    label: "Copy to clipboard",
    description: "Copy body text to clipboard",
  },
  { key: "2", action: "exports", label: ".httap/exports/", description: "Project exports folder" },
  { key: "3", action: "downloads", label: "~/Downloads/", description: "Downloads folder" },
  { key: "4", action: "custom", label: "Custom path...", description: "Enter a custom directory" },
  {
    key: "5",
    action: "open-external",
    label: "Open externally",
    description: "Open in default app",
  },
];

export const FORMAT_OPTIONS: readonly ExportOption[] = [
  { key: "1", label: "cURL", description: "Copy to clipboard" },
  { key: "2", label: "Fetch", description: "Copy to clipboard" },
  { key: "3", label: "Python", description: "Copy to clipboard" },
  { key: "4", label: "HTTPie", description: "Copy to clipboard" },
  { key: "5", label: "HAR", description: "Save to file..." },
];

export const DESTINATION_OPTIONS: readonly ExportOption[] = [
  { key: "1", label: ".httap/exports/", description: "Project exports folder" },
  { key: "2", label: "~/Downloads/", description: "Downloads folder" },
  { key: "3", label: "Custom path...", description: "Enter a custom directory" },
];

export const CLIPBOARD_FORMATS = ["curl", "fetch", "python", "httpie"] as const;
export const HAR_OPTION_INDEX = 4;
export const CUSTOM_DESTINATION_INDEX = 2;
