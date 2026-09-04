# httap TUI walkthrough — re-record after TUI changes with:
#   pnpm build && vhs examples/demo/demo.tape
# Run from the repository root. Requires dist/cli/index.js to be built.

Output docs/demo.gif
Output docs/demo.mp4

Set Shell "bash"
Set Theme "Catppuccin Mocha"
Set FontSize 16
Set Width 1500
Set Height 900
Set Padding 20
Set TypingSpeed 40ms

# Reset to a clean, deterministic starting point.
Hide
Type "node dist/cli/index.js --dir examples/demo daemon stop >/dev/null 2>&1; node dist/cli/index.js --dir examples/demo requests clear --yes >/dev/null 2>&1; clear"
Enter
Sleep 500ms
Show

# --- Start the proxy ---
Type 'eval "$(node dist/cli/index.js --dir examples/demo on -l demo)"'
Enter
Sleep 1.5s
Type "node dist/cli/index.js --dir examples/demo status"
Enter
Sleep 4s

# Start the traffic generator in the background and let the first burst land.
Hide
Type "node examples/demo/app/traffic.mjs > /tmp/httap-demo-traffic.log 2>&1 &"
Enter
Sleep 3s
Type "clear"
Enter
Sleep 300ms
Show

# --- Open the TUI ---
Type "node dist/cli/index.js --dir examples/demo tui"
Enter
Sleep 4s

# Live traffic arriving — follow mode auto-tracks the newest request.
Sleep 10s

# Keyboard navigation — exit follow mode, watch the "N new" counter grow.
Type "j"
Sleep 500ms
Type "j"
Sleep 500ms
Type "j"
Sleep 500ms
Type "j"
Sleep 500ms
Sleep 3.5s

# Half-page scroll through the list.
Ctrl+d
Sleep 700ms
Ctrl+u
Sleep 1.2s

# Bookmark the current request.
Type "b"
Sleep 1.2s

# Resize panels.
Type "["
Sleep 700ms
Type "]"
Sleep 700ms
Type "="
Sleep 700ms

# Snap back to the newest request.
Type "F"
Sleep 1.5s

# Filter — live search as you type.
Type "/"
Sleep 400ms
Type "post"
Sleep 1s
Enter
Sleep 2s

# Clear it.
Type "/"
Sleep 300ms
Backspace 4
Sleep 300ms
Enter
Sleep 800ms

# Filter to a specific endpoint so the JSON explorer always shows the same
# shape of data, then open its response body.
Type "/"
Sleep 400ms
Type "report"
Sleep 1s
Enter
Sleep 1.5s
Type "g"
Sleep 1.2s

Tab
Sleep 700ms
Type "5"
Sleep 800ms
Enter
Sleep 1.5s
Type "j"
Sleep 400ms
Type "j"
Sleep 400ms
Type "l"
Sleep 800ms
Type "j"
Sleep 400ms
Type "l"
Sleep 1.3s
Escape
Sleep 900ms
Type "1"
Sleep 500ms

# Clear the filter to show the full list again.
Type "/"
Sleep 300ms
Backspace 6
Sleep 300ms
Enter
Sleep 800ms

# Interceptor event log — see the mock and modify interceptors at work.
Type "L"
Sleep 3.5s
Escape
Sleep 600ms

# Export menu.
Type "e"
Sleep 2s
Escape
Sleep 600ms

# Back to the top, re-entering follow mode, for a clean ending frame.
Type "g"
Sleep 4s

Type "q"
Sleep 500ms

# Tear down.
Hide
Type "kill %1 >/dev/null 2>&1; node dist/cli/index.js --dir examples/demo daemon stop >/dev/null 2>&1"
Enter
Sleep 500ms
