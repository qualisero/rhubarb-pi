# Release Checklist

Use this checklist when preparing a new release.

## Pre-Release

- [ ] All tests pass: `npm run verify`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Hooks tested locally: `npm run install:all` + restart pi
- [ ] Interactive commands tested: `/emoji`, `/notify`, etc.
- [ ] Documentation updated:
  - [ ] README.md reflects new features
  - [ ] Individual hook READMEs updated
  - [ ] CHANGELOG.md has entry for this version
  - [ ] All code comments are accurate
- [ ] Version numbers consistent:
  - [ ] package.json
  - [ ] CHANGELOG.md
  - [ ] README.md badges
- [ ] No uncommitted changes
- [ ] On main branch (or ready to merge)

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): New features, backward compatible
- **PATCH** (0.0.X): Bug fixes, backward compatible

Examples:
- `1.0.0` → `1.1.0`: Added new hook
- `1.1.0` → `1.1.1`: Fixed bug in existing hook
- `1.1.0` → `2.0.0`: Changed hook API (breaking)

## Release Steps

1. **Update version**:
   ```bash
   npm version X.Y.Z --no-git-tag-version
   ```

2. **Update CHANGELOG.md**:
   - Add section for new version
   - Include date: `## [X.Y.Z] - YYYY-MM-DD`
   - List changes under: Added, Changed, Fixed, Removed
   - Move items from "Unreleased" section

3. **Verify everything**:
   ```bash
   npm run verify
   npm run typecheck
   ```

4. **Run release script**:
   ```bash
   ./scripts/release.sh X.Y.Z
   ```
   This will:
   - Commit version changes
   - Create git tag
   - Show next steps

5. **Review changes**:
   ```bash
   git show HEAD
   git show vX.Y.Z
   ```

6. **Push to GitHub**:
   ```bash
   git push origin main
   git push origin vX.Y.Z
   ```

7. **Monitor GitHub Actions**:
   - Check CI workflow passes
   - Check Release workflow creates release
   - Verify release appears on GitHub

## Post-Release

- [ ] GitHub release created automatically
- [ ] Release notes extracted from CHANGELOG
- [ ] Tag appears on GitHub
- [ ] CI passes on release tag
- [ ] Installation works: `git clone` + `npm run install:all`
- [ ] Announce release (if major version)
- [ ] Close related issues/PRs

## Rollback (if needed)

If something goes wrong:

```bash
# Delete tag locally
git tag -d vX.Y.Z

# Delete tag on GitHub
git push origin :refs/tags/vX.Y.Z

# Revert commit
git reset --hard HEAD~1

# Delete GitHub release manually
```

## Common Issues

### CI Fails

- Check TypeScript compilation errors
- Check missing files
- Check version mismatches

### Release Notes Missing

- Ensure CHANGELOG.md has section for version
- Ensure version format matches: `## [X.Y.Z]`
- Check GitHub Actions workflow logs

### Tag Already Exists

```bash
# Delete and recreate
git tag -d vX.Y.Z
git tag -a vX.Y.Z -m "Release version X.Y.Z"
git push origin vX.Y.Z --force
```

## Hotfix Process

For urgent fixes:

1. Create hotfix branch: `git checkout -b hotfix/X.Y.Z`
2. Make fix
3. Update CHANGELOG.md
4. Bump patch version
5. Follow normal release process
6. Merge back to main

## Resources

- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
