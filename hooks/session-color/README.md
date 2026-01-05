# Session Color Hook

Displays a colored band in pi's footer to visually distinguish sessions. Each new session gets the next color from a 40-color palette designed to maximize visual distinction.

## Features

- 🎨 **40 distinct colors** - Curated palette maximizing visual difference
- 🔄 **Sequential cycling** - Each session gets the next color
- 👁️ **High contrast** - Colors chosen to be distinct from recent sessions
- ⚙️ **Customizable** - Change block character and count

## Installation

**Global (all projects):**
```bash
npm run install:global
```

**Project-local:**
```bash
npm run install:project
```

**Important:** Restart pi after installing.

## Configuration

Add to `~/.pi/agent/settings.json`:

```json
{
  "sessionColor": {
    "enabledByDefault": true,
    "blockChar": "▁",
    "blockCount": "full"
  }
}
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `enabledByDefault` | `true` | Enable/disable for new sessions |
| `blockChar` | `"▁"` | Character to display |
| `blockCount` | `"full"` | `"full"` for terminal width, or a number |

### Block Character Suggestions

| Char | Name | Look |
|------|------|------|
| ▁ | Lower one eighth block (default) | Thin underline |
| ▂ | Lower one quarter block | Slightly thicker |
| ▄ | Lower half block | Half height |
| █ | Full block | Solid bar |
| ▔ | Upper one eighth block | Thin overline |
| ▀ | Upper half block | Top half |
| ─ | Box light horizontal | Thin line |
| ━ | Box heavy horizontal | Thick line |
| ═ | Box double horizontal | Double line |

## Commands

### `/color` - Toggle On/Off

Toggle session color for this session:

```
> /color
🎨 Session color ON

> /color
⬜ Session color OFF
```

### `/color-set` - Manual Selection

Set a specific color by index:

```
> /color-set 5
Color set to index 5 (ANSI 208)

> /color-set
Available colors:
0-9:  ██ ██ ██ ██ ██ ██ ██ ██ ██ ██
Enter color index (0-39):
```

### `/color-next` - Skip to Next

Skip to the next color in the palette:

```
> /color-next
Skipped to color 12
```

### `/color-config` - View Settings

View and configure settings:

```
> /color-config
─── Session Color Settings ───
Session: 🎨 ON  │  Index: 7  │  Palette: 40 colors
Global: ON  │  Char: "█"  │  Count: 2
───────────────────────────────
```

## Color Palette

The 40-color palette uses ANSI 256-color codes and is designed with this heuristic:

- Each color is **very distinct** from the previous 5 colors
- Each color is **as distinct as possible** from the previous 10 colors

This ensures consecutive sessions are always visually distinguishable, even when switching rapidly between sessions.

The palette alternates between:
- Warm and cool tones
- Light and dark shades
- Saturated and muted colors

## How It Works

1. On session start, the hook reads the last used color index
2. It assigns the next color in the sequence (cycling after 40)
3. The colored block is displayed in the footer
4. History is persisted across restarts

## Tips

- Use `/color` to quickly toggle on/off
- Use `/color-next` to skip a color you don't like
- Combine with `session-emoji` for even more visual distinction
- Works in any terminal supporting ANSI 256 colors

## License

MIT
