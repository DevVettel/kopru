import { describe, expect, it } from 'vitest';
import {
  CLI_USAGE,
  DEFAULT_CLI_PORT,
  formatRequestLine,
  parseCliArgs,
  runCli,
} from '../src/cli/run.js';

const createIO = () => {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: { out: (line: string) => out.push(line), err: (line: string) => err.push(line) },
  };
};

describe('parseCliArgs', () => {
  it('varsayılanları uygular', () => {
    expect(parseCliArgs([])).toEqual({
      ok: true,
      value: { port: DEFAULT_CLI_PORT, host: '127.0.0.1', quiet: false, help: false },
    });
  });

  it('uzun ve kısa seçenekleri ayrıştırır', () => {
    expect(parseCliArgs(['--port', '4020', '-H', '0.0.0.0', '-q'])).toEqual({
      ok: true,
      value: { port: 4020, host: '0.0.0.0', quiet: true, help: false },
    });
    expect(parseCliArgs(['-h'])).toMatchObject({ ok: true, value: { help: true } });
  });

  it.each([['--port', 'abc'], ['--port', '70000'], ['--unknown'], ['extra']])(
    'geçersiz argümanı reddeder: %s',
    (...argv) => {
      expect(parseCliArgs(argv)).toMatchObject({ ok: false });
    },
  );

  it('doğrulama hatasında alan adını belirtir', () => {
    const result = parseCliArgs(['--port', 'abc']);
    expect(result.ok ? '' : result.message).toMatch(/^Geçersiz "port" değeri/);
  });
});

describe('runCli', () => {
  it('yardım metnini yazar', async () => {
    const { out, io } = createIO();
    expect(await runCli(['--help'], io)).toEqual({ kind: 'exit', code: 0 });
    expect(out).toEqual([CLI_USAGE]);
  });

  it('geçersiz argümanda 1 koduyla çıkar', async () => {
    const { err, io } = createIO();
    expect(await runCli(['--port', 'x'], io)).toEqual({ kind: 'exit', code: 1 });
    expect(err[0]).toContain('Kullanım: kopru-mock');
  });

  it('sunucuyu başlatır ve istekleri konsola yazar', async () => {
    const { out, io } = createIO();
    const result = await runCli(['--port', '0'], io);
    if (result.kind !== 'started') throw new Error('server did not start');
    try {
      expect(out[0]).toBe(`Köprü mock server çalışıyor: ${result.server.url}`);
      expect(out).toContain(
        `  ${result.server.url}/echo  — ${result.server.plugins[0]?.description ?? ''}`,
      );
      await fetch(`${result.server.url}/echo/x?apiKey=secret`);
      expect(out.at(-1)).toMatch(/ GET \/echo\/x\?apiKey=%5BREDACTED%5D → 200 \[echo\]$/);
    } finally {
      await result.server.stop();
    }
  });

  it('--quiet ile istekleri yazmaz', async () => {
    const { out, io } = createIO();
    const result = await runCli(['-p', '0', '-q'], io);
    if (result.kind !== 'started') throw new Error('server did not start');
    try {
      const before = out.length;
      await fetch(`${result.server.url}/echo/x`);
      expect(out).toHaveLength(before);
    } finally {
      await result.server.stop();
    }
  });

  it('sunucu başlatılamazsa 1 koduyla çıkar', async () => {
    const first = createIO();
    const running = await runCli(['-p', '0', '-q'], first.io);
    if (running.kind !== 'started') throw new Error('server did not start');
    try {
      const { err, io } = createIO();
      expect(await runCli(['-p', String(running.server.port)], io)).toEqual({
        kind: 'exit',
        code: 1,
      });
      expect(err[0]).toMatch(/^Hata: Mock server could not listen/);
    } finally {
      await running.server.stop();
    }
  });
});

describe('formatRequestLine', () => {
  it('eklentisiz isteği biçimlendirir', () => {
    expect(
      formatRequestLine({
        id: 1,
        timestamp: '2026-11-19T10:00:00.000Z',
        plugin: null,
        method: 'GET',
        path: '/missing',
        query: {},
        headers: {},
        body: '',
        status: 404,
      }),
    ).toBe('2026-11-19T10:00:00.000Z GET /missing → 404');
  });
});
