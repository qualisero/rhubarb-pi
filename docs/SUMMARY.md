# Rhubarb Pi

> 🥧 A bundle of pi coding agent upgrades: background automation, safety rails, and session polish

## What’s Inside?

Rhubarb Pi ships both **extensions** (drop into `~/.pi/agent/extensions`) and **hooks** (installed via `~/.pi/agent/hooks`). Together they add notifications, personalization, and safer workflows to pi.

## Available Modules

### 🔔 Background Notify (hook)
Detects long-running tasks and brings your terminal to focus when they complete.

**Highlights**
- ⏱️ Threshold-based detection (default 5s)
- 🔍 Background terminal detection
- 🔔 Audio alerts + 🪟 bring-to-front
- 💬 Completion notification in pi

[Read more →](../hooks/background-notify/README.md)

### 🎨 Session Emoji (hook)
Shows a delightful emoji in pi’s footer before your working directory path.

**Highlights**
- 🤖 AI-aware emoji selection with 24h uniqueness
- 🎯 Multiple preset sets + custom lists
- 🔒 Session persistence with `/emoji-history`

[Read more →](../hooks/session-emoji/README.md)

### 🌈 Session Color (hook)
Adds a colored footer band so concurrent sessions are easy to tell apart.

[Read more →](./session-color.md)

### 🔒 Safe Git (extension)
Gates risky git + gh commands behind explicit approval prompts.

[Read more →](../docs/safe-git.md)

### 🗑️ Safe RM (extension)
Intercepts `rm` commands and moves deleted files to the macOS trash.

[Read more →](../extensions/safe-rm/README.md)

## Quick Start

```bash
# Install everything
npm run install:all

# Or pick individual modules
npm run install:background-notify
npm run install:session-emoji
npm run install:session-color
npm run install:safe-git
npm run install:safe-rm
```

Configure in `~/.pi/agent/settings.json` (or project-local `.pi/settings.json`), then **restart pi**:

```json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 5000
  },
  "sessionEmoji": {
    "enabled": true,
    "emojiSet": "default"
  },
  "sessionColor": {
    "enabledByDefault": true
  },
  "safeGit": {
    "enabledByDefault": true,
    "promptLevel": "medium"
  }
}
```

## Project Highlights

- ✅ **One-line installs** via npm scripts or shell helpers
- ✅ **Configurable**: toggle each hook/extension independently
- ✅ **Non-invasive**: modules fail gracefully if prerequisites are missing
- ✅ **Fast**: negligible runtime overhead
- ✅ **Modular**: mix-and-match what your workflow needs

## Requirements

- pi coding agent v0.36.0+
- Node.js 20+
- macOS (full feature set), Linux/Windows partial support where noted

## Repo Layout

```
rhubarb-pi/
├── README.md                    # Main overview and quick start
├── extensions/
│   └── safe-rm/, safe-git/      # Extension implementations
├── hooks/
│   └── background-notify/, ...  # Hook implementations
└── docs/
    ├── INSTALL.md               # Installation guide
    ├── SUMMARY.md               # This file
    ├── RELEASE.md               # Release checklist
    └── ...
```

## Use Cases

### Background Notify
- Long builds/tests → know the instant they finish
- Research/analysis tasks → terminal jumps forward when complete

### Session Emoji/Color
- Visual identity per session when juggling multiple terminals
- Quick cognitive cue for which environment you’re in

### Safe Git / Safe RM
- Prevent accidental force pushes, rebases, or deletes
- Recover deleted files from the trash instead of panic

## Platform Support

| Platform | Detection | Beep | Bring to Front |
|----------|-----------|------|----------------|
| macOS    | ✅        | ✅   | ✅             |
| Linux    | 🚧        | ✅   | 🚧             |
| Windows  | 🚧        | ✅   | 🚧             |

## Contributing

PRs welcome! To add a new module:

1. Create `hooks/<name>/` or `extensions/<name>/`
2. Add `index.ts`, `README.md`, and install/uninstall scripts
3. Wire scripts into root `package.json`
4. Update README + docs to surface the new module
5. Add examples/tests as needed

See existing modules for structure and patterns.

## License

MIT

## Author

Created for the pi coding agent community.
