# Background Notify Extension

Notifies you when long-running tasks complete while your terminal is in the background.

## Features

- 🔊 **Audio beep** with customizable macOS system sounds
- 🪟 **Bring terminal to front** automatically
- ⏱️ **Configurable threshold** - only notify for tasks longer than specified duration
- 💾 **Persistent settings** - save preferences globally
- 🎯 **Session overrides** - temporary changes without affecting global defaults

## Installation

### Global Installation

```bash
cd rhubarb-pi
npm run install:background-notify
```

Installs to `~/.pi/agent/extensions/background-notify.ts`

**Restart pi** to load the extension.

## Quick Start

```bash
# Check current settings
/notify-status

# Toggle beep (select sound when turning on)
/notify-beep

# Toggle focus (bring terminal to front)
/notify-focus

# Set threshold
/notify-threshold

# Save settings globally
/notify-save-global
```

## Commands

### `/notify-beep`
Toggle beep notification with smart behavior:
- **If beep is ON** → Turns it OFF
- **If beep is OFF** → Shows sound selector, then turns ON

```bash
/notify-beep
# If OFF, shows menu:
#   🔊 Use current sound
#   ───
#   🎵 Tink
#   🎵 Basso
#   🎵 Hero ✓
#   🎵 Submarine
#   ...
```

**Available sounds (macOS):**  
Tink, Basso, Blow, Bottle, Frog, Funk, Glass, Hero, Morse, Ping, Pop, Purr, Sosumi, Submarine

### `/notify-focus`
Toggle bring-to-front behavior:

```bash
/notify-focus
🪟 Focus ON

/notify-focus
⬜ Focus OFF
```

### `/notify-threshold`
Set minimum task duration for notifications:

```bash
/notify-threshold
# Shows menu:
#   1000ms (1s)
#   2000ms (2s) ✓
#   3000ms (3s)
#   5000ms (5s)
#   10000ms (10s)
```

### `/notify-status`
Show current settings with visual indicators:

```bash
/notify-status

╭─ Background Notify Status ─╮

Current (Effective):
  🔊 Beep: ON
  ⬜ Focus: OFF
  🎵 Sound: Hero
  ⏱️  Threshold: 2000ms

Global Defaults:
  🔊 Beep: ON
  🪟 Focus: ON
  🎵 Sound: Tink
  ⏱️  Threshold: 2000ms

Session Overrides:
  ⬜ Focus: OFF
  🎵 Sound: Hero

💻 Terminal: iTerm.app
╰────────────────────────────╯
```

**Emoji indicators:**
- 🔊/🔇 = Beep enabled/disabled
- 🪟/⬜ = Focus enabled/disabled
- 🎵 = Sound name
- ⏱️ = Threshold

### `/notify-save-global`
Save current settings as global defaults:

```bash
/notify-save-global
✅ Settings saved to ~/.pi/agent/settings.json
  🔊 Beep: ON
  ⬜ Focus: OFF
  🎵 Sound: Hero
  ⏱️  Threshold: 3000ms
```

Settings persist across pi sessions automatically.

## Configuration

Settings are stored in `~/.pi/agent/settings.json`:

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

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `thresholdMs` | number | 2000 | Minimum task duration (ms) to trigger notification |
| `beep` | boolean | true | Enable audio notification |
| `beepSound` | string | "Tink" | macOS system sound name |
| `bringToFront` | boolean | true | Bring terminal window to front |

## How It Works

1. **Monitors agent activity** - Tracks time between tool executions
2. **Detects background state** - Uses macOS `lsappinfo` to check if terminal is frontmost
3. **Triggers notification** - If task duration exceeds threshold AND terminal is in background

## Typical Workflow

### Initial Setup

```bash
# 1. Configure beep sound
/notify-beep
# → Select "Hero"

# 2. Disable focus if you prefer
/notify-focus

# 3. Set threshold to 3 seconds
/notify-threshold
# → Select 3000ms

# 4. Save globally
/notify-save-global
```

### Daily Use

```bash
# Temporarily disable beep
/notify-beep

# Check status
/notify-status

# Re-enable with same sound
/notify-beep
# → Select "Use current sound"
```

## Supported Terminals (macOS)

- Terminal.app
- iTerm2
- WezTerm
- kitty
- Ghostty

## Examples

### Try different sounds

```bash
/notify-beep      # Turn off if on
/notify-beep      # Select "Submarine"
# Test it with a long task...
/notify-beep      # Turn off
/notify-beep      # Select "Hero"
# Found one you like?
/notify-save-global
```

### Adjust for longer tasks

```bash
/notify-threshold
# Select 5000ms (5s)
/notify-save-global
# Now only tasks >5s trigger notifications
```

### Quiet mode (no beep)

```bash
/notify-beep      # Disable beep
# Focus still works if enabled
```

## Troubleshooting

### No notification appears

Check settings:
```bash
/notify-status
```

Ensure:
- At least one notification method is ON (beep or focus)
- Task duration exceeds threshold
- Terminal was actually in background during task

### Terminal doesn't come to front

- Only works on macOS
- Check terminal app is detected: `/notify-status` → Terminal line
- Verify macOS accessibility permissions for terminal app

### Wrong beep sound

```bash
/notify-beep      # Turn off
/notify-beep      # Select correct sound
/notify-save-global
```

## Testing

Run a long task and switch to another app:

```bash
# In pi, ask:
"sleep 5 seconds then say hello"

# Immediately switch to another application
# After 5 seconds, you should:
#   - Hear a beep (if enabled)
#   - Terminal comes to front (if enabled)
```

## Technical Details

### Settings Loading

The extension reads settings directly from `~/.pi/agent/settings.json` to bypass pi's Settings interface limitations, ensuring custom extension settings persist correctly.

### Session Overrides

Commands like `/notify-beep` and `/notify-focus` create temporary overrides that don't affect global settings until you run `/notify-save-global`.

### Threshold Behavior

Only the **active working time** counts toward the threshold - time spent waiting for user input is excluded.

## License

MIT
