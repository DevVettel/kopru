import { parseArgs } from 'node:util';
import { isKopruError, redactUrl } from '@kopru/core';
import { z } from 'zod';
import type { RecordedRequest } from '../request-log.js';
import { DEFAULT_MOCK_HOSTNAME, startMockServer, type RunningMockServer } from '../server.js';

/** CLI varsayılan portu. */
export const DEFAULT_CLI_PORT = 4010;

/** CLI yardım metni. */
export const CLI_USAGE = `Kullanım: kopru-mock [seçenekler]

Köprü mock server'ını başlatır.

Seçenekler:
  -p, --port <port>   Dinlenecek port (varsayılan: ${String(DEFAULT_CLI_PORT)}; 0 = rastgele boş port)
  -H, --host <adres>  Dinlenecek adres (varsayılan: ${DEFAULT_MOCK_HOSTNAME})
  -q, --quiet         Gelen istekleri konsola yazma
  -h, --help          Bu yardımı göster
`;

/** Ayrıştırılmış CLI argümanları. */
export const CliArgsSchema = z.object({
  port: z.coerce.number().int().min(0).max(65_535).default(DEFAULT_CLI_PORT),
  host: z.string().min(1).default(DEFAULT_MOCK_HOSTNAME),
  quiet: z.boolean().default(false),
  help: z.boolean().default(false),
});

/** Ayrıştırılmış CLI argümanları. */
export type CliArgs = z.infer<typeof CliArgsSchema>;

/** CLI argüman ayrıştırma sonucu. */
export type ParseCliArgsResult = { ok: true; value: CliArgs } | { ok: false; message: string };

/**
 * Komut satırı argümanlarını ayrıştırır ve doğrular.
 *
 * @param argv - `process.argv.slice(2)`
 */
export function parseCliArgs(argv: readonly string[]): ParseCliArgsResult {
  let values: Record<string, unknown>;
  try {
    ({ values } = parseArgs({
      args: [...argv],
      options: {
        port: { type: 'string', short: 'p' },
        host: { type: 'string', short: 'H' },
        quiet: { type: 'boolean', short: 'q' },
        help: { type: 'boolean', short: 'h' },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  const parsed = CliArgsSchema.safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join('.') ?? 'argüman';
    return { ok: false, message: `Geçersiz "${field}" değeri: ${issue?.message ?? ''}`.trim() };
  }
  return { ok: true, value: parsed.data };
}

/** CLI'ın çıktı yazdığı akışlar; testlerde değiştirilebilir. */
export interface CliIO {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

/** `runCli` sonucu. */
export type RunCliResult =
  { kind: 'started'; server: RunningMockServer } | { kind: 'exit'; code: number };

/**
 * CLI'ı çalıştırır: argümanları ayrıştırır ve sunucuyu başlatır. Süreç sinyallerini
 * dinlemek çağıranın sorumluluğundadır (bkz. `cli.ts`).
 */
export async function runCli(argv: readonly string[], io: CliIO): Promise<RunCliResult> {
  const args = parseCliArgs(argv);
  if (!args.ok) {
    io.err(`Hata: ${args.message}\n\n${CLI_USAGE}`);
    return { kind: 'exit', code: 1 };
  }
  if (args.value.help) {
    io.out(CLI_USAGE);
    return { kind: 'exit', code: 0 };
  }

  try {
    const server = await startMockServer({
      port: args.value.port,
      hostname: args.value.host,
      ...(args.value.quiet
        ? {}
        : {
            onRequest: (entry) => {
              io.out(formatRequestLine(entry));
            },
          }),
    });
    io.out(`Köprü mock server çalışıyor: ${server.url}`);
    for (const plugin of server.plugins) {
      io.out(`  ${server.url}${plugin.basePath}  — ${plugin.description}`);
    }
    io.out(`  ${server.url}/__kopru/scenarios  — senaryo listesi`);
    return { kind: 'started', server };
  } catch (error) {
    io.err(
      `Hata: ${isKopruError(error) || error instanceof Error ? error.message : String(error)}`,
    );
    return { kind: 'exit', code: 1 };
  }
}

/**
 * Kayıtlı bir isteği tek satırlık konsol çıktısına çevirir. Yol ve sorgu
 * maskelenmiş değerlerden üretilir.
 */
export function formatRequestLine(entry: RecordedRequest): string {
  const query = new URLSearchParams(entry.query).toString();
  const target = redactUrl(`http://mock${entry.path}${query === '' ? '' : `?${query}`}`).replace(
    /^http:\/\/mock/,
    '',
  );
  return `${entry.timestamp} ${entry.method} ${target} → ${String(entry.status)}${entry.plugin === null ? '' : ` [${entry.plugin}]`}`;
}
