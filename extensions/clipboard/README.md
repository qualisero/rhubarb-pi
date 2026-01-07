# Clipboard Extension

A pi agent extension that provides a `copy_to_clipboard` tool, allowing the agent to save specific text to the system clipboard.

## Features

- **Agent-driven**: The agent decides when copying would be helpful
- **Cross-platform**: Works on macOS, Linux, and Windows (via Git Bash)
- **Selective usage**: Designed for relevant content only (commands, snippets, configs)
- **Visual feedback**: Clean minimal trailing indicator ("📋 Saved to clipboard")
- **Easy selection**: Content presented in clean code blocks for manual copying
- **Graceful degradation**: Provides installation instructions if clipboard tool unavailable

## Installation

### Global Installation

```bash
# Copy extension to global extensions directory
cp -r ./extensions/clipboard ~/.pi/agent/extensions/
```

### Project-Local Installation

```bash
# Copy extension to project extensions directory
mkdir -p .pi/extensions
cp -r ./extensions/clipboard .pi/extensions/
```

## Platform Requirements

| Platform | Tool Required | Installation |
|----------|---------------|--------------|
| macOS    | `pbcopy`      | Built-in (no installation needed) |
| Linux    | `xclip`       | `sudo apt install xclip` (Debian/Ubuntu)<br>`sudo yum install xclip` (RHEL/CentOS)<br>`sudo pacman -S xclip` (Arch) |
| Windows  | `clip.exe`    | Available via Git Bash |

## Usage

The agent automatically uses this tool when it identifies content you might need to copy. **The agent is strongly encouraged to use this tool whenever you express intent to use content elsewhere.**

### Trigger Phrases

The agent will recognize phrases like:
- "copy this to clipboard"
- "save this for me"
- "I need this for my dissertation"
- "give me X to use in Y"
- "I want to paste this elsewhere"

### ✅ Good Usage Examples

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

Agent: Add these entries to your .gitignore:

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

Agent: Use this command:

```bash
docker-compose restart api
```

📋 Saved to clipboard
```

### ❌ Avoid These Patterns

- ❌ Copying entire file contents that are already visible
- ❌ Copying log output or diagnostic information
- ❌ Copying every code block regardless of context
- ❌ Copying general conversation text

## How It Works

1. Agent identifies relevant content (command, snippet, config)
2. Calls `copy_to_clipboard` tool with the text
3. Extension uses platform-specific clipboard command:
   - macOS: `pbcopy`
   - Linux: `xclip -selection clipboard`
   - Windows: `clip.exe`
4. Agent confirms what was copied in its response
5. User can paste with `Cmd+V` (macOS) or `Ctrl+V` (Windows/Linux)

## TUI Rendering

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

## Troubleshooting

### Linux: "Clipboard tool not available"

Install xclip:
```bash
# Debian/Ubuntu
sudo apt install xclip

# RHEL/CentOS
sudo yum install xclip

# Arch
sudo pacman -S xclip
```

### Windows: "Clipboard tool not available"

Ensure you're running pi through Git Bash, which provides `clip.exe`. If using another shell (Cygwin, MSYS2), verify `clip.exe` is available:

```bash
which clip.exe
```

### Content Too Large

The extension has a 100KB size limit. For larger content, the agent should save it to a file instead.

## Configuration

No configuration required. The extension automatically detects the platform and uses the appropriate clipboard tool.

## Examples

See `PLAN.md` for detailed implementation notes and additional usage examples.
