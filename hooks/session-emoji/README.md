# Session Emoji Hook (Enhanced)

An intelligent pi coding agent hook that displays a contextually relevant emoji in pi's footer status line. Features AI-powered emoji selection that analyzes your conversation and picks a unique, topical emoji that hasn't been used recently.

## Features

- 🤖 **AI-powered selection** - Analyzes conversation context to pick relevant emojis
- 🔄 **24-hour uniqueness** - Never reuses emojis from the past 24 hours
- 🎨 **Multiple emoji sets** - Choose from default, animals, tech, or fun themes
- 🎯 **Custom emojis** - Define your own emoji collection
- 🔒 **Session-persistent** - Same emoji throughout the entire session
- 👁️ **Always visible** - Shows in the footer status line
- ⚙️ **Multiple modes** - Immediate, delayed, or AI-powered assignment
- ⏱️ **Configurable threshold** - Control when emoji appears

## Installation

### Global (all projects)

```bash
npm run install:global
```

This copies the hook to `~/.pi/agent/hooks/session-emoji.ts` where it will be auto-discovered.

### Project-local

```bash
npm run install:project
```

This copies the hook to `.pi/hooks/session-emoji.ts` for the current project only.

### Important: Restart Required

After installing, you **must restart pi** for the hook to be loaded. Hooks are discovered at startup.

## Configuration

Add to `~/.pi/agent/settings.json`:

```json
{
  "sessionEmoji": {
    "enabled": true,
    "autoAssignMode": "ai",
    "autoAssignThreshold": 3,
    "contextMessages": 5
  }
}
```

### Options

- `enabled` - Enable/disable the hook (default: `true`)
- `autoAssignMode` - How to assign emojis (default: `"ai"`)
  - `"ai"` - AI selects based on conversation context (recommended)
  - `"delayed"` - Random emoji after threshold messages
  - `"immediate"` - Random emoji at session start (classic behavior)
- `autoAssignThreshold` - Number of user messages before assignment (default: `3`)
- `contextMessages` - Number of recent messages to analyze for AI mode (default: `5`)
- `emojiSet` - Which emoji set to use for random/fallback: `"default"`, `"animals"`, `"tech"`, `"fun"`, or `"custom"` (default: `"default"`)
- `customEmojis` - Array of custom emojis when `emojiSet` is `"custom"`

### Emoji Sets

#### Default
🚀 ✨ 🎯 💡 🔥 ⚡ 🎨 🌟 💻 🎭

#### Animals
🐱 🐶 🐼 🦊 🐻 🦁 🐯 🐨 🐰 🦉

#### Tech
💻 🖥️ ⌨️ 🖱️ 💾 📱 🔌 🔋 🖨️ 📡

#### Fun
🎉 🎊 🎈 🎁 🎂 🍕 🍩 🌮 🎮 🎲

## Examples

### AI-powered topical emoji (recommended)

```json
{
  "sessionEmoji": {
    "enabled": true,
    "autoAssignMode": "ai",
    "autoAssignThreshold": 3,
    "contextMessages": 5
  }
}
```

This mode analyzes your conversation and picks a relevant emoji that hasn't been used in the past 24 hours.

### Delayed random emoji

```json
{
  "sessionEmoji": {
    "enabled": true,
    "autoAssignMode": "delayed",
    "autoAssignThreshold": 5,
    "emojiSet": "animals"
  }
}
```

### Immediate random emoji (classic behavior)

```json
{
  "sessionEmoji": {
    "enabled": true,
    "autoAssignMode": "immediate",
    "emojiSet": "default"
  }
}
```

### Use custom emojis

```json
{
  "sessionEmoji": {
    "enabled": true,
    "autoAssignMode": "ai",
    "autoAssignThreshold": 2,
    "emojiSet": "custom",
    "customEmojis": ["🎸", "🎹", "🎺", "🎻", "🥁"]
  }
}
```

### Disable the hook

```json
{
  "sessionEmoji": {
    "enabled": false
  }
}
```

## Slash Commands

The hook provides interactive configuration via slash commands:

### `/emoji` - Interactive Configuration

Opens a menu with options:
- **Change assignment mode** - Switch between ai/delayed/immediate
- **Set message threshold** - Configure when emoji is assigned
- **Change emoji set** - Choose default/animals/tech/fun
- **View current settings** - Show active configuration
- **View emoji history (24h)** - See recent emoji usage
- **Force new emoji now** - Replace current session emoji

```
> /emoji
Session Emoji Configuration
  1. Change assignment mode
  2. Set message threshold
  3. Change emoji set
  4. View current settings
  5. View emoji history (24h)
  6. Force new emoji now
  7. Cancel
```

### `/emoji-test` - Preview Emoji Sets

Shows all available emoji sets:

