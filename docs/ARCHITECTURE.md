# Rhubarb Pi Architecture

## Overview

Rhubarb Pi provides modular enhancements for the pi coding agent. Modules are organized into two types:

- **Hooks**: Event-driven modules that respond to agent lifecycle events
- **Extensions**: Command- and tool-intercepting modules that add new commands or modify behavior

## Module Types

### Hooks

Hooks register event handlers for pi agent lifecycle events and modify the footer or respond to state changes.

**Event interface:**
```typescript
export interface Hook {
  on_agent_start?(ctx: Context): Promise<void> | void;
  on_agent_end?(ctx: Context): Promise<void> | void;
  on_agent_message?(ctx: Context, message: string): Promise<void> | void;
  on_agent_error?(ctx: Context, error: Error): Promise<void> | void;
}
```

**Available hooks:**
- `background-notify` - Monitors `on_agent_end` to detect long-running tasks and notify user
- `session-emoji` - Uses `on_agent_message` to track conversation and assign emoji
- `session-color` - Assigns color on `on_agent_start` for visual distinction

### Extensions

Extensions extend pi by:
- Registering new slash commands
- Interpreting tool calls before/after execution
- Providing approval workflows for dangerous operations

**Extension interface:**
```typescript
export interface Extension {
  registerSlashCommands?(registry: SlashCommandRegistry): void;
  beforeToolExecution?(ctx: Context, tool: string, args: any): Promise<boolean> | boolean;
  afterToolExecution?(ctx: Context, tool: string, result: any): Promise<void> | void;
}
```

**Available extensions:**
- `safe-git` - Intercepts git/gh commands requiring approval

## Installation Locations

Despite the different names, **both hooks and extensions are installed to the same location**:

```
~/.pi/agent/extensions/<module-name>.ts
```

Historically, the project used `~/.pi/agent/hooks/` for hooks, but pi now expects all modules in the extensions directory. The repo's `hooks/` and `extensions/` subdirectories are organizational only.

## Configuration Loading

Settings are loaded in order of precedence:

1. **Global defaults** - `~/.pi/agent/settings.json`
2. **Project-specific** - `.pi/settings.json` (if present)
3. **Session overrides** - Runtime changes via slash commands (e.g., `/notify-beep`)

Example configuration structure:
```json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 5000,
    "beep": true,
    "beepSound": "Tink"
  },
  "sessionEmoji": {
    "enabled": true,
    "emojiSet": "default"
  }
}
```

## Module Discovery

Pi discovers modules at startup by scanning:

```
~/.pi/agent/extensions/
.pi/extensions/ (project-local)
```

Only files ending in `.ts` are loaded. If a module fails to load (syntax error, missing dependencies), pi logs a warning and continues.

## Module Interactions

### Independent Modules

All modules operate independently:
- No shared state between modules
- Each reads its own configuration from `settings.json`
- Errors in one module don't affect others

### Potential Interactions

Some subtle interactions may occur:
- Multiple footer modifications (emoji + color) - order depends on load order
- Tool interception - only the first interceptor returns `false` blocks execution
- Command registration - command names must be unique across modules

## Directory Structure

```
rhubarb-pi/
├── hooks/                    # Hook implementations
│   ├── background-notify/
│   ├── session-emoji/
│   └── session-color/
├── extensions/               # Extension implementations
│   └── safe-git/
├── scripts/
│   ├── install.sh           # Unified installer
│   ├── uninstall.sh         # Unified uninstaller
│   └── ...
└── docs/
    ├── ARCHITECTURE.md      # This file
    ├── INSTALL.md           # Installation guide
    └── ...
```

## Development Guidelines

### When to Create a Hook vs Extension

**Use a hook when:**
- You want to respond to agent lifecycle events (start, end, message, error)
- You want to modify the footer display
- You need to track state across the session

**Use an extension when:**
- You want to add new slash commands
- You need to intercept or modify tool execution
- You want to add approval workflows or safety checks

### Module Best Practices

1. **Fail gracefully**: If prerequisites are missing, log a warning and don't crash pi
2. **Keep configuration scoped**: Use a unique top-level key (e.g., `backgroundNotify`)
3. **Document commands**: List all slash commands in the module's README
4. **Test with settings empty**: Ensure modules work with minimal or no configuration
5. **Respect user preferences**: Check `enabled` or `enabledByDefault` before acting

### Naming Conventions

- **Module name**: kebab-case (`background-notify`, `safe-git`)
- **Config key**: camelCase (`backgroundNotify`, `safeGit`)
- **Command prefix**: module name hyphen (`/notify-*`, `/safegit-*`)

## Future Considerations

### Potential Unification

Since hooks and extensions share:
- Same install location
- Similar interfaces
- Same configuration mechanism

A future version could:
- Merge `hooks/` and `extensions/` into a single `modules/` directory
- Unify the `Hook` and `Extension` interfaces into a single `Module` interface

The current separation is mainly historical and for documentation clarity.
