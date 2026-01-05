# Adding Slash Commands to Configure Pi Hooks

Yes! Hooks can register custom slash commands using `pi.registerCommand()` to provide interactive configuration and control.

## Quick Answer

```typescript
export default function (pi: HookAPI) {
  pi.registerCommand("emoji", {
    description: "Configure session emoji settings",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("This command requires interactive mode", "error");
        return;
      }

      const mode = await ctx.ui.select(
        "Choose emoji assignment mode:",
        ["ai", "delayed", "immediate"]
      );

      if (mode) {
        ctx.ui.notify(`Mode set to: ${mode}`, "success");
        ctx.ui.notify("Edit ~/.pi/agent/settings.json to persist", "info");
      }
    }
  });
}
```

## Complete Examples

### 1. Session Emoji Configuration Command

Add this to `hooks/session-emoji/index.ts`:

```typescript
export default function (pi: HookAPI) {
  // ... existing code ...

  // Register /emoji command for interactive configuration
  pi.registerCommand("emoji", {
    description: "Configure session emoji settings",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("This command requires interactive mode", "error");
        return;
      }

      const settings = (ctx as any).settingsManager?.getSettings() ?? {};
      const currentConfig = {
        ...DEFAULT_CONFIG,
        ...(settings.sessionEmoji ?? {}),
      };

      // Main menu
      const action = await ctx.ui.select(
        "Session Emoji Configuration",
        [
          "Change mode",
          "Set threshold",
          "View current settings",
          "Reset to defaults",
          "Cancel"
        ]
      );

      if (!action || action === "Cancel") return;

      switch (action) {
        case "Change mode":
          const mode = await ctx.ui.select(
            "Choose emoji assignment mode:",
            ["ai", "delayed", "immediate"]
          );
          if (mode) {
            ctx.ui.notify(`Mode: ${mode}`, "success");
            ctx.ui.notify("To persist: Add to ~/.pi/agent/settings.json:", "info");
            ctx.ui.notify(`  "sessionEmoji": { "autoAssignMode": "${mode}" }`, "info");
          }
          break;

        case "Set threshold":
          const threshold = await ctx.ui.input(
            "Messages before emoji assignment:",
            String(currentConfig.autoAssignThreshold)
          );
          if (threshold) {
            ctx.ui.notify(`Threshold: ${threshold} messages`, "success");
            ctx.ui.notify("To persist: Add to ~/.pi/agent/settings.json:", "info");
            ctx.ui.notify(`  "sessionEmoji": { "autoAssignThreshold": ${threshold} }`, "info");
          }
          break;

        case "View current settings":
          const configStr = JSON.stringify(currentConfig, null, 2);
          ctx.ui.notify("Current configuration:", "info");
          ctx.ui.notify(configStr, "info");
          break;

        case "Reset to defaults":
          const confirm = await ctx.ui.confirm(
            "Reset to defaults?",
            "This will show default settings (edit settings.json to persist)"
          );
          if (confirm) {
            const defaultStr = JSON.stringify(DEFAULT_CONFIG, null, 2);
            ctx.ui.notify("Default configuration:", "info");
            ctx.ui.notify(defaultStr, "info");
          }
          break;
      }
    }
  });

  // Register /emoji-test command to test different emoji sets
  pi.registerCommand("emoji-test", {
    description: "Preview emoji sets",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;

      const set = await ctx.ui.select(
        "Preview emoji set:",
        ["default", "animals", "tech", "fun"]
      );

      if (set && set in EMOJI_SETS) {
        const emojis = EMOJI_SETS[set as keyof typeof EMOJI_SETS];
        ctx.ui.notify(`${set} set: ${emojis.join(" ")}`, "info");
        ctx.ui.notify(`To use: "sessionEmoji": { "emojiSet": "${set}" }`, "info");
      }
    }
  });
}
```

### 2. Background Notify Configuration Command

Add this to `hooks/background-notify/index.ts`:

