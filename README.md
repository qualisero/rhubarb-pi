# 🥧 Rhubarb Pi

A collection of extensions for the [pi coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Extensions

| Extension | Description | Install |
|-----------|-------------|---------|
| [🔔 background-notify](#-background-notify) | Notifications when tasks complete | `npm run install:background-notify` |
| [🎨 session-emoji](#-session-emoji) | AI-powered emoji in footer | `npm run install:session-emoji` |
| [🌈 session-color](#-session-color) | Colored band to distinguish sessions | `npm run install:session-color` |
| [🔒 safe-git](#-safe-git) | Approval for git operations | `npm run install:safe-git` |

---

### 🔔 background-notify

Get notified when long-running tasks complete while your terminal is in the background. Plays an audio beep and brings the terminal to front (macOS).

**Commands:** `/notify`, `/notify-test`, `/notify-beep`, `/notify-focus`, `/notify-config`, `/notify-status`

```bash
npm run install:background-notify
```

[📖 Documentation](docs/background-notify.md)

---

### 🎨 session-emoji

Display an intelligent emoji in pi's footer that represents your conversation. Uses AI to analyze context and pick a relevant emoji, with 24-hour uniqueness to avoid repetition.

**Commands:** `/emoji`, `/emoji-set`, `/emoji-config`, `/emoji-history`

```bash
npm run install:session-emoji
```

[📖 Documentation](docs/session-emoji.md)

---

### 🌈 session-color

Display a colored band in pi's footer to visually distinguish sessions. Uses a 40-color palette designed for maximum visual distinction between consecutive sessions.

**Commands:** `/color`, `/color-set`, `/color-next`, `/color-config`

```bash
npm run install:session-color
```

[📖 Documentation](docs/session-color.md)

---

### 🔒 safe-git

Require explicit user approval before dangerous git operations. High-risk operations (force push, hard reset) show warnings; medium-risk (push, commit) require confirmation. Blocks entirely in non-interactive mode.

**Commands:** `/safegit`, `/safegit-status`, `/safegit-level`

```bash
npm run install:safe-git
```

[📖 Documentation](docs/safe-git.md)

---

## Quick Start

```bash
# Install everything
npm run install:all

# Or install individually
npm run install:background-notify
npm run install:session-emoji
npm run install:session-color
npm run install:safe-git
```

**Restart pi** after installing for extensions to load.

## Testing

```bash
npm run test:e2e       # Run E2E tests (requires pi + tmux)
npm run test:e2e:watch # Watch mode
npm run typecheck      # TypeScript check
```

## Uninstall

```bash
npm run uninstall:all          # Remove everything
npm run uninstall:all-extensions  # Remove all extensions
```

## Requirements

- [pi coding agent](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) v0.36.0+
- Node.js 20+
- macOS (for background-notify terminal activation)

## License

MIT
# Trigger CI
