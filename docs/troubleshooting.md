# Troubleshooting

## Background Notify

### Debug Output Leaking to Terminal

**Problem:** You see debug messages like `[background-notify] agent_end event fired` appearing in the terminal output, interfering with the UI.

**Cause:** An old version of the extension with debug logging is installed (from v1.x or earlier development versions).

**Solution:**

1. Run the fix script:
   ```bash
   ./scripts/fix-background-notify.sh
   ```

2. Or manually remove old versions:
   ```bash
   rm -rf ~/.pi/agent/extensions/background-notify/
   rm -f ~/.pi/agent/extensions/background-notify.ts
   npm run install:background-notify
   ```

3. Restart pi for changes to take effect.

**Prevention:** Always use `npm run install:background-notify` to install the latest clean version. The uninstall script now automatically removes both old file and directory versions.

---

## General Extension Issues

### Multiple Versions Installed

Extensions can be installed in multiple locations:
- `~/.pi/agent/extensions/` (global)
- `.pi/extensions/` (project-specific)

If you have issues, check both locations and remove duplicates. Project-specific extensions take precedence over global ones.

### Extension Not Loading

1. Verify installation location: `ls ~/.pi/agent/extensions/`
2. Check file has `.ts` extension (not a directory)
3. Restart pi completely
4. Check for errors in pi's startup output

### Settings Not Taking Effect

1. Check `~/.pi/agent/settings.json` for correct structure
2. Verify JSON is valid (use `jq` or JSON validator)
3. Session overrides (via commands like `/notify`) take precedence over global settings
4. Restart pi for global settings changes

