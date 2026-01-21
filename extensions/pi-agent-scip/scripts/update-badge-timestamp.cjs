#!/usr/bin/env node

/**
 * Update the timestamp query parameter in the npm badge URL
 * to prevent caching issues after version bumps.
 */

const fs = require('fs');
const path = require('path');

const readmePath = path.join(__dirname, '..', 'README.md');
const timestamp = Date.now();

try {
  let content = fs.readFileSync(readmePath, 'utf-8');
  
  // Match the npm badge URL with optional existing timestamp
  const badgePattern = /(\[!\[npm version\]\(https:\/\/img\.shields\.io\/npm\/v\/@qualisero\/pi-agent-scip\.svg)(\?t=\d+)?(\)\])/;
  
  if (badgePattern.test(content)) {
    content = content.replace(badgePattern, `$1?t=${timestamp}$3`);
    fs.writeFileSync(readmePath, content, 'utf-8');
    console.log(`✅ Updated npm badge timestamp to ${timestamp}`);
  } else {
    console.error('❌ Could not find npm badge in README.md');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error updating badge timestamp:', error.message);
  process.exit(1);
}
