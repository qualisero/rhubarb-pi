# Safe Git Extension

A pi coding agent extension that requires explicit user approval before any dangerous git operations.

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

## Protected Operations

| Severity | Operations |
|----------|------------|
| 🔴 High | force push, hard reset, clean, stash drop/clear, delete branch, expire reflog |
| 🟡 Medium | push, commit, rebase, merge, tag, cherry-pick, revert, apply patches |

## Behavior

- **Interactive mode**: Shows confirmation dialog before execution
- **Non-interactive mode**: Blocks entirely (no approval possible = fail-safe)

## Example

When the agent tries to push:

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

## Why?

By default, AI agents can run any git command. This extension adds a safety layer ensuring you approve state-changing operations before they execute. In headless/non-interactive mode, these operations are blocked entirely.

## License

MIT
