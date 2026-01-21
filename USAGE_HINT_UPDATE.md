# Usage Hint Update for pi-agent-scip Extension

## What Changed

The usage hint injected by the pi-agent-scip extension has been updated to:

1. **Reference `rhubarb-pi`** instead of `@qualisero/pi-agent-scip`
2. **Only show for relevant projects** - Python or TypeScript/JavaScript

## How It Works

### Language Detection (Already Implemented)
The extension detects the project type using:

**Python Detection:**
- Presence of `pyproject.toml` or `setup.py`
- OR .py files in `src/` or root directory

**TypeScript/JavaScript Detection:**
- Presence of `tsconfig.json` or `jsconfig.json`
- OR TypeScript in `dependencies`/`devDependencies` of `package.json`
- OR .ts/.tsx files in `src/` or root directory

### Hint Injection Logic
```typescript
// Inject guidance message before the first agent turn
pi.on('before_agent_start', async (_event, ctx) => {
  // ... checks if message already injected

  const languages = await detectLanguages(ctx.cwd);
  const hasAnyLanguage = languages.python || languages.typescript;
  if (!hasAnyLanguage) return;  // ← Only shows for Python/TS projects

  const languageNames: string[] = [];
  if (languages.python) languageNames.push('Python');
  if (languages.typescript) languageNames.push('TypeScript/JavaScript');

  const languageList = languageNames.join(' and ');

  // Hint references "rhubarb-pi" now
  return {
    message: {
      customType: 'pi-agent-scip-hint',
      content:
        `For this ${languageList} project, prefer the scip_* tools from rhubarb-pi for code navigation and structure: ` +
        'use scip_find_definition, scip_find_references, scip_list_symbols, scip_search_symbols, and scip_project_tree ' +
        'instead of ad-hoc text search or manual file scanning.',
      display: false,
    },
  };
});
```

### Hint Examples

| Project Type | Hint Shown |
|-------------|------------|
| Python only | Yes ("For this Python project...") |
| TypeScript only | Yes ("For this TypeScript/JavaScript project...") |
| Python + TypeScript | Yes ("For this Python and TypeScript/JavaScript project...") |
| Go only | No |
| Ruby only | No |
| Plain JavaScript (no TS) | May show if .ts files detected |

## Files Modified

- `extensions/pi-agent-scip/src/extension.ts` - Updated hint message to reference `rhubarb-pi`
- `extensions/pi-agent-scip/dist/` - Rebuilt with updated source

## Testing

To test the hint behavior:

1. **In a Python project** (e.g., with `pyproject.toml`):
   - Start pi
   - The LLM should receive the hint mentioning rhubarb-pi

2. **In a TypeScript project** (e.g., with `tsconfig.json`):
   - Start pi
   - The LLM should receive the hint mentioning rhubarb-pi

3. **In a non-relevant project** (e.g., Go project):
   - Start pi
   - No hint should be injected ( SCIP tools still available but not promoted)

## Installation

After installation, the extension works automatically:

```bash
cd /Users/dave/Projects/rhubarb-pi
npm run install:pi-agent-scip
```

Restart pi for changes to take effect.
