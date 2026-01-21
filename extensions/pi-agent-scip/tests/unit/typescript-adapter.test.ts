import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TypeScriptAdapter } from '../../src/languages/typescript.js';

describe('TypeScriptAdapter', () => {
  let testDir: string;
  let adapter: TypeScriptAdapter;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'pi-agent-scip-ts-'));
    adapter = new TypeScriptAdapter();
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('has correct name and extensions', () => {
    expect(adapter.name).toBe('typescript');
    expect(adapter.extensions).toContain('.ts');
    expect(adapter.extensions).toContain('.tsx');
    expect(adapter.extensions).toContain('.js');
    expect(adapter.extensions).toContain('.jsx');
  });

  it('reports indexer as available (bundled via npm)', async () => {
    // scip-typescript is bundled with the package
    const available = await adapter.isIndexerAvailable(testDir);
    expect(available).toBe(true);
  });

  it('returns version string', async () => {
    const version = await adapter.getIndexerVersion(testDir);
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('installIndexer succeeds without confirm callback', async () => {
    // Should not throw
    await adapter.installIndexer(testDir);
  });

  it('installIndexer succeeds with confirm returning true', async () => {
    await adapter.installIndexer(testDir, {
      confirm: async () => true,
    });
  });

  it('installIndexer throws when confirm returns false', async () => {
    await expect(
      adapter.installIndexer(testDir, {
        confirm: async () => false,
      })
    ).rejects.toThrow('cancelled');
  });
});

describe('TypeScriptAdapter workspace detection', () => {
  let testDir: string;
  let adapter: TypeScriptAdapter;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'pi-agent-scip-ws-'));
    adapter = new TypeScriptAdapter();
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('detects pnpm workspaces', async () => {
    writeFileSync(join(testDir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    const flags = await adapter.detectWorkspaceFlags(testDir);
    expect(flags).toEqual(['--pnpm-workspaces']);
  });

  it('detects yarn workspaces (no packageManager)', async () => {
    writeFileSync(
      join(testDir, 'package.json'),
      JSON.stringify({ name: 'test', workspaces: ['packages/*'] })
    );
    const flags = await adapter.detectWorkspaceFlags(testDir);
    expect(flags).toEqual(['--yarn-workspaces']);
  });

  it('detects yarn workspaces (explicit yarn packageManager)', async () => {
    writeFileSync(
      join(testDir, 'package.json'),
      JSON.stringify({
        name: 'test',
        workspaces: ['packages/*'],
        packageManager: 'yarn@4.0.0',
      })
    );
    const flags = await adapter.detectWorkspaceFlags(testDir);
    expect(flags).toEqual(['--yarn-workspaces']);
  });

  it('returns empty flags for bun workspaces', async () => {
    // Bun uses the same workspaces field but scip-typescript lacks bun support.
    // Passing --yarn-workspaces would cause `yarn workspaces info` to fail
    // when corepack detects packageManager mismatch.
    writeFileSync(
      join(testDir, 'package.json'),
      JSON.stringify({
        name: 'test',
        workspaces: ['packages/*'],
        packageManager: 'bun@1.0.0',
      })
    );
    const flags = await adapter.detectWorkspaceFlags(testDir);
    expect(flags).toEqual([]);
  });

  it('returns empty flags for npm workspaces', async () => {
    // npm 7+ supports workspaces but scip-typescript lacks --npm-workspaces.
    // Without the flag it falls back to using root tsconfig with includes.
    writeFileSync(
      join(testDir, 'package.json'),
      JSON.stringify({
        name: 'test',
        workspaces: ['packages/*'],
        packageManager: 'npm@10.0.0',
      })
    );
    const flags = await adapter.detectWorkspaceFlags(testDir);
    expect(flags).toEqual([]);
  });

  it('returns empty for non-workspace project', async () => {
    writeFileSync(join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));
    const flags = await adapter.detectWorkspaceFlags(testDir);
    expect(flags).toEqual([]);
  });

  it('returns empty when no package.json exists', async () => {
    const flags = await adapter.detectWorkspaceFlags(testDir);
    expect(flags).toEqual([]);
  });

  it('pnpm-workspace.yaml takes precedence over package.json workspaces', async () => {
    // Both exist but pnpm-workspace.yaml is checked first
    writeFileSync(join(testDir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    writeFileSync(
      join(testDir, 'package.json'),
      JSON.stringify({ name: 'test', workspaces: ['packages/*'] })
    );
    const flags = await adapter.detectWorkspaceFlags(testDir);
    expect(flags).toEqual(['--pnpm-workspaces']);
  });
});
