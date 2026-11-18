import type { z } from 'zod';
import { summarizeIssues, toValidationIssues, fromZodError } from '../errors/from-zod.js';
import { ProviderError, type KopruError } from '../errors/kopru-error.js';
import { createHttpClient, type HttpClient, type HttpClientOptions } from '../http/client.js';
import { capabilityNotSupported } from '../provider/capabilities.js';
import type { ProviderContext } from '../provider/context.js';
import { err, ok, type Result } from '../result/result.js';

/** Client fabrikalarının ortak seçenekleri. */
export interface ClientOptions {
  /** Hazır bir HTTP istemcisi veya `createHttpClient` seçenekleri. */
  http?: HttpClient | HttpClientOptions;
  /** Zaman kaynağı; testlerde sabitlenebilir. */
  now?: () => Date;
}

/** Tek bir çağrıya özgü seçenekler. */
export interface CallOptions {
  /** Çağrıyı iptal etmek için sinyal. */
  signal?: AbortSignal;
}

function isHttpClient(value: HttpClient | HttpClientOptions): value is HttpClient {
  return 'request' in value && typeof value.request === 'function';
}

/**
 * Client seçeneklerinden çağrı başına `ProviderContext` üreten fonksiyonu oluşturur.
 */
export function createContextFactory(
  options: ClientOptions,
): (call?: CallOptions) => ProviderContext {
  const http =
    options.http !== undefined && isHttpClient(options.http)
      ? options.http
      : createHttpClient(options.http);
  const now = options.now ?? (() => new Date());
  return (call) => ({ http, now, signal: call?.signal });
}

/** `runOperation` girdisi. */
export interface OperationSpec<I extends z.ZodType, O extends z.ZodType, C extends string> {
  providerId: string;
  /** İşlem adı (hata mesajları için). */
  operation: string;
  inputSchema: I;
  outputSchema: O;
  input: unknown;
  /** Doğrulanmış girdi için gereken yetenekler. */
  requiredCapabilities: (input: z.output<I>) => readonly C[];
  hasCapability: (capability: C) => boolean;
  /** Sağlayıcı metodu; sağlayıcı uygulamıyorsa `undefined`. */
  invoke: ((input: z.output<I>) => Promise<Result<z.output<O>, KopruError>>) | undefined;
}

/**
 * Client işlem akışı (ARCHITECTURE.md §4.3): girdi doğrulama → yetenek kontrolü →
 * sağlayıcı çağrısı → çıktı doğrulama. Yetenek eksikse ağ isteği yapılmaz.
 */
export async function runOperation<I extends z.ZodType, O extends z.ZodType, C extends string>(
  spec: OperationSpec<I, O, C>,
): Promise<Result<z.output<O>, KopruError>> {
  const parsedInput = spec.inputSchema.safeParse(spec.input);
  if (!parsedInput.success) return err(fromZodError(parsedInput.error));

  const missing = spec.requiredCapabilities(parsedInput.data).find((c) => !spec.hasCapability(c));
  if (missing !== undefined) return err(capabilityNotSupported(spec.providerId, missing));
  // `define*Provider` yetenek/metot tutarlılığını garanti eder; elle oluşturulmuş
  // sağlayıcılarda metot eksikse işlem desteklenmiyor sayılır.
  if (spec.invoke === undefined) {
    return err(capabilityNotSupported(spec.providerId, spec.operation));
  }

  const result = await spec.invoke(parsedInput.data);
  if (!result.ok) return result;

  const parsedOutput = spec.outputSchema.safeParse(result.value);
  if (parsedOutput.success) return ok(parsedOutput.data);

  const issues = toValidationIssues(parsedOutput.error);
  return err(
    new ProviderError({
      code: 'PROVIDER_UNEXPECTED_RESPONSE',
      message: `Provider "${spec.providerId}" returned an invalid result: ${summarizeIssues(issues)}`,
      provider: spec.providerId,
      details: { issues },
    }),
  );
}
