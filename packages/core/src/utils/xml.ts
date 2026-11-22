// Paketin tip tanımları isimli `Builder` export'u bildirse de çalışma zamanında yalnızca varsayılan export vardır.
import XmlBuilder from 'fast-xml-builder';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { z } from 'zod';
import { ProviderError } from '../errors/kopru-error.js';
import { err, ok, type Result } from '../result/result.js';

/** XML özniteliklerinin JSON'daki ön eki: `<a id="1">` → `{ a: { '@_id': '1' } }`. */
export const XML_ATTRIBUTE_PREFIX = '@_';
/** Öznitelik taşıyan düğümlerde metin içeriğinin anahtarı. */
export const XML_TEXT_KEY = '#text';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: XML_ATTRIBUTE_PREFIX,
  textNodeName: XML_TEXT_KEY,
  removeNSPrefix: true,
  // Takip numarası gibi değerlerin sayıya çevrilip baştaki sıfırlarını kaybetmemesi için
  // tüm değerler metin olarak bırakılır; tip dönüşümü sağlayıcının Zod şemasında yapılır.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
});

const builder = new XmlBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: XML_ATTRIBUTE_PREFIX,
  textNodeName: XML_TEXT_KEY,
  suppressEmptyNode: false,
  processEntities: true,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function unexpected(message: string, cause?: unknown): ProviderError {
  return new ProviderError({
    code: 'PROVIDER_UNEXPECTED_RESPONSE',
    message,
    ...(cause === undefined ? {} : { cause }),
  });
}

/**
 * XML metnini JSON nesnesine çevirir. Namespace ön ekleri kaldırılır ve tüm
 * değerler metin olarak bırakılır. Sonuç `unknown`'dır; Zod ile doğrulanmalıdır.
 */
export function parseXml(xml: string): Result<Record<string, unknown>, ProviderError> {
  if (!xml.trimStart().startsWith('<')) return err(unexpected('Response is not XML'));
  // XMLParser bozuk XML'e karşı toleranslıdır; önce iyi biçimlilik doğrulanır.
  // Not: XMLValidator, ayrı `fast-xml-validator` paketine taşınması planlandığı için deprecated
  // işaretlidir; yeni bir bağımlılık eklememek adına fast-xml-parser 5.x içindeki sürüm kullanılır.
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Yukarıdaki gerekçe.
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    return err(unexpected(`Malformed XML response: ${validation.err.msg}`));
  }
  try {
    const parsed: unknown = parser.parse(xml);
    return isRecord(parsed) && Object.keys(parsed).length > 0
      ? ok(parsed)
      : err(unexpected('XML document is empty'));
    /* v8 ignore next 3 -- Doğrulamadan geçen XML'de ayrıştırıcı hatası beklenmez; savunma amaçlıdır. */
  } catch (cause) {
    return err(unexpected('Malformed XML response', cause));
  }
}

/**
 * JSON nesnesinden XML metni üretir. `@_` ön ekli anahtarlar öznitelik olarak yazılır;
 * değerler XML'e uygun şekilde kaçışlanır.
 */
export function buildXml(value: Record<string, unknown>): string {
  return builder.build(value);
}

/**
 * XML'den çevrilmiş tekrar eden bir elemanın şeması. Ayrıştırıcı tek elemanı nesne,
 * birden fazlasını dizi olarak üretir; boş eleman (`<list/>`) ise boş metin olur.
 * Bu şema üç durumu da diziye çevirir; eleman hiç yoksa sonuç boş dizidir.
 *
 * @example
 * const Schema = z.object({ items: xmlList(z.object({ id: z.string() })) });
 * Schema.parse({ items: { id: '1' } }); // → { items: [{ id: '1' }] }
 */
