/**
 * E2E Test Harness for rhubarb-pi extensions
 *
 * Two-tier testing approach:
 * 1. Print mode tests (-p): Quick smoke tests for extension loading
 * 2. Tmux tests: Real interactive UI testing
 *
 * Inspired by https://github.com/jyaunches/pi-canvas
 */

import { execSync, spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PI_TIMEOUT = 30_000; // 30 seconds for LLM responses
const TMUX_POLL_INTERVAL = 200; // ms between tmux output checks
const TMUX_STABILIZE_DELAY = 500; // ms to wait for output to stabilize
const STARTUP_DELAY = 2000; // ms to wait for pi to start

// Extension paths (relative to repo root)
const EXTENSIONS = {
  "safe-git": "./extensions/safe-git/index.ts",
  "session-emoji": "./hooks/session-emoji/index.ts",
  "session-color": "./hooks/session-color/index.ts",
  "background-notify": "./hooks/background-notify/index.ts",
} as const;

type ExtensionName = keyof typeof EXTENSIONS;

// Track active tmux sessions for cleanup
const activeSessions = new Set<string>();

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function exec(command: string): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execSync(command, {
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, stderr: "", code: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout?.toString() || "",
      stderr: err.stderr?.toString() || "",
      code: err.status || 1,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prerequisites Check
// ─────────────────────────────────────────────────────────────────────────────

export function checkPrerequisites(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];

  // Check pi CLI
  if (exec("which pi").code !== 0) {
    missing.push("pi CLI (npm install -g @mariozechner/pi-coding-agent)");
  }

  // Check tmux
  if (exec("which tmux").code !== 0) {
    missing.push("tmux (brew install tmux)");
  }

  return { ok: missing.length === 0, missing };
}

// ─────────────────────────────────────────────────────────────────────────────
// Print Mode Testing (pi -p)
// ─────────────────────────────────────────────────────────────────────────────

export interface PrintModeResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run pi in print mode (-p) with an extension and capture output.
 * Print mode is non-interactive and outputs directly to stdout.
 */
export async function runPrintMode(
  extension: ExtensionName,
  prompt: string,
  options: { timeout?: number } = {}
): Promise<PrintModeResult> {
  const timeout = options.timeout ?? PI_TIMEOUT;
  const extensionPath = EXTENSIONS[extension];

  return new Promise((resolve) => {
    const proc = spawn("pi", ["-p", "-e", extensionPath, "--no-session", prompt], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => (stdout += data.toString()));
    proc.stderr?.on("data", (data) => (stderr += data.toString()));

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ stdout, stderr: stderr + "\nTimeout", exitCode: 124 });
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}

/**
 * Quick check that an extension loads without errors
 */
export async function extensionLoads(extension: ExtensionName): Promise<boolean> {
  const result = await runPrintMode(extension, "Say 'ok' and nothing else.", { timeout: 15_000 });
  return result.exitCode === 0 && !result.stderr.includes("Error loading extension");
}

// ─────────────────────────────────────────────────────────────────────────────
// Tmux Session for Interactive Testing
// ─────────────────────────────────────────────────────────────────────────────

export class TmuxSession {
  readonly name: string;
  private killed = false;

  constructor(prefix = "rhubarb-test") {
    this.name = `${prefix}-${randomUUID().slice(0, 8)}`;
  }

  /**
   * Start a new tmux session running pi with an extension
   */
  async start(extension: ExtensionName, options: { width?: number; height?: number } = {}): Promise<void> {
    const width = options.width ?? 120;
    const height = options.height ?? 40;
    const extensionPath = EXTENSIONS[extension];

    // Create detached session
    const result = exec(`tmux new-session -d -s "${this.name}" -x ${width} -y ${height}`);
    if (result.code !== 0) {
      throw new Error(`Failed to create tmux session: ${result.stderr}`);
    }
    activeSessions.add(this.name);

    // Start pi with the extension
    const cmd = `pi -e ${extensionPath} --no-session`;
    exec(`tmux send-keys -t "${this.name}" '${cmd}' Enter`);

    // Wait for pi to start
    await sleep(STARTUP_DELAY);
  }

  /**
   * Start with a custom command (for testing multiple extensions)
   */
  async startCustom(command: string, options: { width?: number; height?: number } = {}): Promise<void> {
    const width = options.width ?? 120;
    const height = options.height ?? 40;

    const result = exec(`tmux new-session -d -s "${this.name}" -x ${width} -y ${height}`);
    if (result.code !== 0) {
      throw new Error(`Failed to create tmux session: ${result.stderr}`);
    }
    activeSessions.add(this.name);

    exec(`tmux send-keys -t "${this.name}" '${command.replace(/'/g, "'\\''")}' Enter`);
    await sleep(STARTUP_DELAY);
  }

  /**
   * Capture current pane output
   */
  capture(): string {
    const result = exec(`tmux capture-pane -t "${this.name}" -p`);
    return result.stdout;
  }

  /**
   * Send text to the session
   */
  sendKeys(keys: string): void {
    // Escape single quotes for shell
    const escaped = keys.replace(/'/g, "'\"'\"'");
    exec(`tmux send-keys -t "${this.name}" '${escaped}'`);
  }

  /**
   * Send a special key
   */
  sendSpecialKey(key: "Enter" | "Escape" | "Up" | "Down" | "Left" | "Right" | "Tab" | "BSpace"): void {
    exec(`tmux send-keys -t "${this.name}" ${key}`);
  }

  /**
   * Send Ctrl+key combination
   */
  sendCtrl(key: string): void {
    exec(`tmux send-keys -t "${this.name}" C-${key}`);
  }

  /**
   * Type a slash command and press Enter
   */
  async command(cmd: string): Promise<void> {
    this.sendKeys(`/${cmd}`);
    this.sendSpecialKey("Enter");
    await sleep(300);
  }

  /**
   * Type a prompt and press Enter
   */
  async prompt(text: string): Promise<void> {
    this.sendKeys(text);
    this.sendSpecialKey("Enter");
  }

  /**
   * Wait for output to contain a specific string
   */
  async waitFor(text: string, timeout = PI_TIMEOUT): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const output = this.capture();
      if (output.includes(text)) {
        return output;
      }
      await sleep(TMUX_POLL_INTERVAL);
    }
    throw new Error(`Timeout waiting for "${text}" in tmux output`);
  }

  /**
   * Wait for output to match a regex
   */
  async waitForMatch(pattern: RegExp, timeout = PI_TIMEOUT): Promise<string> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const output = this.capture();
      if (pattern.test(output)) {
        return output;
      }
      await sleep(TMUX_POLL_INTERVAL);
    }
    throw new Error(`Timeout waiting for pattern ${pattern} in tmux output`);
  }

  /**
   * Wait for output to stabilize (no changes)
   */
  async waitForStable(timeout = PI_TIMEOUT): Promise<string> {
    const start = Date.now();
    let lastOutput = "";

    while (Date.now() - start < timeout) {
      await sleep(TMUX_POLL_INTERVAL);
      const output = this.capture();

      if (output === lastOutput && output.length > 0) {
        await sleep(TMUX_STABILIZE_DELAY);
        const finalOutput = this.capture();
        if (finalOutput === output) {
          return output;
        }
      }
      lastOutput = output;
    }

    return lastOutput;
  }

  /**
   * Kill the session
   */
  kill(): void {
    if (this.killed) return;
    this.killed = true;
    exec(`tmux kill-session -t "${this.name}" 2>/dev/null`);
    activeSessions.delete(this.name);
  }
}

/**
 * Cleanup all active tmux sessions (call in afterAll)
 */
export function cleanupAllSessions(): void {
  for (const session of activeSessions) {
    exec(`tmux kill-session -t "${session}" 2>/dev/null`);
  }
  activeSessions.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// Session State File Utilities
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_COLOR_STATE = path.join(os.homedir(), ".pi", "session-color-state.json");

export function getSessionColorState(): { lastColorIndex: number; sessionId: string } | null {
  try {
    return JSON.parse(fs.readFileSync(SESSION_COLOR_STATE, "utf8"));
  } catch {
    return null;
  }
}

export function setSessionColorState(state: { lastColorIndex: number; sessionId: string }): void {
  fs.mkdirSync(path.dirname(SESSION_COLOR_STATE), { recursive: true });
  fs.writeFileSync(SESSION_COLOR_STATE, JSON.stringify({ ...state, timestamp: Date.now() }));
}

export function clearSessionColorState(): void {
  try {
    fs.unlinkSync(SESSION_COLOR_STATE);
  } catch {
    // Ignore
  }
}
