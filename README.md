# 🥧 Rhubarb Pi

A collection of small hooks and extensions for the [pi coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Hooks

Hooks add features via lifecycle events (session start, agent end, etc).

| Hook | Description | Install |
|------|-------------|---------|
| [🔔 background-notify](#-background-notify) | Get notified when long tasks complete | `npm run install:background-notify` |
| [🎨 session-emoji](#-session-emoji) | AI-powered emoji in your footer | `npm run install:session-emoji` |
| [🌈 session-color](#-session-color) | Colored band to distinguish sessions | `npm run install:session-color` |

## Extensions

Extensions intercept and modify tool behavior (like bash commands).

| Extension | Description | Install |
|-----------|-------------|---------|
| [🔒 safe-git](#-safe-git) | Require approval for git operations | `npm run install:safe-git` |

---

## Hooks

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

## Extensions

### 🔒 safe-git

Require explicit user approval before dangerous git operations.

- 🔴 High risk: force push, hard reset, clean, delete branch
- 🟡 Medium risk: push, commit, rebase, merge, tag
- Blocks entirely in non-interactive mode (fail-safe)

**Install:**
```bash
npm run install:safe-git
```

**Uninstall:**
```bash
npm run uninstall:safe-git
```

**Behavior:**
```
🟡 Git push requires approval

The agent wants to run:

  git push origin main

Allow this operation?
[Yes] [No]
```

[📖 Full Documentation](extensions/safe-git/README.md)

---

## Quick Start

### Install everything

```bash
npm run install:all
```

### Install all hooks

```bash
npm run install:all-hooks
```

### Install all extensions

```bash
npm run install:all-extensions
```

### Install individually

```bash
# Hooks
npm run install:background-notify
npm run install:session-emoji
npm run install:session-color

# Extensions
npm run install:safe-git
```

### Restart required

After installing any hook or extension, **restart pi** for it to be loaded.

---

## Uninstall

```bash
# Remove everything
npm run uninstall:all

# Remove all hooks
npm run uninstall:all-hooks

# Remove all extensions
npm run uninstall:all-extensions

# Remove individually
npm run uninstall:background-notify
npm run uninstall:session-emoji
npm run uninstall:session-color
npm run uninstall:safe-git
```

---

## Requirements

- [pi coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) v0.30.0+
- Node.js 18+
- macOS (for background-notify terminal activation)

---

## Contributing

**To add a new hook:**

1. Create `hooks/<hook-name>/` with `index.ts`, `README.md`, `package.json`
2. Add install/uninstall scripts to root `package.json`
3. Update this README

**To add a new extension:**

1. Create `extensions/<extension-name>/` with `index.ts`, `README.md`, `package.json`
2. Add install/uninstall scripts to root `package.json`
3. Update this README

---

## License

MIT
