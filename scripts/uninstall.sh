#!/bin/bash
# Universal hook uninstaller for Rhubarb Pi

set -e

INSTALL_DIR="$HOME/.pi/agent/hooks"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to uninstall a single hook
uninstall_hook() {
    local hook_name=$1
    local hook_file="$INSTALL_DIR/$hook_name.ts"
    
    if [ -f "$hook_file" ]; then
        rm "$hook_file"
        print_success "Uninstalled $hook_name from $INSTALL_DIR"
    else
        print_warning "$hook_name was not installed at $hook_file"
    fi
}

# Main uninstallation logic
if [ "$#" -eq 0 ]; then
    # Uninstall all known hooks
    echo "Uninstalling all hooks..."
    uninstall_hook "background-notify"
    uninstall_hook "session-emoji"
    uninstall_hook "session-color"
else
    # Uninstall specific hooks
    for hook_name in "$@"; do
        uninstall_hook "$hook_name"
    done
fi

echo ""
print_warning "Restart pi for changes to take effect"
