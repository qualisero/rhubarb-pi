/**
 * Background Task Completion Hook
 * 
 * Detects long-running tasks and brings the terminal to the front if it's backgrounded.
 * Notifications are DISABLED by default. Use /notify to enable per session.
 * 
 * Configuration (in ~/.pi/agent/settings.json):
 * {
 *   "backgroundNotify": {
 *     "enabledByDefault": false,
 *     "thresholdMs": 2000,
 *     "beep": true,
 *     "bringToFront": true
 *   }
 * }
 * 
 * - `enabledByDefault`: Global setting for new sessions (default: false)
 * - Per-session control: Use /notify (toggle), /notify-enable, /notify-disable
 */

import type { HookAPI } from "@mariozechner/pi-coding-agent";
import * as child_process from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const execAsync = promisify(child_process.exec);

interface BackgroundNotifyConfig {
  enabledByDefault?: boolean;
  thresholdMs?: number;
  beep?: boolean;
  bringToFront?: boolean;
}

const DEFAULT_CONFIG: Required<BackgroundNotifyConfig> = {
  enabledByDefault: false,
  thresholdMs: 2000,
  beep: true,
  bringToFront: true,
};

export default function (pi: HookAPI) {
  let startTime: number | undefined;
  let terminalPid: number | undefined;
  let terminalApp: string | undefined;
  let terminalTTY: string | undefined;
  let sessionEnabledOverride: boolean | null = null;
  let sessionBeepOverride: boolean | null = null;
  let sessionBringToFrontOverride: boolean | null = null;

  // Register slash commands
  registerCommands(
    pi,
    () => terminalApp,
    () => terminalPid,
    () => terminalTTY,
    () => sessionEnabledOverride,
    (value) => {
      sessionEnabledOverride = value;
    },
    () => sessionBeepOverride,
    (value) => {
      sessionBeepOverride = value;
    },
    () => sessionBringToFrontOverride,
    (value) => {
      sessionBringToFrontOverride = value;
    }
  );

  // Detect terminal at startup
  pi.on("session_start", async () => {
    sessionEnabledOverride = null;
    sessionBeepOverride = null;
    sessionBringToFrontOverride = null;
    try {
      terminalPid = process.ppid;
      terminalTTY = process.env.TTY;
      
      if (!terminalTTY && process.platform === "darwin") {
        try {
          const { stdout } = await execAsync(`ps -p ${process.ppid} -o tty=`);
          const tty = stdout.trim();
          if (tty && tty !== '??') {
            terminalTTY = tty.startsWith('/dev/') ? tty : '/dev/' + tty;
          }
        } catch {}
      }
      
      if (!terminalTTY && process.platform === "darwin" && terminalPid) {
        try {
          const { stdout: ttyInfo } = await execAsync(`lsof -p ${terminalPid} 2>/dev/null | grep -m1 "/dev/ttys" | awk '{print $9}'`);
          const tty = ttyInfo.trim();
          if (tty && tty.startsWith('/dev/')) {
            terminalTTY = tty;
          }
        } catch {}
      }
      
      terminalApp = process.env.TERM_PROGRAM;
      
      if (!terminalApp && process.platform === "darwin") {
        try {
          const { stdout } = await execAsync(`lsappinfo info -only bundleID ${terminalPid}`);
          const match = stdout.match(/"CFBundleIdentifier"="([^"]+)"/);
          if (match) {
            terminalApp = match[1];
          }
        } catch {
          terminalApp = "com.apple.Terminal";
        }
      }
    } catch {}
  });

  pi.on("agent_start", async () => {
    startTime = Date.now();
  });

  pi.on("agent_end", async (_, ctx) => {
    if (!startTime) return;

    const duration = Date.now() - startTime;
    startTime = undefined;

    const settings = (ctx as any).settingsManager?.getSettings() ?? {};
    const config: Required<BackgroundNotifyConfig> = {
      ...DEFAULT_CONFIG,
      ...(settings.backgroundNotify ?? {}),
    };

    // Determine if enabled: session override takes precedence, else global default
    const isEnabled = sessionEnabledOverride !== null 
      ? sessionEnabledOverride 
      : config.enabledByDefault;

    if (!isEnabled || duration < config.thresholdMs) return;

    const isBackground = await isTerminalInBackground(terminalApp, terminalPid);
    if (!isBackground) return;

    const durationSec = (duration / 1000).toFixed(1);

    // Use session overrides if set, otherwise use config
    const shouldBeep = sessionBeepOverride !== null ? sessionBeepOverride : config.beep;
    const shouldBringToFront = sessionBringToFrontOverride !== null ? sessionBringToFrontOverride : config.bringToFront;

    const tasks: Promise<void>[] = [];
    
    if (shouldBeep) {
      tasks.push(playBeep().catch(() => {}));
    }

    if (shouldBringToFront) {
      tasks.push(bringTerminalToFront(terminalApp, terminalPid, terminalTTY));
    }
    
    await Promise.all(tasks);

    if (ctx.hasUI) {
      const actions = [];
      if (shouldBeep) actions.push("beeped");
      if (shouldBringToFront) actions.push("brought to front");
      const actionText = actions.length > 0 ? ` (${actions.join(", ")})` : "";
      ctx.ui.notify(`Task completed in ${durationSec}s${actionText}`, "success");
    }
  });
}

