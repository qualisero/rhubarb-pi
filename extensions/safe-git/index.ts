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
  pi.registerCommand({
    name: "safegit",
    description: "Toggle safe-git protection on/off for this session",
    handler: async (args, ctx) => {
      const { enabled } = getEffectiveConfig(ctx);
      sessionEnabledOverride = !enabled;
      const newState = sessionEnabledOverride;
      ctx.ui.notify(
        newState ? "🔒 Safe-git protection ON" : "🔓 Safe-git protection OFF",
        "info"
      );
      ctx.ui.print(`(Temporary for this session)`);
    },
  });

  pi.registerCommand({
    name: "safegit-level",
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
        ctx.ui.print(desc[arg]);
        ctx.ui.print(`(Temporary for this session)`);
        return;
      }

      // Interactive mode
      const { promptLevel } = getEffectiveConfig(ctx);
      const options = [
        { label: `🔴 high - Only high-risk (force push, hard reset, etc.)`, value: "high" },
        { label: `🟡 medium - Medium and high-risk (push, commit, etc.)`, value: "medium" },
        { label: `⚠️ none - No prompts (disable protection)`, value: "none" },
        { label: `❌ Cancel`, value: "cancel" },
      ];

      ctx.ui.print(`Current level: ${promptLevel}\n`);
      const choice = await ctx.ui.select("Set prompt level:", options);

      if (choice === "cancel" || !choice) {
        ctx.ui.print("Cancelled.");
        return;
      }

      sessionPromptLevelOverride = choice as PromptLevel;
      ctx.ui.notify(`Prompt level set to: ${choice}`, "info");
      ctx.ui.print(`(Temporary for this session)`);
    },
  });

  pi.registerCommand({
    name: "safegit-status",
    description: "Show safe-git status and settings",
    handler: async (args, ctx) => {
      const settings = ctx.settingsManager?.getSettings() ?? {};
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
        "",
        "Global Defaults:",
        `  Enabled: ${globalConfig.enabledByDefault ? "ON" : "OFF"}`,
        `  Prompt Level: ${globalConfig.promptLevel}`,
        "",
        "Prompt Levels:",
        `  🔴 high   - force push, hard reset, clean, delete branch`,
        `  🟡 medium - push, commit, rebase, merge, tag, gh CLI`,
        "",
        "Commands: /safegit /safegit-level /safegit-status",
        "───────────────────────",
      ];

      ctx.ui.print(lines.join("\n"));
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

  // Reset session state on new session
  pi.on("session_start", async (_event, ctx) => {
    sessionEnabledOverride = null;
    sessionPromptLevelOverride = null;

    if (ctx.hasUI) {
      const { enabled, promptLevel } = getEffectiveConfig(ctx);
      if (enabled && promptLevel !== "none") {
        ctx.ui.notify(`pi-safe-git: Protection ${promptLevel === "high" ? "🔴 high-risk only" : "🟡 medium+high"}`, "info");
      }
    }
  });
}
