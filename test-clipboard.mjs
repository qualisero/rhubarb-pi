#!/usr/bin/env node

/**
 * Test script for clipboard extension
 * Simulates what pi does when calling the tool
 */

import { spawnSync } from "node:child_process";

console.log("Testing clipboard tool...\n");

// Test 1: Direct pbcopy test
console.log("Test 1: Direct pbcopy with test string");
const testText = "ffmpeg -i input.mp4 -map 0:v -map 0:a:0 -map 0:s -c:v copy -c:a copy -c:s copy output.mkv";
console.log(`Text to copy: "${testText}"`);

const result = spawnSync("pbcopy", [], {
  input: testText,
  encoding: "utf-8",
});

console.log(`Status: ${result.status}`);
console.log(`Stderr: ${result.stderr || "(none)"}`);

// Verify what's in clipboard
const pasteResult = spawnSync("pbpaste", [], {
  encoding: "utf-8",
});

console.log(`\nClipboard contents: "${pasteResult.stdout}"`);
console.log(`Match: ${pasteResult.stdout === testText ? "✅ SUCCESS" : "❌ FAILED"}`);

// Test 2: Tool name test (reproduce the bug)
console.log("\n\nTest 2: Copying just the tool name (simulating the bug)");
const bugText = "copy_to_clipboard";
const result2 = spawnSync("pbcopy", [], {
  input: bugText,
  encoding: "utf-8",
});

const pasteResult2 = spawnSync("pbpaste", [], {
  encoding: "utf-8",
});

console.log(`Text to copy: "${bugText}"`);
console.log(`Clipboard contents: "${pasteResult2.stdout}"`);
console.log(`Match: ${pasteResult2.stdout === bugText ? "✅ SUCCESS" : "❌ FAILED"}`);

// Test 3: Empty string test
console.log("\n\nTest 3: Empty string");
const result3 = spawnSync("pbcopy", [], {
  input: "",
  encoding: "utf-8",
});

const pasteResult3 = spawnSync("pbpaste", [], {
  encoding: "utf-8",
});

console.log(`Text to copy: ""`);
console.log(`Clipboard contents: "${pasteResult3.stdout}"`);
console.log(`Is empty: ${pasteResult3.stdout === "" ? "✅ SUCCESS" : "❌ FAILED"}`);
