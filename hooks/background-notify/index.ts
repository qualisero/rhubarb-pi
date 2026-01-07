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
 * 
 * - `beep`: Play sound when task completes (default: true)
 * - `bringToFront`: Bring terminal to front (default: true)
 * - Per-session control: Use /notify (toggle both), /notify-beep, /notify-focus
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as child_process from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const execAsync = promisify(child_process.exec);

interface BackgroundNotifyConfig {
  thresholdMs?: number;
  beep?: boolean;
  beepSound?: string;
  bringToFront?: boolean;
}

const DEFAULT_CONFIG: Required<BackgroundNotifyConfig> = {
  thresholdMs: 2000,
  beep: true,
  beepSound: "Tink",
  bringToFront: true,
};

export default function (pi: ExtensionAPI) {
  let lastToolTime: number | undefined;
  let totalActiveTime: number = 0;
  let terminalPid: number | undefined;
  let terminalApp: string | undefined;
  let terminalTTY: string | undefined;
  let sessionBeepOverride: boolean | null = null;
  let sessionBeepSoundOverride: string | null = null;
  let sessionBringToFrontOverride: boolean | null = null;
  let originalTabTitle: string | undefined;

  // Register slash commands
  registerCommands(
    pi,
    () => terminalApp,
    () => terminalPid,
    () => terminalTTY,
    () => sessionBeepOverride,
    (value) => {
      sessionBeepOverride = value;
    },
    () => sessionBeepSoundOverride,
    (value) => {
      sessionBeepSoundOverride = value;
    },
    () => sessionBringToFrontOverride,
    (value) => {
      sessionBringToFrontOverride = value;
    }
  );

  // Detect terminal at startup
  pi.on("session_start", async (_, ctx) => {
    // Reset session overrides to null so they inherit from global settings
    sessionBeepOverride = null;
    sessionBeepSoundOverride = null;
    sessionBringToFrontOverride = null;
    
    // Reset timing variables
    lastToolTime = undefined;
    totalActiveTime = 0;
    
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
    lastToolTime = Date.now();
    totalActiveTime = 0;
  });

  // Track actual tool execution time (excludes waiting for user input)
  pi.on("tool_result", async (event, ctx) => {
    if (lastToolTime) {
      const elapsed = Date.now() - lastToolTime;
      // Add to total active time
      totalActiveTime += elapsed;
    }
    lastToolTime = Date.now();
    return undefined;
  });

  pi.on("agent_end", async (_, ctx) => {
    if (!lastToolTime) return;

    // Add final segment from last tool to agent_end
    const elapsed = Date.now() - lastToolTime;
    totalActiveTime += elapsed;
    
    const activeDuration = totalActiveTime;
    
    lastToolTime = undefined;
    totalActiveTime = 0;

    const settings = (ctx as any).settingsManager?.getSettings() ?? {};
    const config: Required<BackgroundNotifyConfig> = {
      ...DEFAULT_CONFIG,
      ...(settings.backgroundNotify ?? {}),
    };

    // Use session overrides if set, otherwise use config
    const shouldBeep = sessionBeepOverride !== null ? sessionBeepOverride : config.beep;
    const beepSound = sessionBeepSoundOverride !== null ? sessionBeepSoundOverride : config.beepSound;
    const shouldBringToFront = sessionBringToFrontOverride !== null ? sessionBringToFrontOverride : config.bringToFront;

    // Only notify if at least one notification type is enabled
    if (!shouldBeep && !shouldBringToFront) return;
    
    // Use active duration (tool execution time) for threshold check
    if (activeDuration < config.thresholdMs) return;

    const isBackground = await isTerminalInBackground(terminalApp, terminalPid);
    if (!isBackground) return;

    const activeDurationSec = (activeDuration / 1000).toFixed(1);

    const tasks: Promise<void>[] = [];
    
    if (shouldBeep) {
      tasks.push(playBeep(beepSound).catch(() => {}));
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
      
      ctx.ui.notify(`Task completed in ${activeDurationSec}s${actionText}`, "info");
    }
  });
}

/**
 * Play an audible beep (non-blocking)
 */
