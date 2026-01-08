/**
 * Session Color Extension
 *
 * Displays a colored band in the pi footer to visually distinguish sessions.
 * Colors are picked sequentially from a curated palette designed to maximize
 * visual distinction between consecutive sessions.
 *
 * Configuration (in ~/.pi/agent/settings.json):
 * {
 *   "sessionColor": {
 *     "enabledByDefault": true,
 *     "blockChar": "▁",
 *     "blockCount": "full"
 *   }
 * }
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ─────────────────────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────────────────────

interface SessionColorConfig {
  enabledByDefault: boolean;
  blockChar: string;
  blockCount: number | "full";
}

interface ColorState {
  lastColorIndex: number;
  sessionId: string;
  timestamp: number;
}

interface SessionState {
  colorIndex: number | null;
  assigned: boolean;
  enabledOverride: boolean | null;
  blockCharOverride: string | null;
  blockCharIndex: number;
}

const DEFAULT_CONFIG: SessionColorConfig = {
  enabledByDefault: true,
  blockChar: "▁",
  blockCount: "full",
};

const STATE_FILE = path.join(os.homedir(), ".pi", "session-color-state.json");

/**
 * 40 colors selected to maximize visual distinction.
 * Each color is chosen to be very distinct from the previous 5 colors.
 * Uses ANSI 256-color codes for broad terminal compatibility.
 */
const COLOR_PALETTE: number[] = [
  196, 51, 226, 129, 46, 208, 27, 213, 118, 160,
  87, 220, 93, 34, 202, 75, 199, 154, 124, 45,
  214, 135, 40, 166, 69, 205, 190, 88, 80, 228,
  97, 28, 172, 63, 197, 82, 130, 39, 219, 106,
];

const BLOCK_CHARS = [
  { char: "▁", name: "Lower 1/8 block" },
  { char: "▂", name: "Lower 1/4 block" },
  { char: "▄", name: "Lower half block" },
  { char: "█", name: "Full block" },
  { char: "▔", name: "Upper 1/8 block" },
  { char: "▀", name: "Upper half block" },
  { char: "─", name: "Light horizontal" },
  { char: "━", name: "Heavy horizontal" },
  { char: "═", name: "Double horizontal" },
];

const RESET = "\x1b[0m";

