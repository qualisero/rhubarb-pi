/**
 * pi-safe-git Extension
 *
 * Securely prevents dangerous git/gh interactions without explicit user approval.
 * In non-interactive mode, blocks these commands entirely.
 *
 * Protected operations:
 * - git commit, push, reset --hard, rebase, merge, branch -d/-D, tag, stash drop, clean
 * - gh (GitHub CLI) - all commands
 *
 * Features:
 * - Per-command approval with option to approve all of same type for session
 * - Example: Approve "gh pr view" once or approve all "GitHub CLI" commands for session
 *
 * Configuration (in ~/.pi/agent/settings.json):
 * {
 *   "safeGit": {
 *     "promptLevel": "medium",  // "high", "medium", or "none"
 *     "enabledByDefault": true
 *   }
 * }
 *
 * Prompt levels:
 * - "high": Only prompt for high-risk operations (force push, hard reset, etc.)
 * - "medium": Prompt for medium and high risk (default)
 * - "none": No prompts (extension effectively disabled)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

type PromptLevel = "high" | "medium" | "none";
type Severity = "high" | "medium";

interface SafeGitConfig {
  promptLevel?: PromptLevel;
  enabledByDefault?: boolean;
}

const DEFAULT_CONFIG: Required<SafeGitConfig> = {
  promptLevel: "medium",
  enabledByDefault: true,
};

export default function (pi: ExtensionAPI) {
  // Session overrides
  let sessionEnabledOverride: boolean | null = null;
  let sessionPromptLevelOverride: PromptLevel | null = null;
  
  // Session approvals: track which actions are auto-approved for this session
  let sessionApprovedActions: Set<string> = new Set();
  
  // Session blocks: track which actions are auto-blocked for this session
  let sessionBlockedActions: Set<string> = new Set();

  // Patterns that require explicit approval, ordered by severity
  const gitPatterns: { pattern: RegExp; action: string; severity: Severity }[] = [
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

    // GitHub CLI - all commands (medium risk)
    { pattern: /\bgh\s+\S+/i, action: "GitHub CLI", severity: "medium" },
  ];

  const severityIcons: Record<Severity, string> = {
    high: "🔴",
    medium: "🟡",
  };

  // Helper to get effective config
  function getEffectiveConfig(ctx: any): { enabled: boolean; promptLevel: PromptLevel } {
    const settings = ctx.settingsManager?.getSettings() ?? {};
    const config: Required<SafeGitConfig> = {
      ...DEFAULT_CONFIG,
      ...(settings.safeGit ?? {}),
    };

    const enabled = sessionEnabledOverride !== null ? sessionEnabledOverride : config.enabledByDefault;
    const promptLevel = sessionPromptLevelOverride !== null ? sessionPromptLevelOverride : config.promptLevel;

    return { enabled, promptLevel };
  }

  // Helper to check if severity should trigger prompt
  function shouldPrompt(severity: Severity, promptLevel: PromptLevel): boolean {
    if (promptLevel === "none") return false;
    if (promptLevel === "high") return severity === "high";
    return true; // "medium" prompts for both
  }

  // Register slash commands
  pi.registerCommand("safegit", {
    description: "Toggle safe-git protection on/off for this session",
    handler: async (args, ctx) => {
      const { enabled } = getEffectiveConfig(ctx);
      sessionEnabledOverride = !enabled;
      const newState = sessionEnabledOverride;
      ctx.ui.notify(
        newState ? "🔒 Safe-git protection ON" : "🔓 Safe-git protection OFF",
        "info"
      );
      ctx.ui.notify(`(Temporary for this session)`, "info");
    },
  });

  pi.registerCommand("safegit-level", {
    description: "Set prompt level: high, medium, or none",
    handler: async (args, ctx) => {
      const arg = args.trim().toLowerCase();
      
      if (arg === "high" || arg === "medium" || arg === "none") {
        sessionPromptLevelOverride = arg;
        const desc = {
          high: "🔴 Only high-risk operations require approval",
          medium: "🟡 Medium and high-risk operations require approval",
          none: "⚠️ No approval required (protection disabled)",
        };
        ctx.ui.notify(`Prompt level: ${arg}`, "info");
        ctx.ui.notify(desc[arg], "info");
        ctx.ui.notify(`(Temporary for this session)`, "info");
        return;
      }

      // Interactive mode
      const { promptLevel } = getEffectiveConfig(ctx);
      const options = [
        `🔴 high - Only high-risk (force push, hard reset, etc.)`,
        `🟡 medium - Medium and high-risk (push, commit, etc.)`,
        `⚠️ none - No prompts (disable protection)`,
        `❌ Cancel`,
      ];

      ctx.ui.notify(`Current level: ${promptLevel}\n`, "info");
      const choice = await ctx.ui.select("Set prompt level:", options);

      if (!choice || choice.startsWith("❌")) {
        ctx.ui.notify("Cancelled.", "info");
        return;
      }

      // Extract level from choice
      const level = choice.split(" ")[1] as PromptLevel;
      sessionPromptLevelOverride = level;
      ctx.ui.notify(`Prompt level set to: ${choice}`, "info");
      ctx.ui.notify(`(Temporary for this session)`, "info");
    },
  });

  pi.registerCommand("safegit-status", {
    description: "Show safe-git status and settings",
    handler: async (args, ctx) => {
      const settings = (ctx as any).settingsManager?.getSettings() ?? {};
      const globalConfig: Required<SafeGitConfig> = {
        ...DEFAULT_CONFIG,
        ...(settings.safeGit ?? {}),
      };
      const { enabled, promptLevel } = getEffectiveConfig(ctx);

      const lines = [
        "─── Safe Git Status ───",
        "",
        "Session State:",
        `  Enabled: ${enabled ? "🔒 ON" : "🔓 OFF"}${sessionEnabledOverride !== null ? " (session override)" : ""}`,
        `  Prompt Level: ${promptLevel}${sessionPromptLevelOverride !== null ? " (session override)" : ""}`,
      ];

      if (sessionApprovedActions.size > 0) {
        lines.push("");
        lines.push("⏱️  Auto-approved for THIS SESSION ONLY:");
        for (const action of sessionApprovedActions) {
          lines.push(`  ✅ All "git ${action}" commands`);
        }
        lines.push("");
        lines.push("  (Auto-approvals reset when session ends)");
      }

      if (sessionBlockedActions.size > 0) {
        lines.push("");
        lines.push("⏱️  Auto-blocked for THIS SESSION ONLY:");
        for (const action of sessionBlockedActions) {
          lines.push(`  🚫 All "git ${action}" commands`);
        }
        lines.push("");
        lines.push("  (Auto-blocks reset when session ends)");
      }

      lines.push("");
      lines.push("Global Defaults:");
      lines.push(`  Enabled: ${globalConfig.enabledByDefault ? "ON" : "OFF"}`);
      lines.push(`  Prompt Level: ${globalConfig.promptLevel}`);
      lines.push("");
      lines.push("Prompt Levels:");
      lines.push(`  🔴 high   - force push, hard reset, clean, delete branch`);
      lines.push(`  🟡 medium - push, commit, rebase, merge, tag, gh CLI`);
      lines.push("");
      lines.push("Commands: /safegit /safegit-level /safegit-status");
      lines.push("───────────────────────");

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // Intercept tool calls
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return undefined;

    const { enabled, promptLevel } = getEffectiveConfig(ctx);
    if (!enabled || promptLevel === "none") return undefined;

    const command = event.input.command as string;

    // Check all patterns (first match wins - patterns ordered by severity)
    for (const { pattern, action, severity } of gitPatterns) {
      if (pattern.test(command)) {
        // Check if this action is already blocked for this session
        if (sessionBlockedActions.has(action)) {
          ctx.ui.notify(`🚫 Git ${action} auto-blocked (session setting)`, "warning");
          return { block: true, reason: `Git ${action} blocked by user (session setting)` };
        }

        // Check if this action is already approved for this session
        if (sessionApprovedActions.has(action)) {
          ctx.ui.notify(`✅ Git ${action} auto-approved (session setting)`, "info");
          return undefined;
        }

        // Check if this severity level should trigger a prompt
        if (!shouldPrompt(severity, promptLevel)) {
          return undefined;
        }

        const icon = severityIcons[severity];

        // In non-interactive mode (headless, RPC, print mode), block entirely
        if (!ctx.hasUI) {
          return {
            block: true,
            reason: `Git ${action} blocked: requires explicit user approval (no UI available)`,
          };
        }

        // Interactive mode: ask for confirmation with option to approve all for session
        const title =
          severity === "high"
            ? `${icon} ⚠️ HIGH RISK: Git ${action} requires approval`
            : `${icon} Git ${action} requires approval`;

        const choice = await ctx.ui.select(title, [
          "✅ Allow this command once",
          "⏭️  Decline this time (ask again later)",
          `✅✅ Auto-approve all "git ${action}" for this session only`,
          `🚫 Auto-block all "git ${action}" for this session only`,
        ]);

        if (!choice || choice.startsWith("⏭️")) {
          // Decline this time - block the command but don't add to blocked list
          ctx.ui.notify(`Git ${action} declined`, "info");
          return { block: true, reason: `Git ${action} declined by user` };
        }

        if (choice.startsWith("🚫")) {
          // Block this action type for the entire session
          sessionBlockedActions.add(action);
          ctx.ui.notify(`🚫 All "git ${action}" commands auto-blocked for this session`, "warning");
          ctx.ui.notify(`⏱️  Auto-block will reset when session ends`, "info");
          return { block: true, reason: `Git ${action} blocked by user (session setting)` };
        }

        if (choice.startsWith("✅✅")) {
          // Approve this action type for the entire session
          sessionApprovedActions.add(action);
          ctx.ui.notify(`✅ All "git ${action}" commands auto-approved for this session`, "info");
          ctx.ui.notify(`⏱️  Auto-approval will reset when session ends`, "info");
        } else {
          // Approve just this once
          ctx.ui.notify(`Git ${action} approved once`, "info");
        }

        return undefined;
      }
    }

    return undefined;
  });

  // Reset session state on new session
  pi.on("session_start", async (_event, ctx) => {
    // Reset all session-specific overrides, approvals, and blocks
    // This ensures auto-approvals and auto-blocks never persist across sessions
    sessionEnabledOverride = null;
    sessionPromptLevelOverride = null;
    sessionApprovedActions.clear();
    sessionBlockedActions.clear();

    if (ctx.hasUI) {
      const { enabled, promptLevel } = getEffectiveConfig(ctx);
      if (enabled && promptLevel !== "none") {
        ctx.ui.notify(`pi-safe-git: Protection ${promptLevel === "high" ? "🔴 high-risk only" : "🟡 medium+high"}`, "info");
      }
    }
  });
}
