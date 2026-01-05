# Safe Git Extension

A pi coding agent extension that requires explicit user approval before dangerous git and GitHub CLI operations.

## Installation

**Global (all projects):**
```bash
npm run install:safe-git
```

**Uninstall:**
```bash
npm run uninstall:safe-git
```

**Important:** Restart pi after installing.

## Configuration

Add to `~/.pi/agent/settings.json`:

```json
{
  "safeGit": {
    "enabledByDefault": true,
    "promptLevel": "medium"
  }
}
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `enabledByDefault` | `true` | Enable protection for new sessions |
| `promptLevel` | `"medium"` | `"high"`, `"medium"`, or `"none"` |

### Prompt Levels

- **high**: Only prompt for high-risk (force push, hard reset, etc.)
- **medium**: Prompt for medium and high risk (default)
- **none**: No prompts (effectively disabled)

## Protected Operations

| Severity | Operations |
|----------|------------|
| 🔴 High | force push, hard reset, clean, stash drop/clear, delete branch, expire reflog |
| 🟡 Medium | push, commit, rebase, merge, tag, cherry-pick, revert, apply patches, **gh CLI** |

## Commands

- `/safegit` - Toggle protection on/off for this session
- `/safegit-level [high|medium|none]` - Set prompt level
- `/safegit-status` - Show current status and settings

## Behavior

- **Interactive mode**: Shows confirmation dialog before execution
- **Non-interactive mode**: Blocks entirely (no approval possible = fail-safe)

## Example

```
🟡 Git push requires approval

The agent wants to run:

  git push origin main

Allow this operation?
[Yes] [No]
```

High-risk operations show additional warnings:

```
🔴 Git force push requires approval

⚠️ HIGH RISK OPERATION

The agent wants to run:

  git push --force origin main

This operation can cause data loss. Allow?
[Yes] [No]
```

## License

MIT
