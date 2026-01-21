/**
 * Settings loader for background-notify configuration
 */

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { BackgroundNotifyConfig } from "./types";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const DEFAULT_CONFIG: BackgroundNotifyConfig = {
  thresholdMs: 2000,
  beep: true,
  beepSound: "Tink",
  bringToFront: true,
  say: false,
  sayMessage: "Task completed",
};

async function readSettingsFile(): Promise<any> {
  const settingsPath = path.join(os.homedir(), ".pi", "agent", "settings.json");
  try {
    const content = await fs.readFile(settingsPath, "utf8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Load background-notify configuration from settings
 *
 * Priority:
 * 1. ctx.settingsManager.getSettings().backgroundNotify (if available)
 * 2. ~/.pi/agent/settings.json backgroundNotify section
 * 3. DEFAULT_CONFIG
 */
export async function getBackgroundNotifyConfig(
  ctx: ExtensionContext,
  overrides?: Partial<BackgroundNotifyConfig>
): Promise<BackgroundNotifyConfig> {
  // Try to get settings from settingsManager first
  const settings = (ctx as any).settingsManager?.getSettings() ?? {};

  let config: BackgroundNotifyConfig;

  // If settingsManager has it, use it
  if (settings.backgroundNotify) {
    config = { ...DEFAULT_CONFIG, ...settings.backgroundNotify };
  } else {
    // Otherwise, read directly from the settings file
    const fileSettings = await readSettingsFile();
    config = { ...DEFAULT_CONFIG, ...fileSettings.backgroundNotify };
  }

  // Apply any runtime overrides
  if (overrides) {
    config = { ...config, ...overrides };
  }

  return config;
}
