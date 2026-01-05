/**
 * Session Emoji Hook (Enhanced)
 * 
 * Displays an emoji in the pi footer status line with multiple assignment modes:
 * - immediate: Random emoji at session start (classic behavior)
 * - delayed: Random emoji after N user messages
 * - ai: AI-selected topical emoji based on conversation context (recommended)
 * 
 * The AI mode analyzes your conversation and picks a thematically appropriate emoji
 * that hasn't been used in the past 24 hours across any session.
 * 
 * Configuration (in ~/.pi/agent/settings.json):
 * {
 *   "sessionEmoji": {
 *     "enabled": true,
 *     "autoAssignMode": "ai",
 *     "autoAssignThreshold": 3,
 *     "contextMessages": 5
 *   }
 * }
 */

import type { HookAPI, HookContext } from "@mariozechner/pi-coding-agent";
import { complete, type UserMessage } from "@mariozechner/pi-ai";

interface SessionEmojiConfig {
  enabled?: boolean;
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
  enabled: true,
  autoAssignMode: "ai",
  autoAssignThreshold: 3,
  contextMessages: 5,
  emojiSet: "default",
  customEmojis: [],
};

const EMOJI_SETS = {
  default: ["🚀", "✨", "🎯", "💡", "🔥", "⚡", "🎨", "🌟", "💻", "🎭"],
  animals: ["🐱", "🐶", "🐼", "🦊", "🐻", "🦁", "🐯", "🐨", "🐰", "🦉"],
  tech: ["💻", "🖥️", "⌨️", "🖱️", "💾", "📱", "🔌", "🔋", "🖨️", "📡"],
  fun: ["🎉", "🎊", "🎈", "🎁", "🎂", "🍕", "🍩", "🌮", "🎮", "🎲"],
};

const SYSTEM_PROMPT = `You are an emoji selector. Given a conversation context and a list of recently used emojis, choose ONE unique emoji that:
1. Represents the main topic/theme of the conversation
2. Is NOT in the recently used list
3. Is relevant and appropriate
4. Stands alone (no skin tone modifiers)

Output ONLY the single emoji character, nothing else.`;

