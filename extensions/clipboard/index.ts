import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";
import { spawnSync } from "node:child_process";

/**
 * clipboard Extension
 *
 * Provides a tool for the agent to save specific text to the system clipboard.
 * The agent should use this selectively for content the user might need to paste
 * elsewhere (commands, code snippets, configurations).
 *
 * Platform support:
 * - macOS: pbcopy (built-in)
 * - Linux: xclip (requires installation)
 * - Windows: clip.exe (via Git Bash)
 */

interface ClipboardDetails {
  bytes: number;
  label?: string;
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "copy_to_clipboard",
    label: "Copy to Clipboard",
    description: `Save text to the system clipboard for user convenience.

IMPORTANT USAGE GUIDELINES:
- Only use when content is RELEVANT to the user's workflow
- Use for: commands to rerun, code snippets to paste, configurations to save elsewhere
- STRONGLY RECOMMENDED: Use whenever user expresses intent to copy, paste, or use content elsewhere
  Examples: "copy this", "save to clipboard", "I need this for my dissertation", "give me X to use in Y"
- Do NOT use for: general output, logs, or content already visible in conversation

FORMATTING:
- Present the content in a clean code block (with appropriate language tag if applicable)
- Add a trailing line below: "📋 Saved to clipboard"
- This keeps the content easy to select and copy manually if needed

Example response format:
\`\`\`bash
docker run -d -p 8080:80 nginx
\`\`\`

📋 Saved to clipboard`,

    parameters: Type.Object({
      text: Type.String({
        description: "Text to copy to clipboard",
      }),
      label: Type.Optional(
        Type.String({
          description:
            "Optional short label (e.g., 'installation command', 'config snippet')",
        })
      ),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      // Defensive type casting
      const { text, label } = params as { text: string; label?: string };
      
      // Validate we actually have text
      if (!text || typeof text !== 'string') {
        throw new Error(`Invalid text parameter: ${typeof text} - ${JSON.stringify(text)}`);
      }
      
      // Size limit check
      const MAX_CLIPBOARD_SIZE = 1024 * 100; // 100KB
      if (text.length > MAX_CLIPBOARD_SIZE) {
        throw new Error(
          `Content too large (${text.length} bytes, max ${MAX_CLIPBOARD_SIZE})`
        );
      }

      // Determine platform-specific clipboard command
      const platform = process.platform;
      const clipboardConfig: {
        [key: string]: { cmd: string; args: string[] };
      } = {
        darwin: { cmd: "pbcopy", args: [] },
        linux: { cmd: "xclip", args: ["-selection", "clipboard"] },
        win32: { cmd: "clip.exe", args: [] },
      };

      const config = clipboardConfig[platform];
      if (!config) {
        throw new Error(`Clipboard not supported on platform: ${platform}`);
      }

      // Check if clipboard tool is available
      try {
        const testCmd = platform === "win32" ? "where" : "which";
        const testResult = await pi.exec(testCmd, [config.cmd], {
          timeout: 1000,
        });

        if (testResult.code !== 0) {
          const instructions: { [key: string]: string } = {
            darwin: "pbcopy should be available by default",
            linux: "Install xclip: sudo apt install xclip",
            win32: "clip.exe should be available via Git Bash",
          };

          throw new Error(
            `Clipboard tool not available. ${instructions[platform] || "Unknown platform"}`
          );
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("not available")) {
          throw error;
        }
        throw new Error(`Failed to check clipboard availability: ${error}`);
      }

      // Copy to clipboard using spawnSync with stdin
      const result = spawnSync(config.cmd, config.args, {
        input: text,
        encoding: "utf-8",
      });

      if (result.status !== 0) {
        throw new Error(
          `Clipboard copy failed: ${result.stderr || "unknown error"}`
        );
      }
      // Success - provide feedback to agent
      return {
        content: [{ type: "text", text: "Content saved to clipboard" }],
        details: {
          bytes: text.length,
          label: label,
        } as ClipboardDetails,
      };
    },

    // Custom TUI rendering
    renderCall(args, theme) {
      const preview =
        args.text.length > 50
          ? args.text.substring(0, 47) + "..."
          : args.text;

      return new Text(
        theme.fg("toolTitle", theme.bold("copy_to_clipboard ")) +
          theme.fg("dim", args.label || preview),
        0,
        0
      );
    },

    renderResult(result, _options, theme) {
      const details = result.details as ClipboardDetails | undefined;

      // Error case - no details or zero bytes usually means error
      // (though errors should throw, this is a fallback)
      if (!details || details.bytes === 0) {
        return new Text(theme.fg("error", "✗ Clipboard unavailable"), 0, 0);
      }

      // Minimal trailing indicator
      return new Text(theme.fg("success", "📋 Saved to clipboard"), 0, 0);
    },
  });
}
