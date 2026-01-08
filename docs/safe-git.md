# 🔒 Safe Git

Require explicit user approval before dangerous git and GitHub CLI operations.

## Installation

```bash
npm run install:safe-git
```

Restart pi after installing.

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

**Prompt Levels:**
- `high` - Only high-risk operations (force push, hard reset, clean, etc.)
- `medium` - Medium and high-risk operations (default)
- `none` - No prompts (disabled)

## Protected Operations

| Severity | Operations |
|----------|------------|
| 🔴 High | force push, hard reset, clean, stash drop/clear, delete branch |
| 🟡 Medium | push, commit, rebase, merge, tag, gh CLI |

## Approval Dialog

When a protected operation is triggered, you'll see four options:

```
🟡 Git push requires approval

The agent wants to run:
  git push origin main

Options:
  ✅ Allow this command once
  ⏭️  Decline this time (ask again later)
  ✅✅ Auto-approve all "git push" for this session only
  🚫 Auto-block all "git push" for this session only
```

**Options:**
- **Allow once** - Approve this command, prompt again next time
- **Decline** - Block this command, prompt again next time
- **Auto-approve all** - Approve all commands of this type for the session
- **Auto-block all** - Block all commands of this type for the session

**Session behavior:**
- Auto-approvals and auto-blocks reset when you start a new session or restart pi
- View current settings with `/safegit-status`
- Each action type tracked separately (push ≠ force push ≠ commit)

## Commands

- `/safegit` - Toggle protection on/off
- `/safegit-level [high|medium|none]` - Set prompt level
- `/safegit-status` - Show current approvals and blocks
