/**
 * Session Emoji Hook
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
 * 
 * - `enabledByDefault`: Global setting for new sessions (default: true)
 * - Per-session control: Use /emoji (toggle), /emoji-set (manual set)
 */

import type { HookAPI, HookContext } from "@mariozechner/pi-coding-agent";
import { complete, type UserMessage } from "@mariozechner/pi-ai";

interface SessionEmojiConfig {
  enabledByDefault?: boolean;
  autoAssignMode?: "immediate" | "delayed" | "ai";
  autoAssignThreshold?: number;
  contextMessages?: number;
  emojiSet?: "default" | "animals" | "tech" | "fun" | "custom";
  customEmojis?: string[];
}

interface EmojiHistoryEntry {
  sessionId: string;
  emoji: string;
  timestamp: number;
  context: string;
}

const DEFAULT_CONFIG: Required<SessionEmojiConfig> = {
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

const EMOJI_SELECT_PROMPT = `You are an emoji selector. Given a conversation context and a list of recently used emojis, choose ONE unique emoji that:
1. Represents the main topic/theme of the conversation
2. Is NOT in the recently used list
3. Is relevant and appropriate
4. Stands alone (no skin tone modifiers)

Output ONLY the single emoji character, nothing else.`;

const EMOJI_FROM_TEXT_PROMPT = `You are an emoji selector. Given a text description, choose ONE emoji that best represents it.
Output ONLY the single emoji character, nothing else.`;

export default function (pi: HookAPI) {
  // Session state
  let sessionEmoji: string | null = null;
  let userMessageCount = 0;
  let emojiAssigned = false;
  let isSelectingEmoji = false;
  let sessionEnabledOverride: boolean | null = null;

  // Register all commands
  registerCommands(
    pi,
    () => sessionEmoji,
    (emoji) => { sessionEmoji = emoji; },
    () => emojiAssigned,
    (assigned) => { emojiAssigned = assigned; },
    () => sessionEnabledOverride,
    (value) => { sessionEnabledOverride = value; }
  );

  /**
   * Session start - initialize or restore emoji
   */
  pi.on("session_start", async (_, ctx) => {
    // Reset state
    userMessageCount = 0;
    emojiAssigned = false;
    sessionEmoji = null;
    isSelectingEmoji = false;
    sessionEnabledOverride = null;

    const config = getConfig(ctx);
    const isEnabled = config.enabledByDefault;

    if (!isEnabled) {
      ctx.ui.setStatus("0-emoji", "");
      return;
    }

    // Check if emoji already assigned in this session
    const existingEmoji = checkExistingEmoji(ctx);
    if (existingEmoji) {
      sessionEmoji = existingEmoji;
      emojiAssigned = true;
      ctx.ui.setStatus("0-emoji", sessionEmoji);
      return;
    }

    // Handle based on mode
    if (config.autoAssignMode === "immediate") {
      await assignEmoji(ctx, config, pi, () => isSelectingEmoji, (v) => { isSelectingEmoji = v; }, 
        () => sessionEmoji, (e) => { sessionEmoji = e; }, () => emojiAssigned, (a) => { emojiAssigned = a; });
    } else {
      const threshold = config.autoAssignThreshold;
      ctx.ui.setStatus("0-emoji", `⏳ (${threshold})`);
    }
  });

  /**
   * Agent start - track message count and assign when threshold reached
   */
  pi.on("agent_start", async (_, ctx) => {
    const config = getConfig(ctx);
    const isEnabled = sessionEnabledOverride !== null ? sessionEnabledOverride : config.enabledByDefault;

    if (!isEnabled) return;
    if (emojiAssigned) return;
    if (config.autoAssignMode === "immediate") return;

    userMessageCount++;
    const threshold = config.autoAssignThreshold;

    if (userMessageCount >= threshold) {
      await assignEmoji(ctx, config, pi, () => isSelectingEmoji, (v) => { isSelectingEmoji = v; },
        () => sessionEmoji, (e) => { sessionEmoji = e; }, () => emojiAssigned, (a) => { emojiAssigned = a; });
    } else {
      const remaining = threshold - userMessageCount;
      ctx.ui.setStatus("0-emoji", `⏳ (${remaining})`);
    }
  });

  /**
   * Session switch - handle new sessions
   */
  pi.on("session_switch", async (event, ctx) => {
    if (event.reason === "new") {
      userMessageCount = 0;
      emojiAssigned = false;
      sessionEmoji = null;
      sessionEnabledOverride = null;

      const config = getConfig(ctx);
      const isEnabled = config.enabledByDefault;

      if (!isEnabled) {
        ctx.ui.setStatus("0-emoji", "");
        return;
      }

      if (config.autoAssignMode === "immediate") {
        await assignEmoji(ctx, config, pi, () => isSelectingEmoji, (v) => { isSelectingEmoji = v; },
          () => sessionEmoji, (e) => { sessionEmoji = e; }, () => emojiAssigned, (a) => { emojiAssigned = a; });
      } else {
        const threshold = config.autoAssignThreshold;
        ctx.ui.setStatus("0-emoji", `⏳ (${threshold})`);
      }
    }
  });
}

/**
 * Get configuration with defaults
 */
function getConfig(ctx: HookContext): Required<SessionEmojiConfig> {
  const settings = (ctx as any).settingsManager?.getSettings() ?? {};
  return {
    ...DEFAULT_CONFIG,
    ...(settings.sessionEmoji ?? {}),
  };
}

/**
 * Get emojis from the past 24 hours across all sessions
 */
function getRecentEmojis(ctx: HookContext): Set<string> {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const recent = new Set<string>();

  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "session-emoji-history") {
      const data = entry.data as EmojiHistoryEntry;
      if (data && data.timestamp >= oneDayAgo) {
        recent.add(data.emoji);
      }
    }
  }

  return recent;
}

