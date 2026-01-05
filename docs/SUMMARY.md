# pi-hooks

> 🪝 A collection of useful hooks for the pi coding agent

## What Are These Hooks?

Hooks that enhance your pi coding experience with notifications, session personalization, and workflow automation.

## Available Hooks
### 🔔 Background Notify

Detects long-running tasks and brings your terminal to focus when they complete.

**Features:**
- ⏱️ Detects tasks taking longer than your threshold (default: 5 seconds)
- 🔍 Checks if your terminal is in the background
- 🔔 Beeps to get your attention
- 🪟 Brings the terminal window to the front automatically
- 💬 Shows a completion notification in pi

[Read more →](../hooks/background-notify/README.md)

### 🎨 Session Emoji

Display a random emoji in the pi footer before your current working directory path.

**Features:**
- 🎯 Multiple emoji sets (default, animals, tech, fun)
- 🎨 Custom emoji support
- 🔒 Session-persistent emoji
- 👁️ Always visible in footer
- ⚙️ Easy to configure

[Read more →](../hooks/session-emoji/README.md)

## Quick Start

```bash
# Install all hooks
npm run install:all

# Configure in ~/.pi/agent/settings.json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 5000,
    "beep": true,
    "bringToFront": true
  },
  "sessionEmoji": {
    "enabled": true,
    "emojiSet": "default"
  }
}

# Restart pi
```

## Key Features

- ✅ **Easy Installation**: Simple npm scripts for all hooks
- ✅ **Configurable**: Control each hook independently
- ✅ **Non-Invasive**: Fail silently, never break pi functionality
- ✅ **Fast**: Negligible overhead
- ✅ **Modular**: Install only the hooks you want

## Requirements

- macOS (some features), Linux (partial support), or Windows (partial support)
- pi coding agent installed
- Node.js (for npm scripts)

## Documentation Structure

```
pi-hooks/
├── README.md                    # Main overview and quick start
├── hooks/
│   ├── background-notify/       # Background notification hook
│   │   ├── README.md           # Hook-specific documentation
│   │   ├── index.ts            # Hook implementation
│   │   └── ...
│   └── session-emoji/          # Session emoji hook
│       ├── README.md           # Hook-specific documentation
│       ├── index.ts            # Hook implementation
│       └── ...
└── docs/
    ├── INSTALL.md              # Installation guide
    ├── EXAMPLES.md             # Configuration examples
    ├── ARCHITECTURE.md         # Technical architecture
    └── SUMMARY.md              # This file
```

## Use Cases

### Background Notify
- **Long Builds**: Get notified when compilation finishes
- **Test Suites**: Return to terminal when tests complete
- **Code Generation**: Alert when large refactoring finishes
- **Research Tasks**: Know when analysis completes

### Session Emoji
- **Visual Identity**: Each session has its own emoji in the footer
- **Project Identification**: Quickly identify which session you're in
- **Fun Factor**: Add personality to your coding sessions
- **Team Spirit**: Share emoji configurations with your team

## Platform Support

| Platform | Detection | Beep | Bring to Front |
|----------|-----------|------|----------------|
| macOS | ✅ | ✅ | ✅ |
| Linux | 🚧 | ✅ | 🚧 |
| Windows | 🚧 | ✅ | 🚧 |

## Contributing

PRs welcome! To add a new hook:

1. Create a new directory in `hooks/`
2. Add `index.ts`, `README.md`, `package.json`, and `example-settings.json`
3. Add install/uninstall scripts to root `package.json`
4. Update main README with your hook
5. Add examples to `docs/EXAMPLES.md`

See existing hooks for structure and patterns.

## License

MIT

## Author

Created for the pi coding agent community.
