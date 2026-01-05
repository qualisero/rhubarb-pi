#!/bin/bash
# Verification script to check the reorganization

echo "=== Pi Hooks Repository Structure Verification ==="
echo ""

# Check directory structure
echo "📁 Checking directory structure..."
for dir in hooks hooks/background-notify hooks/session-emoji scripts docs; do
    if [ -d "$dir" ]; then
        echo "  ✓ $dir/"
    else
        echo "  ✗ Missing: $dir/"
    fi
done
echo ""

# Check hook files
echo "📄 Checking hook files..."
for file in hooks/background-notify/index.ts hooks/session-emoji/index.ts; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ Missing: $file"
    fi
done
echo ""

# Check documentation
echo "📚 Checking documentation..."
for doc in README.md CHANGELOG.md docs/INSTALL.md docs/EXAMPLES.md docs/ARCHITECTURE.md docs/SUMMARY.md; do
    if [ -f "$doc" ]; then
        echo "  ✓ $doc"
    else
        echo "  ✗ Missing: $doc"
    fi
done
echo ""

# Check scripts
echo "🔧 Checking scripts..."
for script in scripts/install.sh scripts/uninstall.sh; do
    if [ -f "$script" ] && [ -x "$script" ]; then
        echo "  ✓ $script (executable)"
    elif [ -f "$script" ]; then
        echo "  ⚠ $script (not executable)"
    else
        echo "  ✗ Missing: $script"
    fi
done
echo ""

# Check package.json scripts
echo "📦 Checking npm scripts..."
if [ -f "package.json" ]; then
    echo "  Root package.json:"
    for cmd in install:all install:background-notify install:session-emoji uninstall:all; do
        if grep -q "\"$cmd\"" package.json; then
            echo "    ✓ npm run $cmd"
        else
            echo "    ✗ Missing: $cmd"
        fi
    done
fi
echo ""

# Check hook package.json
for hook in background-notify session-emoji; do
    if [ -f "hooks/$hook/package.json" ]; then
        echo "  hooks/$hook/package.json:"
        for cmd in install:global install:project uninstall:global uninstall:project; do
            if grep -q "\"$cmd\"" "hooks/$hook/package.json"; then
                echo "    ✓ npm run $cmd"
            else
                echo "    ✗ Missing: $cmd"
            fi
        done
    fi
done
echo ""

# Summary
echo "=== Verification Complete ==="
echo ""
echo "Next steps:"
echo "  1. Review the changes: cat CHANGELOG.md"
echo "  2. Test installation: npm run install:all"
echo "  3. Configure hooks in ~/.pi/agent/settings.json"
echo "  4. Restart pi to load the hooks"
echo ""
