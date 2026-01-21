import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scip } from '@sourcegraph/scip-typescript/dist/src/scip.js';
import { parseScipSymbol, roleDescription, roleIsDefinition } from './symbols.js';

export interface Definition {
  symbol: string;
  file: string;
  line: number;
  character: number;
  snippet: string;
}

export interface Reference {
  symbol: string;
  file: string;
  line: number;
  character: number;
  role: string;
}

export interface SymbolInfo {
  symbol: string;
  name: string;
  kind: string;
  file: string;
  line: number;
  character: number;
}

export interface SearchResult extends SymbolInfo {}

export interface CodeTreeNode {
  kind: 'Package' | 'Module' | 'Class' | 'Function' | 'Method' | 'Parameter' | 'Variable';
  name: string;
  file?: string;
  line?: number;
  character?: number;
  children: CodeTreeNode[];
}

export class NeedsReindexError extends Error {
  constructor(message: string) {
    super(`SCIP index appears corrupted or outdated: ${message}`);
    this.name = 'NeedsReindexError';
  }
}

export class ScipQuery {
  private index: any | null = null;

  constructor(private readonly projectRoot: string) {}

  get indexPath() {
    return join(this.projectRoot, '.scip', 'index.scip');
  }

  async indexExists(): Promise<boolean> {
    try {
      await readFile(this.indexPath);
      return true;
    } catch {
      return false;
    }
  }

