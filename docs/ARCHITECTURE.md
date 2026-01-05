# Architecture

## Event Flow

```
User Prompt
    │
    ▼
agent_start (hook captures start time)
    │
    ▼
Agent processes task...
    │
    ▼
agent_end (hook checks conditions)
    │
    ├─► Duration >= threshold? ──NO──► Do nothing
    │                 │
    │                YES
    │                 │
    ├─► Terminal in background? ──NO──► Do nothing
    │                 │
    │                YES
    │                 │
    ├─► beep enabled? ──YES──► printf '\a'
    │
    ├─► bringToFront enabled? ──YES──► osascript activate
    │
    └─► Show UI notification
```

## Detection Strategy

### Terminal Background Detection (macOS)

```
1. Get frontmost app:
   lsappinfo front
   → Returns ASN (Application Serial Number)

2. Get bundle ID of frontmost app:
   lsappinfo info -only bundleID <ASN>
   → Returns: "CFBundleIdentifier"="com.example.app"

3. Compare with terminal bundle ID:
   - Detected from $TERM_PROGRAM
   - Or from parent process PID
   - Or fallback to common terminal IDs

4. Result:
   If frontmost != terminal → Background
   If frontmost == terminal → Foreground
```

### Bringing Terminal to Front

```
1. Map bundle ID to app name:
   com.apple.Terminal → "Terminal"
   com.googlecode.iterm2 → "iTerm2"
   etc.

2. Use AppleScript:
   tell application "Terminal"
     activate
   end tell

3. Terminal comes to front with correct window/tab
```

## Configuration Flow

```
Hook loads
    │
    ▼
Read settings from settingsManager
    │
    ├─► backgroundNotify.enabled (default: true)
    ├─► backgroundNotify.thresholdMs (default: 5000)
    ├─► backgroundNotify.beep (default: true)
    └─► backgroundNotify.bringToFront (default: true)
    │
    ▼
On each agent_end:
    Check config → Apply actions
```

## State Management

```typescript
// Hook maintains minimal state:
{
  startTime: number | undefined,      // Set on agent_start, cleared on agent_end
  terminalPid: number | undefined,    // Detected on session_start
  terminalApp: string | undefined     // Detected on session_start
}
```

## Error Handling

All operations fail silently to avoid disrupting pi:

- Terminal detection fails → Feature disabled
- lsappinfo errors → Assume foreground
- osascript errors → No bring-to-front
- printf '\a' errors → No beep

This ensures the hook never breaks pi functionality.

## Performance

- **Overhead**: Negligible (only runs on agent_end)
- **I/O Operations**:
  - 1× lsappinfo call per agent_end (if threshold met)
  - 1× osascript call per notification
- **Memory**: < 1KB state
- **CPU**: < 1ms per check

## Platform-Specific Implementation

### macOS ✅
- Uses `lsappinfo` for detection
- Uses AppleScript for activation
- System beep via `printf '\a'`

### Linux (Future)
- X11: `xdotool` or `wmctrl`
- Wayland: `swaymsg` or similar
- System beep: `printf '\a'` or `paplay`

### Windows (Future)
- PowerShell: `Get-Process` with `MainWindowHandle`
- Activation: `Set-ForegroundWindow`
- System beep: `[console]::beep()`
