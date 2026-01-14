# Contributing to Rhubarb Pi

Thank you for your interest in contributing to Rhubarb Pi! 🎉

## Getting Started

1. **Fork the repository**
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/rhubarb-pi.git
   cd rhubarb-pi
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Project Structure

```
rhubarb-pi/
├── hooks/
│   ├── session-emoji/
│   ├── background-notify/
│   └── session-color/
├── extensions/
│   ├── safe-git/
│   └── safe-rm/
├── docs/
├── scripts/
└── README.md
```

### Making Changes

1. **Edit module code** in `hooks/*/index.ts` or `extensions/*/index.ts`
2. **Update documentation** in the corresponding README + `/docs`
3. **Test your changes**:
   ```bash
   npm run typecheck          # Verify TypeScript
   npm run verify             # Run all checks
   npm run install:all        # Install modules locally
   ```
4. **Test manually** by restarting pi and exercising the commands (`/emoji`, `/notify`, `/color`, `/safegit`, etc.)

### Code Style

- Use TypeScript for type safety
- Follow existing module patterns
- Add comments for complex logic
- Keep functions focused and readable
- Prefer descriptive variable names

### Adding a New Module

1. Create `hooks/<name>/` or `extensions/<name>/`
2. Add:
   - `index.ts` - Implementation
   - `README.md` - Documentation
   - `package.json` + scripts - Install/uninstall helpers
   - Optional: `example-settings.json`, tests, assets
3. Wire install/uninstall scripts into the root `package.json`
4. Update the main README and relevant docs
5. Test thoroughly before submitting a PR

### Documentation

- Update `CHANGELOG.md` for every notable change
- Follow existing formatting conventions
- Include examples and use cases where helpful
- Document slash commands and configuration options

## Pull Request Process

1. **Update documentation** for any behavior changes
2. **Add a CHANGELOG entry** under "Unreleased"
3. **Ensure tests pass**: `npm run verify`
4. **Create a Pull Request** that explains:
   - The problem/opportunity
   - The solution
   - How reviewers can test it
5. **Wait for review** – maintainers will provide feedback

### PR Guidelines

- ✅ One focused change per PR
- ✅ Clear commit messages
- ✅ Docs + tests updated as needed
- ✅ TypeScript compiles cleanly
- ✅ Breaking changes are clearly called out
- ❌ No unrelated drive-by edits
- ❌ No formatting-only PRs mixed with logic changes

## Testing

### Local Testing

1. **Install modules globally**:
   ```bash
   npm run install:all
   ```

2. **Restart pi** to load changes

3. **Test interactively**:
   ```bash
   /help
   /emoji
   /notify-test
   /safegit-status
   ```

4. **Test configuration changes** by editing `~/.pi/agent/settings.json`, restarting pi, and verifying behavior.

### Verification Script

Run the full verification:
```bash
./verify.sh
```

This checks:
- TypeScript compilation
- File/link structure
- Documentation presence
- Coding conventions enforced by the script

## Release Process

> Maintainers only

1. Update the version in `package.json`
2. Update `CHANGELOG.md` with release notes
3. Run `./scripts/release.sh X.Y.Z`
4. Push the resulting branch and tag to GitHub

## Getting Help

- 📖 Read the [README.md](README.md)
- 📋 Check existing [issues](https://github.com/qualisero/rhubarb-pi/issues)
- 💬 Open a new issue for questions
- 🐛 Report bugs with detailed reproduction steps

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on code, not people
- Help others learn and grow

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🚀
