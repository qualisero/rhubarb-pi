# 🔔 Background Notify

Get notified when long-running tasks complete while your terminal is in the background.

## Features

- 🔔 Audio beep when tasks complete
- 🪟 Bring terminal to front automatically (macOS)
- ⏱️ Configurable duration threshold
- 🎛️ Per-session toggles

## Installation

```bash
npm run install:background-notify
```

Restart pi after installing.

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

| Option | Default | Description |
|--------|---------|-------------|
| `enabledByDefault` | `false` | Enable for new sessions by default |
| `thresholdMs` | `5000` | Minimum task duration (ms) to trigger notification |
| `beep` | `true` | Play audio beep |
| `bringToFront` | `true` | Bring terminal window to front |

## Commands

### `/notify` - Toggle On/Off

```
> /notify
🔔 Background notifications enabled

> /notify
🔕 Background notifications disabled
```

### `/notify-test` - Test Notification

Triggers a test notification after 3 seconds:

```
> /notify-test
🧪 Testing notification in 3 seconds...
💡 Tip: Switch to another app to see it in action!
```

### `/notify-beep` - Toggle Beep

```
> /notify-beep
🔊 Beep notifications enabled

> /notify-beep
🔇 Beep notifications disabled
```

### `/notify-focus` - Toggle Bring-to-Front

```
> /notify-focus
🪟 Bring-to-front enabled

> /notify-focus
⬜ Bring-to-front disabled
```

### `/notify-config` - Interactive Configuration

Opens a menu with all options:

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

### `/notify-status` - Show Status

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
  Threshold: 5000ms (5.0s)
```

## Supported Terminals (macOS)

- Terminal.app
- iTerm2
- WezTerm
- kitty
- Ghostty

## How It Works

1. Measures time between `agent_start` and `agent_end` events
2. Checks if terminal is backgrounded (macOS `lsappinfo`)
3. Notifies if task exceeded threshold and terminal is in background

## Troubleshooting

### No beep sound
- Check system volume is not muted
- Verify `"beep": true` in settings
- Test manually: `printf '\a'`

### Terminal not brought to front
- Only works on macOS
- Check macOS accessibility permissions for terminal app
- Verify terminal is in supported list

### Hook not loading
- Verify hook is at `~/.pi/agent/hooks/background-notify.ts`
- Restart pi completely
