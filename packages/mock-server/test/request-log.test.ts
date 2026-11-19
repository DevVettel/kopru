import { describe, expect, it } from 'vitest';
import { createRequestLog, matchesFilter, type RecordedRequest } from '../src/index.js';

const entry = (overrides: Partial<Omit<RecordedRequest, 'id' | 'timestamp'>> = {}) => ({
  plugin: 'echo',
  method: 'POST',
  path: '/echo/a',
  query: {},
  headers: {},
  body: '',
  status: 200,
  ...overrides,
});

describe('createRequestLog', () => {
  it('kayıtlara artan id ve zaman damgası atar', () => {
    const log = createRequestLog();
    const first = log.record(entry());
    const second = log.record(entry());
    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
    expect(Number.isNaN(Date.parse(first.timestamp))).toBe(false);
    expect(log.list()).toHaveLength(2);
    expect(log.last()?.id).toBe(2);
  });

  it('dönen liste kopyadır', () => {
    const log = createRequestLog();
    log.record(entry());
    const listed = log.list();
    log.record(entry());
    expect(listed).toHaveLength(1);
  });

  it('temizlendikten sonra id sıfırlanmaz', () => {
    const log = createRequestLog();
    log.record(entry());
    log.clear();
    expect(log.list()).toEqual([]);
    expect(log.last()).toBeUndefined();
    expect(log.record(entry()).id).toBe(2);
  });

  it('sınır aşıldığında en eski kayıtları atar', () => {
    const log = createRequestLog(2);
    log.record(entry({ path: '/1' }));
    log.record(entry({ path: '/2' }));
    log.record(entry({ path: '/3' }));
    expect(log.list().map((item) => item.path)).toEqual(['/2', '/3']);
  });

  it('süzgece göre listeler', () => {
    const log = createRequestLog();
    log.record(entry({ method: 'GET', path: '/echo/x' }));
    log.record(entry({ plugin: null, path: '/missing' }));
    expect(log.list({ method: 'get' })).toHaveLength(1);
    expect(log.last({ plugin: 'echo' })?.path).toBe('/echo/x');
  });
});

describe('matchesFilter', () => {
  const recorded: RecordedRequest = { id: 1, timestamp: '2026-11-19T00:00:00.000Z', ...entry() };

  it('tüm ölçütleri birlikte uygular', () => {
    expect(matchesFilter(recorded, {})).toBe(true);
    expect(matchesFilter(recorded, { plugin: 'echo', method: 'post', path: '/echo/a' })).toBe(true);
    expect(matchesFilter(recorded, { plugin: 'other' })).toBe(false);
    expect(matchesFilter(recorded, { method: 'GET' })).toBe(false);
    expect(matchesFilter(recorded, { path: '/echo' })).toBe(false);
    expect(matchesFilter(recorded, { path: /^\/echo\// })).toBe(true);
    expect(matchesFilter(recorded, { path: /^\/other/ })).toBe(false);
  });
});
