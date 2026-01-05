/**
 * pi-safe-git Extension
 *
 * Securely prevents dangerous git interactions (commit, push, etc.) without explicit user approval.
 * In non-interactive mode, blocks these commands entirely.
 *
 * Protected operations:
 * - git commit
 * - git push (including force push)
 * - git reset --hard
 * - git rebase
 * - git merge
 * - git branch -d/-D (delete)
 * - git tag
 * - git stash drop
 * - git clean
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Patterns that require explicit approval, ordered by severity
  const gitPatterns = [
    // High risk - destructive operations
    { pattern: /\bgit\s+push\s+.*--force(-with-lease)?\b/i, action: "force push", severity: "high" },
    { pattern: /\bgit\s+reset\s+--hard\b/i, action: "hard reset", severity: "high" },
    { pattern: /\bgit\s+clean\s+-[a-z]*f/i, action: "clean (remove untracked files)", severity: "high" },
    { pattern: /\bgit\s+stash\s+(drop|clear)\b/i, action: "drop/clear stash", severity: "high" },
    { pattern: /\bgit\s+branch\s+-[dD]\b/i, action: "delete branch", severity: "high" },
    { pattern: /\bgit\s+reflog\s+expire\b/i, action: "expire reflog", severity: "high" },

    // Medium risk - state-changing operations
    { pattern: /\bgit\s+push\b/i, action: "push", severity: "medium" },
    { pattern: /\bgit\s+commit\b/i, action: "commit", severity: "medium" },
    { pattern: /\bgit\s+rebase\b/i, action: "rebase", severity: "medium" },
    { pattern: /\bgit\s+merge\b/i, action: "merge", severity: "medium" },
    { pattern: /\bgit\s+tag\b/i, action: "create/modify tag", severity: "medium" },
    { pattern: /\bgit\s+cherry-pick\b/i, action: "cherry-pick", severity: "medium" },
    { pattern: /\bgit\s+revert\b/i, action: "revert", severity: "medium" },
    { pattern: /\bgit\s+am\b/i, action: "apply patches", severity: "medium" },
  ];

  const severityIcons: Record<string, string> = {
    high: "🔴",
    medium: "🟡",
  };

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return undefined;

    const command = event.input.command as string;

    // Check all patterns (first match wins - patterns ordered by severity)
    for (const { pattern, action, severity } of gitPatterns) {
      if (pattern.test(command)) {
        const icon = severityIcons[severity] || "🔒";

        // In non-interactive mode (headless, RPC, print mode), block entirely
        if (!ctx.hasUI) {
          return {
            block: true,
            reason: `Git ${action} blocked: requires explicit user approval (no UI available)`,
          };
        }

        // Interactive mode: ask for confirmation
        const title = `${icon} Git ${action} requires approval`;
        const message =
          severity === "high"
            ? `⚠️ HIGH RISK OPERATION\n\nThe agent wants to run:\n\n  ${command}\n\nThis operation can cause data loss. Allow?`
            : `The agent wants to run:\n\n  ${command}\n\nAllow this operation?`;

        const confirmed = await ctx.ui.confirm(title, message);

        if (!confirmed) {
          ctx.ui.notify(`Git ${action} blocked`, "warning");
          return { block: true, reason: `Git ${action} blocked by user` };
        }

        // User approved - allow the command
        ctx.ui.notify(`Git ${action} approved`, "info");
        return undefined;
      }
    }

    return undefined;
  });

  // Log extension loaded
  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      ctx.ui.notify("pi-safe-git: Git operations require approval", "info");
    }
  });
}
