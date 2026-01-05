# Pi Hook: Background Notify

A pi coding agent hook that notifies you when long-running tasks complete while your terminal is in the background.

## Features

- 🔔 **Audio beep** when tasks complete
- 🪟 **Bring terminal to front** automatically
- ⏱️ **Configurable threshold** - only notify for tasks longer than X milliseconds
- 🍎 **macOS support** - uses AppleScript and lsappinfo for window management

## Installation

### Global (all projects)

```bash
npm run install:global
```

This copies the hook to `~/.pi/agent/hooks/background-notify.ts` where it will be auto-discovered.

### Project-local

```bash
npm run install:project
```

This copies the hook to `.pi/hooks/background-notify.ts` for the current project only.

### Important: Restart Required

After installing, you **must restart pi** for the hook to be loaded. Hooks are discovered at startup.

## Configuration

Add to `~/.pi/agent/settings.json`:

```json
{
  "backgroundNotify": {
    "enabledByDefault": false,
    "thresholdMs": 5000,
    "beep": true,
    "bringToFront": true
  }
}
```

### Options

- `enabledByDefault` - Enable/disable for new sessions by default (default: `false`)
- `thresholdMs` - Minimum task duration in milliseconds to trigger notification (default: `5000`)
- `beep` - Play audio beep (default: `true`)
- `bringToFront` - Bring terminal window to front (default: `true`)

### Per-Session Control

Notifications are **disabled by default**. You can enable them for the current session:

- Use `/notify` to toggle notifications on/off for this session
- Use `/notify-enable` to enable for this session
- Use `/notify-disable` to disable for this session

Session overrides are temporary and reset when you start a new session.

## Slash Commands

The hook provides commands for session control, testing, and configuration:

### Session Control Commands

Quick commands to control notifications for the current session:

#### `/notify` - Toggle Notifications
Toggles background notifications on/off for this session:
```
> /notify
🔔 Background notifications enabled
(Temporary for this session)

💡 Use /notify-test to test it

> /notify
🔕 Background notifications disabled
(Temporary for this session)
```

#### `/notify-beep` - Toggle Beep Sound
Toggles beep notification on/off for this session:
```
> /notify-beep
🔊 Beep notifications enabled
(Temporary for this session)

> /notify-beep
🔇 Beep notifications disabled
(Temporary for this session)
```

#### `/notify-focus` - Toggle Bring-to-Front
Toggles window bring-to-front on/off for this session:
```
> /notify-focus
🪟 Bring-to-front enabled
(Temporary for this session)

> /notify-focus
⬜ Bring-to-front disabled
(Temporary for this session)
```

#### `/notify-enable` - Enable for Session
Enables background notifications for this session only:
```
> /notify-enable
✓ Background notifications ENABLED for this session
(This setting is temporary and will reset when you start a new session)
```

#### `/notify-disable` - Disable for Session
Disables background notifications for this session only:
```
> /notify-disable
✗ Background notifications DISABLED for this session
(This setting is temporary and will reset when you start a new session)
```

### `/notify-config` - Interactive Configuration

Opens a menu with options:
- **Enable for this session** - Enable notifications temporarily
- **Disable for this session** - Disable notifications temporarily
- **Toggle beep on/off** - Enable/disable sound notification
- **Toggle bring-to-front on/off** - Enable/disable window activation
- **Set duration threshold** - Configure minimum task duration
- **Test notification now** - Trigger test beep + bring-to-front
- **View current settings** - Show active configuration
- **View detected terminal info** - Show terminal detection details

```
> /notify-config
Background Notify Configuration
  1. Enable for this session
  2. Disable for this session
  3. Toggle beep on/off
  4. Toggle bring-to-front on/off
  5. Set duration threshold
  6. Test notification now
  7. View current settings
  8. View detected terminal info
  9. Cancel
```

### `/notify-test` - Quick Test

Triggers a test notification after 3 seconds:

```
> /notify-test
🧪 Testing notification in 3 seconds...
💡 Tip: Switch to another app to see it in action!
[3 seconds pass]
✅ Test complete! Triggered: beep + bring-to-front
```