/**
 * Play an audible beep (non-blocking)
 */
async function playBeep(): Promise<void> {
  if (process.platform === "darwin") {
    child_process.exec("afplay /System/Library/Sounds/Tink.aiff");
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

/**
 * Check if the terminal is in the background
 */
async function isTerminalInBackground(
  terminalApp: string | undefined,
  terminalPid: number | undefined
): Promise<boolean> {
  if (process.platform !== "darwin") return false;

  try {
    // Combine both lsappinfo calls into one: get front app and its bundle ID in single query
    const { stdout } = await execAsync("lsappinfo front | awk '{print $1}' | xargs -I {} lsappinfo info -only bundleID {}");
    const match = stdout.match(/"CFBundleIdentifier"="([^"]+)"/);
    if (!match) return false;
    
    const frontBundleId = match[1];

    if (terminalApp && !frontBundleId.includes(terminalApp)) {
      return true;
    }

    const terminalBundleIds = [
      "com.apple.Terminal",
      "com.googlecode.iterm2",
      "com.github.wez.wezterm",
      "net.kovidgoyal.kitty",
      "com.mitchellh.ghostty",
    ];

    const isTerminalFront = terminalBundleIds.some((id) => frontBundleId.includes(id));
    return !isTerminalFront;
  } catch {
    return false;
  }
}

/**
 * Bring the terminal application to the front
 */
async function bringTerminalToFront(
  terminalApp: string | undefined,
  terminalPid: number | undefined,
  terminalTTY: string | undefined
): Promise<void> {
  if (process.platform !== "darwin") return;

  try {
    const appNameMap: Record<string, string> = {
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

    let appName = "Terminal";

    if (terminalApp) {
      if (appNameMap[terminalApp]) {
        appName = appNameMap[terminalApp];
      } else {
        for (const [key, value] of Object.entries(appNameMap)) {
          if (terminalApp.includes(key) || key.includes(terminalApp)) {
            appName = value;
            break;
          }
        }
      }
    }

    let script: string;
    
    if (appName === "Terminal" && terminalTTY) {
      script = `tell application "Terminal"
  activate
  set targetTTY to "${terminalTTY}"
  repeat with w in windows
    repeat with t in tabs of w
      if tty of t is targetTTY then
        set index of w to 1
        set selected of t to true
        set frontmost to true
        return
      end if
    end repeat
  end repeat
end tell`;
    } else if (appName === "iTerm2" && terminalTTY) {
      script = `tell application "iTerm2"
  activate
  set targetTTY to "${terminalTTY}"
  repeat with w in windows
    repeat with t in tabs of w
      repeat with s in sessions of t
        if tty of s is targetTTY then
          select w
          select t
          select s
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
      await fs.writeFile(tmpFile, script, 'utf8');
      await execAsync(`osascript "${tmpFile}"`);
    } finally {
      try {
        await fs.unlink(tmpFile);
      } catch {}
    }
  } catch {}
}

/**
 * Register slash commands for configuration
 */
function registerCommands(
  pi: HookAPI,
  getTerminalApp: () => string | undefined,
  getTerminalPid: () => number | undefined,
  getTerminalTTY: () => string | undefined,
  getSessionOverride: () => boolean | null,
  setSessionOverride: (value: boolean | null) => void,
  getSessionBeepOverride: () => boolean | null,
  setSessionBeepOverride: (value: boolean | null) => void,
  getSessionBringToFrontOverride: () => boolean | null,
  setSessionBringToFrontOverride: (value: boolean | null) => void
) {
  /**
   * /notify - Toggle both beep and focus for current session
   */
  pi.registerCommand("notify", {
    description: "Toggle background notifications (beep + focus) for this session",
    handler: async (args, ctx) => {
      const settings = (ctx as any).settingsManager?.getSettings() ?? {};
      const config: Required<BackgroundNotifyConfig> = {
        ...DEFAULT_CONFIG,
        ...(settings.backgroundNotify ?? {}),
      };

      const sessionOverride = getSessionOverride();
      const currentState = sessionOverride !== null ? sessionOverride : config.enabledByDefault;
      const newState = !currentState;
      
      setSessionOverride(newState);
      // Also set both beep and focus to the new state
      setSessionBeepOverride(newState);
      setSessionBringToFrontOverride(newState);
      
      if (newState) {
        ctx.ui.notify("🔔 Background notifications ON (beep + focus)", "success");
        await playBeep().catch(() => {});
      } else {
        ctx.ui.notify("🔕 Background notifications OFF", "warning");
      }
    }
  });

  /**
   * /notify-beep - Toggle beep on/off for this session
   */
  pi.registerCommand("notify-beep", {
    description: "Toggle beep notification for this session",
    handler: async (args, ctx) => {
      const settings = (ctx as any).settingsManager?.getSettings() ?? {};
      const config: Required<BackgroundNotifyConfig> = {
        ...DEFAULT_CONFIG,
        ...(settings.backgroundNotify ?? {}),
      };

      const sessionBeepOverride = getSessionBeepOverride();
      const currentState = sessionBeepOverride !== null ? sessionBeepOverride : config.beep;
      const newState = !currentState;
      
      setSessionBeepOverride(newState);
      
      // Also enable notifications if turning beep on
      if (newState && getSessionOverride() === false) {
        setSessionOverride(true);
      }
      
      if (newState) {
        ctx.ui.notify("🔊 Beep ON", "success");
        await playBeep().catch(() => {});
      } else {
        ctx.ui.notify("🔇 Beep OFF", "warning");
      }
    }
  });

  /**
   * /notify-focus - Toggle bring-to-front on/off for this session
   */
  pi.registerCommand("notify-focus", {
    description: "Toggle bring-to-front for this session",
    handler: async (args, ctx) => {
      const settings = (ctx as any).settingsManager?.getSettings() ?? {};
      const config: Required<BackgroundNotifyConfig> = {
        ...DEFAULT_CONFIG,
        ...(settings.backgroundNotify ?? {}),
      };

      const sessionBringToFrontOverride = getSessionBringToFrontOverride();
      const currentState = sessionBringToFrontOverride !== null ? sessionBringToFrontOverride : config.bringToFront;
      const newState = !currentState;
      
      setSessionBringToFrontOverride(newState);
      
      // Also enable notifications if turning focus on
      if (newState && getSessionOverride() === false) {
        setSessionOverride(true);
      }
      
      if (newState) {
        ctx.ui.notify("🪟 Focus ON (bring terminal to front)", "success");
      } else {
        ctx.ui.notify("⬜ Focus OFF", "warning");
      }
    }
  });

  /**
   * /notify-test - Quick 3-second notification test
   */
  pi.registerCommand("notify-test", {
    description: "Test notification after 3 seconds (switch apps to see it)",
    handler: async (args, ctx) => {
      const settings = (ctx as any).settingsManager?.getSettings() ?? {};
      const config: Required<BackgroundNotifyConfig> = {
        ...DEFAULT_CONFIG,
        ...(settings.backgroundNotify ?? {}),
      };

      const sessionBeepOverride = getSessionBeepOverride();
      const sessionBringToFrontOverride = getSessionBringToFrontOverride();
      
      const beepEnabled = sessionBeepOverride !== null ? sessionBeepOverride : config.beep;
      const focusEnabled = sessionBringToFrontOverride !== null ? sessionBringToFrontOverride : config.bringToFront;

      ctx.ui.notify("🧪 Testing notification in 3 seconds...", "info");
      ctx.ui.notify("💡 Tip: Switch to another app to see it in action!", "info");

      await new Promise(resolve => setTimeout(resolve, 3000));

      const tasks: Promise<void>[] = [];
      const triggered: string[] = [];

      if (beepEnabled) {
        tasks.push(playBeep().catch(() => {}));
        triggered.push("beep");
      }

      if (focusEnabled) {
        tasks.push(bringTerminalToFront(getTerminalApp(), getTerminalPid(), getTerminalTTY()));
        triggered.push("bring-to-front");
      }

      await Promise.all(tasks);

      if (triggered.length > 0) {
        ctx.ui.notify(`✅ Test complete! Triggered: ${triggered.join(" + ")}`, "success");
      } else {
        ctx.ui.notify("⚠️ Test complete, but both beep and focus are disabled", "warning");
      }
    }
  });

  /**
   * /notify-config - Interactive configuration command
   */
  pi.registerCommand("notify-config", {
    description: "View and configure background notification settings",
    handler: async (args, ctx) => {
      const settings = (ctx as any).settingsManager?.getSettings() ?? {};
      const config: Required<BackgroundNotifyConfig> = {
        ...DEFAULT_CONFIG,
        ...(settings.backgroundNotify ?? {}),
      };

      const sessionOverride = getSessionOverride();
      const sessionBeepOverride = getSessionBeepOverride();
      const sessionBringToFrontOverride = getSessionBringToFrontOverride();
      
      const isEnabled = sessionOverride !== null ? sessionOverride : config.enabledByDefault;
      const beepEnabled = sessionBeepOverride !== null ? sessionBeepOverride : config.beep;
      const focusEnabled = sessionBringToFrontOverride !== null ? sessionBringToFrontOverride : config.bringToFront;

      // Display current settings
      ctx.ui.notify("─── Background Notify Settings ───", "info");
      ctx.ui.notify(`Session:  ${isEnabled ? "🔔 ON" : "🔕 OFF"}  │  Beep: ${beepEnabled ? "🔊 ON" : "🔇 OFF"}  │  Focus: ${focusEnabled ? "🪟 ON" : "⬜ OFF"}`, "info");
      ctx.ui.notify(`Global:   ${config.enabledByDefault ? "ON" : "OFF"}  │  Beep: ${config.beep ? "ON" : "OFF"}  │  Focus: ${config.bringToFront ? "ON" : "OFF"}  │  Threshold: ${config.thresholdMs}ms`, "info");
      ctx.ui.notify("──────────────────────────────────", "info");

      if (!ctx.hasUI) {
        return;
      }

      // Build available beep sounds based on platform
      const beepOptions: string[] = [];
      if (process.platform === "darwin") {
        beepOptions.push(
          "🔊 Test current beep",
          "🎵 Tink (default)",
          "🎵 Basso",
          "🎵 Blow", 
          "🎵 Bottle",
          "🎵 Frog",
          "🎵 Funk",
          "🎵 Glass",
          "🎵 Hero",
          "🎵 Morse",
          "🎵 Ping",
          "🎵 Pop",
          "🎵 Purr",
          "🎵 Sosumi",
          "🎵 Submarine",
          "🎵 Tink"
        );
      }

      const action = await ctx.ui.select(
        "Configure notifications",
        [
          ...beepOptions,
          "───────────────",
          "⚙️  Set global default: Disabled",
          "⚙️  Set global default: Beep only",
          "⚙️  Set global default: Focus only",
          "⚙️  Set global default: Both",
          "───────────────",
          "📋 View terminal info",
          "❌ Cancel"
        ]
      );

      if (!action || action === "❌ Cancel" || action === "───────────────") return;

      // Handle beep sound selection
      if (action === "🔊 Test current beep") {
        ctx.ui.notify("Playing beep...", "info");
        await playBeep().catch(() => {});
        return;
      }

      if (action.startsWith("🎵 ")) {
        const soundName = action.replace("🎵 ", "").replace(" (default)", "");
        ctx.ui.notify(`Playing ${soundName}...`, "info");
        await playSound(soundName).catch(() => {});
        ctx.ui.notify(`To use "${soundName}" as your beep, add to ~/.pi/agent/settings.json:`, "info");
        ctx.ui.notify(JSON.stringify({ backgroundNotify: { beepSound: soundName } }, null, 2), "info");
        return;
      }

      // Handle global default changes
      switch (action) {
        case "⚙️  Set global default: Disabled": {
          ctx.ui.notify("To disable by default, add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(JSON.stringify({ backgroundNotify: { enabledByDefault: false } }, null, 2), "info");
          break;
        }
        case "⚙️  Set global default: Beep only": {
          ctx.ui.notify("To enable beep only by default, add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(JSON.stringify({ backgroundNotify: { enabledByDefault: true, beep: true, bringToFront: false } }, null, 2), "info");
          break;
        }
        case "⚙️  Set global default: Focus only": {
          ctx.ui.notify("To enable focus only by default, add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(JSON.stringify({ backgroundNotify: { enabledByDefault: true, beep: false, bringToFront: true } }, null, 2), "info");
          break;
        }
        case "⚙️  Set global default: Both": {
          ctx.ui.notify("To enable both by default, add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(JSON.stringify({ backgroundNotify: { enabledByDefault: true, beep: true, bringToFront: true } }, null, 2), "info");
          break;
        }
        case "📋 View terminal info": {
          ctx.ui.notify("Terminal Detection:", "info");
          ctx.ui.notify(`  App: ${getTerminalApp() ?? "(not detected)"}`, "info");
          ctx.ui.notify(`  PID: ${getTerminalPid() ?? "(not detected)"}`, "info");
          ctx.ui.notify(`  TTY: ${getTerminalTTY() ?? "(not detected)"}`, "info");
          ctx.ui.notify(`  Platform: ${process.platform}`, "info");
          
          if (process.platform === "darwin") {
            ctx.ui.notify("\nSupported terminals: Terminal.app, iTerm2, WezTerm, kitty, Ghostty", "info");
          }
          
          const hasBeep = process.platform === "darwin" || process.platform === "linux";
          const hasFront = process.platform === "darwin";
          ctx.ui.notify(`\nCapabilities: Beep ${hasBeep ? "✓" : "✗"} | Focus ${hasFront ? "✓" : "✗ (macOS only)"}`, "info");
          break;
        }
      }
    }
  });
}

/**
 * Play a specific macOS system sound
 */
async function playSound(soundName: string): Promise<void> {
  if (process.platform === "darwin") {
    child_process.exec(`afplay /System/Library/Sounds/${soundName}.aiff`);
  }
}

