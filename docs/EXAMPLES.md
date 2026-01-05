# Configuration Examples

## Default Configuration

Enables all features with 5-second threshold:

```json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 5000,
    "beep": true,
    "bringToFront": true
  }
}
```

## Beep Only (No Window Switching)

Useful if you want audio notification but prefer manual window switching:

```json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 5000,
    "beep": true,
    "bringToFront": false
  }
}
```

## Silent Bring-to-Front

Brings window to front without beeping (less disruptive):

```json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 5000,
    "beep": false,
    "bringToFront": true
  }
}
```

## Long Tasks Only (30 seconds)

Only notify for very long tasks:

```json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 30000,
    "beep": true,
    "bringToFront": true
  }
}
```

## Notification Only

Just show the UI notification without beep or window switching:

```json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 5000,
    "beep": false,
    "bringToFront": false
  }
}
```

## Disabled

Completely disable the hook:

```json
{
  "backgroundNotify": {
    "enabled": false
  }
}
```

## Per-Project Configuration

You can override global settings per-project by creating `.pi/settings.json`:

### Project 1: Aggressive (immediate notification)
```json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 2000,
    "beep": true,
    "bringToFront": true
  }
}
```

### Project 2: Conservative (only long tasks)
```json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 60000,
    "beep": false,
    "bringToFront": true
  }
}
```

### Project 3: Disabled
```json
{
  "backgroundNotify": {
    "enabled": false
  }
}
```

## Combining with Other Settings

Full settings.json example with multiple configurations:

```json
{
  "theme": "dark",
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514",
  "defaultThinkingLevel": "medium",
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  },
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 5000,
    "beep": true,
    "bringToFront": true
  },
  "hooks": [
    "/path/to/other/hook.ts"
  ]
}
```

## Use Case Scenarios

### Scenario 1: Developer multitasking
**Goal**: Quick context switching between code review and waiting for build

```json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 3000,
    "beep": true,
    "bringToFront": true
  }
}
```

### Scenario 2: Focused work sessions
**Goal**: No interruptions, but want window ready when task finishes

```json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 10000,
    "beep": false,
    "bringToFront": true
  }
}
```

### Scenario 3: Background monitoring
**Goal**: Work on other tasks, get alert for very long operations only

```json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 120000,
    "beep": true,
    "bringToFront": true
  }
}
```

### Scenario 4: Pair programming / screen sharing
**Goal**: Avoid disrupting others with beeps

```json
{
  "backgroundNotify": {
    "enabled": true,
    "thresholdMs": 5000,
    "beep": false,
    "bringToFront": false
  }
}
```

## Testing Different Configurations

Quick test commands for each threshold:

```bash
# Test 2 seconds (should NOT trigger with 5s threshold)
pi -p "run: sleep 2 && echo 'done'"

# Test 6 seconds (SHOULD trigger with 5s threshold)
pi -p "run: sleep 6 && echo 'done'"

# Test 10 seconds (test longer threshold)
pi -p "run: sleep 10 && echo 'done'"

# Test 35 seconds (test 30s threshold)
pi -p "run: sleep 35 && echo 'done'"
```

Remember to switch to another app (Cmd+Tab) immediately after running the command to test background detection!

## Troubleshooting Configurations

### Hook not triggering?

1. **Check duration**: Ensure task exceeds `thresholdMs`
2. **Check enabled**: Verify `"enabled": true`
3. **Check background**: Make sure terminal is actually backgrounded

### Getting false positives?

1. **Increase threshold**: Try `10000` (10 seconds) or higher
2. **Check if tabs count as background**: Some terminal configs might report background for inactive tabs

### Want different behavior per project?

Create `.pi/settings.json` in project root with project-specific config.

### Need to disable temporarily?

Set `"enabled": false` instead of removing the entire configuration block.
