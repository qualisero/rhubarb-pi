#!/bin/bash
# Test script for session-emoji hook

set -e

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Session Emoji Hook Test (Enhanced) ==="
echo ""

# Check if hook is installed
GLOBAL_HOOK="$HOME/.pi/agent/hooks/session-emoji.ts"
if [ -f "$GLOBAL_HOOK" ]; then
    echo "✓ Hook found at: $GLOBAL_HOOK"
else
    echo "! Hook not found at: $GLOBAL_HOOK"
    echo "  Install with: npm run install:session-emoji"
    exit 1
fi

# Check settings
SETTINGS_FILE="$HOME/.pi/agent/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
    echo "✓ Settings file found: $SETTINGS_FILE"
    
    # Check if sessionEmoji is configured
    if grep -q "sessionEmoji" "$SETTINGS_FILE"; then
        echo "✓ sessionEmoji configuration found"
        
        # Show current mode
        if grep -A 5 "sessionEmoji" "$SETTINGS_FILE" | grep -q "\"autoAssignMode\""; then
            MODE=$(grep -A 5 "sessionEmoji" "$SETTINGS_FILE" | grep "autoAssignMode" | sed 's/.*: *"\([^"]*\)".*/\1/')
            echo "  Mode: $MODE"
        else
            echo "  Mode: ai (default)"
        fi
    else
        echo "! sessionEmoji not configured in settings"
        echo "  Add this to $SETTINGS_FILE:"
        cat example-settings.json
        exit 1
    fi
else
    echo "! Settings file not found: $SETTINGS_FILE"
    echo "  Create it with example configuration:"
    cat example-settings.json
    exit 1
fi

echo ""
echo "=== Configuration Modes ==="
echo ""
echo "Current configuration supports three modes:"
echo "  • ai (recommended) - AI selects topical emoji after N messages"
echo "  • delayed - Random emoji after N messages"
echo "  • immediate - Random emoji at session start"
echo ""
echo "Edit $SETTINGS_FILE to change mode."
echo ""

echo "=== Testing Notes ==="
echo ""
echo "For AI/delayed mode testing:"
echo "  1. Start a pi session interactively (not with -p flag)"
echo "  2. Watch footer for countdown: ⏳ /path (emoji in N messages)"
echo "  3. Send 3 messages (default threshold)"
echo "  4. Watch for loading: 🔄 /path (selecting emoji...)"
echo "  5. See result: 🎨 /path (or similar emoji)"
echo ""
echo "For immediate mode testing:"
echo "  1. Set autoAssignMode to 'immediate'"
echo "  2. Start a pi session"
echo "  3. Emoji should appear immediately in footer"
echo ""
echo "For 24h uniqueness testing:"
echo "  1. Use AI mode"
echo "  2. Create multiple sessions with /new"
echo "  3. Each should get a different emoji"
echo ""

echo "=== Quick Test (Immediate Mode) ==="
echo "Running pi in print mode to verify hook loads..."
echo ""

# Run pi with a simple prompt
pi -p "echo 'Session emoji hook test'" 2>&1 | head -20

echo ""
echo "=== Test Complete ==="
echo ""
echo "To fully test the AI emoji feature:"
echo "  1. Start pi interactively (just type: pi)"
echo "  2. Send 3 messages and watch the footer"
echo "  3. Verify emoji appears after 3rd message"
echo "  4. Use /new to start another session"
echo "  5. Verify you get a different emoji"
echo ""
echo "Did the hook load without errors? (check output above)"
