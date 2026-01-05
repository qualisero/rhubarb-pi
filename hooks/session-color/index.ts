/**
 * Session Color Hook
 * 
 * Displays a colored band in the pi footer to visually distinguish sessions.
 * Colors are picked sequentially from a curated palette designed to maximize
 * visual distinction between consecutive sessions.
 * 
 * Configuration (in ~/.pi/agent/settings.json):
 * {
 *   "sessionColor": {
 *     "enabledByDefault": true,
 *     "blockChar": "█",
 *     "blockCount": "full"
 *   }
 * }
 * 
 * blockCount can be:
 * - "full" (default): fills the terminal width
 * - a number: fixed character count
 */

import type { HookAPI, HookContext } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

interface SessionColorConfig {
  enabledByDefault?: boolean;
  blockChar?: string;
  blockCount?: number | "full";
}

interface ColorState {
  lastColorIndex: number;
  sessionId: string;
  timestamp: number;
}

const DEFAULT_CONFIG: Required<SessionColorConfig> = {
  enabledByDefault: true,
  blockChar: "█",
  blockCount: "full",
};

const STATE_FILE = path.join(os.homedir(), ".pi", "session-color-state.json");

/**
 * 40 colors selected to maximize visual distinction.
 * 
 * Selection heuristic: each color is chosen to be very distinct from the
 * previous 5 colors and as distinct as possible from the previous 10.
 * This ensures that even when cycling through sessions quickly, colors
 * remain easily distinguishable.
 * 
 * Colors use ANSI 256-color codes for broad terminal compatibility.
 * The sequence alternates between warm/cool, light/dark, and saturated/muted
 * to maximize perceptual difference.
 */
const COLOR_PALETTE: number[] = [
  196,  // 1.  Bright red
  51,   // 2.  Cyan
  226,  // 3.  Yellow
  129,  // 4.  Purple
  46,   // 5.  Bright green
  208,  // 6.  Orange
  27,   // 7.  Blue
  213,  // 8.  Pink
  118,  // 9.  Lime green
  160,  // 10. Dark red
  87,   // 11. Turquoise
  220,  // 12. Gold
  93,   // 13. Violet
  34,   // 14. Forest green
  202,  // 15. Dark orange
  75,   // 16. Sky blue
  199,  // 17. Magenta
  154,  // 18. Yellow-green
  124,  // 19. Maroon
  45,   // 20. Light cyan
  214,  // 21. Light orange
  135,  // 22. Medium purple
  40,   // 23. Green
  166,  // 24. Rust
  69,   // 25. Cornflower blue
  205,  // 26. Hot pink
  190,  // 27. Chartreuse
  88,   // 28. Dark maroon
  80,   // 29. Medium turquoise
  228,  // 30. Light yellow
  97,   // 31. Medium orchid
  28,   // 32. Dark green
  172,  // 33. Tan orange
  63,   // 34. Slate blue
  197,  // 35. Deep pink
  82,   // 36. Bright lime
  130,  // 37. Dark goldenrod
  39,   // 38. Deep sky blue
  219,  // 39. Light pink
  106,  // 40. Olive green
];

/**
 * Generate ANSI escape code for 256-color foreground
 */
function colorCode(colorIndex: number): string {
  return `\x1b[38;5;${colorIndex}m`;
}

const RESET = "\x1b[0m";

/**
 * Read the persistent color state from file
 */
function readColorState(): ColorState | null {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, "utf8");
      return JSON.parse(data) as ColorState;
    }
  } catch {
    // Ignore read errors
  }
  return null;
}

/**
 * Write the color state to file
 */
function writeColorState(state: ColorState): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Ignore write errors
  }
}

