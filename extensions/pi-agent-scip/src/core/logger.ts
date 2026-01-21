import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export type LogLevel = 'info' | 'warning' | 'error';

export interface StructuredLogEvent {
  source: 'indexer' | 'tool';
  action: string;
  level?: LogLevel;
  message?: string;
  [key: string]: unknown;
}

export interface StructuredLoggerOptions {
  enableConsole?: boolean;
  enableFile?: boolean;
}

export class StructuredLogger {
  private readonly logPath: string;
  private readonly enableConsole: boolean;
  private readonly enableFile: boolean;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly projectRoot: string, options: StructuredLoggerOptions = {}) {
    this.logPath = join(projectRoot, '.scip', 'index.log');
    this.enableConsole = options.enableConsole ?? true;
    this.enableFile = options.enableFile ?? true;
  }

  log(event: StructuredLogEvent): void {
    const payload = {
      timestamp: new Date().toISOString(),
      level: event.level ?? 'info',
      ...event,
    };

    if (this.enableConsole) {
      const prefix = `[scip][${payload.level}]`;
      const summary = payload.message ?? payload.action;
      // eslint-disable-next-line no-console
      console.log(`${prefix} ${summary}`);
    }

    if (!this.enableFile) return;

    const line = JSON.stringify(payload);
    this.writeChain = this.writeChain
      .then(async () => {
        await mkdir(dirname(this.logPath), { recursive: true });
        await appendFile(this.logPath, `${line}\n`);
      })
      .catch(() => {
        // Ignore write errors to avoid crashing tool execution.
      });
  }
}
