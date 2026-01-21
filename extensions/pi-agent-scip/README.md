# pi-agent-scip

SCIP code intelligence tools for pi-coding-agent. Provides fast, compiler-accurate navigation and code overview for **Python** and **TypeScript/JavaScript** projects using Sourcegraph's SCIP indexers.

Once installed, the agent can automatically:

- Build a `.scip/index.scip` for your project
- Go to definition
- Find references
- List and search symbols
- Provide context-aware guidance for SCIP tool usage

## Quick Start

```bash
npm run install:pi-agent-scip
```

**Restart pi** after installing for the extension to load.

## Supported Languages

| Language | Indexer | Detection |
|----------|---------|-----------|
| **Python** | `@sourcegraph/scip-python` | `pyproject.toml`, `setup.py`, `requirements.txt`, or `.py` files |
| **TypeScript/JavaScript** | `@sourcegraph/scip-typescript` | `tsconfig.json`, `jsconfig.json`, or `.ts`/`.tsx` files |

## CLI Status Helper

```bash
pi-agent-scip-status
```

Run from a project root to see index presence, indexer availability, and the last log entry.

## Requirements

- Node.js 18+
- pi-coding-agent 0.37.0+

For more details, see the [main project](https://github.com/qualisero/pi-agent-scip).
