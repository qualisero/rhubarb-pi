# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.2.x   | :white_check_mark: |
| 1.1.x   | :white_check_mark: |
| < 1.1   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in dave-pi-hooks, please report it responsibly:

### Private Disclosure

**DO NOT** open a public issue for security vulnerabilities.

Instead, please:

1. **Email**: Send details to [your-email@example.com] with subject "SECURITY: dave-pi-hooks"
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: Within 7 days
  - High: Within 14 days
  - Medium: Within 30 days
  - Low: Next release cycle

### Disclosure Policy

- We will work with you to understand and address the issue
- We will credit you in the security advisory (unless you prefer anonymity)
- We will publicly disclose after a fix is released
- We aim for coordinated disclosure

## Security Considerations

### Hook Security

These hooks run with the same permissions as the pi coding agent:

- ✅ **No network requests** (except AI API calls when configured)
- ✅ **No file system writes** (except to pi's own data storage)
- ✅ **No arbitrary code execution**
- ✅ **No sensitive data collection**

### What We Store

**Session Emoji Hook**:
- Session emoji assignments (emoji + timestamp + brief context)
- Stored in pi's session history (local only)
- No external transmission

**Background Notify Hook**:
- No persistent data storage
- Only runtime state (current session)

### API Keys

The session emoji hook may use AI APIs:
- Uses pi's configured API keys
- Keys are accessed via `ctx.modelRegistry.getApiKey()`
- Keys are never logged or transmitted elsewhere
- AI calls are optional (fallback to random selection)

### Permissions

Hooks have access to:
- ✅ pi session data (read-only)
- ✅ Terminal UI controls
- ✅ System notifications (macOS)
- ❌ File system (except pi's data directory)
- ❌ Network (except configured AI provider)
- ❌ System commands (no shell execution)

### Best Practices

When using these hooks:

1. **Review the code** before installation
2. **Keep hooks updated** for security fixes
3. **Use official sources** (this repository)
4. **Report issues** if you find something suspicious

### Audit Trail

Installation locations:
- `~/.pi/agent/hooks/session-emoji.ts`
- `~/.pi/agent/hooks/background-notify.ts`

You can inspect installed hooks at any time:
```bash
cat ~/.pi/agent/hooks/session-emoji.ts
cat ~/.pi/agent/hooks/background-notify.ts
```

## Third-Party Dependencies

These hooks depend on:
- `@mariozechner/pi-coding-agent` - The pi agent framework
- `@mariozechner/pi-ai` - AI completion API (optional)

Both are maintained by the pi agent author and are required for hook functionality.

## Vulnerability History

None reported to date.

---

Thank you for helping keep dave-pi-hooks secure! 🔒
