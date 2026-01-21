import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LanguageRegistry } from '../../src/languages/registry.js';

describe('LanguageRegistry', () => {
  let testDir: string;
  let registry: LanguageRegistry;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'pi-agent-scip-registry-'));
    registry = new LanguageRegistry();
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
      const adapters = await registry.detectLanguages(testDir);
      expect(adapters.some((a) => a.name === 'python')).toBe(true);
    });

    it('detects setup.py', async () => {
      writeFileSync(join(testDir, 'setup.py'), 'from setuptools import setup\nsetup()\n');
      const adapters = await registry.detectLanguages(testDir);
      expect(adapters.some((a) => a.name === 'python')).toBe(true);
    });

    it('detects requirements.txt', async () => {
      writeFileSync(join(testDir, 'requirements.txt'), 'requests==2.28.0\n');
      const adapters = await registry.detectLanguages(testDir);
      expect(adapters.some((a) => a.name === 'python')).toBe(true);
    });

    it('detects .py files in root', async () => {
      writeFileSync(join(testDir, 'main.py'), '# python file');
      const adapters = await registry.detectLanguages(testDir);
      expect(adapters.some((a) => a.name === 'python')).toBe(true);
    });

    it('detects .py files in src/', async () => {
      mkdirSync(join(testDir, 'src'));
      writeFileSync(join(testDir, 'src', 'main.py'), '# python file');
      const adapters = await registry.detectLanguages(testDir);
      expect(adapters.some((a) => a.name === 'python')).toBe(true);
    });
  });

  describe('TypeScript detection', () => {
    it('detects tsconfig.json', async () => {
      writeFileSync(join(testDir, 'tsconfig.json'), '{}');
      const adapters = await registry.detectLanguages(testDir);
      expect(adapters.some((a) => a.name === 'typescript')).toBe(true);
    });

    it('detects jsconfig.json', async () => {
      writeFileSync(join(testDir, 'jsconfig.json'), '{}');
      const adapters = await registry.detectLanguages(testDir);
      expect(adapters.some((a) => a.name === 'typescript')).toBe(true);
    });

    it('detects TypeScript dependency in package.json', async () => {
      writeFileSync(
        join(testDir, 'package.json'),
        JSON.stringify({ devDependencies: { typescript: '^5.0.0' } })
      );
      const adapters = await registry.detectLanguages(testDir);
      expect(adapters.some((a) => a.name === 'typescript')).toBe(true);
    });

    it('detects .ts files in root', async () => {
      writeFileSync(join(testDir, 'index.ts'), 'export const x = 1;');
      const adapters = await registry.detectLanguages(testDir);
      expect(adapters.some((a) => a.name === 'typescript')).toBe(true);
    });

    it('detects .tsx files in src/', async () => {
      mkdirSync(join(testDir, 'src'));
      writeFileSync(join(testDir, 'src', 'App.tsx'), 'export const App = () => <div />;');
      const adapters = await registry.detectLanguages(testDir);
      expect(adapters.some((a) => a.name === 'typescript')).toBe(true);
    });

    it('does not detect plain JavaScript without tsconfig', async () => {
      writeFileSync(join(testDir, 'index.js'), 'console.log("hello");');
      const adapters = await registry.detectLanguages(testDir);
      // Plain JS without any config is not detected as TypeScript project
      expect(adapters.some((a) => a.name === 'typescript')).toBe(false);
    });
  });

  describe('Multi-language detection', () => {
    it('detects both Python and TypeScript', async () => {
      writeFileSync(join(testDir, 'pyproject.toml'), '[project]\nname = "test"\n');
      writeFileSync(join(testDir, 'tsconfig.json'), '{}');
      mkdirSync(join(testDir, 'src'));
      writeFileSync(join(testDir, 'src', 'main.py'), '# python');
      writeFileSync(join(testDir, 'src', 'index.ts'), '// typescript');

      const adapters = await registry.detectLanguages(testDir);
      expect(adapters.length).toBe(2);
      expect(adapters.some((a) => a.name === 'python')).toBe(true);
      expect(adapters.some((a) => a.name === 'typescript')).toBe(true);
    });
  });

  describe('Empty project', () => {
    it('returns no adapters for empty directory', async () => {
      const adapters = await registry.detectLanguages(testDir);
      expect(adapters.length).toBe(0);
    });

    it('returns no adapters for non-supported files', async () => {
      writeFileSync(join(testDir, 'README.md'), '# Hello');
      writeFileSync(join(testDir, 'config.yaml'), 'key: value');
      const adapters = await registry.detectLanguages(testDir);
      expect(adapters.length).toBe(0);
    });
  });
});
