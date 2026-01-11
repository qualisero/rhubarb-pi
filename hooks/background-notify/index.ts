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
 *     "bringToFront": true
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
}

interface SessionState {
  beepOverride: boolean | null;
  beepSoundOverride: string | null;
  focusOverride: boolean | null;
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
};

const IS_MACOS = process.platform === "darwin";

const BEEP_SOUNDS = [
  "Tink", "Basso", "Blow", "Bottle", "Frog", "Funk",
  "Glass", "Hero", "Morse", "Ping", "Pop", "Purr",
  "Sosumi", "Submarine",
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

const TEST_DELAY_MS = 3000;

// ─────────────────────────────────────────────────────────────────────────────
// Main Extension
// ─────────────────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  const state: SessionState = {
    beepOverride: null,
    beepSoundOverride: null,
    focusOverride: null,
    terminalApp: undefined,
    terminalPid: undefined,
    terminalTTY: undefined,
    lastToolTime: undefined,
    totalActiveTime: 0,
  };

  registerCommands(pi, state);

  pi.on("session_start", async (_, ctx) => {
    // Reset session state
    state.beepOverride = null;
    state.beepSoundOverride = null;
    state.focusOverride = null;
    state.lastToolTime = undefined;
    state.totalActiveTime = 0;

    // Detect terminal
    await detectTerminal(state);
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

    const config = getConfig(ctx);
    const shouldBeep = state.beepOverride ?? config.beep;
    const shouldFocus = state.focusOverride ?? config.bringToFront;
    const sound = state.beepSoundOverride ?? config.beepSound;

    if (!shouldBeep && !shouldFocus) return;
    if (duration < config.thresholdMs) return;

    const isBackground = await isTerminalInBackground(state);
    if (!isBackground) return;

    const tasks: Promise<void>[] = [];
    const actions: string[] = [];

    if (shouldBeep) {
      tasks.push(playBeep(sound));
      actions.push("beeped");
    }
    if (shouldFocus) {
      tasks.push(bringTerminalToFront(state));
      actions.push("brought to front");
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

function getConfig(ctx: ExtensionContext): BackgroundNotifyConfig {
  // Try to get settings from settingsManager first (for backward compatibility)
  const settings = (ctx as any).settingsManager?.getSettings() ?? {};
  
  // If settingsManager has it, use it
  if (settings.backgroundNotify) {
    return { ...DEFAULT_CONFIG, ...settings.backgroundNotify };
  }
  
  // Otherwise, read directly from the settings file
  try {
    const settingsPath = path.join(os.homedir(), ".pi", "agent", "settings.json");
    const content = require("fs").readFileSync(settingsPath, "utf8");
    const fileSettings = JSON.parse(content);
    if (fileSettings.backgroundNotify) {
      return { ...DEFAULT_CONFIG, ...fileSettings.backgroundNotify };
    }
  } catch {
    // File doesn't exist or can't be read, use defaults
  }
  
  return DEFAULT_CONFIG;
}

function getEffective(state: SessionState, config: BackgroundNotifyConfig) {
  return {
    beep: state.beepOverride ?? config.beep,
    focus: state.focusOverride ?? config.bringToFront,
    sound: state.beepSoundOverride ?? config.beepSound,
  };
}

async function saveGlobalSettings(ctx: ExtensionContext, updates: Partial<BackgroundNotifyConfig>): Promise<void> {
  try {
    const settingsPath = path.join(os.homedir(), ".pi", "agent", "settings.json");
    let settings: any = {};
    
    try {
      const content = await fs.readFile(settingsPath, "utf8");
      settings = JSON.parse(content);
    } catch {
      // File doesn't exist or invalid, start fresh
    }

    settings.backgroundNotify = {
      ...settings.backgroundNotify,
      ...updates,
    };

    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
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
      const config = getConfig(ctx);
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
        } else if (action.startsWith("🎵 ")) {
          const sound = action.replace("🎵 ", "").replace(" ✓", "");
          state.beepOverride = true;
          state.beepSoundOverride = sound;
          ctx.ui.notify(`🔊 Beep ON (${sound})`, "info");
          await playBeep(sound);
        }
      }
    },
  });

  pi.registerCommand("notify-focus", {
    description: "Toggle bring-to-front",
    handler: async (_, ctx) => {
      const config = getConfig(ctx);
      const current = state.focusOverride ?? config.bringToFront;
      state.focusOverride = !current;

      ctx.ui.notify(state.focusOverride ? "🪟 Focus ON" : "⬜ Focus OFF", state.focusOverride ? "info" : "warning");
    },
  });

  pi.registerCommand("notify-threshold", {
    description: "Set notification threshold (minimum task duration)",
    handler: async (_, ctx) => {
      const config = getConfig(ctx);

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
      const config = getConfig(ctx);
      const eff = getEffective(state, config);

      const beepIcon = eff.beep ? "🔊" : "🔇";
      const focusIcon = eff.focus ? "🪟" : "⬜";
      
      const globalBeepIcon = config.beep ? "🔊" : "🔇";
      const globalFocusIcon = config.bringToFront ? "🪟" : "⬜";

      const hasOverrides = state.beepOverride !== null || state.focusOverride !== null || state.beepSoundOverride !== null;

      const status = [
        "╭─ Background Notify Status ─╮",
        "",
        "Current (Effective):",
        `  ${beepIcon} Beep: ${eff.beep ? "ON" : "OFF"}`,
        `  ${focusIcon} Focus: ${eff.focus ? "ON" : "OFF"}`,
        `  🎵 Sound: ${eff.sound}`,
        `  ⏱️  Threshold: ${config.thresholdMs}ms`,
        "",
        "Global Defaults:",
        `  ${globalBeepIcon} Beep: ${config.beep ? "ON" : "OFF"}`,
        `  ${globalFocusIcon} Focus: ${config.bringToFront ? "ON" : "OFF"}`,
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
      const config = getConfig(ctx);
      const eff = getEffective(state, config);

      await saveGlobalSettings(ctx, {
        beep: eff.beep,
        bringToFront: eff.focus,
        beepSound: eff.sound,
        thresholdMs: config.thresholdMs,
      });

      ctx.ui.notify("✅ Settings saved to ~/.pi/agent/settings.json", "info");
      
      const status = [
        `  ${eff.beep ? "🔊" : "🔇"} Beep: ${eff.beep ? "ON" : "OFF"}`,
        `  ${eff.focus ? "🪟" : "⬜"} Focus: ${eff.focus ? "ON" : "OFF"}`,
        `  🎵 Sound: ${eff.sound}`,
        `  ⏱️  Threshold: ${config.thresholdMs}ms`,
      ].join("\n");
      
      ctx.ui.notify(status, "info");
    },
  });
}
