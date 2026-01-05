#!/bin/bash
# Test script for background-notify hook

set -e

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Background Notify Hook Test ==="
echo ""
echo "This will test the hook by running a 6-second task."
echo "To properly test, switch to another app immediately after starting."
echo ""

# Check if hook is installed
GLOBAL_HOOK="$HOME/.pi/agent/hooks/background-notify/index.ts"
if [ -f "$GLOBAL_HOOK" ]; then
    echo "✓ Hook found at: $GLOBAL_HOOK"
else
    echo "! Hook not found at: $GLOBAL_HOOK"
    echo "  Install with: cp $HOOK_DIR/index.ts $GLOBAL_HOOK"
    exit 1
fi

# Check settings
SETTINGS_FILE="$HOME/.pi/agent/settings.json"
if [ -f "$SETTINGS_FILE" ]; then
    echo "✓ Settings file found: $SETTINGS_FILE"
    
    # Check if backgroundNotify is configured
    if grep -q "backgroundNotify" "$SETTINGS_FILE"; then
        echo "✓ backgroundNotify configuration found"
    else
        echo "! backgroundNotify not configured in settings"
        echo "  Add this to $SETTINGS_FILE:"
        cat example-settings.json
        exit 1
    fi
else
    echo "! Settings file not found: $SETTINGS_FILE"
    echo "  Create it with:"
    echo "  cp $HOOK_DIR/example-settings.json $SETTINGS_FILE"
    exit 1
fi

echo ""
echo "=== Running Test ==="
echo "1. Switch to another app (Cmd+Tab) NOW"
echo "2. Wait 6 seconds..."
echo "3. Terminal should beep and come to front"
echo ""
echo "Starting in 3 seconds..."
sleep 3

# Run pi with a long task
pi -p "Run this bash command: sleep 6 && echo 'Test complete!'"

echo ""
echo "=== Test Complete ==="
echo "Did the terminal beep and come to front? (y/n)"
read -r response

if [ "$response" = "y" ]; then
    echo "✓ Test PASSED!"
else
    echo "✗ Test FAILED - Check troubleshooting in README.md"
fi