```typescript
export default function (pi: HookAPI) {
  // ... existing code ...

  // Register /notify command for configuration
  pi.registerCommand("notify", {
    description: "Configure background notification settings",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("This command requires interactive mode", "error");
        return;
      }

      const settings = (ctx as any).settingsManager?.getSettings() ?? {};
      const currentConfig = {
        ...DEFAULT_CONFIG,
        ...(settings.backgroundNotify ?? {}),
      };

      const action = await ctx.ui.select(
        "Background Notify Configuration",
        [
          "Toggle beep",
          "Toggle bring-to-front",
          "Set threshold",
          "Test beep sound",
          "View current settings",
          "Cancel"
        ]
      );

      if (!action || action === "Cancel") return;

      switch (action) {
        case "Toggle beep":
          const newBeep = !currentConfig.beep;
          ctx.ui.notify(`Beep: ${newBeep ? "enabled" : "disabled"}`, "success");
          ctx.ui.notify("To persist: Add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(`  "backgroundNotify": { "beep": ${newBeep} }`, "info");
          break;

        case "Toggle bring-to-front":
          const newFront = !currentConfig.bringToFront;
          ctx.ui.notify(`Bring-to-front: ${newFront ? "enabled" : "disabled"}`, "success");
          ctx.ui.notify("To persist: Add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(`  "backgroundNotify": { "bringToFront": ${newFront} }`, "info");
          break;

        case "Set threshold":
          const threshold = await ctx.ui.input(
            "Threshold in milliseconds:",
            String(currentConfig.thresholdMs)
          );
          if (threshold) {
            const ms = parseInt(threshold, 10);
            if (!isNaN(ms)) {
              ctx.ui.notify(`Threshold: ${ms}ms (${(ms/1000).toFixed(1)}s)`, "success");
              ctx.ui.notify("To persist: Add to ~/.pi/agent/settings.json:", "info");
              ctx.ui.notify(`  "backgroundNotify": { "thresholdMs": ${ms} }`, "info");
            }
          }
          break;

        case "Test beep sound":
          ctx.ui.notify("Playing beep...", "info");
          await playBeep();
          ctx.ui.notify("Did you hear the beep?", "success");
          break;

        case "View current settings":
          const configStr = JSON.stringify(currentConfig, null, 2);
          ctx.ui.notify("Current configuration:", "info");
          ctx.ui.notify(configStr, "info");
          break;
      }
    }
  });

  // Register /notify-test command to trigger a test notification
  pi.registerCommand("notify-test", {
    description: "Test background notification (beep + bring-to-front)",
    handler: async (args, ctx) => {
      const settings = (ctx as any).settingsManager?.getSettings() ?? {};
      const config = { ...DEFAULT_CONFIG, ...(settings.backgroundNotify ?? {}) };

      ctx.ui.notify("Testing notification in 3 seconds...", "info");
      ctx.ui.notify("Switch to another app now!", "warning");

      await new Promise(resolve => setTimeout(resolve, 3000));

      if (config.beep) {
        await playBeep();
      }

      if (config.bringToFront) {
        await bringTerminalToFront(terminalApp, terminalPid, terminalTTY);
      }

      ctx.ui.notify("Test complete!", "success");
    }
  });
}
```

## Features You Can Add via Slash Commands

### Configuration Helpers

```typescript
// View current config
pi.registerCommand("mycommand-config", {
  description: "View current configuration",
  handler: async (args, ctx) => {
    const settings = (ctx as any).settingsManager?.getSettings() ?? {};
    const config = settings.myHook ?? {};
    ctx.ui.notify(JSON.stringify(config, null, 2), "info");
  }
});

// Quick toggle
pi.registerCommand("mycommand-toggle", {
  description: "Toggle feature on/off",
  handler: async (args, ctx) => {
    const settings = (ctx as any).settingsManager?.getSettings() ?? {};
    const current = settings.myHook?.enabled ?? true;
    ctx.ui.notify(`Currently: ${current ? "ON" : "OFF"}`, "info");
    ctx.ui.notify(`To toggle: Set "enabled": ${!current} in settings.json`, "info");
  }
});
```

### Interactive Wizards

```typescript
pi.registerCommand("mycommand-setup", {
  description: "Interactive setup wizard",
  handler: async (args, ctx) => {
    if (!ctx.hasUI) return;

    // Multi-step configuration
    const step1 = await ctx.ui.select("Step 1: Choose mode", ["option1", "option2"]);
    if (!step1) return;

    const step2 = await ctx.ui.input("Step 2: Enter threshold", "5");
    if (!step2) return;

    const step3 = await ctx.ui.confirm("Step 3: Enable feature?", "Recommended");

    // Show final configuration
    const config = {
      mode: step1,
      threshold: parseInt(step2),
      enabled: step3
    };

    ctx.ui.notify("Copy this to ~/.pi/agent/settings.json:", "success");
    ctx.ui.notify(JSON.stringify({ myHook: config }, null, 2), "info");
  }
});
```

### Testing & Preview

```typescript
// Preview feature without persisting
pi.registerCommand("mycommand-preview", {
  description: "Preview a setting temporarily",
  handler: async (args, ctx) => {
    // Temporarily modify in-memory state
    // Show preview
    // Reset on next session
  }
});

// Test functionality
pi.registerCommand("mycommand-test", {
  description: "Test the hook functionality",
  handler: async (args, ctx) => {
    ctx.ui.notify("Running test...", "info");
    // Execute test logic
    ctx.ui.notify("Test complete!", "success");
  }
});
```

### Status & Debugging

