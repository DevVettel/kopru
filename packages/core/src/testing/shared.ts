import { NetworkError } from '../errors/kopru-error.js';
import type { HttpClient, HttpRequest } from '../http/client.js';
import { err } from '../result/result.js';

/** Yapılan istekleri kaydeden ve her isteği ağ hatasıyla sonlandıran HTTP istemcisi. */
export interface RecordingHttpClient extends HttpClient {
  readonly requests: readonly HttpRequest[];
}

/**
 * "Ağ isteği yapılmadı" doğrulamaları için kayıt tutan sahte HTTP istemcisi oluşturur.
 */
export function createRecordingHttpClient(): RecordingHttpClient {
  const requests: HttpRequest[] = [];
  return {
    requests,
    request(request) {
      requests.push(request);
      return Promise.resolve(
        err(
          new NetworkError({
            code: 'NETWORK_CONNECTION_FAILED',
            message: 'Recording HTTP client does not perform requests',
          }),
        ),
      );
    },
  };
}
