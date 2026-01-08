/**
 * Session Emoji Extension
 *
 * Displays an emoji in the pi footer status line. Supports manual selection,
 * AI-powered selection based on conversation, or random assignment.
 *
 * Configuration (in ~/.pi/agent/settings.json):
 * {
 *   "sessionEmoji": {
 *     "enabledByDefault": true,
 *     "autoAssignMode": "ai",
 *     "autoAssignThreshold": 3,
 *     "contextMessages": 5,
 *     "emojiSet": "default"
 *   }
 * }
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { complete, type UserMessage } from "@mariozechner/pi-ai";

// ─────────────────────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────────────────────

interface SessionEmojiConfig {
  enabledByDefault: boolean;
  autoAssignMode: "immediate" | "delayed" | "ai";
  autoAssignThreshold: number;
  contextMessages: number;
  emojiSet: "default" | "animals" | "tech" | "fun" | "custom";
  customEmojis: string[];
}

interface EmojiHistoryEntry {
  sessionId: string;
  emoji: string;
  timestamp: number;
  context: string;
}

interface SessionState {
  emoji: string | null;
  messageCount: number;
  assigned: boolean;
  selecting: boolean;
  enabledOverride: boolean | null;
}

const DEFAULT_CONFIG: SessionEmojiConfig = {
  enabledByDefault: true,
  autoAssignMode: "ai",
  autoAssignThreshold: 3,
  contextMessages: 5,
  emojiSet: "default",
  customEmojis: [],
};

const EMOJI_SETS: Record<string, string[]> = {
  default: ["🚀", "✨", "🎯", "💡", "🔥", "⚡", "🎨", "🌟", "💻", "🎭"],
  animals: ["🐱", "🐶", "🐼", "🦊", "🐻", "🦁", "🐯", "🐨", "🐰", "🦉"],
  tech: ["💻", "🖥️", "⌨️", "🖱️", "💾", "📱", "🔌", "🔋", "🖨️", "📡"],
  fun: ["🎉", "🎊", "🎈", "🎁", "🎂", "🍕", "🍩", "🌮", "🎮", "🎲"],
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const AI_PROMPTS = {
  select: `You are an emoji selector. Given a conversation context and a list of recently used emojis, choose ONE unique emoji that:
1. Represents the main topic/theme of the conversation
2. Is NOT in the recently used list
3. Is relevant and appropriate
4. Stands alone (no skin tone modifiers)

Output ONLY the single emoji character, nothing else.`,

  fromText: `You are an emoji selector. Given a text description, choose ONE emoji that best represents it.
Output ONLY the single emoji character, nothing else.`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Extension
// ─────────────────────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  const state: SessionState = {
    emoji: null,
    messageCount: 0,
    assigned: false,
    selecting: false,
    enabledOverride: null,
  };

  registerCommands(pi, state);

  pi.on("session_start", (_, ctx) => initSession(ctx, pi, state));
  pi.on("session_switch", (event, ctx) => {
    if (event.reason === "new") initSession(ctx, pi, state);
  });
  pi.on("agent_start", (_, ctx) => handleAgentStart(ctx, pi, state));
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

async function initSession(ctx: ExtensionContext, pi: ExtensionAPI, state: SessionState) {
  // Reset state
  Object.assign(state, { emoji: null, messageCount: 0, assigned: false, selecting: false, enabledOverride: null });

  const config = getConfig(ctx);
  if (!config.enabledByDefault) {
    ctx.ui.setStatus("0-emoji", "");
    return;
  }

  // Check for existing emoji in session
  const existing = findExistingEmoji(ctx);
  if (existing) {
    state.emoji = existing;
    state.assigned = true;
    ctx.ui.setStatus("0-emoji", existing);
    return;
  }

  // Assign based on mode
  if (config.autoAssignMode === "immediate") {
    await assignEmoji(ctx, pi, state, config);
  } else {
    ctx.ui.setStatus("0-emoji", `⏳ (${config.autoAssignThreshold})`);
  }
}

async function handleAgentStart(ctx: ExtensionContext, pi: ExtensionAPI, state: SessionState) {
  const config = getConfig(ctx);
  const isEnabled = state.enabledOverride ?? config.enabledByDefault;

  if (!isEnabled || state.assigned || config.autoAssignMode === "immediate") return;

  state.messageCount++;
  if (state.messageCount >= config.autoAssignThreshold) {
    await assignEmoji(ctx, pi, state, config);
  } else {
    ctx.ui.setStatus("0-emoji", `⏳ (${config.autoAssignThreshold - state.messageCount})`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Emoji Selection
// ─────────────────────────────────────────────────────────────────────────────

async function assignEmoji(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  state: SessionState,
  config: SessionEmojiConfig
) {
  if (state.assigned || state.selecting) return;
  state.selecting = true;

  try {
    if (config.autoAssignMode === "ai") ctx.ui.setStatus("0-emoji", "🔄");

    const emoji =
      config.autoAssignMode === "ai"
        ? await selectEmojiWithAI(ctx, config)
        : selectRandomEmoji(ctx, config);

    state.emoji = emoji;
    state.assigned = true;
    persistEmoji(ctx, pi, emoji);
    ctx.ui.setStatus("0-emoji", emoji);
  } finally {
    state.selecting = false;
  }
}

function selectRandomEmoji(ctx: ExtensionContext, config: SessionEmojiConfig): string {
  const emojis = getEmojiList(config);
  const recent = getRecentEmojis(ctx);
  const available = emojis.filter((e) => !recent.has(e));
  const pool = available.length > 0 ? available : emojis;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function selectEmojiWithAI(ctx: ExtensionContext, config: SessionEmojiConfig): Promise<string> {
  if (!ctx.model) return selectRandomEmoji(ctx, config);

  try {
    const context = getConversationContext(ctx, config.contextMessages);
    const recent = getRecentEmojis(ctx);

    const prompt = `Conversation context:
${context || "(No messages yet - choose a welcoming, friendly emoji)"}

Recently used emojis (DO NOT use these):
${recent.size > 0 ? Array.from(recent).join(", ") : "(none)"}

Choose a unique, topical emoji for this session.`;

    const emoji = await callAI(ctx, AI_PROMPTS.select, prompt);
    if (emoji) return emoji;
  } catch {
    // Fall through to random
  }
  return selectRandomEmoji(ctx, config);
}

async function selectEmojiFromText(ctx: ExtensionContext, description: string): Promise<string | null> {
  if (!ctx.model) return null;
  try {
    return await callAI(ctx, AI_PROMPTS.fromText, description);
  } catch {
    return null;
  }
}

async function callAI(ctx: ExtensionContext, systemPrompt: string, userText: string): Promise<string | null> {
  const apiKey = await ctx.modelRegistry.getApiKey(ctx.model!);
  const userMessage: UserMessage = {
    role: "user",
    content: [{ type: "text", text: userText }],
    timestamp: Date.now(),
  };

  const response = await complete(ctx.model!, { systemPrompt, messages: [userMessage] }, { apiKey, maxTokens: 10 });

  const emoji = response.content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text.trim())
    .join("")
    .slice(0, 10);

  return emoji && emoji.length > 0 && emoji.length <= 10 ? emoji : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence & History
// ─────────────────────────────────────────────────────────────────────────────

function persistEmoji(ctx: ExtensionContext, pi: ExtensionAPI, emoji: string) {
  const context = getConversationContext(ctx, 2).slice(0, 100) || "(initial session)";
  pi.appendEntry("session-emoji-history", {
    sessionId: ctx.sessionManager.getSessionId(),
    emoji,
    timestamp: Date.now(),
    context,
  } as EmojiHistoryEntry);
}

function findExistingEmoji(ctx: ExtensionContext): string | null {
  const sessionId = ctx.sessionManager.getSessionId();
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "session-emoji-history") {
      const data = entry.data as EmojiHistoryEntry;
      if (data?.sessionId === sessionId) return data.emoji;
    }
  }
  return null;
}

function getRecentEmojis(ctx: ExtensionContext): Set<string> {
  const cutoff = Date.now() - ONE_DAY_MS;
  const recent = new Set<string>();

  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "session-emoji-history") {
      const data = entry.data as EmojiHistoryEntry;
      if (data?.timestamp >= cutoff) recent.add(data.emoji);
    }
  }
  return recent;
}

function getEmojiHistory(ctx: ExtensionContext): EmojiHistoryEntry[] {
  const cutoff = Date.now() - ONE_DAY_MS;
  const history: EmojiHistoryEntry[] = [];

  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "session-emoji-history") {
      const data = entry.data as EmojiHistoryEntry;
      if (data?.timestamp >= cutoff) history.push(data);
    }
  }
  return history.sort((a, b) => b.timestamp - a.timestamp);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getConfig(ctx: ExtensionContext): SessionEmojiConfig {
  const settings = (ctx as any).settingsManager?.getSettings() ?? {};
  return { ...DEFAULT_CONFIG, ...(settings.sessionEmoji ?? {}) };
}

function getEmojiList(config: SessionEmojiConfig): string[] {
  if (config.emojiSet === "custom" && config.customEmojis?.length > 0) {
    return config.customEmojis;
  }
  return EMOJI_SETS[config.emojiSet] ?? EMOJI_SETS.default;
}

function getConversationContext(ctx: ExtensionContext, maxMessages: number): string {
  const branch = ctx.sessionManager.getBranch();
  const messages: string[] = [];

  for (let i = branch.length - 1; i >= 0 && messages.length < maxMessages; i--) {
    const entry = branch[i];
    if (entry.type === "message" && "role" in entry.message && entry.message.role === "user") {
      const content = entry.message.content;
      const text =
        typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content
                .filter((c: any): c is { type: "text"; text: string } => c.type === "text")
                .map((c) => c.text)
                .join("\n")
            : "";
      if (text.trim()) messages.unshift(text);
    }
  }
  return messages.join("\n\n");
}

function formatTimeAgo(timestamp: number): string {
  const mins = Math.round((Date.now() - timestamp) / 60000);
  return mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

function registerCommands(pi: ExtensionAPI, state: SessionState) {
  pi.registerCommand("emoji", {
    description: "Toggle session emoji on/off",
    handler: async (_, ctx) => {
      const config = getConfig(ctx);
      const current = state.enabledOverride ?? config.enabledByDefault;
      state.enabledOverride = !current;

      if (state.enabledOverride) {
        ctx.ui.notify("🎨 Session emoji ON", "info");
        ctx.ui.setStatus("0-emoji", state.emoji ?? `⏳ (${config.autoAssignThreshold})`);
      } else {
        ctx.ui.notify("⬜ Session emoji OFF", "warning");
        ctx.ui.setStatus("0-emoji", "");
      }
    },
  });

  pi.registerCommand("emoji-set", {
    description: "Set emoji manually (emoji or description)",
    handler: async (args, ctx) => {
      const input = args.trim();

      if (!input) {
        if (!ctx.hasUI) {
          ctx.ui.notify("Usage: /emoji-set <emoji|description>", "info");
          return;
        }

        const choice = await ctx.ui.select("Set emoji how?", [
          "📝 Enter emoji directly",
          "💬 Describe what you want",
          "🎲 Pick random from set",
          "❌ Cancel",
        ]);

        if (!choice || choice.startsWith("❌")) return;

        if (choice.startsWith("📝")) {
          const emoji = await ctx.ui.input("Enter emoji:");
          if (emoji) {
            setManualEmoji(ctx, pi, state, emoji.trim());
            ctx.ui.notify(`Emoji set to ${emoji.trim()}`, "info");
          }
        } else if (choice.startsWith("💬")) {
          const desc = await ctx.ui.input("Describe the emoji:");
          if (desc) {
            ctx.ui.notify("🔄 Selecting...", "info");
            const emoji = await selectEmojiFromText(ctx, desc);
            if (emoji) {
              setManualEmoji(ctx, pi, state, emoji);
              ctx.ui.notify(`Emoji set to ${emoji}`, "info");
            } else {
              ctx.ui.notify("Could not select emoji", "error");
            }
          }
        } else if (choice.startsWith("🎲")) {
          const setChoice = await ctx.ui.select("Choose set:", Object.keys(EMOJI_SETS));
          if (setChoice) {
            const emojis = EMOJI_SETS[setChoice] ?? EMOJI_SETS.default;
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            setManualEmoji(ctx, pi, state, emoji);
            ctx.ui.notify(`Emoji set to ${emoji}`, "info");
          }
        }
        return;
      }

      // Direct input
      const emojiRegex = /^[\p{Emoji_Presentation}\p{Emoji}\u200d]+/u;
      if (emojiRegex.test(input)) {
        const emoji = input.match(emojiRegex)?.[0] ?? input;
        setManualEmoji(ctx, pi, state, emoji);
        ctx.ui.notify(`Emoji set to ${emoji}`, "info");
      } else {
        ctx.ui.notify("🔄 Selecting...", "info");
        const emoji = await selectEmojiFromText(ctx, input);
        if (emoji) {
          setManualEmoji(ctx, pi, state, emoji);
          ctx.ui.notify(`Emoji set to ${emoji}`, "info");
        } else {
          ctx.ui.notify("Could not select emoji", "error");
        }
      }
    },
  });

  pi.registerCommand("emoji-config", {
    description: "View emoji settings",
    handler: async (_, ctx) => {
      const config = getConfig(ctx);
      const isEnabled = state.enabledOverride ?? config.enabledByDefault;

      ctx.ui.notify("─── Session Emoji ───", "info");
      ctx.ui.notify(`Status: ${isEnabled ? "🎨 ON" : "⬜ OFF"}  │  Current: ${state.emoji ?? "(none)"}`, "info");
      ctx.ui.notify(`Mode: ${config.autoAssignMode}  │  Threshold: ${config.autoAssignThreshold}  │  Set: ${config.emojiSet}`, "info");

      if (!ctx.hasUI) return;

      const action = await ctx.ui.select("Options", [
        "🎨 Preview sets",
        "📋 View history",
        "❌ Cancel",
      ]);

      if (action?.startsWith("🎨")) {
        for (const [name, emojis] of Object.entries(EMOJI_SETS)) {
          ctx.ui.notify(`${name}: ${emojis.join(" ")}`, "info");
        }
      } else if (action?.startsWith("📋")) {
        const history = getEmojiHistory(ctx);
        if (history.length === 0) {
          ctx.ui.notify("No history in past 24h", "info");
        } else {
          history.slice(0, 10).forEach((h, i) => {
            const current = h.sessionId === ctx.sessionManager.getSessionId() ? " (current)" : "";
            ctx.ui.notify(`${i + 1}. ${h.emoji} - ${formatTimeAgo(h.timestamp)}${current}`, "info");
          });
        }
      }
    },
  });

  pi.registerCommand("emoji-history", {
    description: "Show emoji history (24h)",
    handler: async (_, ctx) => {
      const history = getEmojiHistory(ctx);
      if (history.length === 0) {
        ctx.ui.notify("No history in past 24h", "info");
        return;
      }

      const unique = new Set(history.map((h) => h.emoji));
      ctx.ui.notify(`📊 Emoji History - ${history.length} sessions, ${unique.size} unique`, "info");

      history.slice(0, 15).forEach((h, i) => {
        const current = h.sessionId === ctx.sessionManager.getSessionId() ? " (current)" : "";
        ctx.ui.notify(`${i + 1}. ${h.emoji} - ${formatTimeAgo(h.timestamp)}${current}`, "info");
      });
    },
  });
}

function setManualEmoji(ctx: ExtensionContext, pi: ExtensionAPI, state: SessionState, emoji: string) {
  state.emoji = emoji;
  state.assigned = true;
  persistEmoji(ctx, pi, emoji);
  ctx.ui.setStatus("0-emoji", emoji);
}
