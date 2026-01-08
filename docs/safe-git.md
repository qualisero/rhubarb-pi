# 🔒 Safe Git

Require explicit user approval before dangerous git and GitHub CLI operations.

## Why?

By default, AI agents can run any git/gh command. This extension adds a safety layer ensuring you approve state-changing operations before they execute. In headless/non-interactive mode, operations are blocked entirely.

## Installation

```bash
npm run install:safe-git
```

Restart pi after installing.

## Uninstall

```bash
npm run uninstall:safe-git
```

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
| `promptLevel` | `"medium"` | When to prompt: `"high"`, `"medium"`, or `"none"` |

### Prompt Levels

| Level | Description |
|-------|-------------|
| `high` | Only prompt for high-risk operations (force push, hard reset, etc.) |
| `medium` | Prompt for medium and high risk operations (default) |
| `none` | No prompts (effectively disables the extension) |

## Protected Operations

| Severity | Operations |
|----------|------------|
| 🔴 High | force push, hard reset, clean, stash drop/clear, delete branch, expire reflog |
| 🟡 Medium | push, commit, rebase, merge, tag, cherry-pick, revert, apply patches, **gh CLI** |

### Safe Operations (No Approval)

These read-only operations run without prompts:
- `git status`, `git log`, `git diff`, `git show`
- `git branch` (list only)
- `git fetch`, `git remote -v`

## Commands

### `/safegit` - Toggle On/Off

```
> /safegit
🔒 Safe-git protection ON

> /safegit
🔓 Safe-git protection OFF
```

### `/safegit-level` - Set Prompt Level

```
# Direct setting
> /safegit-level high
🔴 Only high-risk operations require approval

> /safegit-level medium
🟡 Medium and high-risk operations require approval

> /safegit-level none
⚠️ No approval required (protection disabled)

# Interactive mode
> /safegit-level
Current level: medium

Set prompt level:
  1. 🔴 high - Only high-risk (force push, hard reset, etc.)
  2. 🟡 medium - Medium and high-risk (push, commit, etc.)
  3. ⚠️ none - No prompts (disable protection)
  4. ❌ Cancel
```

### `/safegit-status` - Show Status

```
> /safegit-status
─── Safe Git Status ───

Session State:
  Enabled: 🔒 ON
  Prompt Level: medium

⏱️  Auto-approved for THIS SESSION ONLY:
  ✅ All "git push" commands
  ✅ All "git commit" commands

  (Auto-approvals reset when session ends)

⏱️  Auto-blocked for THIS SESSION ONLY:
  🚫 All "git force push" commands
  🚫 All "git GitHub CLI" commands

  (Auto-blocks reset when session ends)

Global Defaults:
  Enabled: ON
  Prompt Level: medium

Prompt Levels:
  🔴 high   - force push, hard reset, clean, delete branch
  🟡 medium - push, commit, rebase, merge, tag, gh CLI

Commands: /safegit /safegit-level /safegit-status
───────────────────────
```

## Behavior

### Interactive Mode

Shows confirmation dialog with four options:

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

**Option Descriptions:**
- **Allow once:** Approve this specific command, will prompt again next time
- **Decline this time:** Block this command but ask again next time (doesn't set permanent block)
- **Auto-approve all:** Automatically approve all "git push" commands for the remainder of this session
- **Auto-block all:** Automatically block all "git push" commands for the remainder of this session

**Session Behavior:**
- Auto-approvals and auto-blocks are **session-only** and reset when you start a new session or restart pi
- You can view current auto-approvals and auto-blocks with `/safegit-status`
- Auto-blocks prevent the agent from even asking - commands are silently blocked

### High-Risk Operations

Additional warning for dangerous commands:

```
🔴 Git force push requires approval

⚠️ HIGH RISK OPERATION

The agent wants to run:

  git push --force origin main

This operation can cause data loss.

Options:
  ✅ Allow this command once
  ⏭️  Decline this time (ask again later)
  ✅✅ Auto-approve all "git force push" for this session only
  🚫 Auto-block all "git force push" for this session only
```

### GitHub CLI

All `gh` commands are treated as medium-risk:

```
🟡 Git GitHub CLI requires approval

The agent wants to run:

  gh pr create --title "Feature" --body "Description"

Options:
  ✅ Allow this command once
  ⏭️  Decline this time (ask again later)
  ✅✅ Auto-approve all "git GitHub CLI" for this session only
  🚫 Auto-block all "git GitHub CLI" for this session only
```

### Non-Interactive Mode

All protected operations are **blocked entirely**. This is a fail-safe—if no user can approve, the operation should not proceed.

### Session Auto-Approval

- When you choose "Auto-approve all" for a specific action, it's stored **only for the current session**
- Auto-approved actions are tracked in memory (`sessionApprovedActions` Set)
- All session approvals are cleared when:
  - A new session starts
  - You restart pi
- This ensures auto-approvals and auto-blocks never persist beyond your current work session

## How It Works

1. Intercepts all `bash` tool calls
2. Parses command to detect git/gh operations
3. Classifies risk level based on subcommand and flags
4. Checks if action is already auto-blocked for this session (silent block if yes)
5. Checks if action is already auto-approved for this session (allow if yes)
6. Checks prompt level to decide if approval needed
7. In interactive mode: prompts with four options:
   - Allow once
   - Auto-approve all for session
   - Skip this time (block once, ask again later)
   - Auto-block all for session
8. In non-interactive mode: blocks and returns error
9. Clears all auto-approvals and auto-blocks when session starts/ends

## Examples

### Allowed Without Prompt
```bash
git status
git log --oneline -10
git diff HEAD~1
git fetch origin
```

### Medium Risk (Yellow Prompt)
```bash
git commit -m "message"
git push origin main
git merge feature-branch
git rebase main
git tag v1.0.0
gh pr create
gh issue create
gh release create
```

### High Risk (Red Warning)
```bash
git push --force origin main
git reset --hard HEAD~5
git clean -fd
git branch -D feature
git stash drop
```

## Tips

- Use `/safegit-level high` if you trust commit/push but want protection from destructive operations
- Use `/safegit` to temporarily disable when doing bulk operations
- Session overrides reset when you start a new session