export default function (pi: HookAPI) {
  let sessionColorIndex: number | null = null;
  let colorAssigned = false;
  let sessionEnabledOverride: boolean | null = null;
  let currentCtx: HookContext | null = null;
  let resizeHandler: (() => void) | null = null;

  registerCommands(
    pi,
    () => sessionColorIndex,
    (idx) => { sessionColorIndex = idx; },
    () => colorAssigned,
    (assigned) => { colorAssigned = assigned; },
    () => sessionEnabledOverride,
    (value) => { sessionEnabledOverride = value; }
  );

  /**
   * Set up resize listener to update color band width
   */
  function setupResizeListener(ctx: HookContext, config: Required<SessionColorConfig>) {
    if (resizeHandler) {
      process.stdout.off("resize", resizeHandler);
    }

    if (config.blockCount === "full" && sessionColorIndex !== null) {
      currentCtx = ctx;
      resizeHandler = () => {
        if (currentCtx && sessionColorIndex !== null) {
          const isEnabled = sessionEnabledOverride !== null 
            ? sessionEnabledOverride 
            : config.enabledByDefault;
          if (isEnabled) {
            updateStatus(currentCtx, config, sessionColorIndex);
          }
        }
      };
      process.stdout.on("resize", resizeHandler);
    }
  }

  /**
   * Session start - assign color
   */
  pi.on("session_start", async (_, ctx) => {
    sessionColorIndex = null;
    colorAssigned = false;
    sessionEnabledOverride = null;
    currentCtx = ctx;

    const config = getConfig(ctx);
    if (!config.enabledByDefault) {
      ctx.ui.setStatus("0-color-band", "");
      return;
    }

    const sessionId = ctx.sessionManager.getSessionId();
    const state = readColorState();

    // Check if this session already has a color assigned
    if (state && state.sessionId === sessionId) {
      sessionColorIndex = state.lastColorIndex;
      colorAssigned = true;
      updateStatus(ctx, config, sessionColorIndex);
      setupResizeListener(ctx, config);
      return;
    }

    // Assign next color in sequence
    const lastIndex = state?.lastColorIndex ?? -1;
    const nextIndex = (lastIndex + 1) % COLOR_PALETTE.length;

    sessionColorIndex = nextIndex;
    colorAssigned = true;

    writeColorState({
      lastColorIndex: nextIndex,
      sessionId,
      timestamp: Date.now(),
    });

    updateStatus(ctx, config, nextIndex);
    setupResizeListener(ctx, config);
  });

  /**
   * Session switch - handle new sessions
   */
  pi.on("session_switch", async (event, ctx) => {
    if (event.reason === "new") {
      sessionColorIndex = null;
      colorAssigned = false;
      sessionEnabledOverride = null;
      currentCtx = ctx;

      const config = getConfig(ctx);
      if (!config.enabledByDefault) {
        ctx.ui.setStatus("0-color-band", "");
        return;
      }

      const sessionId = ctx.sessionManager.getSessionId();
      const state = readColorState();

      // Assign next color in sequence
      const lastIndex = state?.lastColorIndex ?? -1;
      const nextIndex = (lastIndex + 1) % COLOR_PALETTE.length;

      sessionColorIndex = nextIndex;
      colorAssigned = true;

      writeColorState({
        lastColorIndex: nextIndex,
        sessionId,
        timestamp: Date.now(),
      });

      updateStatus(ctx, config, nextIndex);
      setupResizeListener(ctx, config);
    }
  });
}

function getConfig(ctx: HookContext): Required<SessionColorConfig> {
  const settings = (ctx as any).settingsManager?.getSettings() ?? {};
  return {
    ...DEFAULT_CONFIG,
    ...(settings.sessionColor ?? {}),
  };
}

function updateStatus(ctx: HookContext, config: Required<SessionColorConfig>, colorIndex: number) {
  const color = COLOR_PALETTE[colorIndex];
  const count = config.blockCount === "full" 
    ? (process.stdout.columns || 80) 
    : config.blockCount;
  const block = config.blockChar.repeat(count);
  const coloredBlock = `${colorCode(color)}${block}${RESET}`;
  ctx.ui.setStatus("0-color-band", coloredBlock);
}

function manualSetColor(
  ctx: HookContext,
  config: Required<SessionColorConfig>,
  colorIndex: number,
  setColorIndex: (idx: number) => void,
  setAssigned: () => void
) {
  setColorIndex(colorIndex);
  setAssigned();

  writeColorState({
    lastColorIndex: colorIndex,
    sessionId: ctx.sessionManager.getSessionId(),
    timestamp: Date.now(),
  });

  updateStatus(ctx, config, colorIndex);
}

