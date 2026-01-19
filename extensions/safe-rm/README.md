# 🗑️ Safe-RM Extension

Intercepts `rm` commands and replaces them with the macOS `trash` command (or falls back to `rm` on other platforms).

## Features

- 🗑️ **Replaces rm with trash** - Uses macOS native `trash` command
- 🌐 **Cross-platform** - On non-macOS systems, falls back to regular `rm`
- 📝 **Debug logging** - Logs both original and replacement commands
- 🎯 **Careful detection** - Minimizes false positives when identifying rm commands
- 📋 **File tracking** - Logs which files were affected

## How It Works

1. **Detects** `rm` commands (including `/bin/rm`, `/usr/bin/rm`)
2. **Parses** file arguments from the rm command
3. **Replaces** `rm` with `trash <files>` (macOS) or falls back to `rm` (other platforms)
4. **Logs** both original and replacement commands to debug log file
5. **Executes** the replacement command

## Installation

```bash
npm run install:safe-rm
```

**Restart pi** to load the extension.

## Configuration

Add to `~/.pi/agent/settings.json`:

```json
{
  "safeRm": {
    "enabledByDefault": true,
    "debugLogPath": "/Users/yourname/.pi/safe-rm-debug.log"
  }
}
```

### Options

| Option | Type | Default | Description |
|---------|------|---------|-------------|
| `enabledByDefault` | boolean | `true` | Enable for new sessions |
| `debugLogPath` | string | `~/.pi/safe-rm-debug.log` | Path to debug log file |

## Platform Support

| Platform | Behavior |
|----------|----------|
| **macOS** | Uses native `trash` command to move files to Trash |
| **Linux/Windows** | Falls back to regular `rm` command (no safety feature) |

> **Note:** On non-macOS systems, the extension will still log all `rm` commands but cannot provide the trash functionality. Consider using platform-specific trash tools like `trash-cli` (Linux) if you need this feature on other platforms.

## Slash Commands

| Command | Description |
|----------|-------------|
| `/saferm` | Show safe-rm status |
| `/saferm-toggle` | Toggle on/off |
| `/saferm-on` | Enable |
| `/saferm-off` | Disable |
| `/saferm-log` | Show debug log contents |
| `/saferm-clearlog` | Clear debug log file |

## Status Display

```
╭─ Safe-RM Status ─╮
│                     │
│  Status: 🟢 ON  │
│  Uses macOS 'trash' │
│  command             │
│                     │
│  📜 Debug log: ~/.pi/safe-rm-debug.log (12.3 KB) │
│                     │
╰─────────────────────╯

Commands: /saferm-on /saferm-off /saferm-toggle /saferm-log
```

## Debug Log

All rm commands are logged in simplified format:

```
[2026-01-14T18:50:00.000Z] | rm -rf build/ → trash
```

Format: `[timestamp] | <original_command> → trash`

### Viewing Debug Log

```bash
# Show last 20 entries
/saferm-log

# View full log
cat ~/.pi/safe-rm-debug.log

# Clear log
/saferm-clearlog
```

## Detection Logic

The extension carefully detects rm commands to avoid false positives:

### Valid RM Commands

| Pattern | Example |
|---------|----------|
| `rm` | `rm file.txt` |
| `/bin/rm` | `/bin/rm file.txt` |
| `/usr/bin/rm` | `/usr/bin/rm file.txt` |

### RM Detection Rules

1. **Starts with rm** - Command begins with "rm" word
2. **Word boundary check** - "rm" is at start or preceded by `/`
3. **Binary path check** - `/bin/rm`, `/usr/bin/rm` are valid

### False Positive Prevention

The following are NOT intercepted as rm:
- Commands containing "rm" as a substring (unlikely but checked)
- Commands like `firm` or `warm` that don't start with `rm`
- Aliased commands where `rm` is part of a longer word

## Usage Examples

### Single File

```
User: Delete config
rm config.json

[Replaced with: trash config.json]
[Logged to: ~/.pi/safe-rm-debug.log]
```

### Multiple Files

```
User: Delete temp files
rm temp1.txt temp2.txt

[Replaced with: trash temp1.txt temp2.txt]
[Logged to: ~/.pi/safe-rm-debug.log]
```

### Recursive Directory

```
User: Clean build
rm -rf build/

[Replaced with: trash build/]
[Logged to: ~/.pi/safe-rm-debug.log]
```

### Glob Patterns

```
User: Delete logs
rm *.log

[Replaced with: trash *.log]
[Logged to: ~/.pi/safe-rm-debug.log]
```

## Why This Approach?

### macOS `trash` Command

- ✅ **Built into macOS** - No external dependencies
- ✅ **Native handling** - Integrates with macOS trash
- ✅ **Metadata preserved** - Original creation dates, permissions kept
- ✅ **Recoverable** - Can restore from Trash app
- ✅ **Multiple files** - Handles multiple files in one call

### Previous Approaches

| Approach | Issues |
|-----------|---------|
| AppleScript | Slow, requires permissions, unreliable |
| Manual file moves | Complex path handling, no error handling |

## Debugging

### Enable Debug Logging

Logs are always written to `~/.pi/safe-rm-debug.log`:
- Original rm commands
- Replaced trash commands
- File lists

### View Recent Activity

```
/saferm-log
```

Shows the last 20 log entries.

### Troubleshooting

**Extension not working:**
1. Check `~/.pi/agent/extensions/safe-rm.ts` exists
2. Run `/saferm` to verify status
3. Check debug log: `cat ~/.pi/safe-rm-debug.log`

**Wrong behavior:**
1. Check debug log for what was intercepted
2. Verify `trash` command exists on your system
3. Check if rm commands were actually from pi (not other shells)

## Uninstall

```bash
npm run uninstall:safe-rm
```

Or manually:
```bash
rm ~/.pi/agent/extensions/safe-rm.ts
```

## License

MIT
