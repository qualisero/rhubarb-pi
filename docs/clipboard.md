# Clipboard Extension

Agent tool to save specific text to the system clipboard.

## Overview

The clipboard extension provides a `copy_to_clipboard` tool that the agent can use to save commands, code snippets, and configurations to your system clipboard. The agent uses this selectively when it identifies content you might need to paste elsewhere.

## Features

- **Agent-driven**: Agent decides when copying would be helpful
- **Cross-platform**: macOS (pbcopy), Linux (xclip), Windows (clip.exe via Git Bash)
- **Selective usage**: Only for relevant content (commands to rerun, snippets, configs)
- **Visual feedback**: Clear TUI indication ("📋 Saved to clipboard")
- **Clean formatting**: Minimal trailing indicator design
- **Size limit**: 100KB maximum to prevent clipboard overflow
- **Graceful degradation**: Installation instructions if clipboard tool unavailable

## Installation

```bash
npm run install:clipboard
```

Or manually:

```bash
cp -r extensions/clipboard ~/.pi/agent/extensions/
```

**Restart pi** for the extension to load.

## Platform Requirements

| Platform | Tool | Installation |
|----------|------|--------------|
| macOS | `pbcopy` | Built-in ✓ |
| Linux | `xclip` | `sudo apt install xclip` |
| Windows | `clip.exe` | Via Git Bash ✓ |

### Linux Setup

If you get "Clipboard tool not available" on Linux:

```bash
# Debian/Ubuntu
sudo apt install xclip

# RHEL/CentOS
sudo yum install xclip

# Arch
sudo pacman -S xclip
```

## Usage

The agent automatically uses this tool when appropriate. **The agent is strongly encouraged to use this tool whenever you express intent to use content elsewhere.**

### Trigger Phrases

The agent will recognize phrases like:
- "copy this to clipboard"
- "save this for me"
- "I need this for my dissertation"
- "give me X to use in Y"
- "I want to paste this elsewhere"

You don't need to invoke the tool manually—just express your intent naturally.

### ✅ Good Usage Examples

**User expresses intent:**
```
You: Give me a paragraph about lemurs for my dissertation

Agent: [provides paragraph]

```text
Lemurs are fascinating primates endemic to Madagascar...
```

📋 Saved to clipboard
```

**Installation commands:**
```
You: How do I install pi?

Agent: Install pi globally with npm:

```bash
npm install -g @mariozechner/pi-coding-agent
```

📋 Saved to clipboard
```

**Configuration snippets:**
```
You: What should I add to .gitignore?

Agent: Add these entries:

```gitignore
node_modules/
.env
dist/
```

📋 Saved to clipboard
```

**Reusable commands:**
```
You: How do I restart the Docker service?

Agent: Run this command:

```bash
docker-compose restart api
```

📋 Saved to clipboard
```

### ❌ What the Agent Should Avoid

- ❌ Copying entire files already shown in conversation
- ❌ Copying log output or diagnostics
- ❌ Copying every code block regardless of context
- ❌ Copying general conversation text

## TUI Display

**Tool call:**
```
copy_to_clipboard installation command
```

**Success:**
```
📋 Saved to clipboard
```

**Error:**
```
✗ Clipboard unavailable
```

## How It Works

1. Agent identifies relevant content (command, snippet, config)
2. Calls `copy_to_clipboard` tool with the text
3. Platform-specific clipboard command executes:
   - macOS: `pbcopy`
   - Linux: `xclip -selection clipboard`
   - Windows: `clip.exe`
4. Agent confirms in response what was copied
5. You paste with `Cmd+V` (macOS) or `Ctrl+V` (Windows/Linux)

## Size Limit

Maximum clipboard size: **100KB**

For larger content, the agent should save it to a file instead.

## Troubleshooting

### Linux: "Clipboard tool not available"

Install xclip (see [Platform Requirements](#platform-requirements)).

### Windows: "Clipboard tool not available"

Run pi through Git Bash. Other shells (Cygwin, MSYS2) should have `clip.exe` available, but Git Bash is recommended.

Verify:
```bash
which clip.exe
```

### Nothing happens when I paste

Check that the agent confirmed the copy operation in its response. If you see "📋 Content saved to clipboard" in the TUI but pasting doesn't work, your clipboard tool may not be properly configured.

## Technical Details

- **Tool name**: `copy_to_clipboard`
- **Parameters**: `text` (string), `label` (optional string)
- **Max size**: 100KB (102,400 bytes)
- **Platform detection**: Uses `process.platform`
- **Tool check**: Uses `which` (Unix) or `where` (Windows)
- **Execution**: Feeds text via stdin to clipboard command

## Extension Details

- **Location**: `~/.pi/agent/extensions/clipboard/index.ts`
- **Type**: Custom tool registration
- **Dependencies**: None (uses system clipboard tools)
- **Mode support**: Interactive only (no-op in print/RPC mode)

## Uninstall

```bash
npm run uninstall:clipboard
```

Or manually:

```bash
rm -rf ~/.pi/agent/extensions/clipboard
```

Restart pi for the change to take effect.

## See Also

- [Extension implementation](../extensions/clipboard/index.ts)
- [Implementation plan](../extensions/clipboard/PLAN.md)
- [Extension README](../extensions/clipboard/README.md)
