#!/bin/bash
# Verification script for Rhubarb Pi

echo "=== Rhubarb Pi Repository Structure Verification ==="
echo ""

# Check directory structure
echo "📁 Checking directory structure..."
for dir in hooks extensions scripts docs; do
    if [ -d "$dir" ]; then
        echo "  ✓ $dir/"
    else
        echo "  ✗ Missing: $dir/"
    fi
done
echo ""

# Check hook files
echo "📄 Checking hook implementations..."
for file in hooks/background-notify/index.ts hooks/session-emoji/index.ts hooks/session-color/index.ts; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ Missing: $file"
    fi
done
echo ""

# Check extension files
echo "📄 Checking extension implementations..."
for file in extensions/safe-git/index.ts extensions/safe-rm/index.ts; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ Missing: $file"
    fi
done
echo ""

# Check documentation
echo "📚 Checking documentation..."
for doc in README.md CHANGELOG.md CONTRIBUTING.md docs/INSTALL.md docs/SUMMARY.md docs/RELEASE.md docs/ARCHITECTURE.md docs/troubleshooting.md; do
    if [ -f "$doc" ]; then
        echo "  ✓ $doc"
    else
        echo "  ✗ Missing: $doc"
    fi
done
echo ""

# Check module docs
echo "📄 Checking module documentation..."
for doc in docs/background-notify.md docs/session-emoji.md docs/session-color.md docs/safe-git.md; do
    if [ -f "$doc" ]; then
        echo "  ✓ $doc"
    else
        echo "  ⚠  Optional: $doc"
    fi
done
echo ""

# Check scripts
echo "🔧 Checking scripts..."
for script in scripts/install.sh scripts/uninstall.sh scripts/release.sh scripts/setup.sh; do
    if [ -f "$script" ] && [ -x "$script" ]; then
        echo "  ✓ $script (executable)"
    elif [ -f "$script" ]; then
        echo "  ⚠ $script (not executable - run chmod +x $script)"
    else
        echo "  ✗ Missing: $script"
    fi
done
echo ""

# Check root package.json scripts
echo "📦 Checking npm scripts in root package.json..."
if [ -f "package.json" ]; then
    echo "  Root package.json:"
    for cmd in install:all install:background-notify install:session-emoji install:session-color install:safe-git install:safe-rm uninstall:all; do
        if grep -q "\"$cmd\"" package.json; then
            echo "    ✓ npm run $cmd"
        else
            echo "    ✗ Missing: $cmd"
        fi
    done
fi
echo ""

# Check hook package.json files
echo "📦 Checking hook package.json files..."
for hook in background-notify session-emoji session-color; do
    if [ -f "hooks/$hook/package.json" ]; then
        echo "  hooks/$hook/package.json:"
        for cmd in install:global install:project uninstall:global uninstall:project; do
            if grep -q "\"$cmd\"" "hooks/$hook/package.json"; then
                echo "    ✓ npm run $cmd"
            else
                echo "    ✗ Missing: $cmd"
            fi
        done
    else
        echo "  ✗ Missing: hooks/$hook/package.json"
    fi
done
echo ""

# Check extension package.json files
echo "📦 Checking extension package.json files..."
for ext in safe-git safe-rm; do
    if [ -f "extensions/$ext/package.json" ]; then
        echo "  extensions/$ext/package.json:"
        for cmd in install:global uninstall:global; do
            if grep -q "\"$cmd\"" "extensions/$ext/package.json"; then
                echo "    ✓ npm run $cmd"
            else
                echo "    ✗ Missing: $cmd"
            fi
        done
    else
        echo "  ⚠  Optional: extensions/$ext/package.json"
    fi
done
echo ""

# Check for outdated naming references
echo "🔍 Checking for outdated naming..."
if rg -q "pi-hooks|dave-pi-hooks" --glob='!node_modules/**' --glob='!.git/**' 2>/dev/null; then
    echo "  ⚠  Found 'pi-hooks' or 'dave-pi-hooks' references (in docs or historical notes):"
    rg -n "pi-hooks|dave-pi-hooks" --glob='!node_modules/**' --glob='!.git/**' | head -10
else
    echo "  ✓ No outdated naming references found"
fi
echo ""

# Summary
echo "=== Verification Complete ==="
echo ""
echo "Next steps:"
echo "  1. Fix any missing files or scripts marked with ✗"
echo "  2. Run npm scripts: npm run typecheck && npm run verify"
echo "  3. Test installation: npm run install:all"
echo "  4. Configure modules in ~/.pi/agent/settings.json"
echo "  5. Restart pi to load the modules"
echo ""