/**
 * Extract recent conversation context
 */
function getConversationContext(ctx: HookContext, maxMessages: number): string {
  const branch = ctx.sessionManager.getBranch();
  const userMessages: string[] = [];

  for (let i = branch.length - 1; i >= 0 && userMessages.length < maxMessages; i--) {
    const entry = branch[i];
    if (entry.type === "message" && "role" in entry.message && entry.message.role === "user") {
      const text = entry.message.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      if (text.trim()) {
        userMessages.unshift(text);
      }
    }
  }

  return userMessages.join("\n\n");
}

/**
 * Get emoji list based on configuration
 */
function getEmojiList(config: Required<SessionEmojiConfig>): string[] {
  if (config.emojiSet === "custom" && config.customEmojis && config.customEmojis.length > 0) {
    return config.customEmojis;
  }
  return EMOJI_SETS[config.emojiSet] ?? EMOJI_SETS.default;
}

/**
 * Select a random emoji from the configured set, avoiding recently used ones
 */
function selectRandomEmoji(ctx: HookContext, config: Required<SessionEmojiConfig>): string {
  const emojis = getEmojiList(config);
  const recentEmojis = getRecentEmojis(ctx);

  const availableEmojis = emojis.filter((e) => !recentEmojis.has(e));
  const emojiPool = availableEmojis.length > 0 ? availableEmojis : emojis;

  return emojiPool[Math.floor(Math.random() * emojiPool.length)];
}

/**
 * Select emoji using AI based on conversation context
 */
async function selectEmojiWithAI(ctx: HookContext, config: Required<SessionEmojiConfig>): Promise<string> {
  if (!ctx.model) {
    return selectRandomEmoji(ctx, config);
  }

  try {
    const conversationContext = getConversationContext(ctx, config.contextMessages);
    const recentEmojis = getRecentEmojis(ctx);

    const userPrompt = `Conversation context:
${conversationContext || "(No messages yet - choose a welcoming, friendly emoji)"}

Recently used emojis (DO NOT use these):
${recentEmojis.size > 0 ? Array.from(recentEmojis).join(", ") : "(none)"}

Choose a unique, topical emoji for this session.`;

    const apiKey = await ctx.modelRegistry.getApiKey(ctx.model);
    const userMessage: UserMessage = {
      role: "user",
      content: [{ type: "text", text: userPrompt }],
      timestamp: Date.now(),
    };

    const response = await complete(
      ctx.model,
      { systemPrompt: EMOJI_SELECT_PROMPT, messages: [userMessage] },
      { apiKey, maxTokens: 10 }
    );

    const emoji = response.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text.trim())
      .join("")
      .slice(0, 10);

    if (emoji && emoji.length > 0 && emoji.length <= 10) {
      return emoji;
    }
  } catch {
    // Fall back to random
  }

  return selectRandomEmoji(ctx, config);
}

/**
 * Select emoji using AI based on a text description
 */
