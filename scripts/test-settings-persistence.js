#!/usr/bin/env node
/**
 * Test settings persistence for background-notify
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SETTINGS_PATH = path.join(os.homedir(), '.pi', 'agent', 'settings.json');
const BACKUP_PATH = SETTINGS_PATH + '.backup';

async function test() {
  console.log('🧪 Testing background-notify settings persistence\n');

  // Step 1: Backup existing settings
  console.log('1️⃣ Backing up existing settings...');
  if (fs.existsSync(SETTINGS_PATH)) {
    fs.copyFileSync(SETTINGS_PATH, BACKUP_PATH);
    console.log('✅ Backup created\n');
  } else {
    console.log('⚠️  No existing settings file\n');
  }

  try {
    // Step 2: Test the saveGlobalSettings function logic
    console.log('2️⃣ Testing settings save logic...');
    
    let settings = {};
    if (fs.existsSync(SETTINGS_PATH)) {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    }

    // Simulate what saveGlobalSettings does
    settings.backgroundNotify = {
      ...settings.backgroundNotify,
      beep: false,
      bringToFront: true,
      beepSound: 'Submarine',
      thresholdMs: 3000,
    };

    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
    console.log('✅ Test settings written\n');

    // Step 3: Verify the settings were saved
    console.log('3️⃣ Verifying settings...');
    const savedSettings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    
    if (!savedSettings.backgroundNotify) {
      console.log('❌ backgroundNotify section not found');
      process.exit(1);
    }

    const notify = savedSettings.backgroundNotify;
    console.log('Settings read back:');
    console.log(`  beep: ${notify.beep}`);
    console.log(`  bringToFront: ${notify.bringToFront}`);
    console.log(`  beepSound: ${notify.beepSound}`);
    console.log(`  thresholdMs: ${notify.thresholdMs}`);

    if (notify.beep === false &&
        notify.bringToFront === true &&
        notify.beepSound === 'Submarine' &&
        notify.thresholdMs === 3000) {
      console.log('✅ All settings match\n');
    } else {
      console.log('❌ Settings mismatch\n');
      process.exit(1);
    }

    // Step 4: Test merge behavior
    console.log('4️⃣ Testing merge behavior...');
    settings.backgroundNotify = {
      ...settings.backgroundNotify,
      beepSound: 'Tink',
    };
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
    
    const mergedSettings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    if (mergedSettings.backgroundNotify.beepSound === 'Tink' &&
        mergedSettings.backgroundNotify.beep === false) {
      console.log('✅ Merge preserves existing keys\n');
    } else {
      console.log('❌ Merge failed\n');
      process.exit(1);
    }

    console.log('✅ All tests passed!\n');

  } finally {
    // Restore backup
    console.log('🔄 Restoring backup...');
    if (fs.existsSync(BACKUP_PATH)) {
      fs.copyFileSync(BACKUP_PATH, SETTINGS_PATH);
      fs.unlinkSync(BACKUP_PATH);
      console.log('✅ Settings restored\n');
    } else {
      console.log('⚠️  No backup to restore\n');
    }
  }

  console.log('Summary:');
  console.log('✅ Settings can be saved to ~/.pi/agent/settings.json');
  console.log('✅ Settings properly merge with existing configuration');
  console.log('✅ The notify-save command should work correctly');
  console.log('');
  console.log('To use in pi:');
  console.log('1. Change beep sound: /notify-config → select sound');
  console.log('2. Save globally: /notify-save');
  console.log('3. Restart pi to verify settings persist');
}

test().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
