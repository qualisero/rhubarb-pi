#!/bin/bash
# Test that background-notify extension loads without debug output

echo "🧪 Testing background-notify extension..."
echo ""

# Check installation
if [ ! -f ~/.pi/agent/extensions/background-notify.ts ]; then
    echo "❌ Extension not installed at ~/.pi/agent/extensions/background-notify.ts"
    exit 1
fi

# Check for debug statements
DEBUG_COUNT=$(grep "console\." ~/.pi/agent/extensions/background-notify.ts 2>/dev/null | wc -l)
if [ "$DEBUG_COUNT" -gt 0 ]; then
    echo "❌ FAIL: Found $DEBUG_COUNT console.log statements"
    echo ""
    echo "Debug statements found:"
    grep -n "console\." ~/.pi/agent/extensions/background-notify.ts
    exit 1
else
    echo "✅ PASS: No debug statements (clean installation)"
fi

# Verify it's the correct file
if diff -q hooks/background-notify/index.ts ~/.pi/agent/extensions/background-notify.ts > /dev/null 2>&1; then
    echo "✅ PASS: Installed file matches source"
else
    echo "⚠️  WARNING: Installed file differs from source"
    echo "   This may be expected if you have local modifications"
fi

# Check that it's a file, not a directory
if [ -d ~/.pi/agent/extensions/background-notify ]; then
    echo "❌ FAIL: Old directory version still exists"
    echo "   Run: rm -rf ~/.pi/agent/extensions/background-notify"
    exit 1
else
    echo "✅ PASS: No old directory version"
fi

echo ""
echo "✅ All checks passed!"
echo ""
echo "To complete testing:"
echo "1. Restart pi"
echo "2. Run a command that takes >1 second"
echo "3. Verify no [background-notify] debug messages appear"
echo "4. Only the UI notification should appear"