export function xmlList<T extends z.ZodType>(item: T) {
  // `.optional()`: eleman hiç yoksa nesne şeması anahtarı zorunlu saymaz; sonuç boş dizi olur.
  return z
    .unknown()
    .optional()
    .transform((value): unknown[] => {
      if (value === undefined || value === null || value === '') return [];
      // `Array.isArray` daraltması `any[]` üretir; öğeler `unknown` olarak kopyalanır.
      return Array.isArray(value) ? Array.from<unknown>(value) : [value];
    })
    .pipe(z.array(item));
}

/** SOAP sürümü. */
export type SoapVersion = '1.1' | '1.2';

const SOAP_NAMESPACES: Record<SoapVersion, string> = {
  '1.1': 'http://schemas.xmlsoap.org/soap/envelope/',
  '1.2': 'http://www.w3.org/2003/05/soap-envelope',
};

/** SOAP zarfı oluşturma seçenekleri. */
export interface SoapEnvelopeOptions {
  /** `soap:Body` içeriği; genellikle tek bir operasyon elemanı. */
  body: Record<string, unknown>;
  /** `soap:Header` içeriği. */
  header?: Record<string, unknown>;
  /** Ek namespace tanımları: ön ek → URI (örn. `{ ws: 'http://…' }`). */
  namespaces?: Record<string, string>;
  /** Varsayılan: `1.1`. */
  version?: SoapVersion;
}

/**
 * SOAP zarfı (envelope) XML'i oluşturur.
 */
export function buildSoapEnvelope(options: SoapEnvelopeOptions): string {
  const version = options.version ?? '1.1';
  const namespaceAttributes = Object.fromEntries(
    Object.entries(options.namespaces ?? {}).map(([prefix, uri]) => [
      `${XML_ATTRIBUTE_PREFIX}xmlns:${prefix}`,
      uri,
    ]),
  );
  const envelope = {
    'soap:Envelope': {
      [`${XML_ATTRIBUTE_PREFIX}xmlns:soap`]: SOAP_NAMESPACES[version],
      ...namespaceAttributes,
      ...(options.header === undefined ? {} : { 'soap:Header': options.header }),
      'soap:Body': options.body,
    },
  };
  return `<?xml version="1.0" encoding="UTF-8"?>${buildXml(envelope)}`;
}

/** Çözülmüş SOAP zarfı. */
export interface SoapEnvelope {
  body: Record<string, unknown>;
  header: Record<string, unknown> | undefined;
}

function readText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (isRecord(value)) return readText(value[XML_TEXT_KEY] ?? value.Text ?? value.Value);
  return undefined;
}

/**
 * SOAP yanıtını çözer. `Fault` elemanı varsa sağlayıcının hata kodu ve mesajı
 * korunarak `ProviderError` döner (SOAP 1.1 ve 1.2 desteklenir).
 */
export function parseSoapEnvelope(xml: string): Result<SoapEnvelope, ProviderError> {
  const parsed = parseXml(xml);
  if (!parsed.ok) return parsed;

  const envelope = parsed.value.Envelope;
  const body = isRecord(envelope) ? envelope.Body : undefined;
  if (!isRecord(envelope) || !isRecord(body)) {
    return err(unexpected('Response is not a SOAP envelope'));
  }

  const fault = body.Fault;
  if (isRecord(fault)) {
    // SOAP 1.1: faultcode/faultstring — SOAP 1.2: Code/Value, Reason/Text
    const code = readText(fault.faultcode) ?? readText(fault.Code);
    const reason = readText(fault.faultstring) ?? readText(fault.Reason);
    return err(
      new ProviderError({
        code: 'PROVIDER_UNEXPECTED_RESPONSE',
        message: `SOAP fault: ${reason ?? 'unknown reason'}`,
        ...(code === undefined ? {} : { providerCode: code }),
        ...(reason === undefined ? {} : { providerMessage: reason }),
        details: { fault },
      }),
    );
  }

  const header = envelope.Header;
  return ok({ body, header: isRecord(header) ? header : undefined });
}
