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
  const settings = (ctx as any).settingsManager?.getSettings() ?? {};
  return { ...DEFAULT_CONFIG, ...(settings.backgroundNotify ?? {}) };
}

function getEffective(state: SessionState, config: BackgroundNotifyConfig) {
  return {
    beep: state.beepOverride ?? config.beep,
    focus: state.focusOverride ?? config.bringToFront,
    sound: state.beepSoundOverride ?? config.beepSound,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

function registerCommands(pi: ExtensionAPI, state: SessionState) {
  pi.registerCommand("notify", {
    description: "Toggle background notifications (beep + focus)",
    handler: async (_, ctx) => {
      const config = getConfig(ctx);
      const eff = getEffective(state, config);
      const newState = !(eff.beep || eff.focus);

      state.beepOverride = newState;
      state.focusOverride = newState;

      if (newState) {
        ctx.ui.notify("🔔 Notifications ON (beep + focus)", "info");
        await playBeep(eff.sound);
      } else {
        ctx.ui.notify("🔕 Notifications OFF", "warning");
      }
    },
  });

  pi.registerCommand("notify-beep", {
    description: "Toggle beep notification",
    handler: async (_, ctx) => {
      const config = getConfig(ctx);
      const current = state.beepOverride ?? config.beep;
      state.beepOverride = !current;

      if (state.beepOverride) {
        ctx.ui.notify("🔊 Beep ON", "info");
        await playBeep(state.beepSoundOverride ?? config.beepSound);
      } else {
        ctx.ui.notify("🔇 Beep OFF", "warning");
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

  pi.registerCommand("notify-status", {
    description: "Show notification settings",
    handler: async (_, ctx) => {
      const config = getConfig(ctx);
      const eff = getEffective(state, config);

      ctx.ui.notify("─── Background Notify ───", "info");
      ctx.ui.notify(`Beep: ${eff.beep ? "🔊 ON" : "🔇 OFF"}  │  Focus: ${eff.focus ? "🪟 ON" : "⬜ OFF"}  │  Sound: ${eff.sound}`, "info");
      ctx.ui.notify(`Threshold: ${config.thresholdMs}ms  │  Terminal: ${state.terminalApp ?? "(unknown)"}`, "info");
    },
  });

  pi.registerCommand("notify-test", {
    description: "Test notification after 3 seconds",
    handler: async (_, ctx) => {
      const config = getConfig(ctx);
      const eff = getEffective(state, config);

      ctx.ui.notify("🧪 Testing in 3s... switch apps to see it!", "info");
      await new Promise((r) => setTimeout(r, TEST_DELAY_MS));

      const triggered: string[] = [];
      if (eff.beep) {
        await playBeep(eff.sound);
        triggered.push("beep");
      }
      if (eff.focus) {
        await bringTerminalToFront(state);
        triggered.push("focus");
      }

      ctx.ui.notify(
        triggered.length > 0
          ? `✅ Test complete: ${triggered.join(" + ")}`
          : "⚠️ Both beep and focus disabled",
        triggered.length > 0 ? "info" : "warning"
      );
    },
  });

  pi.registerCommand("notify-config", {
    description: "Configure notification settings",
    handler: async (_, ctx) => {
      const config = getConfig(ctx);
      const eff = getEffective(state, config);

      ctx.ui.notify("─── Notify Config ───", "info");
      ctx.ui.notify(`Beep: ${eff.beep ? "ON" : "OFF"}  │  Focus: ${eff.focus ? "ON" : "OFF"}  │  Sound: ${eff.sound}`, "info");

      if (!ctx.hasUI) return;

      const options = IS_MACOS
        ? ["🔊 Test current beep", ...BEEP_SOUNDS.map((s) => `🎵 ${s}${s === eff.sound ? " ✓" : ""}`), "───", "🔄 Reset to defaults", "📋 Terminal info", "❌ Cancel"]
        : ["🔄 Reset to defaults", "📋 Terminal info", "❌ Cancel"];

      const action = await ctx.ui.select("Options", options);
      if (!action || action === "❌ Cancel" || action === "───") return;

      if (action === "🔊 Test current beep") {
        ctx.ui.notify(`Playing ${eff.sound}...`, "info");
        await playBeep(eff.sound);
      } else if (action.startsWith("🎵 ")) {
        const sound = action.replace("🎵 ", "").replace(" ✓", "");
        ctx.ui.notify(`Playing ${sound}...`, "info");
        await playBeep(sound);
        state.beepSoundOverride = sound;
        ctx.ui.notify(`Sound set to "${sound}"`, "info");
      } else if (action === "🔄 Reset to defaults") {
        state.beepOverride = null;
        state.focusOverride = null;
        state.beepSoundOverride = null;
        ctx.ui.notify("✅ Reset to global defaults", "info");
      } else if (action === "📋 Terminal info") {
        ctx.ui.notify(`App: ${state.terminalApp ?? "(unknown)"}  │  PID: ${state.terminalPid ?? "?"}  │  TTY: ${state.terminalTTY ?? "?"}`, "info");
      }
    },
  });
}