  async loadIndex(): Promise<void> {
    if (this.index) return;

    try {
      const data = await readFile(this.indexPath);
      this.index = scip.Index.deserializeBinary(data);
    } catch (error) {
      this.index = null;
      throw new NeedsReindexError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  clearCache() {
    this.index = null;
  }

  async findDefinition(symbol: string, contextFile?: string): Promise<Definition[]> {
    await this.loadIndex();
    if (!this.index) return [];

    const normalized = this.normalizeSymbol(symbol);
    const documents = this.index.documents ?? [];
    const definitions: Definition[] = [];

    for (const document of documents) {
      const relativePath = document?.relative_path ?? '';
      const occurrences = document?.occurrences ?? [];

      for (const occurrence of occurrences) {
        const scipSymbol = occurrence?.symbol ?? '';
        if (!this.matchesSymbol(scipSymbol, normalized, contextFile, relativePath)) continue;

        const roles = occurrence?.symbol_roles ?? 0;
        if (!roleIsDefinition(roles)) continue;

        const [line = 0, character = 0] = occurrence?.range ?? [];
        definitions.push({
          symbol: scipSymbol,
          file: relativePath,
          line,
          character,
          snippet: await this.getCodeSnippet(relativePath, line),
        });
      }
    }

    return definitions;
  }

  async findReferences(symbol: string): Promise<Reference[]> {
    await this.loadIndex();
    if (!this.index) return [];

    const normalized = this.normalizeSymbol(symbol);
    const documents = this.index.documents ?? [];
    const references: Reference[] = [];

    for (const document of documents) {
      const relativePath = document?.relative_path ?? '';
      const occurrences = document?.occurrences ?? [];

      for (const occurrence of occurrences) {
        const scipSymbol = occurrence?.symbol ?? '';
        if (!this.matchesSymbol(scipSymbol, normalized, undefined, relativePath)) continue;

        const [line = 0, character = 0] = occurrence?.range ?? [];
        const roles = occurrence?.symbol_roles ?? 0;

        references.push({
          symbol: scipSymbol,
          file: relativePath,
          line,
          character,
          role: roleDescription(roles),
        });
      }
    }

    return references;
  }

  async listSymbols(file: string): Promise<SymbolInfo[]> {
    await this.loadIndex();
    if (!this.index) return [];

    const documents = this.index.documents ?? [];
    const target = documents.find((doc: any) => doc?.relative_path === file);
    if (!target) return [];

    const occurrences = target.occurrences ?? [];
    const seen = new Map<string, SymbolInfo>();

    for (const occurrence of occurrences) {
      const scipSymbol = occurrence?.symbol ?? '';
      const roles = occurrence?.symbol_roles ?? 0;
      if (!roleIsDefinition(roles)) continue;

      if (seen.has(scipSymbol)) continue;

      const [line = 0, character = 0] = occurrence?.range ?? [];
      const parsed = parseScipSymbol(scipSymbol);

      seen.set(scipSymbol, {
        symbol: scipSymbol,
        name: parsed.name,
        kind: parsed.kind,
        file,
        line,
        character,
      });
    }

    return Array.from(seen.values());
  }

  async searchSymbols(query: string): Promise<SearchResult[]> {
    await this.loadIndex();
    if (!this.index) return [];

    const documents = this.index.documents ?? [];
    const needle = this.normalizeSymbol(query);
    const results: SearchResult[] = [];

    for (const document of documents) {
      const relativePath = document?.relative_path ?? '';
      const occurrences = document?.occurrences ?? [];

      for (const occurrence of occurrences) {
        const scipSymbol = occurrence?.symbol ?? '';
        if (!scipSymbol) continue;

        const parsed = parseScipSymbol(scipSymbol);
        if (!this.normalizeSymbol(parsed.name).includes(needle)) continue;

        const [line = 0, character = 0] = occurrence?.range ?? [];

        results.push({
          symbol: scipSymbol,
          name: parsed.name,
          kind: parsed.kind,
          file: relativePath,
          line,
          character,
        });
      }
    }

    return results;
  }

  async buildProjectTree(): Promise<CodeTreeNode[]> {
    await this.loadIndex();
    if (!this.index) return [];

    const documents = this.index.documents ?? [];
    const modules: Map<string, CodeTreeNode> = new Map();

    for (const document of documents) {
      const relativePath = document?.relative_path ?? '';
      if (!this.isSupportedFile(relativePath)) continue;

      const moduleName = this.pathToModuleName(relativePath);
      let moduleNode = modules.get(moduleName);
      if (!moduleNode) {
        moduleNode = {
          kind: 'Module',
          name: moduleName,
          file: relativePath,
          children: [],
        };
        modules.set(moduleName, moduleNode);
      }

      const occurrences = document?.occurrences ?? [];
      const classNodes: Map<string, CodeTreeNode> = new Map();
      const topLevelChildren: CodeTreeNode[] = [];

      for (const occurrence of occurrences) {
        const scipSymbol = occurrence?.symbol ?? '';
        if (!scipSymbol) continue;

        const roles = occurrence?.symbol_roles ?? 0;
        if (!roleIsDefinition(roles)) continue;

        const [line = 0, character = 0] = occurrence?.range ?? [];
        const parsed = parseScipSymbol(scipSymbol);

        if (parsed.kind === 'Class') {
          const classNode: CodeTreeNode = {
            kind: 'Class',
            name: parsed.name,
            file: relativePath,
            line,
            character,
            children: [],
          };
          classNodes.set(parsed.name, classNode);
          topLevelChildren.push(classNode);
        } else if (parsed.kind === 'Method') {
          const className = this.extractClassFromSymbol(scipSymbol);
          let parent: CodeTreeNode | undefined;
          if (className) {
            parent = classNodes.get(className);
            if (!parent) {
              parent = {
                kind: 'Class',
                name: className,
                file: relativePath,
                children: [],
              };
              classNodes.set(className, parent);
              moduleNode.children.push(parent);
            }
          } else {
            parent = moduleNode;
          }

          parent.children.push({
            kind: 'Method',
            name: parsed.name,
            file: relativePath,
            line,
            character,
            children: [],
          });
        } else if (parsed.kind === 'Function') {
          topLevelChildren.push({
            kind: 'Function',
            name: parsed.name,
            file: relativePath,
            line,
            character,
            children: [],
          });
        }
      }

      // Ensure deterministic ordering: classes and functions sorted by name.
      topLevelChildren.sort((a, b) => a.name.localeCompare(b.name));
      moduleNode.children.push(...topLevelChildren);
    }

    return Array.from(modules.values());
  }

  private isSupportedFile(path: string): boolean {
    const supportedExtensions = ['.py', '.ts', '.tsx', '.js', '.jsx', '.vue', '.mts', '.cts', '.mjs', '.cjs'];
    return supportedExtensions.some(ext => path.endsWith(ext));
  }

  private pathToModuleName(path: string): string {
    // Remove common extensions for Python, TypeScript, JavaScript, Vue
    const withoutExt = path.replace(/\.(py|ts|tsx|js|jsx|vue|mts|cts|mjs|cjs)$/, '');
    const parts = withoutExt.split(/[\\/]+/);
    // Remove common source directory prefixes
    if (parts[0] === 'src' || parts[0] === 'lib') {
      parts.shift();
    }
    return parts.join('.');
  }

  private extractClassFromSymbol(symbol: string): string | null {
    // scip-python encodes methods as ...`pkg.mod`/Class#method().
    const backtickIdx = symbol.lastIndexOf('`');
    if (backtickIdx === -1) return null;
    const afterBacktick = symbol.slice(backtickIdx + 1);
    const slashIdx = afterBacktick.indexOf('/');
    if (slashIdx === -1) return null;
    const descriptor = afterBacktick.slice(slashIdx + 1);
    const hashIdx = descriptor.indexOf('#');
    if (hashIdx === -1) return null;
    return descriptor.slice(0, hashIdx) || null;
  }

  private normalizeSymbol(raw: string): string {
    return raw.trim().toLowerCase();
  }

  private matchesSymbol(
    scipSymbol: string,
    normalizedQuery: string,
    contextFile: string | undefined,
    relativePath: string,
  ): boolean {
    if (!scipSymbol) return false;

    const normalizedSymbol = this.normalizeSymbol(scipSymbol);
    if (contextFile && relativePath && contextFile === relativePath) {
      return normalizedSymbol.includes(normalizedQuery);
    }

    return normalizedSymbol.includes(normalizedQuery);
  }

  private async getCodeSnippet(relativePath: string, line: number): Promise<string> {
    if (!relativePath) return '';

    try {
      const fullPath = join(this.projectRoot, relativePath);
      const content = await readFile(fullPath, 'utf8');
      const lines = content.split(/\r?\n/);
      return lines[line] ?? '';
    } catch {
      return '';
    }
  }
}
