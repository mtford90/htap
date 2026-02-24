Output demo.gif

Set Theme "Catppuccin Mocha"
Set FontSize 16
Set Width 1200
Set Height 700
Set Padding 20
Set TypingSpeed 40ms

# Launch TUI off-screen, wait for render and requests to stream in
Hide
Type "node dist/cli/index.js tui"
Enter
Sleep 2s
Show

# Follow mode — requests auto-scroll with green "Following" badge visible
Sleep 3s

# Exit follow — scroll down to break out of follow mode
Type "j"
Sleep 400ms
Type "j"
Sleep 400ms
Type "j"
Sleep 400ms
Type "j"
Sleep 400ms
Type "j"
Sleep 400ms

# Pause so the cyan "N new" count appears and grows
Sleep 2s

# Re-enter follow mode — snap back to latest with "Following" badge
Type "F"
Sleep 2s

# Switch to detail panel to inspect a request
Tab
Sleep 600ms

# Navigate to response section
Type "j"
Sleep 400ms
Type "j"
Sleep 400ms
Type "j"
Sleep 500ms

# Open JSON explorer on response body
Enter
Sleep 800ms

# Navigate and expand JSON tree
Type "j"
Sleep 300ms
Type "j"
Sleep 300ms
Type "l"
Sleep 400ms
Type "j"
Sleep 300ms
Type "j"
Sleep 300ms
Type "l"
Sleep 500ms

# Close JSON explorer
Escape
Sleep 500ms

# Back to request list
Type "1"
Sleep 500ms

# Show export menu
Type "e"
Sleep 1200ms
Escape
Sleep 500ms

# Open filter and search for POST requests
Type "/"
Sleep 300ms
Type "post"
Sleep 800ms
Enter
Sleep 800ms

# Clear filter
Type "/"
Sleep 300ms
Escape
Sleep 400ms

# Show help modal
Type "?"
Sleep 1500ms
Escape
Sleep 500ms

# Jump to top for a clean ending frame
Type "g"
Sleep 2s
