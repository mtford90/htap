import { Command } from "commander";

/**
 * Generate the shell function for htpx.
 * Maps the friendly `on`/`off` aliases to the underlying `vars` command
 * so that environment variables can be set in the current shell.
 */
export function generateShellFunction(): string {
  const lines = [
    "htpx() {",
    '  if [[ "$1" == "on" ]]; then',
    "    shift",
    '    eval "$(command htpx vars "$@")"',
    '  elif [[ "$1" == "off" ]]; then',
    "    shift",
    '    eval "$(command htpx vars --clear "$@")"',
    "  else",
    '    command htpx "$@"',
    "  fi",
    "}",
  ];
  return lines.join("\n");
}

export const initCommand = new Command("init")
  .description("Output shell wrapper function (enables htpx on/off to set env vars)")
  .action(() => {
    console.log(generateShellFunction());
  });