async function playBeep(soundName: string = "Tink"): Promise<void> {
  if (process.platform === "darwin") {
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
  set targetTTY to "${terminalTTY}"
  repeat with w in windows
    set tabIdx to 0
    repeat with t in tabs of w
      set tabIdx to tabIdx + 1
      repeat with s in sessions of t
        if tty of s is targetTTY then
          tell w
            select tab tabIdx
            set index to 1
          end tell
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
  pi: ExtensionAPI,
  getTerminalApp: () => string | undefined,
  getTerminalPid: () => number | undefined,
  getTerminalTTY: () => string | undefined,
  getSessionBeepOverride: () => boolean | null,
  setSessionBeepOverride: (value: boolean | null) => void,
  getSessionBeepSoundOverride: () => string | null,
  setSessionBeepSoundOverride: (value: string | null) => void,
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

      const sessionBeepOverride = getSessionBeepOverride();
      const sessionBringToFrontOverride = getSessionBringToFrontOverride();
      
      const currentBeep = sessionBeepOverride !== null ? sessionBeepOverride : config.beep;
      const currentFocus = sessionBringToFrontOverride !== null ? sessionBringToFrontOverride : config.bringToFront;
      
      // If either is on, turn both off. If both are off, turn both on.
      const newState = !(currentBeep || currentFocus);
      
      setSessionBeepOverride(newState);
      setSessionBringToFrontOverride(newState);
      
      if (newState) {
        ctx.ui.notify("🔔 Background notifications ON (beep + focus)", "info");
        const sound = getSessionBeepSoundOverride() ?? config.beepSound;
        await playBeep(sound).catch(() => {});
      } else {
        ctx.ui.notify("🔕 Background notifications OFF", "warning");
      }
    }
  });

  /**
   * /notify-status - Show current notification settings
   */
  pi.registerCommand("notify-status", {
    description: "Show current notification settings (global + session overrides)",
    handler: async (args, ctx) => {
      const settings = (ctx as any).settingsManager?.getSettings() ?? {};
      const config: Required<BackgroundNotifyConfig> = {
        ...DEFAULT_CONFIG,
        ...(settings.backgroundNotify ?? {}),
      };

      const sessionBeepOverride = getSessionBeepOverride();
      const sessionBringToFrontOverride = getSessionBringToFrontOverride();
      const sessionBeepSound = getSessionBeepSoundOverride();
      
      // Calculate effective (current) settings
      const effectiveBeep = sessionBeepOverride !== null ? sessionBeepOverride : config.beep;
      const effectiveFocus = sessionBringToFrontOverride !== null ? sessionBringToFrontOverride : config.bringToFront;
      const effectiveSound = sessionBeepSound !== null ? sessionBeepSound : config.beepSound;
      
      const statusMessage = [
        "━━━ Background Notify Status ━━━",
        "",
        "CURRENT SESSION (effective):",
        `  Beep:     ${effectiveBeep ? "🔊 ON" : "🔇 OFF"}`,
        `  Focus:    ${effectiveFocus ? "🪟 ON" : "⬜ OFF"}`,
        `  Sound:    ${effectiveSound}`,
        "",
        "GLOBAL DEFAULTS (settings.json):",
        `  Beep:      ${config.beep ? "ON" : "OFF"}`,
        `  Focus:     ${config.bringToFront ? "ON" : "OFF"}`,
        `  Sound:     ${config.beepSound}`,
        `  Threshold: ${config.thresholdMs}ms`,
        "",
        "SESSION OVERRIDES:",
        `  Beep:     ${sessionBeepOverride !== null ? (sessionBeepOverride ? "ON" : "OFF") : "(inheriting from global)"}`,
        `  Focus:    ${sessionBringToFrontOverride !== null ? (sessionBringToFrontOverride ? "ON" : "OFF") : "(inheriting from global)"}`,
        `  Sound:    ${sessionBeepSound !== null ? sessionBeepSound : "(inheriting from global)"}`,
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      ].join("\n");
      
      ctx.ui.notify(statusMessage, "info");
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
      
      if (newState) {
        ctx.ui.notify("🔊 Beep ON", "info");
        const sound = getSessionBeepSoundOverride() ?? config.beepSound;
        await playBeep(sound).catch(() => {});
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
      
      if (newState) {
        ctx.ui.notify("🪟 Focus ON (bring terminal to front)", "info");
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
      const beepSound = getSessionBeepSoundOverride() ?? config.beepSound;

      ctx.ui.notify("🧪 Testing notification in 3 seconds...", "info");
      ctx.ui.notify("💡 Tip: Switch to another app to see it in action!", "info");

      await new Promise(resolve => setTimeout(resolve, 3000));

      const tasks: Promise<void>[] = [];
      const triggered: string[] = [];

      if (beepEnabled) {
        tasks.push(playBeep(beepSound).catch(() => {}));
        triggered.push("beep");
      }

      if (focusEnabled) {
        tasks.push(bringTerminalToFront(getTerminalApp(), getTerminalPid(), getTerminalTTY()));
        triggered.push("bring-to-front");
      }

      await Promise.all(tasks);

      if (triggered.length > 0) {
        ctx.ui.notify(`✅ Test complete! Triggered: ${triggered.join(" + ")}`, "info");
      } else {
        ctx.ui.notify("⚠️ Test complete, but both beep and focus are disabled", "warning");
      }
    }
  });

  /**
   * /notify-config - Interactive configuration command
   */
  pi.registerCommand("notify-config", {
    description: "Configure session notification settings",
    handler: async (args, ctx) => {
      const settings = (ctx as any).settingsManager?.getSettings() ?? {};
      const config: Required<BackgroundNotifyConfig> = {
        ...DEFAULT_CONFIG,
        ...(settings.backgroundNotify ?? {}),
      };

      const sessionBeepOverride = getSessionBeepOverride();
      const sessionBringToFrontOverride = getSessionBringToFrontOverride();
      const sessionBeepSound = getSessionBeepSoundOverride();
      
      const beepEnabled = sessionBeepOverride !== null ? sessionBeepOverride : config.beep;
      const focusEnabled = sessionBringToFrontOverride !== null ? sessionBringToFrontOverride : config.bringToFront;
      const currentSound = sessionBeepSound !== null ? sessionBeepSound : config.beepSound;

      // Display current settings
      const statusLines = [
        "━━━ Session Notify Configuration ━━━",
        "",
        "CURRENT (effective):",
        `  Beep: ${beepEnabled ? "🔊 ON" : "🔇 OFF"}  │  Focus: ${focusEnabled ? "🪟 ON" : "⬜ OFF"}  │  Sound: ${currentSound}`,
        "",
        "SESSION overrides:",
        `  Beep: ${sessionBeepOverride !== null ? (sessionBeepOverride ? "ON" : "OFF") : "default"}  │  Focus: ${sessionBringToFrontOverride !== null ? (sessionBringToFrontOverride ? "ON" : "OFF") : "default"}  │  Sound: ${sessionBeepSound ?? "default"}`,
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      ].join("\n");
      
      ctx.ui.notify(statusLines, "info");

      if (!ctx.hasUI) {
        return;
      }

      // Build available beep sounds based on platform
      const beepSounds = [
        "Tink", "Basso", "Blow", "Bottle", "Frog", "Funk", 
        "Glass", "Hero", "Morse", "Ping", "Pop", "Purr", 
        "Sosumi", "Submarine"
      ];
      
      const beepOptions: string[] = [];
      if (process.platform === "darwin") {
        beepOptions.push("🔊 Test current beep");
        for (const sound of beepSounds) {
          const isDefault = sound === "Tink";
          const isCurrent = sound === currentSound;
          let label = `🎵 ${sound}`;
          if (isDefault) label += " (default)";
          if (isCurrent) label += " ✓";
          beepOptions.push(label);
        }
      }

      const action = await ctx.ui.select(
        "Configure session notifications",
        [
          ...beepOptions,
          "───────────────",
          "💾 Save session as global default",
          "🔄 Reset to global defaults",
          "📋 View terminal info",
          "❌ Cancel"
        ]
      );

      if (!action || action === "❌ Cancel" || action === "───────────────") return;

      // Handle beep sound selection
      if (action === "🔊 Test current beep") {
        ctx.ui.notify(`Playing ${currentSound}...`, "info");
        await playBeep(currentSound).catch(() => {});
        return;
      }

      if (action.startsWith("🎵 ")) {
        const soundName = action.replace("🎵 ", "").replace(" (default)", "").replace(" ✓", "");
        ctx.ui.notify(`Playing ${soundName}...`, "info");
        await playSound(soundName).catch(() => {});
        setSessionBeepSoundOverride(soundName);
        
        ctx.ui.notify(`Sound set to "${soundName}" for this session`, "info");
        return;
      }

      // Handle save session as global default
      if (action === "💾 Save session as global default") {
        // Build the config from current effective settings
        const newGlobalConfig: any = {
          beep: beepEnabled,
          bringToFront: focusEnabled,
          beepSound: currentSound,
          thresholdMs: config.thresholdMs
        };
        
        ctx.ui.notify("To save current session settings as global default, add to ~/.pi/agent/settings.json:", "info");
        ctx.ui.notify(JSON.stringify({ backgroundNotify: newGlobalConfig }, null, 2), "info");
        ctx.ui.notify("", "info");
        ctx.ui.notify("💡 Tip: After updating settings.json, restart pi for changes to take effect", "info");
        return;
      }

      // Handle reset
      if (action === "🔄 Reset to global defaults") {
        setSessionBeepOverride(null);
        setSessionBringToFrontOverride(null);
        setSessionBeepSoundOverride(null);
        
        ctx.ui.notify("✅ Session overrides cleared, using global defaults", "info");
        return;
      }

      if (action === "📋 View terminal info") {
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
      }
    }
  });

  /**
   * /notify-config-global - Configure global notification defaults
   */
  pi.registerCommand("notify-config-global", {
    description: "Configure global notification defaults",
    handler: async (args, ctx) => {
      const settings = (ctx as any).settingsManager?.getSettings() ?? {};
      const config: Required<BackgroundNotifyConfig> = {
        ...DEFAULT_CONFIG,
        ...(settings.backgroundNotify ?? {}),
      };

      // Display current global settings
      const statusLines = [
        "━━━ Global Notify Configuration ━━━",
        "",
        "CURRENT GLOBAL DEFAULTS:",
        `  Beep: ${config.beep ? "ON" : "OFF"}  │  Focus: ${config.bringToFront ? "ON" : "OFF"}  │  Sound: ${config.beepSound}  │  Threshold: ${config.thresholdMs}ms`,
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      ].join("\n");
      
      ctx.ui.notify(statusLines, "info");

      if (!ctx.hasUI) {
        return;
      }

      // Build available beep sounds
      const beepSounds = [
        "Tink", "Basso", "Blow", "Bottle", "Frog", "Funk", 
        "Glass", "Hero", "Morse", "Ping", "Pop", "Purr", 
        "Sosumi", "Submarine"
      ];
      
      const soundOptions: string[] = [];
      if (process.platform === "darwin") {
        for (const sound of beepSounds) {
          const isDefault = sound === "Tink";
          const isCurrent = sound === config.beepSound;
          let label = `🎵 ${sound}`;
          if (isDefault) label += " (default)";
          if (isCurrent) label += " ✓";
          soundOptions.push(label);
        }
      }

      const action = await ctx.ui.select(
        "Configure global defaults",
        [
          "⚙️  Set: Beep only",
          "⚙️  Set: Focus only",
          "⚙️  Set: Both",
          "⚙️  Set: None",
          "───────────────",
          ...(soundOptions.length > 0 ? ["🔊 Change global beep sound:", ...soundOptions, "───────────────"] : []),
          "❌ Cancel"
        ]
      );

      if (!action || action === "❌ Cancel" || action === "───────────────" || action === "🔊 Change global beep sound:") return;

      // Handle sound selection
      if (action.startsWith("🎵 ")) {
        const soundName = action.replace("🎵 ", "").replace(" (default)", "").replace(" ✓", "");
        ctx.ui.notify(`Playing ${soundName}...`, "info");
        await playSound(soundName).catch(() => {});
        ctx.ui.notify("To set this as global default, add to ~/.pi/agent/settings.json:", "info");
        ctx.ui.notify(JSON.stringify({ backgroundNotify: { ...config, beepSound: soundName } }, null, 2), "info");
        return;
      }

      // Handle global default changes
      switch (action) {
        case "⚙️  Set: None": {
          ctx.ui.notify("To disable both by default, add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(JSON.stringify({ backgroundNotify: { beep: false, bringToFront: false } }, null, 2), "info");
          break;
        }
        case "⚙️  Set: Beep only": {
          ctx.ui.notify("To enable beep only by default, add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(JSON.stringify({ backgroundNotify: { beep: true, bringToFront: false } }, null, 2), "info");
          break;
        }
        case "⚙️  Set: Focus only": {
          ctx.ui.notify("To enable focus only by default, add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(JSON.stringify({ backgroundNotify: { beep: false, bringToFront: true } }, null, 2), "info");
          break;
        }
        case "⚙️  Set: Both": {
          ctx.ui.notify("To enable both by default, add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(JSON.stringify({ backgroundNotify: { beep: true, bringToFront: true } }, null, 2), "info");
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

