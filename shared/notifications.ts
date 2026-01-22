/**
 * Notification utilities (beep, speak, bring-to-front)
 */

import type { TerminalInfo, BackgroundNotifyConfig } from "./types";
import * as child_process from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const execAsync = promisify(child_process.exec);

// ─────────────────────────────────────────────────────────────────────────────
// Pronunciation Replacements
// ─────────────────────────────────────────────────────────────────────────────

type PronunciationReplacements = Record<string, string>;

let pronunciationReplacements: PronunciationReplacements = {};
let pronunciationsLoaded = false;

/**
 * Parse a macOS plist file containing pronunciation replacements.
 * Expected format: <dict><key>word</key><string>pronunciation</string>...</dict>
 */
async function parsePronunciationsPlist(
  plistPath: string
): Promise<PronunciationReplacements> {
  try {
    const content = await fs.readFile(plistPath, "utf-8");
    const replacements: PronunciationReplacements = {};

    // Simple regex-based parser for the specific plist structure
    const keyRegex = /<key>([^<]+)<\/key>\s*<string>([^<]+)<\/string>/g;
    let match;

    while ((match = keyRegex.exec(content)) !== null) {
      const [, key, value] = match;
      replacements[key.trim()] = value.trim();
    }

    return replacements;
  } catch {
    return {};
  }
}

/**
 * Load pronunciation replacements from ~/Library/Speech/Pronunciations.plist
 * This is called once at startup on macOS.
 */
export async function loadPronunciations(): Promise<void> {
  if (!isMacOS() || pronunciationsLoaded) {
    return;
  }

  try {
    const homeDir = os.homedir();
    const plistPath = path.join(homeDir, "Library", "Speech", "Pronunciations.plist");
    pronunciationReplacements = await parsePronunciationsPlist(plistPath);
    pronunciationsLoaded = true;
  } catch {
    // Silently fail - pronunciations file may not exist
    pronunciationReplacements = {};
    pronunciationsLoaded = true;
  }
}

/**
 * Get the loaded pronunciation replacements (for testing/debugging)
 */
export function getPronunciationReplacements(): PronunciationReplacements {
  return { ...pronunciationReplacements };
}

/**
 * Apply pronunciation replacements to a message.
 * Replaces each occurrence of a key with its pronunciation value.
 */
