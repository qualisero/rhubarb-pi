# 🔔 Background Notify

Get notified when long-running tasks complete while your terminal is in the background.

## Features

- 🔔 Audio beep when tasks complete
- 🪟 Bring terminal to front automatically (macOS)
- ⏱️ Configurable duration threshold
- 🎛️ Per-session toggles
- ⏲️ Smart timing: excludes user interaction time

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
    "thresholdMs": 2000,
    "beep": true,
    "beepSound": "Tink",
    "bringToFront": true
  }
}
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `thresholdMs` | `2000` | Minimum task duration (ms) to trigger notification |
| `beep` | `true` | Play audio beep |
| `beepSound` | `"Tink"` | macOS system sound name |
| `bringToFront` | `true` | Bring terminal window to front |

## Commands

### `/notify` - Toggle Both On/Off

Toggles both beep and focus. If either is ON, turns both OFF. If both are OFF, turns both ON.

```
> /notify
🔔 Background notifications ON (beep + focus)

> /notify
🔕 Background notifications OFF
```

### `/notify-status` - Show Current Settings

```
> /notify-status
━━━ Background Notify Status ━━━

CURRENT SESSION (effective):
  Beep:     🔊 ON
  Focus:    🪟 ON
  Sound:    Tink

GLOBAL DEFAULTS (settings.json):
  Beep:      ON
  Focus:     ON
  Sound:     Tink
  Threshold: 2000ms

SESSION OVERRIDES:
  Beep:     (inheriting from global)
  Focus:    (inheriting from global)
  Sound:    (inheriting from global)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
🔊 Beep ON

> /notify-beep
🔇 Beep OFF
```

### `/notify-focus` - Toggle Bring-to-Front

```
> /notify-focus
🪟 Focus ON (bring terminal to front)

> /notify-focus
⬜ Focus OFF
```

### `/notify-config` - Configure Session Settings

Configure notification settings for the current session only. Changes affect only this session and are reset when you start a new session.

```
> /notify-config
━━━ Session Notify Configuration ━━━

CURRENT (effective):
  Beep: 🔊 ON  │  Focus: 🪟 ON  │  Sound: Tink

SESSION overrides:
  Beep: default  │  Focus: default  │  Sound: default
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Configure session notifications:
  🔊 Test current beep
  🎵 Tink (default) ✓
  🎵 Basso
  🎵 Glass
  ... [more sounds]
  ───────────────
  💾 Save session as global default
  🔄 Reset to global defaults
  📋 View terminal info
  ❌ Cancel
```

Options:
- **Test/Select beep sounds**: Try different system sounds for this session
- **Save session as global default**: Generate JSON to make current settings permanent
- **Reset to global defaults**: Clear all session overrides
- **View terminal info**: See terminal detection and capabilities

### `/notify-config-global` - Configure Global Defaults

Configure default notification settings that apply to all new sessions.

```
> /notify-config-global
━━━ Global Notify Configuration ━━━

CURRENT GLOBAL DEFAULTS:
  Beep: ON  │  Focus: ON  │  Sound: Tink  │  Threshold: 2000ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Configure global defaults:
  ⚙️  Set: Beep only
  ⚙️  Set: Focus only
  ⚙️  Set: Both
  ⚙️  Set: None
  ───────────────
  🔊 Change global beep sound:
  🎵 Tink (default) ✓
  🎵 Basso
  🎵 Glass
  ... [more sounds]
  ───────────────
  ❌ Cancel
```

Options:
- **Set notification modes**: Choose Beep only, Focus only, Both, or None
- **Change beep sound**: Preview and select a different system sound
- Provides the JSON to add to `~/.pi/agent/settings.json`

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
4. Updates tab title with emoji indicator whenever notification mode changes

## Troubleshooting

### No beep sound
- Check system volume is not muted
- Verify `"beep": true` in settings
- Test manually: `printf '\a'`

### Terminal not brought to front
- Only works on macOS
- Check macOS accessibility permissions for terminal app
- Verify terminal is in supported list

### Tab title not updating
- Most modern terminals support ANSI escape sequences
- If not working, try iTerm2 or another modern terminal
- Check that your shell prompt isn't overwriting the title

### Extension not loading
- Verify extension is at `~/.pi/agent/extensions/background-notify.ts`
- Restart pi completely
