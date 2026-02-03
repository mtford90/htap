import { Command } from "commander";
import { render } from "ink";
import React from "react";
import { App } from "../tui/App.js";

export const tuiCommand = new Command("tui")
  .description("Browse captured HTTP traffic")
  .option("-l, --label <label>", "Filter by session label")
  .option("--ci", "CI mode: render once and exit after a short delay (for testing)")
  .action((options: { label?: string; ci?: boolean }) => {
    const { waitUntilExit, unmount } = render(
      React.createElement(App, { label: options.label }),
    );

    // In CI mode, exit after a short delay to allow initial render
    if (options.ci) {
      setTimeout(() => {
        unmount();
      }, 500);
    }

    void waitUntilExit().then(() => {
      // Print curl command if one was exported
      const curl = (globalThis as Record<string, unknown>)["__htpxCurl"];
      if (typeof curl === "string") {
        console.log("\n--- Exported curl command ---\n");
        console.log(curl);
        console.log();
      }
    });
  });
