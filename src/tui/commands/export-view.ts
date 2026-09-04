/**
 * Keyboard commands of the two export pickers and their custom-path prompt.
 */

import type { Mode, TuiState } from "../store/types.js";
import {
  BODY_EXPORT_OPTIONS,
  CLIPBOARD_FORMATS,
  CUSTOM_DESTINATION_INDEX,
  DESTINATION_OPTIONS,
  FORMAT_OPTIONS,
  HAR_OPTION_INDEX,
  type ExportOption,
} from "../export-options.js";
import { exportBody } from "../export-body.js";
import { exportFormatToClipboard, exportHarToDir, type ExportResult } from "../hooks/useExport.js";
import { resolveTargetDir } from "../hooks/useBodyExport.js";
import type { Command, CommandContext } from "./types.js";

const PICKER: readonly Mode[] = ["bodyExport", "formatExport"];
const PATH: readonly Mode[] = ["exportPath"];
const NUMBER_KEYS = ["1", "2", "3", "4", "5"] as const;

/** The list the picker is currently showing. */
const exportOptions = (state: TuiState): readonly ExportOption[] => {
  if (state.ui.modal?.kind === "bodyExport") {
    return BODY_EXPORT_OPTIONS;
  }
  return state.modals.export.phase === "format" ? FORMAT_OPTIONS : DESTINATION_OPTIONS;
};

const complete = (context: CommandContext, result: ExportResult): void => {
  context.actions.closeModal();
  context.actions.flashStatus(result.success ? result.message : `Error: ${result.message}`);
};

/** Both the directory resolution and the write can throw on a bad path. */
const exportHar = (
  context: CommandContext,
  location: "exports" | "downloads" | "custom",
  customDir?: string
): void => {
  const request = context.state.detail.request;
  if (!request) {
    return;
  }
  try {
    complete(context, exportHarToDir([request], resolveTargetDir(location, customDir)));
  } catch (error) {
    complete(context, {
      success: false,
      message: error instanceof Error ? error.message : "Failed to export HAR",
    });
  }
};

const runBodyExport = (context: CommandContext, index: number, customPath?: string): void => {
  const request = context.state.detail.request;
  const modal = context.state.ui.modal;
  const option = BODY_EXPORT_OPTIONS[index];
  if (!request || modal?.kind !== "bodyExport" || !option) {
    return;
  }
  context.actions.closeModal();
  exportBody({
    request,
    bodyType: modal.bodyType,
    action: option.action,
    customPath,
    showStatus: context.actions.flashStatus,
  });
};

const chooseFormat = (context: CommandContext, index: number): void => {
  if (index === HAR_OPTION_INDEX) {
    context.actions.patchExportView({ phase: "destination", optionIndex: 0 });
    return;
  }
  const format = CLIPBOARD_FORMATS[index];
  const request = context.state.detail.request;
  if (format && request) {
    void exportFormatToClipboard(request, format).then((result) => complete(context, result));
  }
};

const chooseDestination = (context: CommandContext, index: number): void => {
  if (index === CUSTOM_DESTINATION_INDEX) {
    context.actions.patchExportView({ customPathOpen: true, customPath: "" });
    return;
  }
  const location = (["exports", "downloads"] as const)[index];
  if (location) {
    exportHar(context, location);
  }
};

const choose = (context: CommandContext, index: number): void => {
  if (context.state.ui.modal?.kind === "bodyExport") {
    if (BODY_EXPORT_OPTIONS[index]?.action === "custom") {
      context.actions.patchExportView({ customPathOpen: true, customPath: "" });
      return;
    }
    runBodyExport(context, index);
    return;
  }
  if (context.state.modals.export.phase === "format") {
    chooseFormat(context, index);
    return;
  }
  chooseDestination(context, index);
};

const moveOption = (context: CommandContext, delta: number): void => {
  const last = exportOptions(context.state).length - 1;
  const next = Math.min(Math.max(context.state.modals.export.optionIndex + delta, 0), last);
  context.actions.patchExportView({ optionIndex: next });
};

export const EXPORT_VIEW_COMMANDS: readonly Command[] = [
  {
    id: "export.down",
    keys: ["j", "down"],
    modes: PICKER,
    run: (context) => moveOption(context, 1),
  },
  { id: "export.up", keys: ["k", "up"], modes: PICKER, run: (context) => moveOption(context, -1) },
  {
    id: "export.choose",
    keys: ["return"],
    modes: PICKER,
    run: (context) => choose(context, context.state.modals.export.optionIndex),
  },
  {
    id: "export.chooseNumbered",
    keys: NUMBER_KEYS,
    modes: PICKER,
    run: (context) => {
      const index = NUMBER_KEYS.findIndex((digit) => digit === context.key.sequence);
      if (index !== -1 && index < exportOptions(context.state).length) {
        choose(context, index);
      }
    },
  },
  {
    id: "export.close",
    keys: ["escape"],
    modes: PICKER,
    run: (context) => {
      if (
        context.state.ui.modal?.kind === "formatExport" &&
        context.state.modals.export.phase === "destination"
      ) {
        context.actions.patchExportView({ phase: "format", optionIndex: HAR_OPTION_INDEX });
        return;
      }
      context.actions.closeModal();
    },
  },
  {
    id: "exportPath.cancel",
    keys: ["escape"],
    modes: PATH,
    run: (context) => context.actions.patchExportView({ customPathOpen: false, customPath: "" }),
  },
  {
    id: "exportPath.submit",
    keys: ["return"],
    modes: PATH,
    run: (context) => {
      const trimmed = context.state.modals.export.customPath.trim();
      if (!trimmed) {
        return;
      }
      if (context.state.ui.modal?.kind === "bodyExport") {
        runBodyExport(
          context,
          BODY_EXPORT_OPTIONS.findIndex((option) => option.action === "custom"),
          trimmed
        );
        return;
      }
      exportHar(context, "custom", trimmed);
    },
  },
];
