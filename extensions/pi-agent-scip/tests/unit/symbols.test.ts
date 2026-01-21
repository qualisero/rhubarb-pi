import { describe, expect, it } from 'vitest';
import { parseScipSymbol, roleDescription } from '../../src/core/symbols.js';

describe('parseScipSymbol', () => {
  it('parses class symbols', () => {
    const s = 'scip-python python myproj 0.1.0 `src.app`/Foo#';
    const parsed = parseScipSymbol(s);
    expect(parsed.name).toBe('Foo');
    expect(parsed.kind).toBe('Class');
  });

  it('parses method symbols', () => {
    const s = 'scip-python python myproj 0.1.0 `src.app`/Foo#bar().';
    const parsed = parseScipSymbol(s);
    expect(parsed.name).toBe('bar');
    expect(parsed.kind).toBe('Method');
  });

  it('parses function symbols', () => {
    const s = 'scip-python python myproj 0.1.0 `src.app`/helper().';
    const parsed = parseScipSymbol(s);
    expect(parsed.name).toBe('helper');
    expect(parsed.kind).toBe('Function');
  });

  it('parses parameter symbols as parameter kind', () => {
    const s = 'scip-python python myproj 0.1.0 `src.app`/helper().(value)';
    const parsed = parseScipSymbol(s);
    expect(parsed.name).toBe('value');
    expect(parsed.kind).toBe('Parameter');
  });
});

describe('roleDescription', () => {
  it('describes combined roles', () => {
    // 1 = Definition, 8 = ReadAccess
    expect(roleDescription(1 | 8)).toContain('definition');
    expect(roleDescription(1 | 8)).toContain('read');
  });
});
