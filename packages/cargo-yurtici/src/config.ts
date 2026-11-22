import { z } from 'zod';

/** Yurtiçi Kargo test ortamının kök adresi. */
export const YURTICI_TEST_BASE_URL = 'https://testws.yurticikargo.com';

/** Yurtiçi Kargo canlı ortamının kök adresi. */
export const YURTICI_PRODUCTION_BASE_URL = 'https://ws.yurticikargo.com';

/** Gönderi web servisinin (ShippingOrderDispatcherServices) kök adrese göre yolu. */
export const YURTICI_SERVICE_PATH = '/KOPSWebServices/ShippingOrderDispatcherServices';

/** Yurtiçi Kargo sağlayıcı konfigürasyonu şeması. */
export const YurticiConfigSchema = z
  .object({
    /** Web servis kullanıcı adı (`wsUserName`). */
    username: z.string().trim().min(1),
    /** Web servis şifresi (`wsPassword`). Asla loglanmaz. */
    password: z.string().min(1),
    /**
     * Hesabın ödeme tipi. Yurtiçi, gönderici ödemeli ve alıcı ödemeli gönderiler için ayrı
     * kullanıcı tanımlar; bu hesapla yalnızca aynı `paymentType` değerine sahip gönderiler
     * oluşturulabilir. Varsayılan: `sender`.
     */
    paymentType: z.enum(['sender', 'recipient']).default('sender'),
    /** Yanıt mesajlarının dili. Varsayılan: `TR`. */
    language: z.enum(['TR', 'EN']).default('TR'),
    /** `true` ise test ortamı kullanılır. Varsayılan: `false` (canlı). */
    sandbox: z.boolean().default(false),
    /**
     * Kök adresi elle belirler (örn. mock server: `http://127.0.0.1:4010/yurtici`).
     * Servis yolu bu adrese eklenir. Verilirse `sandbox` yok sayılır.
     */
    baseUrl: z.url({ protocol: /^https?$/ }).optional(),
  })
  .transform(({ baseUrl, sandbox, ...rest }) => {
    const root = (
      baseUrl ?? (sandbox ? YURTICI_TEST_BASE_URL : YURTICI_PRODUCTION_BASE_URL)
    ).replace(/\/+$/, '');
    return { ...rest, endpoint: `${root}${YURTICI_SERVICE_PATH}` };
  });

/** Kullanıcının verdiği Yurtiçi Kargo konfigürasyonu. */
export type YurticiConfigInput = z.input<typeof YurticiConfigSchema>;

/** Doğrulanmış ve servis adresi çözümlenmiş Yurtiçi Kargo konfigürasyonu. */
export type YurticiConfig = z.output<typeof YurticiConfigSchema>;