function registerCommands(
  pi: HookAPI,
  getColorIndex: () => number | null,
  setColorIndex: (idx: number) => void,
  getAssigned: () => boolean,
  setAssigned: (assigned: boolean) => void,
  getSessionOverride: () => boolean | null,
  setSessionOverride: (value: boolean | null) => void
) {
  /**
   * /color - Toggle session color on/off
   */
  pi.registerCommand("color", {
    description: "Toggle session color band on/off for this session",
    handler: async (args, ctx) => {
      const config = getConfig(ctx);
      const sessionOverride = getSessionOverride();
      const currentState = sessionOverride !== null ? sessionOverride : config.enabledByDefault;
      const newState = !currentState;

      setSessionOverride(newState);

      if (newState) {
        ctx.ui.notify("🎨 Session color ON", "success");
        const colorIndex = getColorIndex();
        if (colorIndex !== null) {
          updateStatus(ctx, config, colorIndex);
        } else {
          // Assign next color
          const state = readColorState();
          const lastIndex = state?.lastColorIndex ?? -1;
          const nextIndex = (lastIndex + 1) % COLOR_PALETTE.length;
          manualSetColor(ctx, config, nextIndex, setColorIndex, () => setAssigned(true));
        }
      } else {
        ctx.ui.notify("⬜ Session color OFF", "warning");
        ctx.ui.setStatus("0-color-band", "");
      }
    },
  });

  /**
   * /color-set - Manually set a color by index or pick from preview
   */
  pi.registerCommand("color-set", {
    description: "Set session color manually",
    handler: async (args, ctx) => {
      const config = getConfig(ctx);
      const input = args.trim();

      if (input) {
        const index = parseInt(input, 10);
        if (isNaN(index) || index < 0 || index >= COLOR_PALETTE.length) {
          ctx.ui.notify(`Invalid index. Use 0-${COLOR_PALETTE.length - 1}`, "error");
          return;
        }
        manualSetColor(ctx, config, index, setColorIndex, () => setAssigned(true));
        const color = COLOR_PALETTE[index];
        ctx.ui.notify(`Color set to index ${index} (ANSI ${color})`, "success");
        return;
      }

      if (!ctx.hasUI) {
        ctx.ui.notify(`Usage: /color-set <0-${COLOR_PALETTE.length - 1}>`, "info");
        return;
      }

      // Show color preview in groups of 10
      const previews: string[] = [];
      for (let i = 0; i < COLOR_PALETTE.length; i += 10) {
        const group = COLOR_PALETTE.slice(i, i + 10);
        const blocks = group.map((c) => `${colorCode(c)}██${RESET}`).join(" ");
        const range = `${i}-${Math.min(i + 9, COLOR_PALETTE.length - 1)}`;
        previews.push(`${range}: ${blocks}`);
      }

      ctx.ui.notify("Available colors:\n", "info");
      previews.forEach((p) => ctx.ui.notify(p, "info"));

      const indexStr = await ctx.ui.input(`Enter color index (0-${COLOR_PALETTE.length - 1}):`);
      if (!indexStr) return;

      const index = parseInt(indexStr, 10);
      if (isNaN(index) || index < 0 || index >= COLOR_PALETTE.length) {
        ctx.ui.notify("Invalid index", "error");
        return;
      }

      manualSetColor(ctx, config, index, setColorIndex, () => setAssigned(true));
      ctx.ui.notify(`Color set to index ${index}`, "success");
    },
  });

  /**
   * /color-config - View and configure settings
   */
  pi.registerCommand("color-config", {
    description: "View and configure session color settings",
    handler: async (args, ctx) => {
      const config = getConfig(ctx);
      const sessionOverride = getSessionOverride();
      const isEnabled = sessionOverride !== null ? sessionOverride : config.enabledByDefault;
      const colorIndex = getColorIndex();
      const state = readColorState();

      ctx.ui.notify("─── Session Color Settings ───", "info");
      ctx.ui.notify(
        `Session: ${isEnabled ? "🎨 ON" : "⬜ OFF"}  │  Index: ${colorIndex ?? "(none)"}  │  Palette: ${COLOR_PALETTE.length} colors`,
        "info"
      );
      ctx.ui.notify(
        `Global: ${config.enabledByDefault ? "ON" : "OFF"}  │  Char: "${config.blockChar}"  │  Count: ${config.blockCount}`,
        "info"
      );
      if (state) {
        ctx.ui.notify(`Last used: index ${state.lastColorIndex}`, "info");
      }
      ctx.ui.notify("───────────────────────────────", "info");

      if (!ctx.hasUI) return;

      const action = await ctx.ui.select("Configure color", [
        "🎨 Preview all colors",
        "⚙️  Set global default: Disabled",
        "⚙️  Set global default: Enabled",
        "⚙️  Change block character",
        "🔄 Reset color sequence",
        "❌ Cancel",
      ]);

      if (!action || action === "❌ Cancel") return;

      switch (action) {
        case "🎨 Preview all colors": {
          ctx.ui.notify("\nColor palette:\n", "info");
          for (let i = 0; i < COLOR_PALETTE.length; i += 10) {
            const group = COLOR_PALETTE.slice(i, i + 10);
            const blocks = group.map((c) => `${colorCode(c)}██${RESET}`).join(" ");
            const indices = group.map((_, j) => String(i + j).padStart(2)).join("  ");
            ctx.ui.notify(`${blocks}`, "info");
            ctx.ui.notify(`${indices}`, "info");
          }
          break;
        }
        case "⚙️  Set global default: Disabled": {
          ctx.ui.notify("To disable by default, add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(JSON.stringify({ sessionColor: { enabledByDefault: false } }, null, 2), "info");
          break;
        }
        case "⚙️  Set global default: Enabled": {
          ctx.ui.notify("To enable by default, add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(JSON.stringify({ sessionColor: { enabledByDefault: true } }, null, 2), "info");
          break;
        }
        case "⚙️  Change block character": {
          ctx.ui.notify("To change block character, add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(JSON.stringify({ sessionColor: { blockChar: "▌", blockCount: 1 } }, null, 2), "info");
          ctx.ui.notify("\nSuggested characters: █ ▌ ▐ ▮ ■ ●", "info");
          break;
        }
        case "🔄 Reset color sequence": {
          writeColorState({
            lastColorIndex: -1,
            sessionId: "",
            timestamp: Date.now(),
          });
          ctx.ui.notify("Color sequence reset. Next session will start at color 0.", "success");
          break;
        }
      }
    },
  });

  /**
   * /color-next - Skip to next color
   */
  pi.registerCommand("color-next", {
    description: "Skip to the next color in the palette",
    handler: async (args, ctx) => {
      const config = getConfig(ctx);
      const currentIndex = getColorIndex() ?? -1;
      const nextIndex = (currentIndex + 1) % COLOR_PALETTE.length;

      manualSetColor(ctx, config, nextIndex, setColorIndex, () => setAssigned(true));
      ctx.ui.notify(`Skipped to color ${nextIndex}`, "success");
    },
  });
}
