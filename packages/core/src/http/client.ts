import { NetworkError } from '../errors/kopru-error.js';
import { err, ok, type Result } from '../result/result.js';
import { redactHeaders, redactText, redactUrl, type RedactOptions } from './redact.js';

/** Desteklenen HTTP metotları. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

const IDEMPOTENT_METHODS: ReadonlySet<HttpMethod> = new Set(['GET', 'PUT', 'DELETE', 'HEAD']);
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

/** HTTP isteği. */
export interface HttpRequest {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  /** Gövde metni (JSON, XML veya form-encoded; sağlayıcı serileştirir). */
  body?: string;
  /** Bu istek için zaman aşımı (ms). Verilmezse istemci varsayılanı kullanılır. */
  timeoutMs?: number;
  /**
   * İsteğin tekrar edilmesi güvenli mi? Verilmezse metoda göre belirlenir
   * (GET, PUT, DELETE, HEAD). Tahsilat gibi işlemlerde asla `true` verilmemelidir.
   */
  idempotent?: boolean;
  /** İsteği dışarıdan iptal etmek için sinyal. */
  signal?: AbortSignal;
}

/** HTTP yanıtı. 2xx dışı durum kodları da hata değil, yanıt olarak döner. */
export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** `onRequest` kancasına giden (maskelenmiş) olay. */
export interface HttpRequestLogEvent {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body: string | undefined;
  attempt: number;
}

/** `onResponse` kancasına giden (maskelenmiş) olay. */
export interface HttpResponseLogEvent {
  method: HttpMethod;
  url: string;
  attempt: number;
  durationMs: number;
  status: number | undefined;
  body: string | undefined;
  error: NetworkError | undefined;
}

/** Log kancaları. Kancalara giden tüm veri önceden maskelenir. */
export interface HttpHooks {
  onRequest?: (event: HttpRequestLogEvent) => void;
  onResponse?: (event: HttpResponseLogEvent) => void;
}

/** Yeniden deneme ayarları (yalnızca idempotent istekler için). */
export interface RetryOptions {
  /** İlk denemeye ek olarak en fazla kaç kez tekrar denenir. Varsayılan: 2. */
  retries?: number;
  /** Üstel bekleme için taban süre (ms). Varsayılan: 200. */
  baseDelayMs?: number;
  /** Tek bir bekleme için üst sınır (ms). Varsayılan: 2000. */
  maxDelayMs?: number;
}

/** HTTP istemcisi seçenekleri. */
export interface HttpClientOptions {
  /** Varsayılan zaman aşımı (ms). Varsayılan: 30000. */
  timeoutMs?: number;
  retry?: RetryOptions;
  hooks?: HttpHooks;
  redact?: RedactOptions;
  /** Özel `fetch` uygulaması (testler için). Varsayılan: global `fetch`. */
  fetch?: typeof fetch;
  /** Bekleme fonksiyonu (testler için). */
  sleep?: (ms: number) => Promise<void>;
}

/** Sağlayıcıların kullandığı HTTP istemcisi. */
export interface HttpClient {
  /**
   * İsteği gönderir. Ağ hataları ve zaman aşımları `NetworkError` olarak döner;
   * HTTP durum kodları yorumlanmaz.
   */
  request(request: HttpRequest): Promise<Result<HttpResponse, NetworkError>>;
}

const DEFAULT_TIMEOUT_MS = 30_000;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeCall<T>(hook: ((event: T) => void) | undefined, event: T): void {
  try {
    hook?.(event);
  } catch {
    // Log kancasındaki bir hata isteği bozmamalıdır.
  }
}

/**
 * `fetch` tabanlı HTTP istemcisi oluşturur: zaman aşımı, idempotent isteklerde
 * üstel bekleme ile yeniden deneme ve maskelenmiş log kancaları.
 */
export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const sleep = options.sleep ?? defaultSleep;
  const retries = options.retry?.retries ?? 2;
  const baseDelayMs = options.retry?.baseDelayMs ?? 200;
  const maxDelayMs = options.retry?.maxDelayMs ?? 2_000;
  const redactOptions = options.redact ?? {};
  const hooks = options.hooks ?? {};

  async function attemptOnce(
    request: HttpRequest,
    attempt: number,
  ): Promise<Result<HttpResponse, NetworkError>> {
    const timeoutMs = request.timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = request.signal
      ? AbortSignal.any([request.signal, timeoutSignal])
      : timeoutSignal;
    const headers = request.headers ?? {};
    const logUrl = redactUrl(request.url, redactOptions);
    const startedAt = performance.now();

    safeCall(hooks.onRequest, {
      method: request.method,
      url: logUrl,
      headers: redactHeaders(headers, redactOptions),
      body: request.body === undefined ? undefined : redactText(request.body, redactOptions),
      attempt,
    });

    const finish = (
      result: Result<HttpResponse, NetworkError>,
    ): Result<HttpResponse, NetworkError> => {
      safeCall(hooks.onResponse, {
        method: request.method,
        url: logUrl,
        attempt,
        durationMs: Math.round(performance.now() - startedAt),
        status: result.ok ? result.value.status : undefined,
        body: result.ok ? redactText(result.value.body, redactOptions) : undefined,
        error: result.ok ? undefined : result.error,
      });
      return result;
    };

    try {
      const response = await fetchImpl(request.url, {
        method: request.method,
        headers,
        ...(request.body === undefined ? {} : { body: request.body }),
        signal,
      });
      const body = await response.text();
      return finish(
        ok({ status: response.status, headers: Object.fromEntries(response.headers), body }),
      );
    } catch (cause) {
      if (request.signal?.aborted === true) {
        return finish(
          err(
            new NetworkError({
              code: 'NETWORK_CONNECTION_FAILED',
              message: `Request aborted by caller: ${request.method} ${logUrl}`,
              retryable: false,
              cause,
            }),
          ),
        );
      }
      if (timeoutSignal.aborted) {
        return finish(
          err(
            new NetworkError({
              code: 'NETWORK_TIMEOUT',
              message: `Request timed out after ${String(timeoutMs)}ms: ${request.method} ${logUrl}`,
              cause,
            }),
          ),
        );
      }
      return finish(
        err(
          new NetworkError({
            code: 'NETWORK_CONNECTION_FAILED',
            message: `Request failed: ${request.method} ${logUrl}`,
            cause,
          }),
        ),
      );
    }
  }

  return {
    async request(request) {
      const canRetry = request.idempotent ?? IDEMPOTENT_METHODS.has(request.method);
      const maxAttempts = canRetry ? retries + 1 : 1;
      let attempt = 1;

      for (;;) {
        const result = await attemptOnce(request, attempt);
        const shouldRetry =
          attempt < maxAttempts &&
          (result.ok ? RETRYABLE_STATUSES.has(result.value.status) : result.error.retryable);
        if (!shouldRetry) return result;
        await sleep(Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs));
        attempt++;
      }
    },
  };
}