### `/notify-status` - Show Status

Displays comprehensive status information including session state:

```
> /notify-status
📊 Background Notify Status

Session State:
  Enabled: 🔔 yes (session override)
  Beep: 🔊 on (global default)
  Focus: 🪟 on (session override)

Global Defaults:
  Enabled: no
  Beep: on
  Focus: on
  Threshold: 2000ms (2.0s)

Terminal Detection:
  App: com.googlecode.iterm2
  PID: 12345
  TTY: /dev/ttys001
  Platform: darwin

Capabilities:
  Beep support: ✓ Yes
  Bring-to-front: ✓ Yes

Commands: /notify /notify-beep /notify-focus /notify-test /notify-config
```

**Tips:**
- Use `/notify` to quickly toggle notifications on/off
- Use `/notify-beep` and `/notify-focus` to fine-tune behavior
- Use `/notify-enable` or `/notify-disable` for explicit control
- Use `/notify-test` to verify your setup works correctly
- Commands show the JSON to add to `settings.json` for persistence
- Test beep plays immediately when toggling beep on
- Switch to another app before `/notify-test` to see bring-to-front in action
- Session overrides are cleared when you restart or start a new session
- Notifications are **disabled by default** - use `/notify` to enable per session

## How It Works

1. **Detects long-running tasks** - Measures time between `agent_start` and `agent_end` events
2. **Checks if terminal is backgrounded** - Uses macOS `lsappinfo` to check if terminal is the frontmost app
3. **Notifies if both conditions met** - Beeps and/or brings terminal to front

## Debugging

The hook includes extensive debug logging. To see diagnostic output:

1. Make sure the hook is installed at `~/.pi/agent/hooks/background-notify.ts`
2. Restart pi
3. Run a command that takes longer than your threshold
4. Check console output for `[background-notify]` messages

Debug output includes:
- Hook loading confirmation
- Terminal detection (PID, bundle ID)
- Event timing (agent_start, agent_end)
- Duration and threshold comparison
- Background detection results
- Beep execution status
- Window activation attempts

## Troubleshooting

### Hook not loading

**Problem:** No `[background-notify]` debug output appears

**Solutions:**
- Verify hook is at `~/.pi/agent/hooks/background-notify.ts` (not in a subdirectory)
- Restart pi completely
- Check `~/.pi/agent/settings.json` doesn't have `"enabledByDefault": false` (unless intended)

### Hook disabled for session

**Problem:** Notifications not working in current session

**Solutions:**
- Check if you've disabled it with `/notify-disable`
- Use `/notify-status` to see current session state
- Use `/notify` or `/notify-enable` to enable for this session

### No beep sound

**Problem:** Hook runs but no beep is heard

**Solutions:**
- Check system volume is not muted
- Verify `"beep": true` in settings
- Check debug output for beep execution errors
- Test beep manually: `printf '\a'`

### Terminal not brought to front

**Problem:** Hook runs but terminal stays in background

**Solutions:**
- Only works on macOS currently
- Check debug output for terminal app detection
- Verify terminal app is in the supported list (Terminal, iTerm2, WezTerm, kitty, Ghostty)
- Check macOS accessibility permissions for the terminal app

### Hook runs when terminal is in foreground

**Problem:** Notification happens even when watching the terminal

**Solutions:**
- This is expected behavior during testing
- The background detection only prevents notification if terminal is frontmost
- If you're actively using the terminal, you'll see notifications
- To test properly, switch to another app during the sleep command

## Supported Terminals (macOS)

- Terminal.app
- iTerm2
- WezTerm
- kitty
- Ghostty

Other terminals may work but are untested.

## Development

### Testing

```bash
npm test
```

Or manually:
1. Install the hook globally
2. Restart pi
3. Ask pi to "sleep 10 seconds then say hello"
4. Switch to another application during the sleep
5. You should hear a beep and the terminal should come to front

### Contributing

When modifying the hook:
1. Edit `index.ts`
2. Run `npm run install:global` to update the installed copy
3. Restart pi to load the changes

## License

MIT
