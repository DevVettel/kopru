import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, mapResult, ok, unwrap, unwrapOr, type Result } from '../src/index.js';

describe('Result', () => {
  it('ok() başarılı sonuç üretir', () => {
    const result = ok(42);
    expect(result).toEqual({ ok: true, value: 42 });
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
  });

  it('ok() argümansız void sonuç üretir', () => {
    expect(ok()).toEqual({ ok: true, value: undefined });
  });

  it('err() başarısız sonuç üretir', () => {
    const result = err('boom');
    expect(result).toEqual({ ok: false, error: 'boom' });
    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
  });

  it('unwrap() değeri döner veya hatayı fırlatır', () => {
    expect(unwrap(ok('x'))).toBe('x');
    const error = new Error('fail');
    expect(() => unwrap(err(error))).toThrow(error);
  });

  it('unwrap() Error olmayan hatayı Error içine sarar', () => {
    expect(() => unwrap(err('raw'))).toThrow('Called unwrap() on an Err result');
  });

  it('unwrapOr() varsayılan değeri döner', () => {
    const failed: Result<number, string> = err('x');
    expect(unwrapOr(failed, 7)).toBe(7);
    expect(unwrapOr(ok(3), 7)).toBe(3);
  });

  it('mapResult() yalnızca başarılı değeri dönüştürür', () => {
    expect(mapResult(ok(2), (n: number) => n * 2)).toEqual(ok(4));
    const failed: Result<number, string> = err('x');
    expect(mapResult(failed, (n: number) => n * 2)).toBe(failed);
  });
});
