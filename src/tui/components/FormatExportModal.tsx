/** @jsxImportSource @opentui/react */

/**
 * Two-phase export of a whole request: pick a format, and for HAR also pick
 * where the file goes. Every key comes from the command table.
 */

import React from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { CapturedRequest } from "../../shared/types.js";
import { DESTINATION_OPTIONS, FORMAT_OPTIONS } from "../export-options.js";
import type { TuiActions, TuiStore } from "../store/store.js";
import { CustomPathPrompt } from "./CustomPathPrompt.js";
import { BOLD, DIM } from "./styles.js";

const MAX_URL_LENGTH = 50;

const truncateUrl = (url: string): string =>
  url.length <= MAX_URL_LENGTH ? url : `${url.slice(0, MAX_URL_LENGTH - 1)}…`;

export interface FormatExportModalProps {
  store: TuiStore;
  actions: TuiActions;
  request: CapturedRequest;
  width: number;
  height: number;
}

export function FormatExportModal({
  store,
  actions,
  request,
  width,
  height,
}: FormatExportModalProps): React.ReactNode {
  const { optionIndex, phase, customPathOpen } = useStore(
    store,
    useShallow((state) => ({
      optionIndex: state.modals.export.optionIndex,
      phase: state.modals.export.phase,
      customPathOpen: state.modals.export.customPathOpen,
    }))
  );

  const options = phase === "format" ? FORMAT_OPTIONS : DESTINATION_OPTIONS;
  const statusLine = `${request.method} ${truncateUrl(request.url)}${
    request.responseStatus ? ` (${request.responseStatus})` : ""
  }`;

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
          {phase === "format" ? "Export Request" : "Export as HAR"}
        </text>
      </box>
      <box marginBottom={2}>
        <text attributes={DIM}>{statusLine}</text>
      </box>

      {customPathOpen ? (
        <CustomPathPrompt onChange={(path) => actions.patchExportView({ customPath: path })} />
      ) : (
        <box flexDirection="column">
          <box marginBottom={1}>
            <text>{phase === "format" ? "Select export format:" : "Select destination:"}</text>
          </box>
          {options.map((option, index) => (
            <text key={option.key} marginLeft={2} wrapMode="none">
              <span fg={index === optionIndex ? "cyan" : undefined}>
                {index === optionIndex ? "❯ " : "  "}
              </span>
              <span fg="yellow" attributes={BOLD}>{`[${option.key}]`}</span>
              <span fg={index === optionIndex ? "white" : "gray"}>{` ${option.label}`}</span>
              <span attributes={DIM}>{` — ${option.description}`}</span>
            </text>
          ))}
          <box marginTop={2}>
            <text attributes={DIM}>
              {phase === "format"
                ? "j/k navigate │ Enter or number to select │ Escape to cancel"
                : "j/k navigate │ Enter or number to select │ Escape to go back"}
            </text>
          </box>
        </box>
      )}
    </box>
  );
}
