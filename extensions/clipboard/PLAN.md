# Copy-to-Clipboard Extension - Implementation Plan

## Overview
A custom **tool** (not command) that allows the agent to save specific text blocks to the system clipboard. The agent can call this proactively when it identifies content the user might need to copy.

## Approach: Custom Tool Registration

### Why a Tool?
- Agent can decide when clipboard copying would be helpful
- Called programmatically during conversations
- Appears in system prompt so agent knows it's available
- Returns structured feedback to agent about success/failure

### Key Design Decisions

1. **Tool (not command)**: Agent uses it directly, no manual invocation needed
2. **Selective usage**: Agent should only copy when content is **relevant** - commands to reuse, snippets to paste elsewhere, etc.
3. **Visual feedback**: Agent must highlight in conversation what was saved
4. **Concise TUI**: Simple "[emoji] Content saved to clipboard" message

---

## Implementation Strategy

### 1. Tool Definition

```typescript
pi.registerTool({
  name: "copy_to_clipboard",
  label: "Copy to Clipboard",
  description: `Save text to the system clipboard for user convenience.

IMPORTANT USAGE GUIDELINES:
- Only use when content is RELEVANT to the user's workflow
- Use for: commands to rerun, code snippets to paste, configurations to save elsewhere
- STRONGLY RECOMMENDED: Use whenever user expresses intent to copy, paste, or use content elsewhere
  Examples: "copy this", "save to clipboard", "I need this for my dissertation", "give me X to use in Y"
- Do NOT use for: general output, logs, or content already visible in conversation
- ALWAYS provide visual feedback in your response highlighting what was saved
  Example: "I've saved this command to your clipboard: \`docker run ...\`"

The tool succeeds silently - ensure your message clearly indicates what was copied.`,
  
  parameters: Type.Object({
    text: Type.String({ 
      description: "Text to copy to clipboard" 
    }),
    label: Type.Optional(Type.String({ 
      description: "Optional short label (e.g., 'installation command', 'config snippet')" 
    })),
  }),
  
  async execute(toolCallId, params, onUpdate, ctx, signal) {
    // Implementation
  }
})
```

### 2. Platform-Specific Clipboard Access

Use platform-specific commands via `pi.exec()`:

```typescript
const platform = process.platform;
const clipboardCmd = {
  'darwin': { cmd: 'pbcopy', args: [] },
  'linux': { cmd: 'xclip', args: ['-selection', 'clipboard'] },
  'win32': { cmd: 'clip.exe', args: [] },
}[platform];

// Feed text via stdin
const result = await pi.exec(
  clipboardCmd.cmd, 
  clipboardCmd.args,
  { 
    stdin: params.text,
    signal 
  }
);
```

### 3. Fallback Handling

Check if clipboard tool is available:

```typescript
// Test if tool exists
const testResult = await pi.exec('which', [clipboardCmd.cmd], { 
  timeout: 1000 
});

if (testResult.code !== 0) {
  const instructions = {
    'darwin': 'pbcopy should be available by default',
    'linux': 'Install xclip: sudo apt install xclip',
    'win32': 'clip.exe should be available via Git Bash',
  };
  
  return {
    content: [{ 
      type: "text", 
      text: `Clipboard unavailable. ${instructions[platform]}` 
    }],
    isError: true
  };
}
```

### 4. Custom Rendering

**Concise visual feedback in TUI:**

```typescript
renderCall(args, theme) {
  const preview = args.text.length > 50 
    ? args.text.substring(0, 47) + "..." 
    : args.text;
  
  return new Text(
    theme.fg("toolTitle", theme.bold("copy_to_clipboard ")) +
    theme.fg("dim", args.label || preview),
    0, 0
  );
},

renderResult(result, options, theme) {
  if (result.isError) {
    return new Text(theme.fg("error", "✗ Clipboard unavailable"), 0, 0);
  }
  
  // Concise success message with emoji
  return new Text(
    theme.fg("success", "📋 Content saved to clipboard"),
    0, 0
  );
}
```

### 5. Additional Features

**a) Size limit:**
```typescript
const MAX_CLIPBOARD_SIZE = 1024 * 100; // 100KB
if (params.text.length > MAX_CLIPBOARD_SIZE) {
  return {
    content: [{ 
      type: "text", 
      text: `Content too large (${params.text.length} bytes, max ${MAX_CLIPBOARD_SIZE})` 
    }],
    isError: true
  };
}
```

**b) Silent notification (optional):**
```typescript
// Only notify if UI available (not in print mode)
if (ctx.hasUI) {
  ctx.ui.notify("📋 Copied to clipboard", "info");
}
```

**c) Return details for agent:**
```typescript
return {
  content: [{ type: "text", text: "Saved to clipboard" }],
  details: { 
    bytes: params.text.length,
    label: params.label 
  }
};
```

---

## File Structure

```
~/.pi/agent/extensions/
└── clipboard/
    ├── index.ts           # Main extension
    └── README.md          # Usage documentation
```

No external dependencies needed (uses system clipboard tools).

---

## Agent Usage Examples

### ✅ Good Usage (Relevant)

1. **Installation command:**
   ```
   Agent: "Here's the installation command:
   
   `npm install -g @mariozechner/pi-coding-agent`
   
   I've saved this to your clipboard so you can paste it directly."
   ```

2. **Configuration snippet:**
   ```
   Agent: "Add this to your .gitignore:
   
   ```
   node_modules/
   .env
   dist/
   ```
   
   I've copied this to your clipboard."
   ```

3. **Reusable command:**
   ```
   Agent: "To restart the service, run:
   
   `docker-compose restart api`
   
   This is now in your clipboard for quick access."
   ```

### ❌ Bad Usage (Not Relevant)

1. ❌ Copying entire file contents already shown
2. ❌ Copying logs or diagnostics output
3. ❌ Copying general conversation text
4. ❌ Using for every code block regardless of context

---

## Advantages

1. **Agent-driven**: Agent decides when useful
2. **Cross-platform**: macOS, Linux, Windows (Git Bash)
3. **Non-invasive**: No pi core modifications
4. **Visible**: Shows in conversation what was copied
5. **Graceful degradation**: Instructions if tool unavailable
6. **Lightweight**: No npm dependencies
7. **Clear guidance**: Tool description teaches agent proper usage

---

## Next Steps

1. Implement `index.ts` with platform detection
2. Test on macOS, Linux (if available)
3. Create README with usage examples
4. Test agent behavior with various scenarios
