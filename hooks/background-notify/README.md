# Background Notify Extension

Notifies you when long-running tasks complete while your terminal is in the background.

## Installation

```bash
npm run install:global
```

This copies the extension to `~/.pi/agent/extensions/background-notify.ts`.

**Restart pi** to load the extension.

## Quick Start

```bash
/notify-beep      # Toggle beep (select sound when enabling)
/notify-focus     # Toggle bring-to-front
/notify-threshold # Set minimum task duration
/notify-status    # View current settings
/notify-save-global # Save settings
```

## Commands

### `/notify-beep`
Toggle beep with sound selection:
- If ON → turns OFF
- If OFF → shows sound menu, then turns ON

### `/notify-focus`  
Toggle bring-to-front: ON ⟷ OFF

### `/notify-threshold`
Set minimum task duration (1s, 2s, 3s, 5s, 10s)

### `/notify-status`
Show settings with emoji indicators:
```
╭─ Background Notify Status ─╮

Current (Effective):
  🔊 Beep: ON
  🪟 Focus: ON
  🎵 Sound: Hero
  ⏱️  Threshold: 2000ms

Global Defaults:
  🔊 Beep: ON
  🪟 Focus: ON
  🎵 Sound: Tink
  ⏱️  Threshold: 2000ms

💻 Terminal: iTerm.app
╰────────────────────────────╯
```

### `/notify-save-global`
Save current settings globally (persists across sessions)

## Configuration

Edit `~/.pi/agent/settings.json`:

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

## Available Beep Sounds (macOS)

Tink, Basso, Blow, Bottle, Frog, Funk, Glass, Hero, Morse, Ping, Pop, Purr, Sosumi, Submarine

## Examples

**Try different sounds:**
```bash
/notify-beep      # Select "Hero"
/notify-save-global
```

**Adjust threshold:**
```bash
/notify-threshold # Select 5000ms
/notify-save-global
```

**Check settings:**
```bash
/notify-status
```

## Supported Terminals (macOS)

Terminal.app, iTerm2, WezTerm, kitty, Ghostty

## Testing

```bash
# In pi:
"sleep 5 seconds then say hello"

# Switch to another app
# After 5s → beep + terminal comes to front
```

## License

MIT
