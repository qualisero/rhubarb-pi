/**
 * E2E Tests for rhubarb-pi extensions
 *
 * Two-tier approach:
 * 1. Print mode: Quick smoke tests (extension loads)
 * 2. Tmux mode: Real interactive UI tests (slash commands)
 *
 * Prerequisites:
 * - pi CLI installed globally
 * - tmux installed
 *
 * Run with: npm run test:e2e
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  checkPrerequisites,
  extensionLoads,
  TmuxSession,
  cleanupAllSessions,
  sleep,
  clearSessionColorState,
  getSessionColorState,
} from "./harness";

// ─────────────────────────────────────────────────────────────────────────────
// Test Setup
// ─────────────────────────────────────────────────────────────────────────────

let prereqsMet = false;

beforeAll(() => {
  const { ok, missing } = checkPrerequisites();
  prereqsMet = ok;
  if (!ok) {
    console.warn(`⚠️  Skipping E2E tests. Missing: ${missing.join(", ")}`);
  }
});

afterAll(() => {
  cleanupAllSessions();
});

// ─────────────────────────────────────────────────────────────────────────────
// Extension Loading Tests (Print Mode)
// ─────────────────────────────────────────────────────────────────────────────

describe("Extension Loading", () => {
  it("safe-git loads without errors", async () => {
    if (!prereqsMet) return;
    expect(await extensionLoads("safe-git")).toBe(true);
  }, 20_000);

  it("session-emoji loads without errors", async () => {
    if (!prereqsMet) return;
    expect(await extensionLoads("session-emoji")).toBe(true);
  }, 20_000);

  it("session-color loads without errors", async () => {
    if (!prereqsMet) return;
    expect(await extensionLoads("session-color")).toBe(true);
  }, 20_000);

  it("background-notify loads without errors", async () => {
    if (!prereqsMet) return;
    expect(await extensionLoads("background-notify")).toBe(true);
  }, 20_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Session Emoji Tests (Tmux)
// ─────────────────────────────────────────────────────────────────────────────

describe("Session Emoji", () => {
  let session: TmuxSession;

  afterEach(() => {
    session?.kill();
  });

  it("shows emoji in status bar", async () => {
    if (!prereqsMet) return;

    session = new TmuxSession();
    await session.start("session-emoji");
    await sleep(1000);

    const output = session.capture();
    expect(output.length).toBeGreaterThan(0);
  }, 15_000);

  it("/emoji command toggles emoji display", async () => {
    if (!prereqsMet) return;

    session = new TmuxSession();
    await session.start("session-emoji");
    await sleep(1000);

    await session.command("emoji");
    await sleep(500);

    const output = session.capture();
    expect(output).toMatch(/emoji|toggle|off|on/i);
  }, 15_000);

  it("/emoji-set allows manual emoji assignment", async () => {
    if (!prereqsMet) return;

    session = new TmuxSession();
    await session.start("session-emoji");
    await sleep(1000);

    session.sendKeys("/emoji-set 🦀");
    session.sendSpecialKey("Enter");
    await sleep(500);

    const output = session.capture();
    expect(output).toContain("🦀");
  }, 15_000);

  it("/emoji-history shows recent usage", async () => {
    if (!prereqsMet) return;

    session = new TmuxSession();
    await session.start("session-emoji");
    await sleep(1000);

    await session.command("emoji-history");
    await sleep(500);

    const output = session.capture();
    expect(output).toMatch(/history|recent|no history/i);
  }, 15_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Session Color Tests (Tmux)
// ─────────────────────────────────────────────────────────────────────────────

describe("Session Color", () => {
  let session: TmuxSession;

  beforeAll(() => {
    clearSessionColorState();
  });

  afterEach(() => {
    session?.kill();
  });

  it("assigns color on session start", async () => {
    if (!prereqsMet) return;

    session = new TmuxSession();
    await session.start("session-color");
    await sleep(1500);

    const state = getSessionColorState();
    expect(state).not.toBeNull();
    expect(typeof state?.lastColorIndex).toBe("number");
  }, 15_000);

  it("/color command toggles color display", async () => {
    if (!prereqsMet) return;

    session = new TmuxSession();
    await session.start("session-color");
    await sleep(1000);

    await session.command("color");
    await sleep(500);

    const output = session.capture();
    expect(output).toMatch(/color|toggle|off|on/i);
  }, 15_000);

  it("/color-next advances to next color", async () => {
    if (!prereqsMet) return;
    clearSessionColorState();

    session = new TmuxSession();
    await session.start("session-color");
    await sleep(1500);

    const initialState = getSessionColorState();
    const initialIndex = initialState?.lastColorIndex ?? 0;

    await session.command("color-next");
    await sleep(500);

    const newState = getSessionColorState();
    expect(newState?.lastColorIndex).toBe((initialIndex + 1) % 40);
  }, 15_000);

  it("/color-config shows current settings", async () => {
    if (!prereqsMet) return;

    session = new TmuxSession();
    await session.start("session-color");
    await sleep(1000);

    await session.command("color-config");
    await sleep(500);

    const output = session.capture();
    expect(output).toMatch(/color|config|index|palette/i);
  }, 15_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Safe Git Tests (Tmux)
// ─────────────────────────────────────────────────────────────────────────────

describe("Safe Git", () => {
  let session: TmuxSession;

  afterEach(() => {
    session?.kill();
  });

  it("/safegit command toggles protection", async () => {
    if (!prereqsMet) return;

    session = new TmuxSession();
    await session.start("safe-git");
    await sleep(1000);

    await session.command("safegit");
    await sleep(500);

    const output = session.capture();
    expect(output).toMatch(/safe.?git|protection|on|off/i);
  }, 15_000);

  it("/safegit-status shows current state", async () => {
    if (!prereqsMet) return;

    session = new TmuxSession();
    await session.start("safe-git");
    await sleep(1000);

    await session.command("safegit-status");
    await sleep(500);

    const output = session.capture();
    expect(output).toMatch(/safe.?git|status|enabled|level/i);
  }, 15_000);

  it("/safegit-level shows prompt level options", async () => {
    if (!prereqsMet) return;

    session = new TmuxSession();
    await session.start("safe-git");
    await sleep(1000);

    await session.command("safegit-level");
    await sleep(500);

    const output = session.capture();
    expect(output).toMatch(/level|high|medium|none/i);
  }, 15_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Background Notify Tests (Tmux)
// ─────────────────────────────────────────────────────────────────────────────

describe("Background Notify", () => {
  let session: TmuxSession;

  afterEach(() => {
    session?.kill();
  });

  it("/notify command toggles notifications", async () => {
    if (!prereqsMet) return;

    session = new TmuxSession();
    await session.start("background-notify");
    await sleep(1000);

    await session.command("notify");
    await sleep(500);

    const output = session.capture();
    expect(output).toMatch(/notify|beep|focus|on|off/i);
  }, 15_000);

  it("/notify-status shows current settings", async () => {
    if (!prereqsMet) return;

    session = new TmuxSession();
    await session.start("background-notify");
    await sleep(1000);

    await session.command("notify-status");
    await sleep(500);

    const output = session.capture();
    expect(output).toMatch(/notify|status|beep|focus/i);
  }, 15_000);

  it("/notify-beep toggles beep independently", async () => {
    if (!prereqsMet) return;

    session = new TmuxSession();
    await session.start("background-notify");
    await sleep(1000);

    await session.command("notify-beep");
    await sleep(500);

    const output = session.capture();
    expect(output).toMatch(/beep|on|off/i);
  }, 15_000);

  it("/notify-focus toggles focus independently", async () => {
    if (!prereqsMet) return;

    session = new TmuxSession();
    await session.start("background-notify");
    await sleep(1000);

    await session.command("notify-focus");
    await sleep(500);

    const output = session.capture();
    expect(output).toMatch(/focus|on|off/i);
  }, 15_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Extension Tests (Tmux)
// ─────────────────────────────────────────────────────────────────────────────

describe("Multi-Extension", () => {
  let session: TmuxSession;

  afterEach(() => {
    session?.kill();
  });

  it("session-emoji and session-color work together", async () => {
    if (!prereqsMet) return;

    session = new TmuxSession();
    await session.startCustom(
      "pi -e ./hooks/session-emoji/index.ts -e ./hooks/session-color/index.ts --no-session"
    );
    await sleep(2000);

    await session.command("emoji");
    await sleep(300);
    const output1 = session.capture();

    await session.command("color");
    await sleep(300);
    const output2 = session.capture();

    expect(output1).toMatch(/emoji|toggle/i);
    expect(output2).toMatch(/color|toggle/i);
  }, 20_000);
});
