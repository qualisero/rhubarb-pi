/**
 * Background Task Completion Extension
 *
 * Detects long-running tasks and notifies you when they complete while the terminal is backgrounded.
 *
 * Configuration (in ~/.pi/agent/settings.json):
 * {
 *   "backgroundNotify": {
 *     "thresholdMs": 2000,
 *     "beep": true,
 *     "beepSound": "Tink",
 *     "bringToFront": true,
 *     "say": false,
 *     "sayMessage": "Task completed"
 *   }
 * }
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import * as child_process from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const execAsync = promisify(child_process.exec);

// ─────────────────────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────────────────────

interface BackgroundNotifyConfig {
  thresholdMs: number;
  beep: boolean;
  beepSound: string;
  bringToFront: boolean;
  say: boolean;
  sayMessage: string;
}

interface SessionState {
  beepOverride: boolean | null;
  beepSoundOverride: string | null;
  focusOverride: boolean | null;
  sayOverride: boolean | null;
  sayMessageOverride: string | null;
  terminalApp: string | undefined;
  terminalPid: number | undefined;
  terminalTTY: string | undefined;
  lastToolTime: number | undefined;
  totalActiveTime: number;
}

const DEFAULT_CONFIG: BackgroundNotifyConfig = {
  thresholdMs: 2000,
  beep: true,
  beepSound: "Tink",
  bringToFront: true,
  say: false,
  sayMessage: "Task completed",
};

const IS_MACOS = process.platform === "darwin";
let HAS_SAY_COMMAND = false;

const BEEP_SOUNDS = [
  "Tink", "Basso", "Blow", "Bottle", "Frog", "Funk",
  "Glass", "Hero", "Morse", "Ping", "Pop", "Purr",
  "Sosumi", "Submarine",
];

const SAY_MESSAGES = [
  "Task completed",
  "Done",
  "Finished",
  "Ready",
  "All done",
  "Complete",
  "Task completed in {dirname}",
  "Done in {dirname}",
  "Finished in {dirname}",
  "All done in {dirname}",
];

const TERMINAL_BUNDLE_IDS: Record<string, string> = {
  "com.apple.Terminal": "Terminal",
  "Apple_Terminal": "Terminal",
  "com.googlecode.iterm2": "iTerm2",
  "iTerm.app": "iTerm2",
  "com.github.wez.wezterm": "WezTerm",
  "WezTerm": "WezTerm",
  "net.kovidgoyal.kitty": "kitty",
  "kitty": "kitty",
  "com.mitchellh.ghostty": "Ghostty",
  "Ghostty": "Ghostty",
};

enum NotificationAction {
  Beeped = "beeped",
  Spoke = "spoke",
  BroughtToFront = "brought to front",
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function isSayAvailable(): boolean {
  return HAS_SAY_COMMAND;
}

function resetSessionState(state: SessionState): void {
  state.beepOverride = null;
  state.beepSoundOverride = null;
  state.focusOverride = null;
  state.sayOverride = null;
  state.sayMessageOverride = null;
  state.lastToolTime = undefined;
  state.totalActiveTime = 0;
}

async function readSettingsFile(): Promise<any> {
  const settingsPath = path.join(os.homedir(), ".pi", "agent", "settings.json");
  try {
    const content = await fs.readFile(settingsPath, "utf8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeSettingsFile(settings: any): Promise<void> {
  const settingsPath = path.join(os.homedir(), ".pi", "agent", "settings.json");
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
}

function extractOptionText(action: string, iconPrefix: string): string | null {
  if (!action || action === "❌ Cancel" || action === "───") {
    return null;
  }
  if (action.startsWith(iconPrefix)) {
    return action.replace(iconPrefix, "").replace(" ✓", "").replace(/^"|"$/g, "");
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Extension
// ─────────────────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  const state: SessionState = {
    beepOverride: null,
    beepSoundOverride: null,
    focusOverride: null,
    sayOverride: null,
    sayMessageOverride: null,
    terminalApp: undefined,
    terminalPid: undefined,
    terminalTTY: undefined,
    lastToolTime: undefined,
    totalActiveTime: 0,
  };

  registerCommands(pi, state);

  pi.on("session_start", async (_, ctx) => {
    // Reset session state
    resetSessionState(state);

    // Detect terminal and check for say command
    await detectTerminal(state);
    await checkSayCommand();
  });

  pi.on("agent_start", () => {
    state.lastToolTime = Date.now();
    state.totalActiveTime = 0;
  });

  pi.on("tool_result", () => {
    if (state.lastToolTime) {
      state.totalActiveTime += Date.now() - state.lastToolTime;
    }
    state.lastToolTime = Date.now();
  });

  pi.on("agent_end", async (_, ctx) => {
    if (!state.lastToolTime) return;

    // Add final segment
    state.totalActiveTime += Date.now() - state.lastToolTime;
    const duration = state.totalActiveTime;

    state.lastToolTime = undefined;
    state.totalActiveTime = 0;

    const config = await getConfig(ctx);
    const eff = getEffective(state, config);

    if (!eff.beep && !eff.focus && !eff.say) return;
    if (duration < config.thresholdMs) return;

    const isBackground = await isTerminalInBackground(state);
    if (!isBackground) return;

    const tasks: Promise<void>[] = [];
    const actions: NotificationAction[] = [];

    if (eff.beep) {
      tasks.push(playBeep(eff.sound));
      actions.push(NotificationAction.Beeped);
    }
    if (eff.focus) {
      tasks.push(bringTerminalToFront(state));
      actions.push(NotificationAction.BroughtToFront);
    }
    if (eff.say) {
      tasks.push(speakMessage(eff.sayMessage));
      actions.push(NotificationAction.Spoke);
    }

    await Promise.all(tasks);

    if (ctx.hasUI) {
      ctx.ui.notify(`Task completed in ${(duration / 1000).toFixed(1)}s (${actions.join(", ")})`, "info");
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Terminal Detection
// ─────────────────────────────────────────────────────────────────────────────

async function detectTerminal(state: SessionState) {
  if (!IS_MACOS) return;

  try {
    state.terminalPid = process.ppid;
    state.terminalApp = process.env.TERM_PROGRAM;

    // Try to get TTY
    state.terminalTTY = process.env.TTY;
    if (!state.terminalTTY) {
      try {
        const { stdout } = await execAsync(`ps -p ${process.ppid} -o tty=`);
        const tty = stdout.trim();
        if (tty && tty !== "??") {
          state.terminalTTY = tty.startsWith("/dev/") ? tty : "/dev/" + tty;
        }
      } catch {}
    }
    if (!state.terminalTTY && state.terminalPid) {
      try {
        const { stdout } = await execAsync(
          `lsof -p ${state.terminalPid} 2>/dev/null | grep -m1 "/dev/ttys" | awk '{print $9}'`
        );
        const tty = stdout.trim();
        if (tty?.startsWith("/dev/")) state.terminalTTY = tty;
      } catch {}
    }

    // Try to get app bundle ID
    if (!state.terminalApp) {
      try {
        const { stdout } = await execAsync(`lsappinfo info -only bundleID ${state.terminalPid}`);
        const match = stdout.match(/"CFBundleIdentifier"="([^"]+)"/);
        if (match) state.terminalApp = match[1];
      } catch {
        state.terminalApp = "com.apple.Terminal";
      }
    }
  } catch {}
}

async function isTerminalInBackground(state: SessionState): Promise<boolean> {
  if (!IS_MACOS) return false;

  try {
    const { stdout } = await execAsync(
      "lsappinfo front | awk '{print $1}' | xargs -I {} lsappinfo info -only bundleID {}"
    );
    const match = stdout.match(/"CFBundleIdentifier"="([^"]+)"/);
    if (!match) return false;

    const frontBundleId = match[1];
    if (state.terminalApp && !frontBundleId.includes(state.terminalApp)) {
      return true;
    }

    const knownTerminals = Object.keys(TERMINAL_BUNDLE_IDS).filter((k) => k.includes("."));
    return !knownTerminals.some((id) => frontBundleId.includes(id));
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Say Command Detection
// ─────────────────────────────────────────────────────────────────────────────

async function checkSayCommand(): Promise<void> {
  if (!IS_MACOS) {
    HAS_SAY_COMMAND = false;
    return;
  }

  try {
    await execAsync("which say");
    HAS_SAY_COMMAND = true;
  } catch {
    HAS_SAY_COMMAND = false;
  }
}

function getCurrentDirName(): string {
  try {
    return process.cwd().split("/").pop() || "unknown";
  } catch {
    return "unknown";
  }
}

function replaceMessageTemplates(message: string): string {
  return message.replace(/{dirname}/g, getCurrentDirName());
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

async function playBeep(soundName: string = "Tink"): Promise<void> {
  if (IS_MACOS) {
    child_process.exec(`afplay /System/Library/Sounds/${soundName}.aiff`);
  } else if (process.platform === "linux") {
    try {
      child_process.exec("paplay /usr/share/sounds/freedesktop/stereo/bell.oga");
    } catch {
      child_process.exec("echo -e '\\a'");
    }
  } else {
    child_process.exec("echo -e '\\a'");
  }
}

async function speakMessage(message: string): Promise<void> {
  if (!isSayAvailable()) return;

  const finalMessage = replaceMessageTemplates(message);
  const escapedMessage = finalMessage.replace(/"/g, '\\"');

  return new Promise((resolve, reject) => {
    child_process.exec(`say "${escapedMessage}"`, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function bringTerminalToFront(state: SessionState): Promise<void> {
  if (!IS_MACOS) return;

  try {
    let appName = "Terminal";
    if (state.terminalApp) {
      for (const [key, value] of Object.entries(TERMINAL_BUNDLE_IDS)) {
        if (state.terminalApp.includes(key) || key.includes(state.terminalApp)) {
          appName = value;
          break;
        }
      }
    }

    let script: string;
    if (appName === "Terminal" && state.terminalTTY) {
      script = `tell application "Terminal"
  activate
  repeat with w in windows
    repeat with t in tabs of w
      if tty of t is "${state.terminalTTY}" then
        set index of w to 1
        set selected of t to true
        return
      end if
    end repeat
  end repeat
end tell`;
    } else if (appName === "iTerm2" && state.terminalTTY) {
      script = `tell application "iTerm2"
  repeat with w in windows
    set tabIdx to 0
    repeat with t in tabs of w
      set tabIdx to tabIdx + 1
      repeat with s in sessions of t
        if tty of s is "${state.terminalTTY}" then
          tell w to select tab tabIdx
          activate
          return
        end if
      end repeat
    end repeat
  end repeat
end tell`;
    } else {
      script = `tell application "${appName}" to activate`;
    }

    const tmpFile = path.join(os.tmpdir(), `pi-terminal-${Date.now()}.scpt`);
    try {
      await fs.writeFile(tmpFile, script, "utf8");
      await execAsync(`osascript "${tmpFile}"`);
    } finally {
      try {
        await fs.unlink(tmpFile);
      } catch {}
    }
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getConfig(ctx: ExtensionContext): Promise<BackgroundNotifyConfig> {
  // Try to get settings from settingsManager first (for backward compatibility)
  const settings = (ctx as any).settingsManager?.getSettings() ?? {};

  // If settingsManager has it, use it
  if (settings.backgroundNotify) {
    return { ...DEFAULT_CONFIG, ...settings.backgroundNotify };
  }

  // Otherwise, read directly from the settings file
  const fileSettings = await readSettingsFile();
  if (fileSettings.backgroundNotify) {
    return { ...DEFAULT_CONFIG, ...fileSettings.backgroundNotify };
  }

  return DEFAULT_CONFIG;
}

function getEffective(state: SessionState, config: BackgroundNotifyConfig) {
  return {
    beep: state.beepOverride ?? config.beep,
    focus: state.focusOverride ?? config.bringToFront,
    say: isSayAvailable() ? (state.sayOverride ?? config.say) : false,
    sound: state.beepSoundOverride ?? config.beepSound,
    sayMessage: state.sayMessageOverride ?? config.sayMessage,
  };
}

async function saveGlobalSettings(_ctx: ExtensionContext, updates: Partial<BackgroundNotifyConfig>): Promise<void> {
  try {
    const settings = await readSettingsFile();
    settings.backgroundNotify = {
      ...settings.backgroundNotify,
      ...updates,
    };

    await writeSettingsFile(settings);
  } catch (err) {
    console.error("Failed to save settings:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

function registerCommands(pi: ExtensionAPI, state: SessionState) {
  pi.registerCommand("notify-beep", {
    description: "Toggle beep notification (off if on, select sound if off)",
    handler: async (_, ctx) => {
      const config = await getConfig(ctx);
      const current = state.beepOverride ?? config.beep;

      if (current) {
        // Currently ON, turn OFF
        state.beepOverride = false;
        ctx.ui.notify("🔇 Beep OFF", "warning");
      } else {
        // Currently OFF, let user select a sound
        if (!ctx.hasUI || !IS_MACOS) {
          // No UI or not macOS, just turn on with current sound
          state.beepOverride = true;
          ctx.ui.notify("🔊 Beep ON", "info");
          await playBeep(state.beepSoundOverride ?? config.beepSound);
          return;
        }

        const currentSound = state.beepSoundOverride ?? config.beepSound;
        const options = [
          "🔊 Use current sound",
          "───",
          ...BEEP_SOUNDS.map((s) => `🎵 ${s}${s === currentSound ? " ✓" : ""}`),
          "───",
          "❌ Cancel"
        ];

        const action = await ctx.ui.select(`Turn beep ON - Select sound (current: ${currentSound})`, options);

        if (!action || action === "❌ Cancel" || action === "───") {
          return;
        }

        if (action === "🔊 Use current sound") {
          state.beepOverride = true;
          ctx.ui.notify(`🔊 Beep ON (${currentSound})`, "info");
          await playBeep(currentSound);
        } else {
          const sound = extractOptionText(action, "🎵 ");
          if (sound) {
            state.beepOverride = true;
            state.beepSoundOverride = sound;
            ctx.ui.notify(`🔊 Beep ON (${sound})`, "info");
            await playBeep(sound);
          }
        }
      }
    },
  });

  pi.registerCommand("notify-focus", {
    description: "Toggle bring-to-front",
    handler: async (_, ctx) => {
      const config = await getConfig(ctx);
      const current = state.focusOverride ?? config.bringToFront;
      state.focusOverride = !current;

      ctx.ui.notify(state.focusOverride ? "🪟 Focus ON" : "⬜ Focus OFF", state.focusOverride ? "info" : "warning");
    },
  });

  pi.registerCommand("notify-say", {
    description: "Toggle speech notification (off if on, select message if off)",
    handler: async (_, ctx) => {
      if (!isSayAvailable()) {
        ctx.ui.notify("❌ 'say' command not available (macOS only)", "warning");
        return;
      }

      const config = await getConfig(ctx);
      const current = state.sayOverride ?? config.say;

      if (current) {
        // Currently ON, turn OFF
        state.sayOverride = false;
        ctx.ui.notify("🔇 Speech OFF", "warning");
      } else {
        // Currently OFF, let user select a message
        if (!ctx.hasUI) {
          // No UI, just turn on with current message
          state.sayOverride = true;
          const msg = state.sayMessageOverride ?? config.sayMessage;
          ctx.ui.notify("🗣️  Speech ON", "info");
          await speakMessage(msg);
          return;
        }

        const currentMessage = state.sayMessageOverride ?? config.sayMessage;
        const options = [
          "🗣️  Use current message",
          "───",
          ...SAY_MESSAGES.map((m) => `💬 "${m}"${m === currentMessage ? " ✓" : ""}`),
          "───",
          "✏️  Enter custom message...",
          "───",
          "❌ Cancel"
        ];

        const action = await ctx.ui.select(`Turn speech ON - Select message (current: "${currentMessage}")`, options);

        if (!action || action === "❌ Cancel" || action === "───") {
          return;
        }

        if (action === "🗣️  Use current message") {
          state.sayOverride = true;
          ctx.ui.notify(`🗣️  Speech ON ("${currentMessage}")`, "info");
          await speakMessage(currentMessage);
        } else if (action.startsWith("💬 ")) {
          const message = action.replace('💬 "', '').replace('"', '').replace(" ✓", "");
          state.sayOverride = true;
          state.sayMessageOverride = message;
          ctx.ui.notify(`🗣️  Speech ON ("${message}")`, "info");
          await speakMessage(message);
        } else if (action === "✏️  Enter custom message...") {
          const customMessage = await ctx.ui.input("Enter message to speak");
          if (customMessage && customMessage.trim()) {
            state.sayOverride = true;
            state.sayMessageOverride = customMessage.trim();
            ctx.ui.notify(`🗣️  Speech ON ("${customMessage.trim()}")`, "info");
            await speakMessage(customMessage.trim());
          }
        }
      }
    },
  });

  pi.registerCommand("notify-threshold", {
    description: "Set notification threshold (minimum task duration)",
    handler: async (_, ctx) => {
      const config = await getConfig(ctx);

      if (!ctx.hasUI) {
        ctx.ui.notify(`Current threshold: ${config.thresholdMs}ms`, "info");
        return;
      }

      const options = [
        `1000ms (1s)${config.thresholdMs === 1000 ? " ✓" : ""}`,
        `2000ms (2s)${config.thresholdMs === 2000 ? " ✓" : ""}`,
        `3000ms (3s)${config.thresholdMs === 3000 ? " ✓" : ""}`,
        `5000ms (5s)${config.thresholdMs === 5000 ? " ✓" : ""}`,
        `10000ms (10s)${config.thresholdMs === 10000 ? " ✓" : ""}`,
        "───",
        "❌ Cancel"
      ];

      const action = await ctx.ui.select(`Threshold (current: ${config.thresholdMs}ms)`, options);

      if (!action || action === "❌ Cancel" || action === "───") {
        return;
      }

      const match = action.match(/^(\d+)ms/);
      if (match) {
        const newThreshold = parseInt(match[1], 10);
        await saveGlobalSettings(ctx, { thresholdMs: newThreshold });
        ctx.ui.notify(`⏱️  Threshold set to ${newThreshold}ms`, "info");
      }
    },
  });

  pi.registerCommand("notify-status", {
    description: "Show notification settings",
    handler: async (_, ctx) => {
      const config = await getConfig(ctx);
      const eff = getEffective(state, config);

      const beepIcon = eff.beep ? "🔊" : "🔇";
      const focusIcon = eff.focus ? "🪟" : "⬜";
      const sayIcon = isSayAvailable() && eff.say ? "🗣️" : "🔇";

      const globalBeepIcon = config.beep ? "🔊" : "🔇";
      const globalFocusIcon = config.bringToFront ? "🪟" : "⬜";
      const globalSayIcon = isSayAvailable() && config.say ? "🗣️" : "🔇";

      const hasOverrides = state.beepOverride !== null || state.focusOverride !== null || state.beepSoundOverride !== null || state.sayOverride !== null || state.sayMessageOverride !== null;

      const status = [
        "╭─ Background Notify Status ─╮",
        "",
        "Current (Effective):",
        `  ${beepIcon} Beep: ${eff.beep ? "ON" : "OFF"}`,
        `  ${focusIcon} Focus: ${eff.focus ? "ON" : "OFF"}`,
        isSayAvailable() ? `  ${sayIcon} Speech: ${eff.say ? "ON" : "OFF"}` : `  🔇 Speech: (not available)`,
        isSayAvailable() ? `  💬 Message: "${eff.sayMessage}"` : "",
        isSayAvailable() && eff.sayMessage.includes("{dirname}") ? `  → Spoken: "${replaceMessageTemplates(eff.sayMessage)}"` : "",
        `  🎵 Sound: ${eff.sound}`,
        `  ⏱️  Threshold: ${config.thresholdMs}ms`,
        "",
        "Global Defaults:",
        `  ${globalBeepIcon} Beep: ${config.beep ? "ON" : "OFF"}`,
        `  ${globalFocusIcon} Focus: ${config.bringToFront ? "ON" : "OFF"}`,
        isSayAvailable() ? `  ${globalSayIcon} Speech: ${config.say ? "ON" : "OFF"}` : `  🔇 Speech: (not available)`,
        isSayAvailable() ? `  💬 Message: "${config.sayMessage}"` : "",
        isSayAvailable() && config.sayMessage.includes("{dirname}") ? `  → Spoken: "${replaceMessageTemplates(config.sayMessage)}"` : "",
        `  🎵 Sound: ${config.beepSound}`,
        `  ⏱️  Threshold: ${config.thresholdMs}ms`,
      ];

      if (hasOverrides) {
        status.push("");
        status.push("Session Overrides:");
        if (state.beepOverride !== null) {
          status.push(`  ${state.beepOverride ? "🔊" : "🔇"} Beep: ${state.beepOverride ? "ON" : "OFF"}`);
        }
        if (state.focusOverride !== null) {
          status.push(`  ${state.focusOverride ? "🪟" : "⬜"} Focus: ${state.focusOverride ? "ON" : "OFF"}`);
        }
        if (state.beepSoundOverride !== null) {
          status.push(`  🎵 Sound: ${state.beepSoundOverride}`);
        }
        if (state.sayOverride !== null) {
          status.push(`  ${state.sayOverride ? "🗣️" : "🔇"} Speech: ${state.sayOverride ? "ON" : "OFF"}`);
        }
        if (state.sayMessageOverride !== null) {
          status.push(`  💬 Message: "${state.sayMessageOverride}"`);
          if (state.sayMessageOverride.includes("{dirname}")) {
            status.push(`     → Spoken: "${replaceMessageTemplates(state.sayMessageOverride)}"`);
          }
        }
      }

      status.push("");
      status.push(`💻 Terminal: ${state.terminalApp ?? "(unknown)"}`);
      status.push("╰────────────────────────────╯");

      ctx.ui.notify(status.join("\n"), "info");
    },
  });

  pi.registerCommand("notify-save-global", {
    description: "Save current settings as global defaults",
    handler: async (_, ctx) => {
      const config = await getConfig(ctx);
      const eff = getEffective(state, config);

      await saveGlobalSettings(ctx, {
        beep: eff.beep,
        bringToFront: eff.focus,
        beepSound: eff.sound,
        say: isSayAvailable() ? eff.say : false,
        sayMessage: eff.sayMessage,
        thresholdMs: config.thresholdMs,
      });

      ctx.ui.notify("✅ Settings saved to ~/.pi/agent/settings.json", "info");

      const status = [
        `  ${eff.beep ? "🔊" : "🔇"} Beep: ${eff.beep ? "ON" : "OFF"}`,
        `  ${eff.focus ? "🪟" : "⬜"} Focus: ${eff.focus ? "ON" : "OFF"}`,
        isSayAvailable() ? `  ${eff.say ? "🗣️" : "🔇"} Speech: ${eff.say ? "ON" : "OFF"}` : "",
        isSayAvailable() ? `  💬 Message: "${eff.sayMessage}"` : "",
        `  🎵 Sound: ${eff.sound}`,
        `  ⏱️  Threshold: ${config.thresholdMs}ms`,
      ].filter(Boolean).join("\n");

      ctx.ui.notify(status, "info");
    },
  });
}

