#!/bin/bash
set -e

echo "🚀 Release Script for dave-pi-hooks"
echo ""

# Check if VERSION argument provided
if [ -z "$1" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 1.2.1"
  exit 1
fi

VERSION=$1

# Validate version format
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌ Invalid version format. Use semantic versioning (e.g., 1.2.0)"
  exit 1
fi

echo "Version: $VERSION"
echo ""

# Check if on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "⚠️  Warning: You are not on main branch (current: $CURRENT_BRANCH)"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
  echo "❌ You have uncommitted changes. Please commit or stash them first."
  git status -s
  exit 1
fi

echo "📝 Updating version in package.json..."
npm version $VERSION --no-git-tag-version

echo ""
echo "📋 Please update CHANGELOG.md with release notes for v$VERSION"
echo "   Add a section like:"
echo ""
echo "   ## [$VERSION] - $(date +%Y-%m-%d)"
echo "   ### Added"
echo "   - New feature"
echo "   ### Changed"
echo "   - Updated feature"
echo "   ### Fixed"
echo "   - Bug fix"
echo ""
read -p "Press Enter when CHANGELOG.md is updated..."

echo ""
echo "🔍 Verifying project..."
npm run verify

echo ""
echo "📦 Committing version bump..."
git add package.json CHANGELOG.md
git commit -m "chore: bump version to $VERSION"

echo ""
echo "🏷️  Creating git tag v$VERSION..."
git tag -a "v$VERSION" -m "Release version $VERSION"

echo ""
echo "✅ Release prepared!"
echo ""
echo "Next steps:"
echo "  1. Review the changes:"
echo "     git show HEAD"
echo "     git show v$VERSION"
echo ""
echo "  2. Push to GitHub:"
echo "     git push origin main"
echo "     git push origin v$VERSION"
echo ""
echo "  3. GitHub Actions will automatically create the release"
echo ""
echo "To undo if needed:"
echo "  git tag -d v$VERSION"
echo "  git reset --hard HEAD~1"