async function selectEmojiFromText(ctx: HookContext, description: string): Promise<string | null> {
  if (!ctx.model) {
    return null;
  }

  try {
    const apiKey = await ctx.modelRegistry.getApiKey(ctx.model);
    const userMessage: UserMessage = {
      role: "user",
      content: [{ type: "text", text: description }],
      timestamp: Date.now(),
    };

    const response = await complete(
      ctx.model,
      { systemPrompt: EMOJI_FROM_TEXT_PROMPT, messages: [userMessage] },
      { apiKey, maxTokens: 10 }
    );

    const emoji = response.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text.trim())
      .join("")
      .slice(0, 10);

    if (emoji && emoji.length > 0 && emoji.length <= 10) {
      return emoji;
    }
  } catch {
    // Return null on error
  }

  return null;
}

/**
 * Check if emoji is already assigned in current session
 */
function checkExistingEmoji(ctx: HookContext): string | null {
  const sessionId = ctx.sessionManager.getSessionId();
  const entries = ctx.sessionManager.getEntries();

  for (const entry of entries) {
    if (entry.type === "custom" && entry.customType === "session-emoji-history") {
      const data = entry.data as EmojiHistoryEntry;
      if (data && data.sessionId === sessionId) {
        return data.emoji;
      }
    }
  }

  return null;
}

/**
 * Assign emoji to current session and persist to history
 */
async function assignEmoji(
  ctx: HookContext,
  config: Required<SessionEmojiConfig>,
  pi: HookAPI,
  getIsSelecting: () => boolean,
  setIsSelecting: (v: boolean) => void,
  getEmoji: () => string | null,
  setEmoji: (e: string) => void,
  getAssigned: () => boolean,
  setAssigned: (a: boolean) => void
) {
  if (getAssigned() || getIsSelecting()) return;
  setIsSelecting(true);

  try {
    if (config.autoAssignMode === "ai") {
      ctx.ui.setStatus("0-emoji", "🔄");
    }

    let emoji: string;
    if (config.autoAssignMode === "ai") {
      emoji = await selectEmojiWithAI(ctx, config);
    } else {
      emoji = selectRandomEmoji(ctx, config);
    }

    setEmoji(emoji);
    setAssigned(true);

    // Persist to history
    const conversationContext = getConversationContext(ctx, 2);
    const briefContext = conversationContext.slice(0, 100) || "(initial session)";

    pi.appendEntry("session-emoji-history", {
      sessionId: ctx.sessionManager.getSessionId(),
      emoji,
      timestamp: Date.now(),
      context: briefContext,
    } as EmojiHistoryEntry);

    ctx.ui.setStatus("0-emoji", emoji);
  } finally {
    setIsSelecting(false);
  }
}

/**
 * Manually set emoji and persist
 */
function manualSetEmoji(
  ctx: HookContext,
  pi: HookAPI,
  emoji: string,
  setEmoji: (e: string) => void,
  setAssigned: (a: boolean) => void
) {
  setEmoji(emoji);
  setAssigned(true);

  const conversationContext = getConversationContext(ctx, 2);
  const briefContext = conversationContext.slice(0, 100) || "(manual set)";

  pi.appendEntry("session-emoji-history", {
    sessionId: ctx.sessionManager.getSessionId(),
    emoji,
    timestamp: Date.now(),
    context: briefContext,
  } as EmojiHistoryEntry);

  ctx.ui.setStatus("0-emoji", emoji);
}

/**
 * Register slash commands
 */
