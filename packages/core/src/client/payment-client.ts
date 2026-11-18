import type { PaymentCapability, PaymentProvider } from '../domain/payment/provider.js';
import {
  ChargeRequestSchema,
  ChargeResultSchema,
  RefundRequestSchema,
  RefundResultSchema,
  ThreeDSCallbackSchema,
  ThreeDSInitRequestSchema,
  ThreeDSInitResultSchema,
  type ChargeRequestInput,
  type ChargeResult,
  type RefundRequestInput,
  type RefundResult,
  type ThreeDSCallback,
  type ThreeDSInitRequestInput,
  type ThreeDSInitResult,
} from '../domain/payment/schemas.js';
import type { KopruError } from '../errors/kopru-error.js';
import type { Result } from '../result/result.js';
import {
  createContextFactory,
  runOperation,
  type CallOptions,
  type ClientOptions,
} from './run-operation.js';

/** `createPaymentClient` seçenekleri. */
export interface PaymentClientOptions extends ClientOptions {
  provider: PaymentProvider;
}

/** Kullanıcıya açılan ödeme istemcisi. Tüm girdiler doğrulanır, tüm çıktılar `Result` döner. */
export interface PaymentClient {
  readonly providerId: string;
  /** Sağlayıcının yeteneği destekleyip desteklemediğini döner (örn. `refund.partial`). */
  supports(capability: PaymentCapability): boolean;
  /** Karttan tek adımda tahsilat yapar (Non-3DS). */
  charge(
    input: ChargeRequestInput,
    options?: CallOptions,
  ): Promise<Result<ChargeResult, KopruError>>;
  /** 3D Secure akışını başlatır; kullanıcı dönen `action` ile bankaya yönlendirilir. */
  initThreeDS(
    input: ThreeDSInitRequestInput,
    options?: CallOptions,
  ): Promise<Result<ThreeDSInitResult, KopruError>>;
  /** Bankadan dönen callback verisiyle 3D Secure ödemesini tamamlar. */
  completeThreeDS(
    input: ThreeDSCallback,
    options?: CallOptions,
  ): Promise<Result<ChargeResult, KopruError>>;
  /** İade yapar; `amount` verilmezse tam iade. */
  refund(
    input: RefundRequestInput,
    options?: CallOptions,
  ): Promise<Result<RefundResult, KopruError>>;
}

function installmentCapabilities(installments: number): PaymentCapability[] {
  return installments > 1 ? ['installments'] : [];
}

/**
 * Ödeme istemcisi oluşturur.
 *
 * @example
 * const payments = createPaymentClient({ provider: iyzico({ apiKey, secretKey, sandbox: true }) });
 * const result = await payments.charge({ orderId: 'S-1', amount: { value: 1050, currency: 'TRY' }, … });
 */
export function createPaymentClient(options: PaymentClientOptions): PaymentClient {
  const { provider } = options;
  const createContext = createContextFactory(options);
  const base = {
    providerId: provider.id,
    hasCapability: (capability: PaymentCapability) => provider.capabilities.has(capability),
  };
  const charge = provider.charge?.bind(provider);
  const initThreeDS = provider.initThreeDS?.bind(provider);
  const completeThreeDS = provider.completeThreeDS?.bind(provider);
  const refund = provider.refund?.bind(provider);

  return {
    providerId: provider.id,
    supports: (capability) => provider.capabilities.has(capability),

    charge: (input, call) =>
      runOperation({
        ...base,
        operation: 'charge',
        inputSchema: ChargeRequestSchema,
        outputSchema: ChargeResultSchema,
        input,
        requiredCapabilities: (req) => ['charge', ...installmentCapabilities(req.installments)],
        invoke: charge && ((req) => charge(req, createContext(call))),
      }),

    initThreeDS: (input, call) =>
      runOperation({
        ...base,
        operation: 'initThreeDS',
        inputSchema: ThreeDSInitRequestSchema,
        outputSchema: ThreeDSInitResultSchema,
        input,
        requiredCapabilities: (req) => ['threeDS', ...installmentCapabilities(req.installments)],
        invoke: initThreeDS && ((req) => initThreeDS(req, createContext(call))),
      }),

    completeThreeDS: (input, call) =>
      runOperation({
        ...base,
        operation: 'completeThreeDS',
        inputSchema: ThreeDSCallbackSchema,
        outputSchema: ChargeResultSchema,
        input,
        requiredCapabilities: () => ['threeDS'],
        invoke:
          completeThreeDS && ((req: ThreeDSCallback) => completeThreeDS(req, createContext(call))),
      }),

    refund: (input, call) =>
      runOperation({
        ...base,
        operation: 'refund',
        inputSchema: RefundRequestSchema,
        outputSchema: RefundResultSchema,
        input,
        requiredCapabilities: (req) =>
          req.amount === undefined ? ['refund'] : ['refund', 'refund.partial'],
        invoke: refund && ((req) => refund(req, createContext(call))),
      }),
  };
}
