#!/bin/bash
# Unified installer for Rhubarb Pi hooks + extensions

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_DIR="$SCRIPT_DIR/../hooks"
EXTENSIONS_DIR="$SCRIPT_DIR/../extensions"
INSTALL_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent/extensions}"

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
            echo "Install Rhubarb Pi modules (hooks and extensions) to pi agent."
            echo ""
            echo "Options:"
            echo "  --dry-run      Show what would be installed without actually installing"
            echo "  -v, --verbose  Show detailed output"
            echo "  --help         Show this help message"
            echo ""
            echo "Arguments:"
            echo "  module...      Specific modules to install (default: all)"
            echo ""
            echo "Available modules:"
            for dir in "$HOOKS_DIR"/* "$EXTENSIONS_DIR"/*; do
                if [ -d "$dir" ]; then
                    echo "  - $(basename "$dir")"
                fi
            done
            exit 0
            ;;
        --)
            shift
            break
            ;;
        -*)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
        *)
            break
            ;;
    esac
done

# Create install directory if it doesn't exist
if [ "$DRY_RUN" = false ]; then
    mkdir -p "$INSTALL_DIR"
else
    print_info "Would create: $INSTALL_DIR"
fi

# Function to install a single module (hook or extension)
install_module() {
    local module_name=$1
    local module_source=""
    local module_type=""

    # Try hooks first, then extensions
    if [ -f "$HOOKS_DIR/$module_name/index.ts" ]; then
        module_source="$HOOKS_DIR/$module_name/index.ts"
        module_type="hook"
    elif [ -f "$EXTENSIONS_DIR/$module_name/index.ts" ]; then
        module_source="$EXTENSIONS_DIR/$module_name/index.ts"
        module_type="extension"
    else
        print_error "Module not found: $module_name"
        return 1
    fi

    local module_dest="$INSTALL_DIR/$module_name.ts"

    if [ "$VERBOSE" = true ]; then
        print_info "Checking for: $module_source"
    fi

    if [ "$DRY_RUN" = false ]; then
        cp "$module_source" "$module_dest"
        print_success "Installed $module_name ($module_type) to $module_dest"
    else
        print_info "Would copy: $module_source → $module_dest"
    fi
}

# Main installation logic
if [ "$#" -eq 0 ]; then
    # Install all modules
    echo "Installing all modules..."
    echo ""

    # Install hooks
    if [ -d "$HOOKS_DIR" ]; then
        for module_dir in "$HOOKS_DIR"/*; do
            if [ -d "$module_dir" ]; then
                module_name=$(basename "$module_dir")
                install_module "$module_name"
            fi
        done
    else
        print_warning "Hooks directory not found: $HOOKS_DIR"
    fi

    # Install extensions
    if [ -d "$EXTENSIONS_DIR" ]; then
        for module_dir in "$EXTENSIONS_DIR"/*; do
            if [ -d "$module_dir" ]; then
                module_name=$(basename "$module_dir")
                install_module "$module_name"
            fi
        done
    else
        print_warning "Extensions directory not found: $EXTENSIONS_DIR"
    fi
else
    # Install specific modules
    for module_name in "$@"; do
        install_module "$module_name"
    done
fi

echo ""
print_warning "Remember to restart pi for modules to be loaded!"
