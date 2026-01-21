import { describe, expect, it } from 'vitest';
import { scip } from '@sourcegraph/scip-typescript/dist/src/scip.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import { NeedsReindexError, ScipQuery } from '../../src/core/query.js';

const createTempProject = () => mkdtempSync(join(tmpdir(), 'pi-agent-scip-query-'));

async function writeIndex(projectRoot: string, filePath: string, symbol: string) {
  const document = new scip.Document();
  document.relative_path = filePath;

  const occurrence = new scip.Occurrence();
  occurrence.symbol = symbol;
  occurrence.symbol_roles = scip.SymbolRole.Definition | scip.SymbolRole.ReadAccess;
  occurrence.range = [0, 0];

  document.occurrences = [occurrence];

  const index = new scip.Index();
  index.documents = [document];

  await fs.mkdir(join(projectRoot, '.scip'), { recursive: true });
  const buffer = Buffer.from(index.serializeBinary());
  await fs.writeFile(join(projectRoot, '.scip', 'index.scip'), buffer);
}

describe('ScipQuery', () => {
  it('finds symbol definitions from SCIP index', async () => {
    const projectRoot = createTempProject();
    const filePath = 'src/main.py';
    const symbol = 'python . pi_scip `src/main.py` Foo#bar.';

    await fs.mkdir(join(projectRoot, 'src'), { recursive: true });
    await fs.writeFile(join(projectRoot, filePath), 'def bar():\n    return 42\n');
    await writeIndex(projectRoot, filePath, symbol);

    const query = new ScipQuery(projectRoot);
    const results = await query.findDefinition('bar');

    expect(results).toHaveLength(1);
    expect(results[0]?.file).toBe(filePath);
    expect(results[0]?.snippet.trim()).toBe('def bar():');
  });

  it('finds references', async () => {
    const projectRoot = createTempProject();
    const filePath = 'src/main.py';
    const symbol = 'python . pi_scip `src/main.py` Class#User.';

    await fs.mkdir(join(projectRoot, 'src'), { recursive: true });
    await fs.writeFile(join(projectRoot, filePath), 'class User:\n    pass\n');
    await writeIndex(projectRoot, filePath, symbol);

    const query = new ScipQuery(projectRoot);
    const results = await query.findReferences('User');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.file).toBe(filePath);
    expect(results[0]?.role).toContain('definition');
  });

  it('throws NeedsReindexError when index is missing', async () => {
    const projectRoot = createTempProject();
    const query = new ScipQuery(projectRoot);

    await expect(query.findDefinition('anything')).rejects.toBeInstanceOf(NeedsReindexError);
  });
});
