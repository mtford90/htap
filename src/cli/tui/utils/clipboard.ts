/**
 * Cross-platform clipboard utilities using native commands.
 */

import { spawn } from "node:child_process";

/**
 * Copy text to the system clipboard.
 * Uses pbcopy on macOS, xclip on Linux, clip on Windows.
 */
export async function copyToClipboard(text: string): Promise<void> {
  const platform = process.platform;

  let command: string;
  let args: string[];

  if (platform === "darwin") {
    command = "pbcopy";
    args = [];
  } else if (platform === "win32") {
    command = "clip";
    args = [];
  } else {
    // Linux - try xclip first, fall back to xsel
    command = "xclip";
    args = ["-selection", "clipboard"];
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ["pipe", "ignore", "ignore"] });

    proc.on("error", (err) => {
      if (platform === "linux" && command === "xclip") {
        // Try xsel as fallback
        const xsel = spawn("xsel", ["--clipboard", "--input"], {
          stdio: ["pipe", "ignore", "ignore"],
        });
        xsel.on("error", () =>
          reject(new Error("No clipboard tool available (tried xclip and xsel)"))
        );
        xsel.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`xsel exited with code ${code}`));
        });
        xsel.stdin.write(text);
        xsel.stdin.end();
      } else {
        reject(err);
      }
    });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });

    proc.stdin.write(text);
    proc.stdin.end();
  });
}
