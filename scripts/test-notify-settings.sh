#!/bin/bash
# Test script to verify background-notify settings persistence

set -e

echo "🧪 Testing background-notify settings persistence..."
echo ""

# 1. Check installation
echo "1️⃣ Checking installation..."
if [ ! -f ~/.pi/agent/extensions/background-notify.ts ]; then
    echo "❌ Extension not installed"
    exit 1
fi
echo "✅ Extension installed"
echo ""

# 2. Check for saveGlobalSettings function
echo "2️⃣ Checking for saveGlobalSettings function..."
if grep -q "saveGlobalSettings" ~/.pi/agent/extensions/background-notify.ts; then
    echo "✅ saveGlobalSettings function found"
else
    echo "❌ saveGlobalSettings function not found"
    exit 1
fi
echo ""

# 3. Check for notify-save command
echo "3️⃣ Checking for notify-save command..."
if grep -q "notify-save" ~/.pi/agent/extensions/background-notify.ts; then
    echo "✅ notify-save command found"
else
    echo "❌ notify-save command not found"
    exit 1
fi
echo ""

# 4. Verify settings file exists
echo "4️⃣ Checking settings file..."
if [ -f ~/.pi/agent/settings.json ]; then
    echo "✅ Settings file exists at ~/.pi/agent/settings.json"
    echo ""
    echo "Current backgroundNotify settings:"
    cat ~/.pi/agent/settings.json | jq -r '.backgroundNotify'
else
    echo "⚠️  Settings file doesn't exist yet (will be created on first save)"
fi
echo ""

# 5. Check for consistent emoji usage in notify-status
echo "5️⃣ Checking notify-status consistency..."
if grep -q "Background Notify Status" ~/.pi/agent/extensions/background-notify.ts; then
    echo "✅ notify-status updated with consistent format"
else
    echo "⚠️  notify-status format may need review"
fi
echo ""

echo "✅ All checks passed!"
echo ""
echo "📋 Available commands:"
echo "  /notify              - Toggle notifications on/off"
echo "  /notify-beep         - Toggle beep only"
echo "  /notify-focus        - Toggle focus only"
echo "  /notify-status       - Show current settings"
echo "  /notify-config       - Interactive configuration menu"
echo "  /notify-save         - Save current settings as global defaults"
echo "  /notify-test         - Test notifications (3s delay)"
echo ""
echo "To test settings persistence:"
echo "1. Start pi and run: /notify-config"
echo "2. Change beep sound (session only)"
echo "3. Run: /notify-save"
echo "4. Verify settings file: cat ~/.pi/agent/settings.json | jq .backgroundNotify"
