#!/bin/bash
# Fix: Remove old debug version and install clean version

set -e

echo "🔧 Fixing background-notify installation..."

# Remove old versions
if [ -d ~/.pi/agent/extensions/background-notify ]; then
    echo "  Removing old directory version: ~/.pi/agent/extensions/background-notify/"
    rm -rf ~/.pi/agent/extensions/background-notify
fi

if [ -f ~/.pi/agent/extensions/background-notify.ts ]; then
    echo "  Removing old file version: ~/.pi/agent/extensions/background-notify.ts"
    rm -f ~/.pi/agent/extensions/background-notify.ts
fi

# Create extensions directory if it doesn't exist
mkdir -p ~/.pi/agent/extensions

# Copy the clean version
echo "  Installing clean version..."
cp hooks/background-notify/index.ts ~/.pi/agent/extensions/background-notify.ts

echo "✅ Done! Please restart pi for changes to take effect."
echo ""
echo "The extension is now installed at: ~/.pi/agent/extensions/background-notify.ts"
echo "Debug output has been removed."

