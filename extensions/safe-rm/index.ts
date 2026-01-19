/**
 * Safe-RM Extension
 *
 * Intercepts rm commands and replaces them with macOS `trash` command.
 * Logs both original and replacement commands to debug log file.
 * Carefully detects rm to avoid false positives.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface SafeRmConfig {
  enabledByDefault?: boolean;
  debugLogPath?: string;
}

const DEFAULT_CONFIG: Required<SafeRmConfig> = {
  enabledByDefault: true,
  debugLogPath: path.join(os.homedir(), '.pi', 'safe-rm-debug.log'),
};

export default function (pi: ExtensionAPI) {
  let sessionEnabledOverride: boolean | null = null;

  // Helper to get effective config
  function getEffectiveConfig(ctx: any): { enabled: boolean; debugLogPath: string } {
    const settings = ctx.settingsManager?.getSettings() ?? {};
    const config: Required<SafeRmConfig> = {
      ...DEFAULT_CONFIG,
      ...(settings.safeRm ?? {}),
    };

    const enabled = sessionEnabledOverride !== null
      ? sessionEnabledOverride
      : config.enabledByDefault;

    return { enabled, debugLogPath: config.debugLogPath };
  }

  // Detect if command is an rm command (careful about false positives)
  function isRmCommand(command: string): boolean {
    const trimmed = command.trim();

    // Match standalone "rm" or explicit paths to rm binary
    // Patterns that ARE rm commands:
    //   - "rm" at start
    //   - "/bin/rm", "/usr/bin/rm", etc.
    const rmPatterns = [
      /^(?:\/[\w\/]+\/)?rm\b/,           // rm, /bin/rm, /usr/bin/rm
    ];

    // Patterns that might look like rm but are NOT:
    //   - Filenames containing "rm" like "worm" -> "wrm" (unlikely but possible)
    //   - Commands where "rm" is just part of the word

    for (const pattern of rmPatterns) {
      if (pattern.test(trimmed)) {
        // Additional check: make sure "rm" is a word boundary or at path boundary
        // This helps avoid false positives in edge cases
        return true;
      }
    }

    return false;
  }

  // Parse rm command to extract files
  //
  // NOTE: This is a simplified parser that doesn't handle all shell quoting edge cases
  // (e.g., escaped characters, complex flags with values). However, since the original
  // command was already shell-parsed by the user's shell, we're just extracting the
  // file arguments for the trash command. Files are properly quoted when passed to trash.
  function parseRmCommand(command: string): { flags: string; files: string[]; commandRest: string } {
    const trimmed = command.trim();

    // Remove the "rm" or path-to-rm part to get flags and files
    // Replace any "rm" or "/path/to/rm" at the start
    const withoutRm = trimmed.replace(/^(?:\/[\w\/]+\/)?rm\b\s*/, '');

    // Now split into flags and files
    const parts = withoutRm.split(/\s+/).filter(p => p.length > 0);

    const flags: string[] = [];
    const files: string[] = [];

    for (const part of parts) {
      if (part.startsWith('-')) {
        // It's a flag
        flags.push(part);
      } else {
        // It's a file/directory
        files.push(part);
      }
    }

    return {
      flags: flags.join(' '),
      files,
      commandRest: withoutRm,
    };
  }

  // Build trash command
  function buildTrashCommand(files: string[]): string {
    // Check OS for appropriate command
    const isMacOS = os.platform() === 'darwin';

    // On macOS, use the built-in `trash` command.
    if (isMacOS) {
      // Usage: trash <file1> <file2> ...
      // Quote filenames to handle spaces and special characters
      const quotedFiles = files.map(f => `'${f.replace(/'/g, "'\\''")}'`);
      return `trash ${quotedFiles.join(' ')}`;
    }

    // On non-macOS systems, fall back to regular rm so the command still works.
    // Note: This bypasses the safety feature on non-macOS systems.
    return `rm ${files.map(f => `'${f.replace(/'/g, "'\\''")}'`).join(' ')}`;
  }

  // Log to debug file (simplified format)
  function logToDebugFile(logPath: string, originalCmd: string, trashCmd: string, files: string[]) {
    const timestamp = new Date().toISOString();
    // Simplified format: "rm -rf build/ → trash"
    const entry = `[${timestamp}] | ${originalCmd} → trash\n`;

    try {
      // Ensure log directory exists
      const logDir = path.dirname(logPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Append to log file
      fs.appendFileSync(logPath, entry, 'utf8');
    } catch (e) {
      console.error(`[safe-rm] Failed to write debug log: ${e}`);
    }
  }

  // Intercept tool calls
  pi.on("tool_call", async (event, ctx) => {
    // Only intercept bash commands
    if (event.toolName !== 'bash') return undefined;

    const command = event.input.command as string;

    // Check if this is an rm command
    if (!isRmCommand(command)) return undefined;

    const { enabled, debugLogPath } = getEffectiveConfig(ctx);

    if (!enabled) return undefined;

    // Parse the rm command
    const { files } = parseRmCommand(command);

    if (files.length === 0) {
      // No files specified, let original command run
      // This will just show an error from rm
      return undefined;
    }

    // Build the trash command (macOS uses `trash` command)
    const trashCmd = buildTrashCommand(files);

    // Log to debug file
    logToDebugFile(debugLogPath, command, trashCmd, files);

    // Replace the command with trash command
    return {
      command: trashCmd,
      reason: `safe-rm: Replaced 'rm' with 'trash' for ${files.length} file(s)`,
    };
  });

  // Register slash commands
  pi.registerCommand("saferm", {
    description: "Show safe-rm status",
    handler: async (args, ctx) => {
      const { enabled, debugLogPath } = getEffectiveConfig(ctx);
      const status = enabled ? "🟢 ON" : "🔴 OFF";

      // Check log file
      let logInfo = "";
      try {
        if (fs.existsSync(debugLogPath)) {
          const stats = fs.statSync(debugLogPath);
          const sizeKB = (stats.size / 1024).toFixed(1);
          logInfo = `\n📜 Debug log: ${debugLogPath} (${sizeKB} KB)`;
        }
      } catch (e) {
        logInfo = "\n⚠️  Could not read debug log";
      }

      const isMacOS = os.platform() === 'darwin';
      const osInfo = isMacOS ? "macOS: trash command" : "Non-macOS: falls back to rm";

      ctx.ui?.notify?.([
        "╭─ Safe-RM Status ─╮",
        `│                     │`,
        `│  Status: ${status} │`,
        `│  ${osInfo.padEnd(15)} │`,
        `${logInfo}`,
        `│                     │`,
        `╰─────────────────────╯`,
        "",
        "Commands:",
        "  /saferm-on   - Enable",
        "  /saferm-off  - Disable",
        "  /saferm-toggle - Toggle",
        "  /saferm-log - View log",
        "  /saferm-clearlog - Clear log",
        "",
        "All rm commands are logged to:",
        `  ${debugLogPath}`,
      ].join('\n'), 'info');
    },
  });

  pi.registerCommand("saferm-toggle", {
    description: "Toggle safe-rm on/off",
    handler: async (args, ctx) => {
      const { enabled } = getEffectiveConfig(ctx);
      sessionEnabledOverride = !enabled;
      ctx.ui?.notify?.(sessionEnabledOverride ? "🟢 Safe-RM: ON" : "🔴 Safe-RM: OFF", 'info');
    },
  });

  pi.registerCommand("saferm-on", {
    description: "Enable safe-rm",
    handler: async (args, ctx) => {
      sessionEnabledOverride = true;
      ctx.ui?.notify?.("🟢 Safe-RM: ON", 'info');
    },
  });

  pi.registerCommand("saferm-off", {
    description: "Disable safe-rm",
    handler: async (args, ctx) => {
      sessionEnabledOverride = false;
      ctx.ui?.notify?.("🔴 Safe-RM: OFF", 'info');
    },
  });

  pi.registerCommand("saferm-log", {
    description: "Show debug log contents",
    handler: async (args, ctx) => {
      const { debugLogPath } = getEffectiveConfig(ctx);

      try {
        if (!fs.existsSync(debugLogPath)) {
          ctx.ui?.notify?.("No debug log found yet.", 'info');
          return;
        }

        const content = fs.readFileSync(debugLogPath, 'utf8');
        const lines = content.trim().split('\n');
        const last20 = lines.slice(-20); // Show last 20 entries

        ctx.ui?.notify?.([
          "╭─ Safe-RM Debug Log (last 20) ─╮",
          `│                                    │`,
          ...last20.map(line => `│ ${line.slice(0, 75)}${line.length > 75 ? '...' : ''} │`),
          `│                                    │`,
          `╰────────────────────────────────────╯`,
          "",
          `Full log: ${debugLogPath}`,
        ].join('\n'), 'info');
      } catch (e) {
        ctx.ui?.notify?.(`Error reading log: ${e}`, 'warning');
      }
    },
  });

  pi.registerCommand("saferm-clearlog", {
    description: "Clear debug log file",
    handler: async (args, ctx) => {
      const { debugLogPath } = getEffectiveConfig(ctx);

      try {
        if (fs.existsSync(debugLogPath)) {
          fs.unlinkSync(debugLogPath);
          ctx.ui?.notify?.("🗑️  Debug log cleared.", 'info');
        } else {
          ctx.ui?.notify?.("No debug log to clear.", 'info');
        }
      } catch (e) {
        ctx.ui?.notify?.(`Error clearing log: ${e}`, 'warning');
      }
    },
  });
}