```
> /emoji-test
Available emoji sets:

default: 🚀 ✨ 🎯 💡 🔥 ⚡ 🎨 🌟 💻 🎭
animals: 🐱 🐶 🐼 🦊 🐻 🦁 🐯 🐨 🐰 🦉
tech: 💻 🖥️ ⌨️ 🖱️ 💾 📱 🔌 🔋 🖨️ 📡
fun: 🎉 🎊 🎈 🎁 🎂 🍕 🍩 🌮 🎮 🎲

To configure, use: /emoji
```

### `/emoji-history` - View Usage History

Shows emoji history from the past 24 hours:

```
> /emoji-history
📊 Emoji History (past 24h)

Total sessions: 12
Unique emojis: 10

Recent sessions (newest first):

1. 🎨 - 5m ago (current)
   "implement session emoji slash commands..."
2. 🚀 - 2h ago
   "create new feature for background notif..."
3. 💡 - 5h ago
   "debug issue with terminal detection..."
```

**Tips:**
- Use `/emoji` for quick configuration without editing files
- Commands show the JSON to add to `settings.json` for persistence
- Changes take effect immediately (except for threshold which applies to next session)

## How It Works

### AI Mode (Recommended)

1. When a pi session starts, the hook shows a placeholder with countdown
2. After you send N messages (default: 3), the hook triggers emoji selection
3. AI analyzes your conversation context (last 5 messages by default)
4. AI checks which emojis were used in the past 24 hours across all sessions
5. AI selects a unique, topical emoji that represents your conversation theme
6. The emoji is stored with timestamp and displayed immediately in the footer
7. Same emoji persists throughout the session
8. When starting a new session (`/new`), a new emoji is selected

**Example flow:**
```
Session start → ⏳ /Users/dave/Projects/my-app (emoji in 3 messages)
1st message   → ⏳ /Users/dave/Projects/my-app (emoji in 2 messages)
2nd message   → ⏳ /Users/dave/Projects/my-app (emoji in 1 messages)
3rd message   → 🔄 /Users/dave/Projects/my-app (selecting emoji...)
                → 🎨 /Users/dave/Projects/my-app
```

### Delayed Mode

Works like AI mode but picks a random emoji from your chosen set instead of using AI.

### Immediate Mode

Classic behavior - assigns a random emoji immediately when the session starts.

**Example footer status:**
```
🚀 /Users/dave/Projects/my-project
```

## 24-Hour Uniqueness

The hook maintains a persistent history of all assigned emojis with timestamps. When selecting a new emoji (in AI or delayed mode), it ensures the emoji hasn't been used in the past 24 hours across ANY session. This helps you visually distinguish between different sessions and time periods.

**History is stored in the session file and persists across restarts.**

## Troubleshooting

### Hook not loading

**Problem:** No emoji appears in the footer

**Solutions:**
- Verify hook is at `~/.pi/agent/hooks/session-emoji.ts` (not in a subdirectory)
- Restart pi completely
- Check `~/.pi/agent/settings.json` doesn't have `"enabled": false`

### Emoji not showing in footer

**Problem:** Hook loads but emoji doesn't appear in the footer status line

**Solutions:**
- Make sure pi is running (not in background/minimized)
- Check that the footer is visible in your terminal
- Verify the hook loaded without errors (check pi startup messages)
- Try running a command to see if status updates

### AI mode not working

**Problem:** Hook falls back to random emojis instead of using AI

**Solutions:**
- Verify you have a model selected (e.g., `anthropic/claude-3-5-sonnet-20241022`)
- Check that your API key is configured correctly
- Look for errors in pi console during emoji selection
- Try `"autoAssignMode": "immediate"` to test basic functionality first

### Same emoji appears multiple times

**Problem:** Getting duplicate emojis across sessions

**Solutions:**
- This shouldn't happen with AI mode - emojis from past 24h are excluded
- Check your `autoAssignMode` - immediate/delayed modes don't check history
- Try switching to `"autoAssignMode": "ai"` for uniqueness guarantee
- With small custom emoji sets, duplicates are more likely

### Want different emojis

**Problem:** Don't like the default emoji selection

**Solutions:**
- Try a different `emojiSet`: `"animals"`, `"tech"`, or `"fun"`
- Create your own with `"emojiSet": "custom"` and `"customEmojis": [...]`
- Use AI mode for contextual variety: `"autoAssignMode": "ai"`

### Emoji changes during session

**Problem:** Different emoji appears after `/new`

**Solutions:**
- This is expected - `/new` starts a fresh session with a new emoji
- The emoji should remain the same within a single session
- If it changes without `/new`, please report as a bug

### Countdown not updating

**Problem:** Status shows "emoji in 3 messages" but doesn't update

**Solutions:**
- The countdown updates only when you send messages (on `agent_start` event)
- Make sure you're in delayed or AI mode, not immediate mode
- Check that `autoAssignThreshold` is set correctly in your config

## License

MIT
