#!/bin/bash
# Universal hook installer for pi-hooks

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_DIR="$SCRIPT_DIR/../hooks"
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

# Create hooks directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

# Function to install a single hook
install_hook() {
    local hook_name=$1
    local hook_source="$HOOKS_DIR/$hook_name/index.ts"
    local hook_dest="$INSTALL_DIR/$hook_name.ts"
    
    if [ ! -f "$hook_source" ]; then
        print_error "Hook source not found: $hook_source"
        return 1
    fi
    
    cp "$hook_source" "$hook_dest"
    print_success "Installed $hook_name to $hook_dest"
}

# Main installation logic
if [ "$#" -eq 0 ]; then
    # Install all hooks
    echo "Installing all hooks..."
    for hook_dir in "$HOOKS_DIR"/*; do
        if [ -d "$hook_dir" ]; then
            hook_name=$(basename "$hook_dir")
            install_hook "$hook_name"
        fi
    done
else
    # Install specific hooks
    for hook_name in "$@"; do
        install_hook "$hook_name"
    done
fi

echo ""
print_warning "Remember to restart pi for the hooks to be loaded!"
