#!/usr/bin/env node

/**
 * Fix esbuild CommonJS export for pi extensions
 *
 * esbuild with --format=cjs wraps default exports in a { default: fn } object.
 * Pi's extension loader expects the factory function directly.
 * This script fixes the export after esbuild builds.
 */

import { readFileSync, writeFileSync } from "node:fs";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/fix-export.js <path-to-built-file>");
  process.exit(1);
}

try {
  let content = readFileSync(filePath, "utf8");

  // Replace the problematic export line
  const oldExport = "module.exports = __toCommonJS(index_exports);";
  const newExport = "module.exports = index_default;";

  if (content.includes(oldExport)) {
    content = content.replace(oldExport, newExport);
    writeFileSync(filePath, content, "utf8");
    console.log(`✓ Fixed export in ${filePath}`);
  } else {
    console.log(`ℹ No changes needed in ${filePath}`);
  }
} catch (error) {
  console.error(`✗ Error fixing export in ${filePath}:`, error.message);
  process.exit(1);
}
