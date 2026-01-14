#!/bin/bash
# Unified uninstaller for Rhubarb Pi hooks + extensions

set -e

INSTALL_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent/extensions}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_DIR="$SCRIPT_DIR/../hooks"
EXTENSIONS_DIR="$SCRIPT_DIR/../extensions"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
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

print_info() {
    echo -e "${BLUE}→${NC} $1"
}

# Parse arguments
DRY_RUN=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--dry-run] [-v|--verbose] [--help] [module...]"
            echo ""
            echo "Uninstall Rhubarb Pi modules (hooks and extensions) from pi agent."
            echo ""
            echo "Options:"
            echo "  --dry-run      Show what would be uninstalled without actually uninstalling"
            echo "  -v, --verbose  Show detailed output"
            echo "  --help         Show this help message"
            echo ""
            echo "Arguments:"
            echo "  module...      Specific modules to uninstall (default: all)"
            exit 0
            ;;
        *)
            break
            ;;
    esac
done

# Function to uninstall a single module
uninstall_module() {
    local module_name=$1
    local module_file="$INSTALL_DIR/$module_name.ts"

    if [ "$VERBOSE" = true ]; then
        print_info "Checking for: $module_file"
    fi

    if [ -f "$module_file" ]; then
        if [ "$DRY_RUN" = false ]; then
            rm -f "$module_file"
            print_success "Uninstalled $module_name from $INSTALL_DIR"
        else
            print_info "Would remove: $module_file"
        fi
    else
        print_warning "$module_name was not installed at $module_file"
    fi
}

# Function to list all available modules
list_available_modules() {
    echo "Available modules:"
    for dir in "$HOOKS_DIR"/* "$EXTENSIONS_DIR"/*; do
        if [ -d "$dir" ]; then
            echo "  - $(basename "$dir")"
        fi
    done
}

# Main uninstallation logic
if [ "$#" -eq 0 ]; then
    # Uninstall all known modules
    echo "Uninstalling all modules..."
    echo ""

    # Uninstall hooks
    if [ -d "$HOOKS_DIR" ]; then
        for module_dir in "$HOOKS_DIR"/*; do
            if [ -d "$module_dir" ]; then
                module_name=$(basename "$module_dir")
                uninstall_module "$module_name"
            fi
        done
    else
        print_warning "Hooks directory not found: $HOOKS_DIR"
    fi

    # Uninstall extensions
    if [ -d "$EXTENSIONS_DIR" ]; then
        for module_dir in "$EXTENSIONS_DIR"/*; do
            if [ -d "$module_dir" ]; then
                module_name=$(basename "$module_dir")
                uninstall_module "$module_name"
            fi
        done
    else
        print_warning "Extensions directory not found: $EXTENSIONS_DIR"
    fi
else
    # Uninstall specific modules
    for module_name in "$@"; do
        uninstall_module "$module_name"
    done
fi

echo ""
print_warning "Restart pi for changes to take effect"
