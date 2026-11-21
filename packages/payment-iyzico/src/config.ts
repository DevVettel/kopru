import { z } from 'zod';

/** iyzico sandbox ortamının kök adresi. */
export const IYZICO_SANDBOX_BASE_URL = 'https://sandbox-api.iyzipay.com';

/** iyzico canlı ortamının kök adresi. */
export const IYZICO_PRODUCTION_BASE_URL = 'https://api.iyzipay.com';

/** iyzico sağlayıcı konfigürasyonu şeması. */
export const IyzicoConfigSchema = z
  .object({
    /** iyzico API anahtarı. Asla loglanmaz. */
    apiKey: z.string().trim().min(1),
    /** iyzico gizli anahtarı (istek imzalamada kullanılır). Asla loglanmaz. */
    secretKey: z.string().trim().min(1),
    /** `true` ise sandbox ortamı kullanılır. Varsayılan: `false` (canlı). */
    sandbox: z.boolean().default(false),
    /**
     * Kök adresi elle belirler (örn. mock server: `http://127.0.0.1:4010/iyzico`).
     * Verilirse `sandbox` yok sayılır.
     */
    baseUrl: z.url({ protocol: /^https?$/ }).optional(),
    /** iyzico yanıt mesajlarının dili. Varsayılan: `tr`. */
    locale: z.enum(['tr', 'en']).default('tr'),
    /** Sepet kalemlerinin tipi. Varsayılan: `PHYSICAL`. */
    basketItemType: z.enum(['PHYSICAL', 'VIRTUAL']).default('PHYSICAL'),
    /**
     * `items` verilmediğinde siparişin tek kalemlik sepet olarak gönderileceği kategori.
     * Varsayılan: `Genel`.
     */
    defaultItemCategory: z.string().trim().min(1).max(100).default('Genel'),
  })
  .transform(({ baseUrl, sandbox, ...rest }) => ({
    ...rest,
    baseUrl: (baseUrl ?? (sandbox ? IYZICO_SANDBOX_BASE_URL : IYZICO_PRODUCTION_BASE_URL)).replace(
      /\/+$/,
      '',
    ),
  }));

/** Kullanıcının verdiği iyzico konfigürasyonu. */
export type IyzicoConfigInput = z.input<typeof IyzicoConfigSchema>;

/** Doğrulanmış ve kök adresi çözümlenmiş iyzico konfigürasyonu. */
export type IyzicoConfig = z.output<typeof IyzicoConfigSchema>;