```typescript
pi.registerCommand("mycommand-status", {
  description: "Show hook status",
  handler: async (args, ctx) => {
    // Show internal state
    ctx.ui.notify(`Hook loaded: YES`, "success");
    ctx.ui.notify(`Active sessions: ${count}`, "info");
    ctx.ui.notify(`Last action: ${timestamp}`, "info");
  }
});

pi.registerCommand("mycommand-debug", {
  description: "Debug information",
  handler: async (args, ctx) => {
    const info = {
      sessionId: ctx.sessionManager.getSessionId(),
      cwd: ctx.cwd,
      hasUI: ctx.hasUI,
      model: ctx.model?.id,
      // Add hook-specific debug info
    };
    ctx.ui.notify(JSON.stringify(info, null, 2), "info");
  }
});
```

## Important Notes

### Settings Are Read-Only in Hooks

⚠️ **Hooks can READ settings but cannot WRITE them directly**

```typescript
// ✅ You CAN do this (read settings)
const settings = (ctx as any).settingsManager?.getSettings() ?? {};
const config = settings.myHook ?? {};

// ❌ You CANNOT do this (write settings)
// settings.myHook.enabled = false; // Won't persist!
```

**Why?** Settings are loaded at startup and stored in `~/.pi/agent/settings.json`. Changes would need to:
1. Write to the JSON file
2. Reload settings
3. Notify all hooks

**Solution:** Have commands show the user what to add to their settings file:

```typescript
ctx.ui.notify("To persist this change, add to ~/.pi/agent/settings.json:", "info");
ctx.ui.notify(`  "myHook": { "option": "value" }`, "info");
```

### Command Arguments

Commands receive everything after the slash command as `args`:

```typescript
// User types: /emoji set ai
// args = "set ai"

pi.registerCommand("emoji", {
  handler: async (args, ctx) => {
    const parts = args.trim().split(/\s+/);
    const subcommand = parts[0]; // "set"
    const value = parts[1];       // "ai"
    
    if (subcommand === "set" && value) {
      // Handle: /emoji set ai
    } else {
      // Show menu or help
    }
  }
});
```

### Best Practices

1. **Always check `ctx.hasUI`** before using UI methods
2. **Show configuration snippets** users can copy to settings.json
3. **Provide preview/test commands** so users can try before persisting
4. **Use clear descriptions** - shown in `/help` output
5. **Handle cancellation** - users can press Escape in dialogs
6. **Give feedback** - use `ctx.ui.notify()` to confirm actions

### Complete Command Pattern

```typescript
pi.registerCommand("mycommand", {
  description: "Brief description shown in /help",
  handler: async (args, ctx) => {
    // 1. Check UI availability
    if (!ctx.hasUI) {
      ctx.ui.notify("Requires interactive mode", "error");
      return;
    }

    // 2. Get current settings
    const settings = (ctx as any).settingsManager?.getSettings() ?? {};
    const config = { ...DEFAULT_CONFIG, ...(settings.myHook ?? {}) };

    // 3. Parse arguments or show menu
    if (args.trim()) {
      // Handle command line args: /mycommand arg1 arg2
    } else {
      // Show interactive menu
      const choice = await ctx.ui.select("Options:", ["A", "B", "C"]);
      if (!choice) return; // Cancelled
      
      // Process choice
    }

    // 4. Provide feedback
    ctx.ui.notify("Action completed!", "success");
    
    // 5. Show how to persist
    ctx.ui.notify("To save: Edit ~/.pi/agent/settings.json", "info");
  }
});
```

## Useful Command Ideas

- `/emoji` - Configure session emoji mode/threshold
- `/emoji-test` - Preview emoji sets
- `/emoji-history` - Show recent emoji usage
- `/notify` - Configure background notifications
- `/notify-test` - Test notification system
- `/hook-status` - Show all hook states
- `/hook-reload` - Suggest restart to reload hooks
- `/config` - Open settings file in editor

## Integration with Settings

### Recommended Workflow

1. **Commands provide interactive configuration**
   ```typescript
   const mode = await ctx.ui.select("Mode:", ["ai", "delayed", "immediate"]);
   ```

2. **Commands show the JSON to add**
   ```typescript
   ctx.ui.notify('Add to settings.json:', "info");
   ctx.ui.notify(`"sessionEmoji": { "autoAssignMode": "${mode}" }`, "info");
   ```

3. **Commands can offer to open settings**
   ```typescript
   const shouldOpen = await ctx.ui.confirm(
     "Open settings file?",
     "You'll need to restart pi after editing"
   );
   if (shouldOpen) {
     ctx.ui.notify("Opening: ~/.pi/agent/settings.json", "info");
     // User can then edit manually
   }
   ```

4. **User edits settings.json and restarts pi**

This workflow:
- ✅ Keeps hooks simple (no file writing)
- ✅ Maintains single source of truth (settings.json)
- ✅ Makes configuration discoverable (via slash commands)
- ✅ Provides interactive guidance
- ✅ Preserves explicit configuration

## Example: Full Feature Implementation

See the examples above for session-emoji and background-notify hooks with complete interactive configuration commands!

Would you like me to implement these configuration commands for the hooks in this repository?
