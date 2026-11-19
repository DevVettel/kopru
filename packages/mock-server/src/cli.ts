#!/usr/bin/env node
import { runCli } from './cli/run.js';

/**
 * `kopru-mock` giriş noktası. Sunucuyu başlatır ve SIGINT/SIGTERM ile düzgün kapatır.
 */
async function main(): Promise<void> {
  const result = await runCli(process.argv.slice(2), {
    out: (line) => {
      process.stdout.write(`${line}\n`);
    },
    err: (line) => {
      process.stderr.write(`${line}\n`);
    },
  });

  if (result.kind === 'exit') {
    process.exitCode = result.code;
    return;
  }

  const { server } = result;
  const shutdown = (): void => {
    void server.stop().finally(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

void main();
