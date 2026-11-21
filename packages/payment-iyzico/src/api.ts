import {
  ProviderError,
  err,
  ok,
  randomHex,
  toValidationIssues,
  type KopruError,
  type ProviderContext,
  type Result,
} from '@kopru/core';
import type { z } from 'zod';
import { createIyzicoAuthHeaders } from './auth.js';
import type { IyzicoConfig } from './config.js';
import { IYZICO_PROVIDER_ID, mapIyzicoError, type IyzicoOperationKind } from './errors.js';
import { IyzicoEnvelopeSchema, type IyzicoEnvelope } from './schemas/response.js';

/** `callIyzico` seçenekleri. */
export interface IyzicoCall<S extends z.ZodType> {
  /** Sorgu metni içermeyen yol (örn. `/payment/auth`). */
  path: string;
  /** JSON'a çevrilecek istek gövdesi. */
  body: unknown;
  /** Başarılı yanıtın şeması. */
  responseSchema: S;
  /** Hata eşleme bağlamı. */
  operation: IyzicoOperationKind;
  /** İstek tekrar edilebilir mi? Yalnızca okuma işlemlerinde `true` verilir. */
  idempotent?: boolean;
}

/** iyzico'nun başarısız yanıtı; çağıran özel kodlara (örn. `10223`) göre karar verebilir. */
export interface IyzicoFailureResult {
  error: KopruError;
  /** Yanıt zarfı; yanıt çözülemediyse `undefined`. */
  envelope: IyzicoEnvelope | undefined;
}

function unexpected(message: string, details?: Record<string, unknown>): ProviderError {
  return new ProviderError({
    code: 'PROVIDER_UNEXPECTED_RESPONSE',
    message,
    provider: IYZICO_PROVIDER_ID,
    ...(details === undefined ? {} : { details }),
  });
}

function parseJson(text: string): unknown {
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
}

/**
 * İmzalı bir iyzico isteği gönderir ve yanıtı doğrular (ARCHITECTURE.md §4.3, adım 4–5).
 *
 * - Ağ hataları `NetworkError` olarak döner.
 * - JSON olmayan 5xx yanıtlar `PROVIDER_UNAVAILABLE`, diğer çözülemeyen yanıtlar
 *   `PROVIDER_UNEXPECTED_RESPONSE` olur.
 * - `status: "failure"` yanıtlar hata kodu tablosuyla `KopruError`'a çevrilir.
 */
export async function callIyzico<S extends z.ZodType>(
  config: IyzicoConfig,
  ctx: ProviderContext,
  call: IyzicoCall<S>,
): Promise<Result<z.output<S>, IyzicoFailureResult>> {
  const body = JSON.stringify(call.body);
  const randomKey = `${String(ctx.now().getTime())}${randomHex(8)}`;
  const response = await ctx.http.request({
    method: 'POST',
    url: `${config.baseUrl}${call.path}`,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...createIyzicoAuthHeaders(config, { path: call.path, body, randomKey }),
    },
    body,
    idempotent: call.idempotent ?? false,
    ...(ctx.signal === undefined ? {} : { signal: ctx.signal }),
  });
  if (!response.ok) return err({ error: response.error, envelope: undefined });

  const { status } = response.value;
  const json = parseJson(response.value.body);
  const envelope = IyzicoEnvelopeSchema.safeParse(json);
  if (!envelope.success) {
    const error =
      status >= 500
        ? new ProviderError({
            code: 'PROVIDER_UNAVAILABLE',
            message: `iyzico responded with HTTP ${String(status)}`,
            provider: IYZICO_PROVIDER_ID,
          })
        : unexpected(`iyzico returned an unrecognized response (HTTP ${String(status)})`);
    return err({ error, envelope: undefined });
  }

  if (envelope.data.status === 'failure') {
    return err({ error: mapIyzicoError(envelope.data, call.operation), envelope: envelope.data });
  }

  const parsed = call.responseSchema.safeParse(json);
  if (!parsed.success) {
    return err({
      error: unexpected(`iyzico response for ${call.path} did not match the expected schema`, {
        issues: toValidationIssues(parsed.error),
      }),
      envelope: envelope.data,
    });
  }
  return ok(parsed.data);
}

/** `callIyzico` sonucunu yalnızca `KopruError` taşıyan sonuca indirger. */
export function dropEnvelope<T>(result: Result<T, IyzicoFailureResult>): Result<T, KopruError> {
  return result.ok ? result : err(result.error.error);
}