// ─────────────────────────────────────────────────────────────────────────────
// Main Extension
// ─────────────────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  const state: SessionState = {
    colorIndex: null,
    assigned: false,
    enabledOverride: null,
    blockCharOverride: null,
    blockCharIndex: 0,
  };

  let currentCtx: ExtensionContext | null = null;
  let resizeHandler: (() => void) | null = null;

  function setupResizeListener(ctx: ExtensionContext, config: SessionColorConfig) {
    if (resizeHandler) process.stdout.off("resize", resizeHandler);

    if (config.blockCount === "full" && state.colorIndex !== null) {
      currentCtx = ctx;
      resizeHandler = () => {
        if (currentCtx && state.colorIndex !== null) {
          const isEnabled = state.enabledOverride ?? config.enabledByDefault;
          if (isEnabled) updateStatus(currentCtx, config, state);
        }
      };
      process.stdout.on("resize", resizeHandler);
    }
  }

  registerCommands(pi, state);

  pi.on("session_start", async (_, ctx) => {
    currentCtx = ctx;
    initSession(ctx, state, setupResizeListener);
  });

  pi.on("session_switch", async (event, ctx) => {
    if (event.reason === "new") {
      currentCtx = ctx;
      initSession(ctx, state, setupResizeListener);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

function initSession(
  ctx: ExtensionContext,
  state: SessionState,
  setupResize: (ctx: ExtensionContext, config: SessionColorConfig) => void
) {
  // Reset state
  Object.assign(state, {
    colorIndex: null,
    assigned: false,
    enabledOverride: null,
    blockCharOverride: null,
    blockCharIndex: 0,
  });

  const config = getConfig(ctx);
  if (!config.enabledByDefault) {
    ctx.ui.setStatus("0-color-band", "");
    return;
  }

  const sessionId = ctx.sessionManager.getSessionId();
  const persisted = readColorState();

  // Check if this session already has a color
  if (persisted?.sessionId === sessionId) {
    state.colorIndex = persisted.lastColorIndex;
    state.assigned = true;
    updateStatus(ctx, config, state);
    setupResize(ctx, config);
    return;
  }

  // Assign next color in sequence
  const lastIndex = persisted?.lastColorIndex ?? -1;
  const nextIndex = (lastIndex + 1) % COLOR_PALETTE.length;

  state.colorIndex = nextIndex;
  state.assigned = true;

  writeColorState({ lastColorIndex: nextIndex, sessionId, timestamp: Date.now() });
  updateStatus(ctx, config, state);
  setupResize(ctx, config);
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Display
// ─────────────────────────────────────────────────────────────────────────────

function updateStatus(ctx: ExtensionContext, config: SessionColorConfig, state: SessionState) {
  if (state.colorIndex === null) return;

  const color = COLOR_PALETTE[state.colorIndex];
  const count = config.blockCount === "full" ? (process.stdout.columns || 80) : config.blockCount;
  const char = state.blockCharOverride ?? config.blockChar;
  const block = char.repeat(count);
  ctx.ui.setStatus("0-color-band", `\x1b[38;5;${color}m${block}${RESET}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

function readColorState(): ColorState | null {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as ColorState;
    }
  } catch {
    // Ignore
  }
  return null;
}

function writeColorState(state: ColorState): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getConfig(ctx: ExtensionContext): SessionColorConfig {
  const settings = (ctx as any).settingsManager?.getSettings() ?? {};
  return { ...DEFAULT_CONFIG, ...(settings.sessionColor ?? {}) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

function registerCommands(pi: ExtensionAPI, state: SessionState) {
  pi.registerCommand("color", {
    description: "Toggle color band on/off",
    handler: async (_, ctx) => {
      const config = getConfig(ctx);
      const current = state.enabledOverride ?? config.enabledByDefault;
      state.enabledOverride = !current;

      if (state.enabledOverride) {
        ctx.ui.notify("🎨 Color band ON", "info");
        if (state.colorIndex !== null) {
          updateStatus(ctx, config, state);
        } else {
          // Assign next color
          const persisted = readColorState();
          const nextIndex = ((persisted?.lastColorIndex ?? -1) + 1) % COLOR_PALETTE.length;
          state.colorIndex = nextIndex;
          state.assigned = true;
          writeColorState({ lastColorIndex: nextIndex, sessionId: ctx.sessionManager.getSessionId(), timestamp: Date.now() });
          updateStatus(ctx, config, state);
        }
      } else {
        ctx.ui.notify("⬜ Color band OFF", "warning");
        ctx.ui.setStatus("0-color-band", "");
      }
    },
  });

  pi.registerCommand("color-set", {
    description: "Set color by index (0-39)",
    handler: async (args, ctx) => {
      const config = getConfig(ctx);
      const input = args.trim();

      if (input) {
        const index = parseInt(input, 10);
        if (isNaN(index) || index < 0 || index >= COLOR_PALETTE.length) {
          ctx.ui.notify(`Invalid index. Use 0-${COLOR_PALETTE.length - 1}`, "error");
          return;
        }
        setColor(ctx, state, index);
        ctx.ui.notify(`Color set to index ${index}`, "info");
        return;
      }

      if (!ctx.hasUI) {
        ctx.ui.notify(`Usage: /color-set <0-${COLOR_PALETTE.length - 1}>`, "info");
        return;
      }

      // Show preview
      ctx.ui.notify("Color palette:", "info");
      for (let i = 0; i < COLOR_PALETTE.length; i += 10) {
        const blocks = COLOR_PALETTE.slice(i, i + 10)
          .map((c) => `\x1b[38;5;${c}m██${RESET}`)
          .join(" ");
        ctx.ui.notify(`${String(i).padStart(2)}-${Math.min(i + 9, 39)}: ${blocks}`, "info");
      }

      const indexStr = await ctx.ui.input(`Enter index (0-${COLOR_PALETTE.length - 1}):`);
      if (!indexStr) return;

      const index = parseInt(indexStr, 10);
      if (isNaN(index) || index < 0 || index >= COLOR_PALETTE.length) {
        ctx.ui.notify("Invalid index", "error");
        return;
      }

      setColor(ctx, state, index);
      ctx.ui.notify(`Color set to index ${index}`, "info");
    },
  });

  pi.registerCommand("color-next", {
    description: "Skip to next color",
    handler: async (_, ctx) => {
      const nextIndex = ((state.colorIndex ?? -1) + 1) % COLOR_PALETTE.length;
      setColor(ctx, state, nextIndex);
      ctx.ui.notify(`Skipped to color ${nextIndex}`, "info");
    },
  });

  pi.registerCommand("color-char", {
    description: "Change block character (cycles if no arg)",
    handler: async (args, ctx) => {
      const config = getConfig(ctx);
      const input = args.trim();

      if (state.colorIndex === null) {
        ctx.ui.notify("No color assigned yet", "error");
        return;
      }

      if (input) {
        state.blockCharOverride = input;
        updateStatus(ctx, config, state);
        ctx.ui.notify(`Block char set to "${input}"`, "info");
        return;
      }

      // Cycle through chars
      state.blockCharIndex = (state.blockCharIndex + 1) % BLOCK_CHARS.length;
      const next = BLOCK_CHARS[state.blockCharIndex];
      state.blockCharOverride = next.char;
      updateStatus(ctx, config, state);
      ctx.ui.notify(`${next.char} ${next.name}`, "info");
    },
  });

  pi.registerCommand("color-config", {
    description: "View color settings",
    handler: async (_, ctx) => {
      const config = getConfig(ctx);
      const isEnabled = state.enabledOverride ?? config.enabledByDefault;
      const persisted = readColorState();

      ctx.ui.notify("─── Session Color ───", "info");
      ctx.ui.notify(`Status: ${isEnabled ? "🎨 ON" : "⬜ OFF"}  │  Index: ${state.colorIndex ?? "(none)"}`, "info");
      ctx.ui.notify(`Char: "${state.blockCharOverride ?? config.blockChar}"  │  Palette: ${COLOR_PALETTE.length} colors`, "info");
      if (persisted) ctx.ui.notify(`Last used: index ${persisted.lastColorIndex}`, "info");

      if (!ctx.hasUI) return;

      const action = await ctx.ui.select("Options", [
        "🎨 Preview all colors",
        "🔄 Reset sequence",
        "❌ Cancel",
      ]);

      if (action?.startsWith("🎨")) {
        for (let i = 0; i < COLOR_PALETTE.length; i += 10) {
          const blocks = COLOR_PALETTE.slice(i, i + 10)
            .map((c) => `\x1b[38;5;${c}m██${RESET}`)
            .join(" ");
          ctx.ui.notify(blocks, "info");
        }
      } else if (action?.startsWith("🔄")) {
        writeColorState({ lastColorIndex: -1, sessionId: "", timestamp: Date.now() });
        ctx.ui.notify("Sequence reset. Next session starts at color 0.", "info");
      }
    },
  });
}

function setColor(ctx: ExtensionContext, state: SessionState, index: number) {
  const config = getConfig(ctx);
  state.colorIndex = index;
  state.assigned = true;
  writeColorState({ lastColorIndex: index, sessionId: ctx.sessionManager.getSessionId(), timestamp: Date.now() });
  updateStatus(ctx, config, state);
}
