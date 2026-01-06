# Changelog

## v2.0.0 - Extensions Migration (Breaking Changes)

### 🔥 Breaking Changes

**Unified extensions architecture** - All hooks are now extensions, aligning with pi v0.36.0+ architecture.

**Migration Required:**
1. Uninstall old hooks:
   ```bash
   rm ~/.pi/agent/hooks/background-notify.ts
   rm ~/.pi/agent/hooks/session-emoji.ts
   rm ~/.pi/agent/hooks/session-color.ts
   ```
2. Install new extensions:
   ```bash
   npm run install:all
   ```
3. Restart pi

### Changes

#### Directory Structure
- **Before:** Separate `hooks/` and `extensions/` directories
- **After:** All components in unified structure, installed to `~/.pi/agent/extensions/`

#### Installation Paths
- `~/.pi/agent/hooks/` → `~/.pi/agent/extensions/`
- `.pi/hooks/` → `.pi/extensions/`

#### Terminology
- All components now called "extensions" (no more "hooks")
- Updated all documentation and package descriptions
- Maintained backward compatibility for functionality

### What Changed

#### Package Updates
- **Root package.json**: Simplified scripts, bumped version to 2.0.0
- **Individual packages**: Updated install paths from `hooks/` to `extensions/`
- **Keywords**: Changed from "hook" to "extension"
- **Descriptions**: Updated terminology throughout

#### Documentation
- **README.md**: Unified terminology, added migration guide
- **All docs**: Updated references from "hooks" to "extensions"
- **TypeScript comments**: Updated file headers

### What Stayed the Same

✅ **No code changes** - All TypeScript code unchanged  
✅ **Configuration** - Settings remain the same  
✅ **Commands** - All slash commands work identically  
✅ **Features** - Zero functionality changes  

### Why This Update?

Pi v0.36.0 unified hooks and custom tools into a single "extensions" concept. This update:
- Aligns with pi's latest architecture
- Simplifies mental model (one concept instead of two)
- Future-proofs for upcoming pi features
- Maintains full backward compatibility

### Requirements

- pi v0.36.0+ (was v0.30.0+)

---

## v1.2.0 - Slash Commands for Interactive Configuration

### New Feature: Slash Commands

Both hooks now support interactive configuration via slash commands, making it easy to configure and test without editing files!

#### Session Emoji Commands

**`/emoji`** - Interactive configuration menu
- Change assignment mode (ai/delayed/immediate)
- Set message threshold
- Change emoji set (default/animals/tech/fun)
- View current settings
- View emoji history (past 24h)
- Force new emoji assignment

**`/emoji-test`** - Preview all emoji sets

**`/emoji-history`** - Show recent emoji usage with timestamps and context

**Example:**
```
> /emoji
Session Emoji Configuration
  1. Change assignment mode
  2. Set message threshold
  ...
> Select: 1
Choose emoji assignment mode:
  1. ai - AI-selected based on conversation (recommended)
  2. delayed - Random after threshold messages
  3. immediate - Random at session start
> Select: 1
✓ Selected: ai
ℹ To persist, add to ~/.pi/agent/settings.json:
{
  "sessionEmoji": {
    "autoAssignMode": "ai"
  }
}
```

#### Background Notify Commands

**`/notify`** - Interactive configuration menu
- Toggle beep on/off (with immediate test)
- Toggle bring-to-front on/off
- Set duration threshold
- Test notification
- View current settings
- View detected terminal info

**`/notify-test`** - Quick 3-second notification test

**`/notify-status`** - Comprehensive status display

**Example:**
```
> /notify-test
🧪 Testing notification in 3 seconds...
💡 Tip: Switch to another app to see it in action!
[waits 3 seconds]
✅ Test complete! Triggered: beep + bring-to-front
```

### Benefits

- ✅ **No file editing** - Configure interactively in pi
- ✅ **Immediate feedback** - See settings take effect right away
- ✅ **Easy testing** - Test features without waiting for tasks
- ✅ **Discoverable** - Commands shown in `/help`
- ✅ **Guided setup** - Menus show available options
- ✅ **History viewing** - See emoji usage patterns
- ✅ **Status info** - Debug configuration issues

### Documentation Updates

- Updated both READMEs with slash command sections
- Added examples for each command
- Created comprehensive `docs/SLASH_COMMANDS.md` guide
- Updated troubleshooting with command-based solutions

### Technical Details

Commands use `pi.registerCommand()` from the Hook API:
- Interactive dialogs via `ctx.ui.select()`, `ctx.ui.input()`, `ctx.ui.confirm()`
- Settings read-only access (commands show JSON to persist)
- In-session state access for testing and status
- Non-blocking async handlers

---

## v1.1.0 - AI-Powered Session Emoji Enhancement

### Enhanced: Session Emoji Hook

