# 🎨 Session Emoji

Display an intelligent emoji in pi's footer that represents your conversation.

## Features

- 🤖 AI-powered contextual emoji selection
- 🔄 24-hour uniqueness across sessions
- 🎯 Manual selection with `/emoji-set`
- 🎨 Multiple emoji sets

## Installation

```bash
npm run install:session-emoji
```

Restart pi after installing.

## Configuration

Add to `~/.pi/agent/settings.json`:

```json
{
  "sessionEmoji": {
    "enabledByDefault": true,
    "autoAssignMode": "ai",
    "autoAssignThreshold": 3,
    "contextMessages": 5,
    "emojiSet": "default"
  }
}
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `enabledByDefault` | `true` | Enable for new sessions |
| `autoAssignMode` | `"ai"` | `"ai"`, `"delayed"`, or `"immediate"` |
| `autoAssignThreshold` | `3` | Messages before auto-assign (ai/delayed modes) |
| `contextMessages` | `5` | Messages to analyze for AI mode |
| `emojiSet` | `"default"` | `"default"`, `"animals"`, `"tech"`, `"fun"`, `"custom"` |
| `customEmojis` | `[]` | Custom emoji array when `emojiSet` is `"custom"` |

### Emoji Sets

| Set | Emojis |
|-----|--------|
| default | 🚀 ✨ 🎯 💡 🔥 ⚡ 🎨 🌟 💻 🎭 |
| animals | 🐱 🐶 🐼 🦊 🐻 🦁 🐯 🐨 🐰 🦉 |
| tech | 💻 🖥️ ⌨️ 🖱️ 💾 📱 🔌 🔋 🖨️ 📡 |
| fun | 🎉 🎊 🎈 🎁 🎂 🍕 🍩 🌮 🎮 🎲 |

### Auto-Assign Modes

- **ai** (recommended): Analyzes conversation context, picks relevant unique emoji
- **delayed**: Random emoji after threshold messages
- **immediate**: Random emoji at session start

## Commands

### `/emoji` - Toggle On/Off

```
> /emoji
🎨 Session emoji ON

> /emoji
⬜ Session emoji OFF
```

### `/emoji-set` - Manual Selection

```
# Direct emoji
> /emoji-set 🦀
Emoji set to 🦀

# From description (uses AI)
> /emoji-set rust programming
🔄 Selecting emoji...
Emoji set to 🦀 (from: "rust programming")

# Interactive mode
> /emoji-set
Set emoji how?
  1. 📝 Enter emoji directly
  2. 💬 Describe what you want
  3. 🎲 Pick random from set
  4. ❌ Cancel
```

### `/emoji-config` - View Settings

```
> /emoji-config
─── Session Emoji Settings ───
Session: 🎨 ON  │  Emoji: 🚀  │  Mode: ai
Global: ON  │  Threshold: 3  │  Set: default
───────────────────────────────

Configure emoji:
  1. 🎨 Preview emoji sets
  2. ⚙️  Set global default: Disabled
  3. ⚙️  Set global default: Enabled (AI)
  4. ⚙️  Set global default: Enabled (Random)
  5. 📋 View emoji history (24h)
  6. ❌ Cancel
```

### `/emoji-history` - View History

```
> /emoji-history
📊 Emoji History (past 24h)

Sessions: 5  │  Unique: 5

1. 🚀 - 5m ago (current)
   "implement session emoji..."
2. 🎨 - 2h ago
   "create new feature..."
```

## How It Works

### AI Mode

1. Session starts with countdown: `⏳ (3)`
2. After N messages, AI analyzes conversation
3. AI picks a unique emoji not used in past 24h
4. Emoji persists for the session

## Tips

- Use `/emoji` to quickly toggle on/off
- Use `/emoji-set <description>` to get contextual emoji without waiting
- Session overrides reset on new session
- History is persistent across restarts
