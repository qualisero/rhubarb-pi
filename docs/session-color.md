# 🌈 Session Color

Display a colored band in pi's footer to visually distinguish sessions.

## Features

- 🎨 40 distinct colors maximizing visual difference
- 🔄 Sequential cycling through palette
- 👁️ Each color distinct from recent sessions
- ⚙️ Customizable block character

## Installation

```bash
npm run install:session-color
```

Restart pi after installing.

## Configuration

Add to `~/.pi/agent/settings.json`:

```json
{
  "sessionColor": {
    "enabledByDefault": true,
    "blockChar": "█",
    "blockCount": "full"
  }
}
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `enabledByDefault` | `true` | Enable for new sessions |
| `blockChar` | `"█"` | Character to display |
| `blockCount` | `"full"` | `"full"` for terminal width, or a number |

### Block Character Suggestions

| Char | Name |
|------|------|
| █ | Full block (default) |
| ▌ | Left half block |
| ▐ | Right half block |
| ▮ | Black vertical rectangle |
| ■ | Black square |
| ● | Black circle |

## Commands

### `/color` - Toggle On/Off

```
> /color
🎨 Session color ON

> /color
⬜ Session color OFF
```

### `/color-set` - Manual Selection

```
> /color-set 5
Color set to index 5 (ANSI 208)

> /color-set
Available colors:
0-9:  ██ ██ ██ ██ ██ ██ ██ ██ ██ ██
Enter color index (0-39):
```

### `/color-next` - Skip to Next

```
> /color-next
Skipped to color 12
```

### `/color-config` - View Settings

```
> /color-config
─── Session Color Settings ───
Session: 🎨 ON  │  Index: 7  │  Palette: 40 colors
Global: ON  │  Char: "█"  │  Count: 2
───────────────────────────────
```

## Color Palette

The 40-color palette uses ANSI 256-color codes with this design:

- Each color is **very distinct** from the previous 5 colors
- Each color is **as distinct as possible** from the previous 10 colors

The palette alternates between:
- Warm and cool tones
- Light and dark shades
- Saturated and muted colors

## How It Works

1. On session start, reads the last used color index
2. Assigns the next color in sequence (cycling after 40)
3. Displays colored block in footer
4. History persists across restarts

## Tips

- Use `/color` to quickly toggle on/off
- Use `/color-next` to skip a color you don't like
- Combine with `session-emoji` for even more visual distinction
- Works in any terminal supporting ANSI 256 colors
