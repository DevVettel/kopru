import type { HttpClient } from '../http/client.js';

/**
 * Sağlayıcı metotlarına her çağrıda client tarafından enjekte edilen bağlam.
 * Sağlayıcılar ağ isteklerini yalnızca `http` üzerinden yapar.
 */
export interface ProviderContext {
  /** Zaman aşımı, retry ve maskeli log desteği olan HTTP istemcisi. */
  readonly http: HttpClient;
  /** Çağrıyı iptal etmek için sinyal. */
  readonly signal: AbortSignal | undefined;
  /** Şu anki zaman; testlerde sabitlenebilir. */
  readonly now: () => Date;
}
