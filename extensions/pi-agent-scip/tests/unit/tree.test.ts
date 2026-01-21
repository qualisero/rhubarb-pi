import { describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { scip } from '@sourcegraph/scip-typescript/dist/src/scip.js';
import { ScipQuery } from '../../src/core/query.js';

function createIndex(projectRoot: string) {
  const doc = new scip.Document({
    relative_path: 'src/app.py',
    occurrences: [
      // Class Foo
      new scip.Occurrence({
        symbol: 'scip-python python proj 0.1.0 `src.app`/Foo#',
        symbol_roles: scip.SymbolRole.Definition,
        range: [0, 0],
      }),
      // Method bar inside Foo
      new scip.Occurrence({
        symbol: 'scip-python python proj 0.1.0 `src.app`/Foo#bar().',
        symbol_roles: scip.SymbolRole.Definition,
        range: [1, 4],
      }),
      // Nested class Inner inside Foo
      new scip.Occurrence({
        symbol: 'scip-python python proj 0.1.0 `src.app`/Foo#Inner#',
        symbol_roles: scip.SymbolRole.Definition,
        range: [3, 4],
      }),
      // Method inside Inner
      new scip.Occurrence({
        symbol: 'scip-python python proj 0.1.0 `src.app`/Foo#Inner#nested_method().',
        symbol_roles: scip.SymbolRole.Definition,
        range: [4, 8],
      }),
      // Top-level function
      new scip.Occurrence({
        symbol: 'scip-python python proj 0.1.0 `src.app`/helper().',
        symbol_roles: scip.SymbolRole.Definition,
        range: [7, 0],
      }),
    ],
  });

  const index = new scip.Index({ documents: [doc] });
  const data = index.serializeBinary();

  mkdirSync(join(projectRoot, '.scip'), { recursive: true });
  writeFileSync(join(projectRoot, '.scip', 'index.scip'), Buffer.from(data));
}

function createTsIndex(projectRoot: string) {
  const doc = new scip.Document({
    relative_path: 'src/utils.ts',
    occurrences: [
      // Class MyService
      new scip.Occurrence({
        symbol: 'scip-typescript npm pkg 1.0.0 src/`utils.ts`/MyService#',
        symbol_roles: scip.SymbolRole.Definition,
        range: [0, 0],
      }),
      // Method fetchData inside MyService
      new scip.Occurrence({
        symbol: 'scip-typescript npm pkg 1.0.0 src/`utils.ts`/MyService#fetchData().',
        symbol_roles: scip.SymbolRole.Definition,
        range: [1, 4],
      }),
      // Top-level function
      new scip.Occurrence({
        symbol: 'scip-typescript npm pkg 1.0.0 src/`utils.ts`/formatDate().',
        symbol_roles: scip.SymbolRole.Definition,
        range: [5, 0],
      }),
    ],
  });

  const index = new scip.Index({ documents: [doc] });
  const data = index.serializeBinary();

  mkdirSync(join(projectRoot, '.scip'), { recursive: true });
  writeFileSync(join(projectRoot, '.scip', 'index.scip'), Buffer.from(data));
}

describe('ScipQuery.buildProjectTree', () => {
  it('builds a simple module tree with classes and functions', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pi-agent-scip-tree-'));
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'app.py'), 'class Foo:\n    def bar(self):\n        pass\n\n\ndef helper():\n    pass\n');

    createIndex(root);

    const query = new ScipQuery(root);
    const tree = await query.buildProjectTree();

    expect(tree.length).toBe(1);
    const moduleNode = tree[0];
    expect(moduleNode.kind).toBe('Module');
    expect(moduleNode.name).toBe('app');

    const classNode = moduleNode.children.find((c) => c.kind === 'Class');
    const funcNode = moduleNode.children.find((c) => c.kind === 'Function');

    expect(classNode?.name).toBe('Foo');
    expect(funcNode?.name).toBe('helper');
  });

  it('handles nested classes and methods', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pi-agent-scip-tree-nested-'));
    mkdirSync(join(root, 'src'));
    writeFileSync(
      join(root, 'src', 'app.py'),
      `class Foo:
    def bar(self):
        pass
    class Inner:
        def nested_method(self):
            pass

def helper():
    pass
`,
    );

    createIndex(root);

    const query = new ScipQuery(root);
    const tree = await query.buildProjectTree();

    expect(tree.length).toBe(1);
    const moduleNode = tree[0];

    // Find Foo class
    const fooClass = moduleNode.children.find((c) => c.kind === 'Class' && c.name === 'Foo');
    expect(fooClass).toBeDefined();

    // Foo should have bar method
    const barMethod = fooClass?.children.find((c) => c.kind === 'Method' && c.name === 'bar');
    expect(barMethod).toBeDefined();

    // Top-level helper function
    const helperFunc = moduleNode.children.find((c) => c.kind === 'Function' && c.name === 'helper');
    expect(helperFunc).toBeDefined();
  });

  it('handles multiple modules', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pi-agent-scip-tree-multi-'));
    mkdirSync(join(root, 'src', 'pkg'), { recursive: true });
    writeFileSync(join(root, 'src', 'app.py'), 'def main(): pass\n');
    writeFileSync(join(root, 'src', 'pkg', 'utils.py'), 'def util(): pass\n');

    // Create index with two documents
    const doc1 = new scip.Document({
      relative_path: 'src/app.py',
      occurrences: [
        new scip.Occurrence({
          symbol: 'scip-python python proj 0.1.0 `src.app`/main().',
          symbol_roles: scip.SymbolRole.Definition,
          range: [0, 0],
        }),
      ],
    });

    const doc2 = new scip.Document({
      relative_path: 'src/pkg/utils.py',
      occurrences: [
        new scip.Occurrence({
          symbol: 'scip-python python proj 0.1.0 `src.pkg.utils`/util().',
          symbol_roles: scip.SymbolRole.Definition,
          range: [0, 0],
        }),
      ],
    });

    const index = new scip.Index({ documents: [doc1, doc2] });
    mkdirSync(join(root, '.scip'), { recursive: true });
    writeFileSync(join(root, '.scip', 'index.scip'), Buffer.from(index.serializeBinary()));

    const query = new ScipQuery(root);
    const tree = await query.buildProjectTree();

    expect(tree.length).toBe(2);
    const appModule = tree.find((m) => m.name === 'app');
    const utilsModule = tree.find((m) => m.name === 'pkg.utils');

    expect(appModule).toBeDefined();
    expect(utilsModule).toBeDefined();
    expect(appModule?.children.some((c) => c.name === 'main')).toBe(true);
    expect(utilsModule?.children.some((c) => c.name === 'util')).toBe(true);
  });

  it('handles TypeScript files with classes and functions', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pi-agent-scip-tree-ts-'));
    mkdirSync(join(root, 'src'));
    writeFileSync(
      join(root, 'src', 'utils.ts'),
      `class MyService {
  fetchData(): void {}
}

export function formatDate(date: Date): string {
  return date.toISOString();
}
`,
    );

    createTsIndex(root);

    const query = new ScipQuery(root);
    const tree = await query.buildProjectTree();

    expect(tree.length).toBe(1);
    const moduleNode = tree[0];
    expect(moduleNode.kind).toBe('Module');
    expect(moduleNode.name).toBe('utils');
    expect(moduleNode.file).toBe('src/utils.ts');

    const classNode = moduleNode.children.find((c) => c.kind === 'Class');
    const funcNode = moduleNode.children.find((c) => c.kind === 'Function');

    expect(classNode?.name).toBe('MyService');
    expect(funcNode?.name).toBe('formatDate');
  });

  it('handles Vue and JSX files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'pi-agent-scip-tree-vue-'));
    mkdirSync(join(root, 'src', 'components'), { recursive: true });

    // Create index with Vue and JSX files
    const doc1 = new scip.Document({
      relative_path: 'src/components/Header.vue',
      occurrences: [
        new scip.Occurrence({
          symbol: 'scip-typescript npm pkg 1.0.0 src/components/`Header.vue`/setup().',
          symbol_roles: scip.SymbolRole.Definition,
          range: [0, 0],
        }),
      ],
    });

    const doc2 = new scip.Document({
      relative_path: 'src/App.tsx',
      occurrences: [
        new scip.Occurrence({
          symbol: 'scip-typescript npm pkg 1.0.0 src/`App.tsx`/App().',
          symbol_roles: scip.SymbolRole.Definition,
          range: [0, 0],
        }),
      ],
    });

    const index = new scip.Index({ documents: [doc1, doc2] });
    mkdirSync(join(root, '.scip'), { recursive: true });
    writeFileSync(join(root, '.scip', 'index.scip'), Buffer.from(index.serializeBinary()));

    const query = new ScipQuery(root);
    const tree = await query.buildProjectTree();

    expect(tree.length).toBe(2);
    const headerModule = tree.find((m) => m.name === 'components.Header');
    const appModule = tree.find((m) => m.name === 'App');

    expect(headerModule).toBeDefined();
    expect(appModule).toBeDefined();
    expect(headerModule?.file).toBe('src/components/Header.vue');
    expect(appModule?.file).toBe('src/App.tsx');
  });
});
