/**
 * Type definitions for SCIP protobuf structures from @sourcegraph/scip-typescript.
 *
 * The package does not currently ship TypeScript type definitions,
 * so we provide a minimal shim that allows type-safe usage of the
 * most commonly used SCIP structures.
 */

declare module '@sourcegraph/scip-typescript/dist/src/scip.js' {
  /** Symbol role bit flags */
  export namespace SymbolRole {
    const UnspecifiedSymbolRole: number;
    const Definition: number;
    const Import: number;
    const WriteAccess: number;
    const ReadAccess: number;
    const Generated: number;
    const Test: number;
    const ForwardDefinition: number;
  }

  /** A single occurrence of a symbol in source code */
  export interface Occurrence {
    range: number[];
    symbol: string;
    symbol_roles: number;
    override_documentation?: string[];
    syntax_kind?: number;
    diagnostics?: unknown[];
  }

  /** A document (file) in the SCIP index */
  export interface Document {
    language?: string;
    relative_path: string;
    occurrences: Occurrence[];
    symbols?: unknown[];
    text?: string;
  }

  /** Root structure of a SCIP index */
  export interface Index {
    metadata?: unknown;
    documents: Document[];
    external_symbols?: unknown[];
  }

  export const scip: {
    SymbolRole: typeof SymbolRole;
    Index: {
      new (init?: Partial<Index>): Index & { serializeBinary(): Uint8Array };
      deserializeBinary(data: Uint8Array | Buffer): Index;
    };
    Document: {
      new (init?: Partial<Document>): Document;
    };
    Occurrence: {
      new (init?: Partial<Occurrence>): Occurrence;
    };
  };
}
