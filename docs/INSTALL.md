# Pi Hooks Installation Guide

Installation instructions for pi coding agent hooks.

## Quick Install

### Install All Hooks

From the root of the pi-hooks repository:

```bash
npm run install:all
```

This installs all available hooks to `~/.pi/agent/hooks/` where they will be auto-discovered.

### Install Individual Hooks

```bash
# Background Notify
npm run install:background-notify

# Session Emoji
npm run install:session-emoji
```

### Alternative: Use Install Script

```bash
# Install all hooks
./scripts/install.sh

# Install specific hooks
./scripts/install.sh background-notify
./scripts/install.sh session-emoji
```

### Project-Local Installation

To install a hook for only the current project:

```bash
cd hooks/background-notify
npm run install:project

# Or for session-emoji
cd hooks/session-emoji
npm run install:project
```

This copies the hook to `.pi/hooks/<hook-name>.ts` in your project directory.

### Important: Restart Required

After installing any hook, you **must restart pi** for it to be loaded. Hooks are discovered at startup.

## Configuration

Each hook has its own configuration section in `~/.pi/agent/settings.json` or `.pi/settings.json` (project-local).

### Example Combined Configuration

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

See each hook's README for detailed configuration options:
- [Background Notify Configuration](../hooks/background-notify/README.md#configuration)
- [Session Emoji Configuration](../hooks/session-emoji/README.md#configuration)

## Testing

Test individual hooks:

```bash
# Test background-notify
npm run test:background-notify

# Test session-emoji
npm run test:session-emoji
```

Or manually test from each hook directory:

```bash
cd hooks/background-notify
./test.sh

cd ../session-emoji
./test.sh
```

## Troubleshooting

### Hook not loading

**Problem:** No output or behavior from installed hook

**Solutions:**
1. Verify hook file exists:
   ```bash
   ls -l ~/.pi/agent/hooks/*.ts
   ```
2. Check settings file exists and is valid JSON:
   ```bash
   cat ~/.pi/agent/settings.json | python -m json.tool
   ```
3. Restart pi completely
4. Check for `"enabled": false` in configuration

### Multiple hooks conflict

**Problem:** Hooks interfere with each other

**Solutions:**
- Each hook is independent and should not conflict
- Check each hook's `enabled` setting
- Review configuration for typos or invalid values

### Settings not taking effect

**Problem:** Changes to settings.json don't apply

**Solutions:**
1. Verify JSON syntax is valid
2. Restart pi after changes
3. Check for project-local settings overriding global ones

### Permission issues

**Problem:** Cannot create hooks directory

**Solutions:**
```bash
# Manually create directory
mkdir -p ~/.pi/agent/hooks
chmod 755 ~/.pi/agent/hooks

# Then try installation again
npm run install:all
```

## Uninstalling

### Uninstall All Hooks

```bash
npm run uninstall:all
```

### Uninstall Individual Hooks

```bash
npm run uninstall:background-notify
npm run uninstall:session-emoji
```

### Alternative: Use Uninstall Script

```bash
# Uninstall all hooks
./scripts/uninstall.sh

# Uninstall specific hooks
./scripts/uninstall.sh background-notify
./scripts/uninstall.sh session-emoji
```

### Manual Uninstallation

Remove hook files:

```bash
rm ~/.pi/agent/hooks/background-notify.ts
rm ~/.pi/agent/hooks/session-emoji.ts
```

Remove configuration from `~/.pi/agent/settings.json`:

```json
{
  "backgroundNotify": { ... },  // Delete this
  "sessionEmoji": { ... }       // Delete this
}
```

Then restart pi.

## Next Steps

- Read individual hook documentation for detailed features
- See [EXAMPLES.md](EXAMPLES.md) for configuration recipes
- Check [ARCHITECTURE.md](ARCHITECTURE.md) for technical details
- Review [SUMMARY.md](SUMMARY.md) for project overview
