# 🔒 Safe Git

Require explicit user approval before dangerous git operations.

## Why?

By default, AI agents can run any git command. This extension adds a safety layer ensuring you approve state-changing operations before they execute. In headless/non-interactive mode, operations are blocked entirely.

## Installation

```bash
npm run install:safe-git
```

Restart pi after installing.

## Uninstall

```bash
npm run uninstall:safe-git
```

## Protected Operations

| Severity | Operations |
|----------|------------|
| 🔴 High | force push, hard reset, clean, stash drop/clear, delete branch, expire reflog |
| 🟡 Medium | push, commit, rebase, merge, tag, cherry-pick, revert, apply patches |

### Safe Operations (No Approval)

These read-only operations run without prompts:
- `git status`
- `git log`
- `git diff`
- `git show`
- `git branch` (list only)
- `git fetch`
- `git remote -v`

## Behavior

### Interactive Mode

Shows confirmation dialog before execution:

```
🟡 Git push requires approval

The agent wants to run:

  git push origin main

Allow this operation?
[Yes] [No]
```

### High-Risk Operations

Additional warning for dangerous commands:

```
🔴 Git force push requires approval

⚠️ HIGH RISK OPERATION

The agent wants to run:

  git push --force origin main

This operation can cause data loss. Allow?
[Yes] [No]
```

### Non-Interactive Mode

All protected operations are **blocked entirely**. This is a fail-safe—if no user can approve, the operation should not proceed.

## Configuration

No configuration options. The extension applies globally once installed.

## How It Works

1. Intercepts all `bash` tool calls
2. Parses command to detect git operations
3. Classifies risk level based on subcommand and flags
4. In interactive mode: prompts for approval
5. In non-interactive mode: blocks and returns error

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
```

### High Risk (Red Warning)
```bash
git push --force origin main
git reset --hard HEAD~5
git clean -fd
git branch -D feature
git stash drop
```
