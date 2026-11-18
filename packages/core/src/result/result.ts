/**
 * Başarılı bir işlemin sonucu.
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Başarısız bir işlemin sonucu.
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Beklenen iş hatalarını fırlatmadan taşıyan sonuç tipi (bkz. ADR-0002).
 * `ok` alanı üzerinden ayrıştırılan bir discriminated union'dır.
 */
export type Result<T, E> = Ok<T> | Err<E>;

/**
 * Başarılı bir sonuç oluşturur.
 *
 * @param value - Taşınacak değer (verilmezse `void`)
 */
export function ok(): Ok<void>;
export function ok<T>(value: T): Ok<T>;
export function ok<T>(value?: T): Ok<T | undefined> {
  return { ok: true, value };
}

/**
 * Başarısız bir sonuç oluşturur.
 *
 * @param error - Taşınacak hata
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Sonucun başarılı olup olmadığını kontrol eder (tip daraltıcı).
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/**
 * Sonucun başarısız olup olmadığını kontrol eder (tip daraltıcı).
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/**
 * Başarılı sonucun değerini döner; başarısız sonuçta hatayı fırlatır.
 * Yalnızca testlerde veya hatanın programlama hatası sayıldığı yerlerde kullanılmalıdır.
 *
 * @throws Sonuç başarısızsa taşıdığı hata (`Error` değilse `Error` içine sarılarak)
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  if (result.error instanceof Error) {
    throw result.error;
  }
  throw new Error('Called unwrap() on an Err result', { cause: result.error });
}

/**
 * Başarılı sonucun değerini, başarısız sonuçta ise verilen varsayılan değeri döner.
 */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

/**
 * Başarılı sonucun değerini dönüştürür; başarısız sonucu olduğu gibi bırakır.
 */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}
