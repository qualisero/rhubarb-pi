/**
 * Shared types for notification utilities
 */

export interface BackgroundNotifyConfig {
  thresholdMs: number;
  beep: boolean;
  beepSound: string;
  bringToFront: boolean;
  say: boolean;
  sayMessage: string;
}

export interface NotificationCapabilities {
  isMacOS: boolean;
  hasSay: boolean;
}

export interface TerminalInfo {
  terminalApp?: string;
  terminalPid?: number;
  terminalTTY?: string;
}