export default function (pi: HookAPI) {
  // Session state (reset on hook reload)
  let sessionEmoji: string | null = null;
  let userMessageCount: number = 0;
  let emojiAssigned: boolean = false;
  let isSelectingEmoji: boolean = false;

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
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
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
    } else if (config.emojiSet in EMOJI_SETS) {
      return EMOJI_SETS[config.emojiSet as keyof typeof EMOJI_SETS];
    }
    return EMOJI_SETS.default;
  }

  /**
   * Select a random emoji from the configured set, avoiding recently used ones
   */
  function selectRandomEmoji(ctx: HookContext, config: Required<SessionEmojiConfig>): string {
    const emojis = getEmojiList(config);
    const recentEmojis = getRecentEmojis(ctx);
    
    // Filter out recently used emojis
    const availableEmojis = emojis.filter(e => !recentEmojis.has(e));
    
    // If all emojis have been used recently, use the full set
    const emojiPool = availableEmojis.length > 0 ? availableEmojis : emojis;
    
    return emojiPool[Math.floor(Math.random() * emojiPool.length)];
  }

  /**
   * Select emoji using AI based on conversation context
   */
  async function selectEmojiWithAI(
    ctx: HookContext,
    config: Required<SessionEmojiConfig>
  ): Promise<string> {
    // Check if model is available
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
        { systemPrompt: SYSTEM_PROMPT, messages: [userMessage] },
        { apiKey, maxTokens: 10 }
      );

      const emoji = response.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text.trim())
        .join("")
        .slice(0, 10);

      // Validate it's a reasonable emoji response
      if (emoji && emoji.length > 0 && emoji.length <= 10) {
        return emoji;
      }
    } catch (err) {
      // Silently fall back to random on error
    }

    return selectRandomEmoji(config);
  }

  /**
   * Assign emoji to current session and persist to history
   */
  async function assignEmoji(ctx: HookContext, config: Required<SessionEmojiConfig>) {
    if (emojiAssigned || isSelectingEmoji) return;
    isSelectingEmoji = true;

    try {
      // Show loading state for AI mode
      if (config.autoAssignMode === "ai") {
        ctx.ui.setStatus("0-emoji", "🔄 selecting emoji...");
      }

      // Select emoji based on mode
      if (config.autoAssignMode === "ai") {
        sessionEmoji = await selectEmojiWithAI(ctx, config);
      } else {
        sessionEmoji = selectRandomEmoji(config);
      }

      emojiAssigned = true;

      // Persist to history
      const conversationContext = getConversationContext(ctx, 2);
      const briefContext = conversationContext.slice(0, 100) || "(initial session)";

      pi.appendEntry("session-emoji-history", {
        sessionId: ctx.sessionManager.getSessionId(),
        emoji: sessionEmoji,
        timestamp: Date.now(),
        context: briefContext,
      } as EmojiHistoryEntry);

      // Update status immediately
      ctx.ui.setStatus("0-emoji", sessionEmoji);
    } finally {
      isSelectingEmoji = false;
    }
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
   * Session start - initialize or restore emoji
   */
  pi.on("session_start", async (_, ctx) => {
    // Reset state
    userMessageCount = 0;
    emojiAssigned = false;
    sessionEmoji = null;
    isSelectingEmoji = false;

    const config = getConfig(ctx);
    if (!config.enabled) return;

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
      await assignEmoji(ctx, config);
    } else if (config.autoAssignMode === "delayed" || config.autoAssignMode === "ai") {
      const threshold = config.autoAssignThreshold;
      ctx.ui.setStatus("0-emoji", `⏳ emoji in ${threshold} messages`);
    }
  });

  /**
   * Agent start - track message count and assign when threshold reached
   */
  pi.on("agent_start", async (_, ctx) => {
    const config = getConfig(ctx);

    if (!config.enabled) return;
    if (emojiAssigned) return;
    if (config.autoAssignMode === "immediate") return;

    userMessageCount++;
    const threshold = config.autoAssignThreshold;

    if (userMessageCount >= threshold) {
      await assignEmoji(ctx, config);
    } else {
      const remaining = threshold - userMessageCount;
      ctx.ui.setStatus("0-emoji", `⏳ emoji in ${remaining} messages`);
    }
  });

  /**
   * Session switch - handle new sessions
   */
  pi.on("session_switch", async (event, ctx) => {
    if (event.reason === "new") {
      // Reset for new session
      userMessageCount = 0;
      emojiAssigned = false;
      sessionEmoji = null;

      const config = getConfig(ctx);
      if (!config.enabled) return;

      if (config.autoAssignMode === "immediate") {
        await assignEmoji(ctx, config);
      } else {
        const threshold = config.autoAssignThreshold;
        ctx.ui.setStatus("0-emoji", `⏳ emoji in ${threshold} messages`);
      }
    }
  });

  /**
   * /emoji - Interactive configuration command
   */
  pi.registerCommand("emoji", {
    description: "Configure session emoji settings",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("This command requires interactive mode", "error");
        return;
      }

      const settings = (ctx as any).settingsManager?.getSettings() ?? {};
      const currentConfig: Required<SessionEmojiConfig> = {
        ...DEFAULT_CONFIG,
        ...(settings.sessionEmoji ?? {}),
      };

      // Main menu
      const action = await ctx.ui.select(
        "Session Emoji Configuration",
        [
          "Change assignment mode",
          "Set message threshold",
          "Change emoji set",
          "View current settings",
          "View emoji history (24h)",
          "Force new emoji now",
          "Cancel"
        ]
      );

      if (!action || action === "Cancel") return;

      switch (action) {
        case "Change assignment mode": {
          const mode = await ctx.ui.select(
            "Choose emoji assignment mode:",
            [
              "ai - AI-selected based on conversation (recommended)",
              "delayed - Random after threshold messages",
              "immediate - Random at session start"
            ]
          );
          if (!mode) return;
          
          const modeValue = mode.split(" - ")[0];
          ctx.ui.notify(`Selected: ${modeValue}`, "success");
          ctx.ui.notify("To persist, add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(JSON.stringify({ sessionEmoji: { autoAssignMode: modeValue } }, null, 2), "info");
          break;
        }

        case "Set message threshold": {
          const threshold = await ctx.ui.input(
            "Messages before emoji assignment:",
            String(currentConfig.autoAssignThreshold)
          );
          if (!threshold) return;
          
          const value = parseInt(threshold, 10);
          if (isNaN(value) || value < 1) {
            ctx.ui.notify("Please enter a valid number (1 or greater)", "error");
            return;
          }
          
          ctx.ui.notify(`Threshold set to: ${value} messages`, "success");
          ctx.ui.notify("To persist, add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(JSON.stringify({ sessionEmoji: { autoAssignThreshold: value } }, null, 2), "info");
          break;
        }

        case "Change emoji set": {
          const set = await ctx.ui.select(
            "Choose emoji set (for random/fallback):",
            [
              "default - 🚀 ✨ 🎯 💡 🔥 ⚡ 🎨 🌟 💻 🎭",
              "animals - 🐱 🐶 🐼 🦊 🐻 🦁 🐯 🐨 🐰 🦉",
              "tech - 💻 🖥️ ⌨️ 🖱️ 💾 📱 🔌 🔋 🖨️ 📡",
              "fun - 🎉 🎊 🎈 🎁 🎂 🍕 🍩 🌮 🎮 🎲"
            ]
          );
          if (!set) return;
          
          const setName = set.split(" - ")[0];
          ctx.ui.notify(`Selected: ${setName}`, "success");
          ctx.ui.notify("To persist, add to ~/.pi/agent/settings.json:", "info");
          ctx.ui.notify(JSON.stringify({ sessionEmoji: { emojiSet: setName } }, null, 2), "info");
          break;
        }

        case "View current settings": {
          const configStr = JSON.stringify(currentConfig, null, 2);
          ctx.ui.notify("Current session emoji configuration:", "info");
          ctx.ui.notify(configStr, "info");
          ctx.ui.notify("\nSession state:", "info");
          ctx.ui.notify(`  Current emoji: ${sessionEmoji ?? "(not assigned yet)"}`, "info");
          ctx.ui.notify(`  Message count: ${userMessageCount}`, "info");
          ctx.ui.notify(`  Emoji assigned: ${emojiAssigned}`, "info");
          break;
        }

        case "View emoji history (24h)": {
          const recentEmojis = getRecentEmojis(ctx);
          const entries = ctx.sessionManager.getEntries();
          const history: EmojiHistoryEntry[] = [];
          
          const now = Date.now();
          const oneDayAgo = now - (24 * 60 * 60 * 1000);
          
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
          
          ctx.ui.notify(`Emoji history (past 24h): ${history.length} sessions\n`, "info");
          history
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 10)
            .forEach((item) => {
              const timeAgo = Math.round((now - item.timestamp) / (60 * 1000));
              const timeStr = timeAgo < 60 
                ? `${timeAgo}m ago` 
                : `${Math.round(timeAgo / 60)}h ago`;
              const contextPreview = item.context.slice(0, 40);
              ctx.ui.notify(`  ${item.emoji} - ${timeStr} - "${contextPreview}..."`, "info");
            });
          break;
        }

        case "Force new emoji now": {
          const config = getConfig(ctx);
          if (!config.enabled) {
            ctx.ui.notify("Session emoji is disabled in settings", "error");
            return;
          }
          
          const confirm = await ctx.ui.confirm(
            "Assign new emoji?",
            "This will replace the current session emoji"
          );
          if (!confirm) return;
          
          // Reset state and force assignment
          emojiAssigned = false;
          await assignEmoji(ctx, config);
          ctx.ui.notify("New emoji assigned! Check the footer status line.", "success");
          break;
        }
      }
    }
  });

  /**
   * /emoji-test - Preview emoji sets
   */
  pi.registerCommand("emoji-test", {
    description: "Preview available emoji sets",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("This command requires interactive mode", "error");
        return;
      }

      const sets = ["default", "animals", "tech", "fun"];
      const previews = sets.map(set => {
        const emojis = EMOJI_SETS[set as keyof typeof EMOJI_SETS];
        return `${set}: ${emojis.join(" ")}`;
      });

      ctx.ui.notify("Available emoji sets:\n", "info");
      previews.forEach(preview => ctx.ui.notify(preview, "info"));
      ctx.ui.notify("\nTo configure, use: /emoji", "info");
    }
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
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      
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
      
      const recentEmojis = new Set(history.map(h => h.emoji));
      ctx.ui.notify(`📊 Emoji History (past 24h)\n`, "info");
      ctx.ui.notify(`Total sessions: ${history.length}`, "info");
      ctx.ui.notify(`Unique emojis: ${recentEmojis.size}`, "info");
      ctx.ui.notify(`\nRecent sessions (newest first):\n`, "info");
      
      history
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 15)
        .forEach((item, idx) => {
          const timeAgo = Math.round((now - item.timestamp) / (60 * 1000));
          const timeStr = timeAgo < 60 
            ? `${timeAgo}m ago` 
            : `${Math.round(timeAgo / 60)}h ago`;
          const contextPreview = item.context.slice(0, 50);
          const isCurrent = item.sessionId === ctx.sessionManager.getSessionId();
          const marker = isCurrent ? " (current)" : "";
          ctx.ui.notify(`${idx + 1}. ${item.emoji} - ${timeStr}${marker}`, "info");
          ctx.ui.notify(`   "${contextPreview}..."`, "info");
        });
    }
  });
}
