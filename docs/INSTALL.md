# Rhubarb Pi Installation Guide

Installation instructions for Rhubarb Pi hooks and extensions.

## Quick Install

### Install Everything

From the root of the repository:

```bash
npm run install:all
```

This chains through every available hook (background-notify, session-emoji, session-color) and extension (safe-git), dropping them into the appropriate pi directories under `~/.pi/agent/`.

### Install Individual Modules

```bash
# Hooks
npm run install:background-notify
npm run install:session-emoji
npm run install:session-color

# Extensions
npm run install:safe-git
```

### Alternative: Use the Shell Script

```bash
# Install all modules
./scripts/install.sh

# Install a subset
./scripts/install.sh background-notify session-emoji safe-git
```

The script understands every module name listed in `package.json` install/uninstall scripts.

### Project-Local Installation

To scope a hook or extension to the current project only:

```bash
cd hooks/background-notify
npm run install:project

cd ../../extensions/safe-git
npm run install:project
```

This copies the module into `.pi/hooks/<name>.ts` or `.pi/extensions/<name>.ts` inside your repo so it loads only when you’re working here.

### Important: Restart Required

After installing or uninstalling anything, **restart pi** so it reloads the new hooks/extensions. pi only discovers them at startup.

## Configuration

Each module reads its own section from `~/.pi/agent/settings.json` or project-local `.pi/settings.json`.

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

See each README for configuration details:
- [Background Notify](../hooks/background-notify/README.md#configuration)
- [Session Emoji](../hooks/session-emoji/README.md#configuration)
- [Session Color](./session-color.md#configuration)
- [Safe Git](./safe-git.md#configuration)

## Testing

Use the targeted npm scripts:

```bash
# TypeScript + project checks
npm run typecheck
npm run verify
```

Hook-specific manual testing is available inside each module directory (e.g., `hooks/background-notify/test.sh`).

## Troubleshooting

### Module Not Loading

**Problem:** No output or behavior from an installed module

**Solutions:**
1. Verify file exists:
   ```bash
   ls -l ~/.pi/agent/hooks/*.ts ~/.pi/agent/extensions/*.ts
   ```
2. Validate settings JSON:
   ```bash
   cat ~/.pi/agent/settings.json | python -m json.tool
   ```
3. Restart pi completely
4. Ensure `"enabled"` or `"enabledByDefault"` isn’t false in configuration

### Conflicting Copies

Modules can be installed globally and project-locally. Remove duplicates if behavior seems inconsistent (`rm ~/.pi/agent/hooks/<name>.ts` vs `.pi/hooks/<name>.ts`). Project-local copies take priority.

### Settings Not Taking Effect

1. Confirm JSON syntax
2. Restart pi (settings cache)
3. Check for session overrides (commands like `/notify` or `/emoji`) masking global defaults

### Permission Issues

```bash
mkdir -p ~/.pi/agent/{hooks,extensions}
chmod 755 ~/.pi/agent/{hooks,extensions}
```
Then rerun the installer.

## Uninstalling

### Remove Everything

```bash
npm run uninstall:all
```

### Remove Individual Modules

```bash
npm run uninstall:background-notify
npm run uninstall:session-emoji
npm run uninstall:session-color
npm run uninstall:safe-git
```

### Alternative: Shell Script

```bash
./scripts/uninstall.sh background-notify safe-git
```

### Manual Removal

Delete the installed files:

```bash
rm ~/.pi/agent/hooks/background-notify.ts
rm ~/.pi/agent/extensions/safe-git.ts
```

Then remove their configuration blocks from `settings.json` and restart pi.

## Next Steps

- Read each module’s README for feature deep-dives
- See [SUMMARY.md](SUMMARY.md) for a project-wide overview
- Consult [RELEASE.md](RELEASE.md) before publishing a new version