Major upgrade to the session emoji hook with AI-powered contextual emoji selection:

**New Features:**
- 🤖 **AI Mode**: Analyzes conversation context to pick thematically relevant emojis
- 🔄 **24-hour uniqueness**: Never reuses emojis from the past 24 hours across any session
- ⏱️ **Delayed assignment**: Configurable threshold for when emoji appears
- 💾 **Persistent history**: Tracks emoji usage across sessions with timestamps
- 🎯 **Multiple modes**: Choose between AI, delayed, or immediate assignment

**New Configuration Options:**
```json
{
  "sessionEmoji": {
    "enabled": true,
    "autoAssignMode": "ai",           // "ai", "delayed", or "immediate"
    "autoAssignThreshold": 3,          // Messages before assignment
    "contextMessages": 5               // Messages to analyze for AI
  }
}
```

**How AI Mode Works:**
1. Waits for N user messages (default: 3)
2. Analyzes recent conversation context
3. Checks which emojis were used in past 24 hours
4. Uses LLM to select a unique, topical emoji
5. Updates footer immediately (no restart needed)
6. Persists history across sessions

**Modes:**
- `ai` (recommended) - AI selects based on conversation theme
- `delayed` - Random emoji after threshold
- `immediate` - Random emoji at start (classic v1.0 behavior)

**Example:**
```
Session start → ⏳ (emoji in 3 messages)
3rd message   → 🔄 (selecting emoji...)
                → 🎨 /Users/dave/my-project
```

**Technical Details:**
- Uses `@mariozechner/pi-ai` complete() for emoji selection
- Stores history via `pi.appendEntry()` for session persistence
- Gracefully falls back to random if AI unavailable
- Tracks context and timestamps for each emoji
- Live status updates via `ctx.ui.setStatus()`

### Documentation Updates
- Updated README with AI mode examples
- Added troubleshooting for AI-specific issues
- Expanded configuration documentation
- Added 24-hour uniqueness explanation

---

## v1.0.0 - Multi-Hook Repository Reorganization

### Major Changes

**Reorganized from single-hook to multi-hook structure:**

- Created `hooks/` directory with individual hook subdirectories
- Each hook now has its own `package.json`, `README.md`, `example-settings.json`, and `test.sh`
- Moved general documentation to `docs/` directory
- Created centralized install/uninstall scripts in `scripts/`

### New Hooks

#### Background Notify (`hooks/background-notify/`)
- Notifies when long-running tasks complete while terminal is backgrounded
- Features: beep, bring-to-front, configurable threshold
- Moved from root level to hooks directory

#### Session Emoji (`hooks/session-emoji/`) - NEW! 🎨
- Displays random emoji at session start
- Multiple emoji sets: default, animals, tech, fun, custom
- Adds personality to coding sessions

### New Structure

```
pi-hooks/
├── README.md                          # Main overview
├── package.json                       # Root package with install scripts
├── hooks/
│   ├── background-notify/             # Background notification hook
│   │   ├── index.ts
│   │   ├── README.md
│   │   ├── package.json
│   │   ├── example-settings.json
│   │   └── test.sh
│   └── session-emoji/                 # Session emoji hook (NEW)
│       ├── index.ts
│       ├── README.md
│       ├── package.json
│       ├── example-settings.json
│       └── test.sh
├── scripts/
│   ├── install.sh                     # Universal installer
│   └── uninstall.sh                   # Universal uninstaller
└── docs/
    ├── INSTALL.md                     # Installation guide
    ├── EXAMPLES.md                    # Configuration examples
    ├── ARCHITECTURE.md                # Technical details
    └── SUMMARY.md                     # Project summary
```

### Installation Changes

**Before:**
```bash
npm run install:global
npm run install:project
```

**After:**
```bash
# Install all hooks
npm run install:all

# Or install individually
npm run install:background-notify
npm run install:session-emoji

# Or use scripts
./scripts/install.sh background-notify session-emoji
```

### Configuration

Both hooks use separate configuration sections in `settings.json`:

```json
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
```

### Breaking Changes

⚠️ **Important:** After updating, you need to:

1. **Uninstall old hook** (if previously installed):
   ```bash
   rm ~/.pi/agent/hooks/background-notify.ts
   ```

2. **Reinstall from new structure**:
   ```bash
   npm run install:all
   ```

3. **Restart pi** for changes to take effect

### Migration Guide

If you had the old single-hook installation:

1. Your configuration in `settings.json` remains unchanged
2. Simply run `npm run install:background-notify` to reinstall
3. Optionally add `npm run install:session-emoji` for the new hook
4. Restart pi

### Future Additions

This structure makes it easy to add more hooks:
- Each hook is self-contained
- Simple install/uninstall via npm scripts
- Modular - users install only what they need
