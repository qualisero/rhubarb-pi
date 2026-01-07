# Background Notify - Future Improvements

## Terminal Bell Character Integration

### Idea
Use the system bell character (`\a`) in addition to or instead of `afplay` for audio notifications.

### Benefits
- **Native iTerm2 integration**: iTerm2 automatically shows a visual indicator (🔔) in the tab when bell character is received
- **Auto-clearing**: The indicator disappears when you switch to that tab
- **macOS notifications**: Can trigger system notifications if enabled in iTerm2 preferences
- **Universal support**: Works in most terminal emulators, not just iTerm2
- **Lightweight**: No need to spawn external process (`afplay`)

### Implementation Considerations
- Add configuration option: `useTerminalBell: boolean` (default: true)
- Could use bell character instead of `afplay`, or in addition to it
- Terminal bell respects system "Alert volume" setting
- Some users may have terminal bell disabled in their terminal preferences

### Example
```typescript
if (config.useTerminalBell) {
  process.stdout.write('\x07'); // Bell character
}
if (config.beep) {
  playBeep(beepSound); // macOS system sound
}
```

### Trade-offs
- **Pro**: Better terminal integration, visual feedback
- **Pro**: More universal (works on Linux, Windows)
- **Con**: Users who have disabled terminal bell won't hear it
- **Con**: Can't select different system sounds (always uses terminal bell sound)

### Suggested Configuration
```json
{
  "backgroundNotify": {
    "beep": true,           // Play macOS system sound
    "useTerminalBell": true, // Also send bell character for visual indicator
    "beepSound": "Tink",
    "bringToFront": true,
    "thresholdMs": 2000
  }
}
```