export function applyPronunciations(message: string): string {
  let result = message;

  // Sort keys by length (descending) to match longer words first
  const sortedKeys = Object.keys(pronunciationReplacements).sort(
    (a, b) => b.length - a.length
  );

  for (const key of sortedKeys) {
    const replacement = pronunciationReplacements[key];
    // Use word boundaries to avoid replacing parts of other words
    const regex = new RegExp(`\\b${escapeRegex(key)}\\b`, "gi");
    result = result.replace(regex, replacement);
  }

  return result;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const BEEP_SOUNDS = [
  "Tink", "Basso", "Blow", "Bottle", "Frog", "Funk",
  "Glass", "Hero", "Morse", "Ping", "Pop", "Purr",
  "Sosumi", "Submarine",
];

export const SAY_MESSAGES = [
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
  "{session dir} needs your attention",
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

// ─────────────────────────────────────────────────────────────────────────────
// Platform Detection
// ─────────────────────────────────────────────────────────────────────────────

export function isMacOS(): boolean {
  return process.platform === "darwin";
}

let hasSayCommand = false;

export async function checkSayAvailable(): Promise<boolean> {
  if (!isMacOS()) {
    hasSayCommand = false;
    return false;
  }

  try {
    await execAsync("which say");
    hasSayCommand = true;
    return true;
  } catch {
    hasSayCommand = false;
    return false;
  }
}

export function isSayAvailable(): boolean {
  return hasSayCommand;
}

// ─────────────────────────────────────────────────────────────────────────────
// Terminal Detection
// ─────────────────────────────────────────────────────────────────────────────

export async function detectTerminalInfo(): Promise<TerminalInfo> {
  const info: TerminalInfo = {};

  if (!isMacOS()) {
    return info;
  }

  try {
    info.terminalPid = process.ppid;
    info.terminalApp = process.env.TERM_PROGRAM;

    // Try to get TTY
    info.terminalTTY = process.env.TTY;
    if (!info.terminalTTY) {
      try {
        const { stdout } = await execAsync(`ps -p ${process.ppid} -o tty=`);
        const tty = stdout.trim();
        if (tty && tty !== "??") {
          info.terminalTTY = tty.startsWith("/dev/") ? tty : "/dev/" + tty;
        }
      } catch {}
    }
    if (!info.terminalTTY && info.terminalPid) {
      try {
        const { stdout } = await execAsync(
          `lsof -p ${info.terminalPid} 2>/dev/null | grep -m1 "/dev/ttys" | awk '{print $9}'`
        );
        const tty = stdout.trim();
        if (tty?.startsWith("/dev/")) info.terminalTTY = tty;
      } catch {}
    }

    // Try to get app bundle ID
    if (!info.terminalApp) {
      try {
        const { stdout } = await execAsync(`lsappinfo info -only bundleID ${info.terminalPid}`);
        const match = stdout.match(/"CFBundleIdentifier"="([^"]+)"/);
        if (match) info.terminalApp = match[1];
      } catch {
        info.terminalApp = "com.apple.Terminal";
      }
    }
  } catch {}

  return info;
}

export async function isTerminalInBackground(info: TerminalInfo): Promise<boolean> {
  if (!isMacOS()) return false;

  try {
    const { stdout } = await execAsync(
      "lsappinfo front | awk '{print $1}' | xargs -I {} lsappinfo info -only bundleID {}"
    );
    const match = stdout.match(/"CFBundleIdentifier"="([^"]+)"/);
    if (!match) return false;

    const frontBundleId = match[1];
    if (info.terminalApp && !frontBundleId.includes(info.terminalApp)) {
      return true;
    }

    const knownTerminals = Object.keys(TERMINAL_BUNDLE_IDS).filter((k) => k.includes("."));
    return !knownTerminals.some((id) => frontBundleId.includes(id));
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getCurrentDirName(): string {
  try {
    return process.cwd().split("/").pop() || "unknown";
  } catch {
    return "unknown";
  }
}

export function replaceMessageTemplates(message: string): string {
  const dirName = getCurrentDirName();
  return message
    .replace(/{session dir}/g, dirName)
    .replace(/{dirname}/g, dirName);
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification Actions
// ─────────────────────────────────────────────────────────────────────────────

export async function playBeep(soundName: string = "Tink"): Promise<void> {
  if (isMacOS()) {
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

export function speakMessage(message: string): void {
  if (!isSayAvailable()) return;

  const finalMessage = replaceMessageTemplates(message);
  const messageWithPronunciations = applyPronunciations(finalMessage);
  const escapedMessage = messageWithPronunciations.replace(/"/g, '\\"');

  // Use spawn for non-blocking speech - doesn't wait for command to complete
  // This prevents TUI from being blocked while speaking
  child_process.spawn("say", ["-v", "Daniel", escapedMessage], {
    detached: true,
    stdio: "ignore",
  }).unref();
}

export async function bringTerminalToFront(info: TerminalInfo): Promise<void> {
  if (!isMacOS()) return;

  try {
    let appName = "Terminal";
    if (info.terminalApp) {
      for (const [key, value] of Object.entries(TERMINAL_BUNDLE_IDS)) {
        if (info.terminalApp.includes(key) || key.includes(info.terminalApp)) {
          appName = value;
          break;
        }
      }
    }

    let script: string;
    if (appName === "Terminal" && info.terminalTTY) {
      script = `tell application "Terminal"
  activate
  repeat with w in windows
    repeat with t in tabs of w
      if tty of t is "${info.terminalTTY}" then
        set index of w to 1
        set selected of t to true
        return
      end if
    end repeat
  end repeat
end tell`;
    } else if (appName === "iTerm2" && info.terminalTTY) {
      script = `tell application "iTerm2"
  repeat with w in windows
    set tabIdx to 0
    repeat with t in tabs of w
      set tabIdx to tabIdx + 1
      repeat with s in sessions of t
        if tty of s is "${info.terminalTTY}" then
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
// Combined Notification
// ─────────────────────────────────────────────────────────────────────────────

export interface NotifyOptions {
  beep?: boolean;
  beepSound?: string;
  bringToFront?: boolean;
  say?: boolean;
  sayMessage?: string;
}

export async function notifyOnConfirm(
  config: BackgroundNotifyConfig,
  terminalInfo: TerminalInfo,
  options?: NotifyOptions
): Promise<void> {
  const eff = {
    beep: options?.beep ?? config.beep,
    beepSound: options?.beepSound ?? config.beepSound,
    bringToFront: options?.bringToFront ?? config.bringToFront,
    say: isSayAvailable() ? (options?.say ?? config.say) : false,
    sayMessage: options?.sayMessage ?? config.sayMessage,
  };

  const tasks: Promise<void>[] = [];

  if (eff.beep) {
    tasks.push(playBeep(eff.beepSound));
  }
  if (eff.bringToFront) {
    tasks.push(bringTerminalToFront(terminalInfo));
  }
  if (eff.say) {
    // speakMessage is non-blocking, so don't add to tasks
    speakMessage(eff.sayMessage);
  }

  await Promise.all(tasks);
}
