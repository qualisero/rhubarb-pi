import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Input, matchesKey, Key, type TUI } from "@mariozechner/pi-tui";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const CONFIG_FILE = join(homedir(), ".pi", "agent", "compact-config.json");

interface Config {
  thresholds: Record<string, number>;
}

async function loadConfig(): Promise<Config> {
  try {
    const content = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`[compact-config] Failed to load config from "${CONFIG_FILE}":`, error);
    return { thresholds: {} };
  }
}

async function saveConfig(config: Config): Promise<void> {
  await mkdir(dirname(CONFIG_FILE), { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

function getModelKey(model: { provider: string; id: string }): string {
  return `${model.provider}/${model.id}`;
}

interface ModelItem {
  modelKey: string;
  modelName: string;
  provider: string;
  contextWindow: number;
  threshold?: number;
}

export default function (pi: ExtensionAPI) {
  // Track if we need to trigger compaction on agent_end
  let compactionTriggered = false;

  pi.registerCommand("compact-config", {
    description: "Configure custom compaction thresholds per model",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("UI not available", "error");
        return;
      }

      const allModels = ctx.modelRegistry.getAvailable();
      if (allModels.length === 0) {
        ctx.ui.notify("No models available", "error");
        return;
      }

      const currentModel = ctx.model;
      const currentKey = currentModel ? getModelKey(currentModel) : null;
      const config = await loadConfig();

      const items: ModelItem[] = allModels.map((m) => {
        const key = getModelKey(m);
        const isCurrent = key === currentKey;
        const threshold = config.thresholds[key];
        return {
          modelKey: key,
          modelName: isCurrent ? `${m.name} (current)` : m.name,
          provider: m.provider,
          contextWindow: m.contextWindow,
          threshold,
        };
      });

      items.sort((a, b) => {
        if (a.modelName.endsWith("(current)") && !b.modelName.endsWith("(current)")) return -1;
        if (!a.modelName.endsWith("(current)") && b.modelName.endsWith("(current)")) return 1;
        return a.modelName.localeCompare(b.modelName);
      });

      const selectedKey = await ctx.ui.custom<string | null>((tui, theme, keybindings, done) => {
        let selectedIndex = 0;
        let filterText = "";
        let filteredItems = [...items];

        const searchInput = new Input();

        function renderList(): string[] {
          const lines: string[] = [];

          if (filteredItems.length === 0) {
            lines.push(theme.fg("muted", "  No matching models"));
            return lines;
          }

          const maxVisible = 10;
          const startIndex = Math.max(
            0,
            Math.min(selectedIndex - Math.floor(maxVisible / 2), filteredItems.length - maxVisible),
          );
          const endIndex = Math.min(startIndex + maxVisible, filteredItems.length);

          for (let i = startIndex; i < endIndex; i++) {
            const item = filteredItems[i];
            const isSelected = i === selectedIndex;

            const baseText = `${item.provider} | ${item.contextWindow.toLocaleString()}`;
            const thresholdPart = item.threshold !== undefined
              ? `${theme.fg("accent", theme.bold(` → ${item.threshold.toLocaleString()}`))}`
              : "";

            if (isSelected) {
              lines.push(
                `${theme.fg("accent", "→ ")}${theme.fg("accent", item.modelName)} ${theme.fg("muted", baseText)}${thresholdPart}`,
              );
            } else {
              lines.push(`  ${item.modelName} ${theme.fg("muted", baseText)}${thresholdPart}`);
            }
          }

          if (startIndex > 0 || endIndex < filteredItems.length) {
            lines.push(theme.fg("dim", `  (${selectedIndex + 1}/${filteredItems.length})`));
          }

          return lines;
        }

        function updateFilter(): void {
          const query = filterText.toLowerCase();
          if (!query) {
            filteredItems = [...items];
          } else {
            filteredItems = items.filter(
              (item) =>
                item.modelName.toLowerCase().includes(query) ||
                item.provider.toLowerCase().includes(query),
            );
          }
          selectedIndex = Math.min(selectedIndex, Math.max(0, filteredItems.length - 1));
        }

        return {
          render(width: number) {
            const lines: string[] = [
              theme.fg("accent", theme.bold("Configure Compaction Threshold")),
              "",
              ...searchInput.render(width),
              "",
              ...renderList(),
              "",
              theme.fg("dim", "type to filter, up/down navigate, enter select, esc cancel"),
            ];
            return lines;
          },
          invalidate() {
            searchInput.invalidate();
          },
          handleInput(data: string) {
            if (matchesKey(data, Key.up)) {
              if (filteredItems.length > 0) {
                selectedIndex = selectedIndex === 0 ? filteredItems.length - 1 : selectedIndex - 1;
              }
            } else if (matchesKey(data, Key.down)) {
              if (filteredItems.length > 0) {
                selectedIndex = selectedIndex === filteredItems.length - 1 ? 0 : selectedIndex + 1;
              }
            } else if (matchesKey(data, Key.enter)) {
              const selected = filteredItems[selectedIndex];
              if (selected) {
                done(selected.modelKey);
              }
            } else if (matchesKey(data, Key.escape)) {
              done(null);
            } else {
              searchInput.handleInput(data);
              filterText = searchInput.getValue();
              updateFilter();
            }

            tui.requestRender();
          },
          dispose() {},
        };
      });

      if (!selectedKey) {
        return;
      }

      const model = allModels.find((m) => getModelKey(m) === selectedKey);
      if (!model) {
        return;
      }

      const currentThreshold = config.thresholds[selectedKey];

      const prompt = currentThreshold !== undefined
        ? `Current threshold: ${currentThreshold.toLocaleString()} tokens. Enter new value (0-${model.contextWindow}):`
        : `Enter threshold tokens (0-${model.contextWindow}):`;

      const input = await ctx.ui.input(prompt, currentThreshold?.toString() ?? "");
      if (input === undefined) {
        return;
      }

      const threshold = parseInt(input, 10);

      if (isNaN(threshold)) {
        ctx.ui.notify("Invalid number", "error");
        return;
      }

      if (threshold < 0) {
        ctx.ui.notify("Threshold must be non-negative", "error");
        return;
      }

      if (threshold > model.contextWindow) {
        ctx.ui.notify(
          `Threshold (${threshold.toLocaleString()}) exceeds model context window (${model.contextWindow.toLocaleString()})`,
          "error"
        );
        return;
      }

      config.thresholds[selectedKey] = threshold;
      await saveConfig(config);

      ctx.ui.notify(
        `Saved: ${model.name} compacts at ${threshold.toLocaleString()} tokens`,
        "info"
      );
    },
  });

  // Check if custom threshold is reached at turn_end
  pi.on("turn_end", async (_event, ctx) => {
    const model = ctx.model;
    if (!model) {
      return;
    }

    const modelKey = getModelKey(model);
    const config = await loadConfig();
    const threshold = config.thresholds[modelKey];

    if (threshold === undefined) {
      return;
    }

    const usage = ctx.getContextUsage();
    if (!usage || usage.tokens <= threshold) {
      return;
    }

    // Custom threshold exceeded, mark for potential compaction on agent_end
    compactionTriggered = true;
  });

  // Trigger compaction when agent completes (if needed and built-in won't handle it)
  pi.on("agent_end", async (_event, ctx) => {
    if (!compactionTriggered) {
      return;
    }

    const model = ctx.model;
    if (!model) {
      compactionTriggered = false;
      return;
    }

    const modelKey = getModelKey(model);
    const config = await loadConfig();
    const threshold = config.thresholds[modelKey];
    if (threshold === undefined) {
      compactionTriggered = false;
      return;
    }

    const usage = ctx.getContextUsage();
    if (!usage || usage.tokens <= threshold) {
      compactionTriggered = false;
      return;
    }

    // Check what built-in auto-compaction would do
    // Access settings via the settings manager if available
    const settings = (ctx as any).settings?.compaction;
    const builtInEnabled = settings?.enabled ?? true;
    const reserveTokens = settings?.reserveTokens ?? 16384;
    const contextWindow = model.contextWindow;

    // Calculate built-in threshold (context window minus reserve)
    const builtInThreshold = contextWindow - reserveTokens;

    // If built-in will handle it (and is enabled), let it
    if (builtInEnabled && usage.tokens >= builtInThreshold) {
      // Built-in auto-compaction will run after this handler completes
      // Just reset our flag
      compactionTriggered = false;
      return;
    }

    // Built-in won't trigger, but custom threshold is exceeded
    // Trigger manual compaction now (agent is idle, so it's safe)
    if (!ctx.isIdle()) {
      // Agent isn't idle yet, let built-in handle it if it will
      if (builtInEnabled && usage.tokens >= builtInThreshold) {
        compactionTriggered = false;
        return;
      }
      // Can't compact right now, skip
      compactionTriggered = false;
      return;
    }

    if (ctx.hasUI) {
      ctx.ui.notify(
        `Context at ${usage.tokens.toLocaleString()} tokens (threshold: ${threshold.toLocaleString()}), compacting...`,
        "info"
      );
    }

    compactionTriggered = false;

    // ctx.compact() is safe here because agent is done
    // The onComplete and onError callbacks handle the async result
    ctx.compact({
      customInstructions: `Compaction triggered at ${usage.tokens.toLocaleString()} tokens (threshold: ${threshold.toLocaleString()})`,
      onComplete: () => {
        if (ctx.hasUI) {
          ctx.ui.notify("Compaction completed", "info");
        }
      },
      onError: (error) => {
        if (ctx.hasUI) {
          ctx.ui.notify(`Compaction failed: ${error.message}`, "error");
        }
      },
    });
  });
}
