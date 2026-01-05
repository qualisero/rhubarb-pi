# Contributing to dave-pi-hooks

Thank you for your interest in contributing to dave-pi-hooks! 🎉

## Getting Started

1. **Fork the repository**
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/dave-pi-hooks.git
   cd dave-pi-hooks
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Project Structure

```
dave-pi-hooks/
├── hooks/
│   ├── session-emoji/
│   │   ├── index.ts          # Hook implementation
│   │   ├── README.md         # Hook documentation
│   │   └── package.json      # Hook metadata
│   └── background-notify/
│       ├── index.ts
│       ├── README.md
│       └── package.json
├── docs/                     # Additional documentation
├── scripts/                  # Build and release scripts
└── README.md                 # Main documentation
```

### Making Changes

1. **Edit hook code** in `hooks/*/index.ts`
2. **Update documentation** in corresponding README.md files
3. **Test your changes**:
   ```bash
   npm run typecheck          # Verify TypeScript
   npm run verify             # Run all checks
   npm run install:all        # Install hooks locally
   ```
4. **Test manually** by restarting pi and using the hooks

### Code Style

- Use TypeScript for type safety
- Follow existing code patterns in the hooks
- Add comments for complex logic
- Keep functions focused and readable
- Use descriptive variable names

### Adding a New Hook

1. Create directory: `hooks/your-hook-name/`
2. Add files:
   - `index.ts` - Hook implementation
   - `README.md` - Hook documentation
   - `package.json` - Metadata and install scripts
   - `example-settings.json` - Configuration example
3. Update main README.md with hook description
4. Add install scripts to root package.json
5. Test thoroughly before submitting PR

### Documentation

- Update CHANGELOG.md for all changes
- Follow existing format in documentation
- Include examples and use cases
- Document all configuration options
- Add slash commands to docs/SLASH_COMMANDS.md

## Pull Request Process

1. **Update documentation** for any changes
2. **Add CHANGELOG entry** under "Unreleased" section
3. **Ensure tests pass**: `npm run verify`
4. **Create Pull Request** with clear description:
   - What problem does it solve?
   - What changes were made?
   - How to test it?
5. **Wait for review** - we'll provide feedback

### PR Guidelines

- ✅ One feature per PR (keep it focused)
- ✅ Clear commit messages
- ✅ Updated documentation
- ✅ TypeScript compiles without errors
- ✅ No breaking changes (or clearly documented)
- ❌ No unrelated changes
- ❌ No formatting-only changes mixed with logic

## Testing

### Local Testing

1. **Install hooks globally**:
   ```bash
   npm run install:all
   ```

2. **Restart pi** to load changes

3. **Test interactively**:
   ```bash
   /help                    # Verify commands appear
   /emoji                   # Test emoji commands
   /notify-test            # Test notification
   ```

4. **Test configuration changes**:
   - Edit `~/.pi/agent/settings.json`
   - Restart pi
   - Verify behavior

### Verification Script

Run the full verification:
```bash
./verify.sh
```

This checks:
- TypeScript compilation
- File structure
- Documentation presence
- Code patterns

## Release Process

**Note**: Only maintainers can create releases.

1. Update version in package.json
2. Update CHANGELOG.md with release notes
3. Run: `./scripts/release.sh X.Y.Z`
4. Push tag to trigger GitHub Actions release

## Getting Help

- 📖 Read the [README.md](README.md)
- 📋 Check existing [issues](https://github.com/your-username/dave-pi-hooks/issues)
- 💬 Open a new issue for questions
- 🐛 Report bugs with detailed reproduction steps

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🚀
