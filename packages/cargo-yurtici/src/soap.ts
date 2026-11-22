import {
  ProviderError,
  buildSoapEnvelope,
  err,
  ok,
  parseSoapEnvelope,
  toValidationIssues,
  type KopruError,
  type ProviderContext,
  type Result,
} from '@kopru/core';
import type { z } from 'zod';
import type { YurticiConfig } from './config.js';
import { YURTICI_PROVIDER_ID } from './errors.js';

/** Gönderi web servisinin XML namespace'i (`NOTES.md` §2). */
export const YURTICI_NAMESPACE = 'http://yurticikargo.com.tr/ShippingOrderDispatcherServices';

/** Kullanılan SOAP operasyonları. */
export type YurticiOperation = 'createShipment' | 'cancelShipment' | 'queryShipment';

/** `callYurtici` seçenekleri. */
export interface YurticiCall<S extends z.ZodType> {
  operation: YurticiOperation;
  /** Operasyon elemanının alt alanları (kimlik bilgileri hariç; onlar otomatik eklenir). */
  fields: Record<string, unknown>;
  /** `<operation>Response` elemanının içeriğinin şeması. */
  responseSchema: S;
  /** İstek tekrar edilebilir mi? Yalnızca okuma işlemlerinde `true` verilir. */
  idempotent?: boolean;
}

/**
 * Operasyonun SOAP zarfını oluşturur. Kimlik bilgileri her operasyonun gövdesinde gider;
 * `queryShipment` dil alanı için `wsLanguage`, diğerleri `userLanguage` kullanır.
 */
export function buildYurticiEnvelope(
  config: Pick<YurticiConfig, 'username' | 'password' | 'language'>,
  operation: YurticiOperation,
  fields: Record<string, unknown>,
): string {
  const languageField = operation === 'queryShipment' ? 'wsLanguage' : 'userLanguage';
  return buildSoapEnvelope({
    namespaces: { ship: YURTICI_NAMESPACE },
    body: {
      [`ship:${operation}`]: {
        wsUserName: config.username,
        wsPassword: config.password,
        [languageField]: config.language,
        ...fields,
      },
    },
  });
}

/** Hataya eklenecek, sağlayıcıdan gelen ek bilgiler. */
interface ErrorExtra {
  providerCode?: string | undefined;
  providerMessage?: string | undefined;
  details?: Readonly<Record<string, unknown>> | undefined;
}

function providerError(
  code: 'PROVIDER_UNAVAILABLE' | 'PROVIDER_UNEXPECTED_RESPONSE',
  message: string,
  extra: ErrorExtra = {},
): ProviderError {
  return new ProviderError({
    code,
    message,
    provider: YURTICI_PROVIDER_ID,
    ...(extra.providerCode === undefined ? {} : { providerCode: extra.providerCode }),
    ...(extra.providerMessage === undefined ? {} : { providerMessage: extra.providerMessage }),
    ...(extra.details === undefined ? {} : { details: { ...extra.details } }),
  });
}

/**
 * Yurtiçi web servisine SOAP isteği gönderir ve yanıt gövdesini doğrular (ARCHITECTURE.md §4.3).
 *
 * - Ağ hataları `NetworkError` olarak döner.
 * - SOAP Fault, sağlayıcının hata kodu ve mesajı korunarak `PROVIDER_UNEXPECTED_RESPONSE` olur.
 * - SOAP zarfı olmayan 5xx yanıtlar `PROVIDER_UNAVAILABLE`, diğer çözülemeyen yanıtlar
 *   `PROVIDER_UNEXPECTED_RESPONSE` olur.
 * - İş hataları (`outFlag`, `errCode`) burada değil, operasyonun kendisinde yorumlanır.
 */
export async function callYurtici<S extends z.ZodType>(
  config: YurticiConfig,
  ctx: ProviderContext,
  call: YurticiCall<S>,
): Promise<Result<z.output<S>, KopruError>> {
  const response = await ctx.http.request({
    method: 'POST',
    url: config.endpoint,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      Accept: 'text/xml',
      SOAPAction: '""',
    },
    body: buildYurticiEnvelope(config, call.operation, call.fields),
    idempotent: call.idempotent ?? false,
    ...(ctx.signal === undefined ? {} : { signal: ctx.signal }),
  });
  if (!response.ok) return response;

  const { status, body } = response.value;
  const envelope = parseSoapEnvelope(body);
  if (!envelope.ok) {
    const fault = envelope.error.details?.fault;
    if (fault === undefined && status >= 500) {
      return err(
        providerError('PROVIDER_UNAVAILABLE', `Yurtiçi responded with HTTP ${String(status)}`),
      );
    }
    return err(
      providerError(
        'PROVIDER_UNEXPECTED_RESPONSE',
        `Yurtiçi ${call.operation} failed: ${envelope.error.message}`,
        envelope.error,
      ),
    );
  }

  const parsed = call.responseSchema.safeParse(envelope.value.body[`${call.operation}Response`]);
  if (!parsed.success) {
    return err(
      providerError(
        'PROVIDER_UNEXPECTED_RESPONSE',
        `Yurtiçi ${call.operation} response did not match the expected schema`,
        { details: { issues: toValidationIssues(parsed.error) } },
      ),
    );
  }
  return ok(parsed.data);
}
