#!/bin/bash
set -e

echo "🔧 Setup Script for Rhubarb Pi"
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
  echo "📦 Initializing git repository..."
  git init
  git add .
  git commit -m "Initial commit: Rhubarb Pi"
  echo "✅ Git repository initialized"
  echo ""
fi

# Check for git remote
if ! git remote | grep -q origin; then
  echo "⚠️  No git remote configured"
  echo ""
  echo "To set up GitHub repository:"
  echo "  1. Create a new repository on GitHub named 'rhubarb-pi'"
  echo "  2. Run:"
  echo "     git remote add origin https://github.com/YOUR_USERNAME/rhubarb-pi.git"
  echo "     git branch -M main"
  echo "     git push -u origin main"
  echo ""
else
  REMOTE_URL=$(git remote get-url origin)
  echo "✅ Git remote configured: $REMOTE_URL"
  echo ""
fi

echo "📋 Project structure:"
tree -L 2 -I '.git|.scip|node_modules' || ls -la

echo ""
echo "✅ Setup complete!"
echo ""
echo "Available commands:"
echo "  npm run install:all          - Install every hook + extension globally"
echo "  npm run install:session-emoji - Install the session emoji hook"
echo "  npm run install:background-notify - Install the background notify hook"
echo "  npm run install:session-color - Install the session color hook"
echo "  npm run install:safe-git     - Install the safe git extension"
echo "  npm run install:safe-rm      - Install the safe rm extension"
echo "  npm run typecheck            - Verify TypeScript compilation"
echo "  npm run verify               - Run all verification checks"
echo "  ./scripts/release.sh X.Y.Z   - Create a new release"
echo ""
echo "Documentation:"
echo "  README.md                    - Main documentation"
echo "  CHANGELOG.md                 - Version history"
echo "  docs/SLASH_COMMANDS.md       - Slash commands guide"
echo "  docs/BEEP_SOUNDS.md          - Alternative beep sounds"
