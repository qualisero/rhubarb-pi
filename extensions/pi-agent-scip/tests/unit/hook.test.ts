import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promises as fs } from 'node:fs';

// Re-implement detectLanguages here for direct testing (same logic as in hook.ts)
interface DetectedLanguages {
  python: boolean;
  typescript: boolean;
}

async function detectLanguages(cwd: string): Promise<DetectedLanguages> {
  const result: DetectedLanguages = { python: false, typescript: false };

  try {
    // Check for Python
    const pyproject = join(cwd, 'pyproject.toml');
    const setup = join(cwd, 'setup.py');

    const hasPyproject = await fs.access(pyproject).then(() => true).catch(() => false);
    const hasSetup = await fs.access(setup).then(() => true).catch(() => false);

    if (hasPyproject || hasSetup) {
      result.python = true;
    } else {
      const srcDir = join(cwd, 'src');
      const srcEntries = await fs.readdir(srcDir).catch(() => [] as string[]);
      if (srcEntries.some((e) => e.endsWith('.py'))) {
        result.python = true;
      } else {
        const rootEntries = await fs.readdir(cwd);
        if (rootEntries.some((e) => e.endsWith('.py'))) {
          result.python = true;
        }
      }
    }

    // Check for TypeScript/JavaScript
    const tsconfig = join(cwd, 'tsconfig.json');
    const jsconfig = join(cwd, 'jsconfig.json');
    const packageJson = join(cwd, 'package.json');

    const hasTsconfig = await fs.access(tsconfig).then(() => true).catch(() => false);
    const hasJsconfig = await fs.access(jsconfig).then(() => true).catch(() => false);

    if (hasTsconfig || hasJsconfig) {
      result.typescript = true;
    } else {
      try {
        const content = await fs.readFile(packageJson, 'utf-8');
        const pkg = JSON.parse(content);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['typescript']) {
          result.typescript = true;
        }
      } catch {
        // No package.json or invalid JSON
      }

      if (!result.typescript) {
        const srcDir = join(cwd, 'src');
        const srcEntries = await fs.readdir(srcDir).catch(() => [] as string[]);
        if (srcEntries.some((e) => e.endsWith('.ts') || e.endsWith('.tsx'))) {
          result.typescript = true;
        } else {
          const rootEntries = await fs.readdir(cwd);
          if (rootEntries.some((e) => e.endsWith('.ts') || e.endsWith('.tsx'))) {
            result.typescript = true;
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return result;
}

describe('detectLanguages', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'pi-agent-scip-hook-'));
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('Python detection', () => {
    it('detects pyproject.toml', async () => {
      writeFileSync(join(testDir, 'pyproject.toml'), '[project]\nname = "test"\n');
      const result = await detectLanguages(testDir);
      expect(result.python).toBe(true);
    });

    it('detects setup.py', async () => {
      writeFileSync(join(testDir, 'setup.py'), 'from setuptools import setup\nsetup()\n');
      const result = await detectLanguages(testDir);
      expect(result.python).toBe(true);
    });

    it('detects .py files in src/', async () => {
      mkdirSync(join(testDir, 'src'));
      writeFileSync(join(testDir, 'src', 'main.py'), '# python file');
      const result = await detectLanguages(testDir);
      expect(result.python).toBe(true);
    });

    it('detects .py files in root', async () => {
      writeFileSync(join(testDir, 'app.py'), '# python file');
      const result = await detectLanguages(testDir);
      expect(result.python).toBe(true);
    });
  });

  describe('TypeScript detection', () => {
    it('detects tsconfig.json', async () => {
      writeFileSync(join(testDir, 'tsconfig.json'), '{}');
      const result = await detectLanguages(testDir);
      expect(result.typescript).toBe(true);
    });

    it('detects jsconfig.json', async () => {
      writeFileSync(join(testDir, 'jsconfig.json'), '{}');
      const result = await detectLanguages(testDir);
      expect(result.typescript).toBe(true);
    });

    it('detects TypeScript dependency in package.json', async () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ devDependencies: { typescript: '^5.0.0' } })
      );
      const result = await detectLanguages(testDir);
      expect(result.typescript).toBe(true);
    });

    it('detects .ts files in root', async () => {
      writeFileSync(join(testDir, 'index.ts'), 'export const x = 1;');
      const result = await detectLanguages(testDir);
      expect(result.typescript).toBe(true);
    });

    it('detects .tsx files in src/', async () => {
      mkdirSync(join(testDir, 'src'));
      writeFileSync(join(testDir, 'src', 'App.tsx'), 'export const App = () => <div />;');
      const result = await detectLanguages(testDir);
      expect(result.typescript).toBe(true);
    });
  });

  describe('Multi-language detection', () => {
    it('detects both Python and TypeScript', async () => {
      writeFileSync(join(testDir, 'pyproject.toml'), '[project]\nname = "test"\n');
      writeFileSync(join(testDir, 'tsconfig.json'), '{}');
      const result = await detectLanguages(testDir);
      expect(result.python).toBe(true);
      expect(result.typescript).toBe(true);
    });
  });

  describe('Empty/non-supported projects', () => {
    it('returns false for both on empty directory', async () => {
      const result = await detectLanguages(testDir);
      expect(result.python).toBe(false);
      expect(result.typescript).toBe(false);
    });

    it('returns false for non-supported files only', async () => {
      writeFileSync(join(testDir, 'README.md'), '# Hello');
      writeFileSync(join(testDir, 'package.json'), '{}');
      const result = await detectLanguages(testDir);
      expect(result.python).toBe(false);
      expect(result.typescript).toBe(false);
    });
  });
});