function registerCommands(
  pi: HookAPI,
  getEmoji: () => string | null,
  setEmoji: (e: string) => void,
  getAssigned: () => boolean,
  setAssigned: (a: boolean) => void,
  getSessionOverride: () => boolean | null,
  setSessionOverride: (v: boolean | null) => void
) {
  /**
   * /emoji - Toggle session emoji on/off for this session
   */
  pi.registerCommand("emoji", {
    description: "Toggle session emoji on/off for this session",
    handler: async (args, ctx) => {
      const config = getConfig(ctx);
      const sessionOverride = getSessionOverride();
      const currentState = sessionOverride !== null ? sessionOverride : config.enabledByDefault;
      const newState = !currentState;

      setSessionOverride(newState);

      if (newState) {
        ctx.ui.notify("🎨 Session emoji ON", "success");
        // If we have an emoji, show it; otherwise show pending
        const emoji = getEmoji();
        if (emoji) {
          ctx.ui.setStatus("0-emoji", emoji);
        } else {
          ctx.ui.setStatus("0-emoji", `⏳ (${config.autoAssignThreshold})`);
        }
      } else {
        ctx.ui.notify("⬜ Session emoji OFF", "warning");
        ctx.ui.setStatus("0-emoji", "");
      }
    },
  });

  /**
   * /emoji-set - Manually set an emoji (directly or from description)
   */
  pi.registerCommand("emoji-set", {
    description: "Set emoji manually (emoji or text description)",
    handler: async (args, ctx) => {
      const input = args.trim();

      if (!input) {
        // Interactive mode
        if (!ctx.hasUI) {
          ctx.ui.notify("Usage: /emoji-set <emoji> or /emoji-set <description>", "info");
          ctx.ui.notify("Examples:", "info");
          ctx.ui.notify("  /emoji-set 🦀", "info");
          ctx.ui.notify("  /emoji-set rust programming", "info");
          return;
        }

        const choice = await ctx.ui.select("Set emoji how?", [
          "📝 Enter emoji directly",
          "💬 Describe what you want",
          "🎲 Pick random from set",
          "❌ Cancel",
        ]);

        if (!choice || choice === "❌ Cancel") return;

        if (choice === "📝 Enter emoji directly") {
          const emoji = await ctx.ui.input("Enter emoji:");
          if (!emoji) return;
          manualSetEmoji(ctx, pi, emoji.trim(), setEmoji, setAssigned);
          ctx.ui.notify(`Emoji set to ${emoji.trim()}`, "success");
        } else if (choice === "💬 Describe what you want") {
          const description = await ctx.ui.input("Describe the emoji you want:");
          if (!description) return;
          ctx.ui.notify("🔄 Selecting emoji...", "info");
          const emoji = await selectEmojiFromText(ctx, description);
          if (emoji) {
            manualSetEmoji(ctx, pi, emoji, setEmoji, setAssigned);
            ctx.ui.notify(`Emoji set to ${emoji} (from: "${description}")`, "success");
          } else {
            ctx.ui.notify("Could not select emoji. Try entering one directly.", "error");
          }
        } else if (choice === "🎲 Pick random from set") {
          const config = getConfig(ctx);
          const setChoice = await ctx.ui.select("Choose emoji set:", [
            "default - 🚀 ✨ 🎯 💡 🔥 ⚡ 🎨 🌟 💻 🎭",
            "animals - 🐱 🐶 🐼 🦊 🐻 🦁 🐯 🐨 🐰 🦉",
            "tech - 💻 🖥️ ⌨️ 🖱️ 💾 📱 🔌 🔋 🖨️ 📡",
            "fun - 🎉 🎊 🎈 🎁 🎂 🍕 🍩 🌮 🎮 🎲",
          ]);
          if (!setChoice) return;
          const setName = setChoice.split(" - ")[0] as keyof typeof EMOJI_SETS;
          const emojis = EMOJI_SETS[setName] ?? EMOJI_SETS.default;
          const emoji = emojis[Math.floor(Math.random() * emojis.length)];
          manualSetEmoji(ctx, pi, emoji, setEmoji, setAssigned);
          ctx.ui.notify(`Emoji set to ${emoji} (random from ${setName})`, "success");
        }
        return;
      }

      // Check if input looks like an emoji (starts with emoji-like character)
      const emojiRegex = /^[\p{Emoji_Presentation}\p{Emoji}\u200d]+/u;
      if (emojiRegex.test(input)) {
        // Direct emoji input
        const emoji = input.match(emojiRegex)?.[0] ?? input;
        manualSetEmoji(ctx, pi, emoji, setEmoji, setAssigned);
        ctx.ui.notify(`Emoji set to ${emoji}`, "success");
      } else {
        // Text description - use AI
        ctx.ui.notify("🔄 Selecting emoji...", "info");
        const emoji = await selectEmojiFromText(ctx, input);
        if (emoji) {
          manualSetEmoji(ctx, pi, emoji, setEmoji, setAssigned);
          ctx.ui.notify(`Emoji set to ${emoji} (from: "${input}")`, "success");
        } else {
          ctx.ui.notify("Could not select emoji from description. Try entering one directly.", "error");
        }
      }
    },
  });

  /**
   * /emoji-config - View and configure settings
   */
  pi.registerCommand("emoji-config", {
    description: "View and configure session emoji settings",
    handler: async (args, ctx) => {
      const config = getConfig(ctx);
      const sessionOverride = getSessionOverride();
      const isEnabled = sessionOverride !== null ? sessionOverride : config.enabledByDefault;
      const currentEmoji = getEmoji();

      // Display current settings
      ctx.ui.notify("─── Session Emoji Settings ───", "info");
      ctx.ui.notify(
        `Session: ${isEnabled ? "🎨 ON" : "⬜ OFF"}  │  Emoji: ${currentEmoji ?? "(none)"}  │  Mode: ${config.autoAssignMode}`,
        "info"
      );
      ctx.ui.notify(
        `Global: ${config.enabledByDefault ? "ON" : "OFF"}  │  Threshold: ${config.autoAssignThreshold}  │  Set: ${config.emojiSet}`,
        "info"
      );
      ctx.ui.notify("───────────────────────────────", "info");

      if (!ctx.hasUI) return;

      const action = await ctx.ui.select("Configure emoji", [
        "🎨 Preview emoji sets",
        "⚙️  Set global default: Disabled",
        "⚙️  Set global default: Enabled (AI)",
        "⚙️  Set global default: Enabled (Random)",
        "📋 View emoji history (24h)",
        "❌ Cancel",
      ]);

      if (!action || action === "❌ Cancel") return;

      switch (action) {
        case "🎨 Preview emoji sets": {
          ctx.ui.notify("\nAvailable emoji sets:", "info");
          for (const [name, emojis] of Object.entries(EMOJI_SETS)) {
            ctx.ui.notify(`  ${name}: ${emojis.join(" ")}`, "info");
          }
          break;
        }
        case "⚙️  Set global default: Disabled": {
          ctx.ui.notify("To disable by default, add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(JSON.stringify({ sessionEmoji: { enabledByDefault: false } }, null, 2), "info");
          break;
        }
        case "⚙️  Set global default: Enabled (AI)": {
          ctx.ui.notify("To enable AI mode by default, add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(
            JSON.stringify({ sessionEmoji: { enabledByDefault: true, autoAssignMode: "ai" } }, null, 2),
            "info"
          );
          break;
        }
        case "⚙️  Set global default: Enabled (Random)": {
          ctx.ui.notify("To enable random mode by default, add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(
            JSON.stringify({ sessionEmoji: { enabledByDefault: true, autoAssignMode: "immediate" } }, null, 2),
            "info"
          );
          break;
        }
        case "📋 View emoji history (24h)": {
          const entries = ctx.sessionManager.getEntries();
          const history: EmojiHistoryEntry[] = [];
          const now = Date.now();
          const oneDayAgo = now - 24 * 60 * 60 * 1000;

          for (const entry of entries) {
            if (entry.type === "custom" && entry.customType === "session-emoji-history") {
              const data = entry.data as EmojiHistoryEntry;
              if (data && data.timestamp >= oneDayAgo) {
                history.push(data);
              }
            }
          }

          if (history.length === 0) {
            ctx.ui.notify("No emoji history in the past 24 hours", "info");
            return;
          }

          ctx.ui.notify(`\n📊 Emoji History (${history.length} sessions):\n`, "info");
          history
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 10)
            .forEach((item) => {
              const timeAgo = Math.round((now - item.timestamp) / (60 * 1000));
              const timeStr = timeAgo < 60 ? `${timeAgo}m ago` : `${Math.round(timeAgo / 60)}h ago`;
              ctx.ui.notify(`  ${item.emoji} - ${timeStr} - "${item.context.slice(0, 30)}..."`, "info");
            });
          break;
        }
      }
    },
  });

  /**
   * /emoji-history - Show recent emoji usage
   */
  pi.registerCommand("emoji-history", {
    description: "Show emoji history from past 24 hours",
    handler: async (args, ctx) => {
      const entries = ctx.sessionManager.getEntries();
      const history: EmojiHistoryEntry[] = [];
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      for (const entry of entries) {
        if (entry.type === "custom" && entry.customType === "session-emoji-history") {
          const data = entry.data as EmojiHistoryEntry;
          if (data && data.timestamp >= oneDayAgo) {
            history.push(data);
          }
        }
      }

      if (history.length === 0) {
        ctx.ui.notify("No emoji history in the past 24 hours", "info");
        return;
      }

      const recentEmojis = new Set(history.map((h) => h.emoji));
      ctx.ui.notify(`📊 Emoji History (past 24h)\n`, "info");
      ctx.ui.notify(`Sessions: ${history.length}  │  Unique: ${recentEmojis.size}`, "info");
      ctx.ui.notify("", "info");

      history
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 15)
        .forEach((item, idx) => {
          const timeAgo = Math.round((now - item.timestamp) / (60 * 1000));
          const timeStr = timeAgo < 60 ? `${timeAgo}m ago` : `${Math.round(timeAgo / 60)}h ago`;
          const isCurrent = item.sessionId === ctx.sessionManager.getSessionId();
          const marker = isCurrent ? " (current)" : "";
          ctx.ui.notify(`${idx + 1}. ${item.emoji} - ${timeStr}${marker}`, "info");
          ctx.ui.notify(`   "${item.context.slice(0, 50)}..."`, "info");
        });
    },
  });
}
