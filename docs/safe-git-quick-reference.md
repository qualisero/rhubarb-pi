# Safe-Git Quick Reference Card

## The Four Options

When the safe-git extension prompts for approval, you'll see these four options:

```
┌─────────────────────────────────────────────────────────────┐
│  🟡 Git push requires approval                              │
│                                                              │
│  The agent wants to run:                                    │
│    git push origin main                                     │
│                                                              │
│  ✅ Allow this command once                                 │
│  ⏭️  Decline this time (ask again later)                    │
│  ✅✅ Auto-approve all "git push" for this session only     │
│  🚫 Auto-block all "git push" for this session only        │
└─────────────────────────────────────────────────────────────┘
```

## Quick Decision Guide

| I want to... | Select |
|-------------|--------|
| Run this command now, decide later for next one | ✅ Allow this command once |
| Not now, but ask me again later | ⏭️ Decline this time |
| Always allow this type of command this session | ✅✅ Auto-approve all |
| Never allow this type of command this session | 🚫 Auto-block all |

## What Happens After Each Choice

### ✅ Allow this command once
- **Immediate:** Command executes
- **Next time:** You'll be prompted again
- **Session state:** Nothing saved
- **Use case:** One-off approval

### ✅✅ Auto-approve all "git {action}" for this session only
- **Immediate:** Command executes
- **Feedback:** `✅ All "git {action}" commands auto-approved for this session`
- **Next time:** No prompt, auto-approved with message
- **Session state:** Added to approved list
- **Clears:** When session ends or pi restarts
- **Use case:** "Yes, and keep saying yes for this session"

### ⏭️ Decline this time (ask again later)
- **Immediate:** Command is blocked
- **Feedback:** `ℹ️ Git {action} declined`
- **Next time:** You'll be prompted again
- **Session state:** Nothing saved
- **Use case:** "Not right now, but maybe later"

### 🚫 Auto-block all "git {action}" for this session only
- **Immediate:** Command is blocked
- **Feedback:** `🚫 All "git {action}" commands auto-blocked for this session`
- **Next time:** No prompt, silently blocked with message
- **Session state:** Added to blocked list
- **Clears:** When session ends or pi restarts
- **Use case:** "No, and keep saying no for this session"

## Common Scenarios

### Scenario 1: Working Locally Only
**Goal:** Let agent commit, but not push

**Solution:**
- When commit prompts: Select "✅✅ Auto-approve all"
- When push prompts: Select "🚫 Auto-block all"

**Result:** Agent can freely commit locally, but all push attempts are blocked

---

### Scenario 2: Review Each Action
**Goal:** Approve/deny each command individually

**Solution:**
- Always select "✅ Allow once" or "⏭️ Decline this time"

**Result:** You get prompted for every git operation

---

### Scenario 3: Temporary Workflow Block
**Goal:** Block push for now, but might want it later

**Solution:**
- When push prompts: Select "⏭️ Skip this time"

**Result:** This push is blocked, but next push will prompt again

---

### Scenario 4: Prevent Accidents
**Goal:** Never allow force push during this session

**Solution:**
- When force push prompts: Select "🚫 Auto-block all"

**Result:** All force push attempts silently blocked, preventing data loss

---

### Scenario 5: CI/CD Workflow
**Goal:** Allow all GitHub CLI commands for this session

**Solution:**
- When first `gh` command prompts: Select "✅✅ Auto-approve all"

**Result:** All `gh` commands (pr, issue, release, etc.) auto-approved

---

## Checking Your Current Settings

Type `/safegit-status` to see:
- Which actions are auto-approved
- Which actions are auto-blocked
- Current protection level
- Global defaults

Example output:
```
⏱️  Auto-approved for THIS SESSION ONLY:
  ✅ All "git commit" commands

⏱️  Auto-blocked for THIS SESSION ONLY:
  🚫 All "git push" commands
```

## Important Notes

### Separate Tracking
Each git operation is tracked independently:
- "push" and "force push" are separate
- "commit" and "push" are separate
- Auto-blocking "push" does NOT block "commit"

### Session-Only
- All approvals and blocks are **temporary**
- They **reset** when you:
  - Start a new pi session
  - Restart pi
- They **never persist** to disk

### Action Groupings
Some commands share the same action type:
- All `gh` commands → "GitHub CLI"
- `git branch -d` and `git branch -D` → "delete branch"
- `git stash drop` and `git stash clear` → "drop/clear stash"

## Risk Levels

### 🟡 Medium Risk
- commit, push, rebase, merge, tag
- cherry-pick, revert, apply patches
- GitHub CLI (all `gh` commands)

### 🔴 High Risk (with warning)
- force push
- hard reset
- clean (remove untracked)
- delete branch
- drop/clear stash
- expire reflog

## Other Commands

### Toggle Protection
```
/safegit
```
Turn protection on/off for current session

### Change Prompt Level
```
/safegit-level high    # Only high-risk operations
/safegit-level medium  # Medium and high-risk (default)
/safegit-level none    # No prompts (disabled)
```

### View Status
```
/safegit-status
```
See all current settings and session state

## Tips

1. **Start conservative:** Use "Allow once" until you establish a pattern
2. **Use auto-approve for trusted workflows:** Like committing during development
3. **Use auto-block for dangerous ops:** Like force push if you never want it
4. **Check status regularly:** Use `/safegit-status` to see what's approved/blocked
5. **Remember it's temporary:** All choices reset with new session - safe to experiment!
