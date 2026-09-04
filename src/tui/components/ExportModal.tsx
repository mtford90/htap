/** @jsxImportSource @opentui/react */

/**
 * Destination picker for a captured body: clipboard, the project exports
 * folder, ~/Downloads, a custom directory, or the system's default viewer.
 * Every key comes from the command table; this only draws the choice.
 */

import React from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { BODY_EXPORT_OPTIONS } from "../export-options.js";
import type { TuiActions, TuiStore } from "../store/store.js";
import { CustomPathPrompt } from "./CustomPathPrompt.js";
import { attributes, BOLD, DIM } from "./styles.js";

export interface ExportModalProps {
  store: TuiStore;
  actions: TuiActions;
  filename: string;
  fileSize: string;
  isBinary: boolean;
  width: number;
  height: number;
}

export function ExportModal({
  store,
  actions,
  filename,
  fileSize,
  isBinary,
  width,
  height,
}: ExportModalProps): React.ReactNode {
  const { optionIndex, customPathOpen } = useStore(
    store,
    useShallow((state) => ({
      optionIndex: state.modals.export.optionIndex,
      customPathOpen: state.modals.export.customPathOpen,
    }))
  );

  return (
    <box
      flexDirection="column"
      width={width}
      height={height}
      alignItems="center"
      justifyContent="center"
    >
      <box marginBottom={1}>
        <text fg="cyan" attributes={BOLD}>
          Export Body Content
        </text>
      </box>
      <box marginBottom={2}>
        <text attributes={DIM}>{`${filename} (${fileSize})`}</text>
      </box>

      {customPathOpen ? (
        <CustomPathPrompt onChange={(path) => actions.patchExportView({ customPath: path })} />
      ) : (
        <box flexDirection="column">
          <box marginBottom={1}>
            <text>Select export action:</text>
          </box>
          {BODY_EXPORT_OPTIONS.map((option, index) => (
            <text key={option.key} marginLeft={2} wrapMode="none">
              <span fg={index === optionIndex ? "cyan" : undefined}>
                {index === optionIndex ? "❯ " : "  "}
              </span>
              <span fg="yellow" attributes={BOLD}>{`[${option.key}]`}</span>
              <span fg={index === optionIndex ? "white" : "gray"}>{` ${option.label}`}</span>
              <span attributes={DIM}>{` - ${option.description}`}</span>
              {option.action === "clipboard" && isBinary ? (
                <span attributes={attributes({ dim: true, italic: true })}>
                  {" (binary — will copy raw bytes)"}
                </span>
              ) : null}
            </text>
          ))}
          <box marginTop={2}>
            <text attributes={DIM}>
              j/k navigate │ Enter or number to select │ Escape to cancel
            </text>
          </box>
        </box>
      )}
    </box>
  );
}
