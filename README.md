# 🥧 Rhubarb Pi

A collection of small hooks and extensions for the [pi coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Hooks

| Hook | Description | Install |
|------|-------------|---------|
| [🔔 background-notify](#-background-notify) | Get notified when long tasks complete | `npm run install:background-notify` |
| [🎨 session-emoji](#-session-emoji) | AI-powered emoji in your footer | `npm run install:session-emoji` |
| [🌈 session-color](#-session-color) | Colored band to distinguish sessions | `npm run install:session-color` |

---

### 🔔 background-notify

Get notified when long-running tasks complete while your terminal is in the background.

- Audio beep when tasks complete
- Automatically bring terminal to front (macOS)
- Configurable duration threshold
- Session controls via `/notify`, `/notify-test`, `/notify-config`

**Install:**
```bash
npm run install:background-notify
```

**Uninstall:**
```bash
npm run uninstall:background-notify
```

**Configuration** (`~/.pi/agent/settings.json`):
```json
{
  "backgroundNotify": {
    "enabledByDefault": false,
    "thresholdMs": 2000,
    "beep": true,
    "bringToFront": true
  }
}
```

**Commands:**
- `/notify` - Toggle notifications on/off
- `/notify-test` - Test notification (3 second delay)
- `/notify-beep` - Toggle beep sound
- `/notify-focus` - Toggle bring-to-front
- `/notify-config` - Interactive configuration

[📖 Full Documentation](hooks/background-notify/README.md)

---

### 🎨 session-emoji

Display an intelligent emoji in pi's footer that represents your conversation.

- 🤖 AI-powered contextual emoji selection
- 🔄 24-hour uniqueness across sessions
- 🎯 Manual selection with `/emoji-set`
- Multiple emoji sets (default, animals, tech, fun)

**Install:**
```bash
npm run install:session-emoji
```

**Uninstall:**
```bash
npm run uninstall:session-emoji
```

**Configuration** (`~/.pi/agent/settings.json`):
```json
{
  "sessionEmoji": {
    "enabledByDefault": true,
    "autoAssignMode": "ai",
    "autoAssignThreshold": 3
  }
}
```

**Commands:**
- `/emoji` - Toggle on/off for this session
- `/emoji-set` - Set emoji (direct or from description)
- `/emoji-config` - View settings and configure
- `/emoji-history` - View 24h usage history

[📖 Full Documentation](hooks/session-emoji/README.md)

---

### 🌈 session-color

Display a colored band in pi's footer to visually distinguish sessions.

- 🎨 40 distinct colors maximizing visual difference
- 🔄 Sequential cycling through palette
- 👁️ Each color distinct from recent sessions
- ⚙️ Customizable block character

**Install:**
```bash
npm run install:session-color
```

**Uninstall:**
```bash
npm run uninstall:session-color
```

**Configuration** (`~/.pi/agent/settings.json`):
```json
{
  "sessionColor": {
    "enabledByDefault": true,
    "blockChar": "█",
    "blockCount": "full"
  }
}
```

**Commands:**
- `/color` - Toggle on/off for this session
- `/color-set` - Set specific color by index
- `/color-next` - Skip to next color
- `/color-config` - View settings and palette

[📖 Full Documentation](hooks/session-color/README.md)

---

## Quick Start

### Install all hooks

```bash
npm run install:all
```

### Install a single hook

```bash
npm run install:background-notify
npm run install:session-emoji
npm run install:session-color
```

### Restart required

After installing any hook, **restart pi** for it to be loaded.

---

## Uninstall

```bash
# Remove all hooks
npm run uninstall:all

# Remove individual hooks
npm run uninstall:background-notify
npm run uninstall:session-emoji
npm run uninstall:session-color
```

---

## Requirements

- [pi coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) v0.30.0+
- Node.js 18+
- macOS (for background-notify terminal activation)

---

## Contributing

To add a new hook:

1. Create `hooks/<hook-name>/` with `index.ts`, `README.md`, `package.json`
2. Add install/uninstall scripts to root `package.json`
3. Update this README
4. Submit a PR

---

## License

MIT
