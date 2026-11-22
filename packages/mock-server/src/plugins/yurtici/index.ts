import { buildSoapEnvelope, parseSoapEnvelope, safeEqual, xmlList } from '@kopru/core';
import type { Context } from 'hono';
import { z } from 'zod';
import { defineMockPlugin } from '../../plugin.js';
import {
  YURTICI_MOCK_DELIVERED_KEY,
  YURTICI_MOCK_EXISTING_KEY,
  YURTICI_MOCK_INVALID_ADDRESS_MARKER,
  YURTICI_MOCK_IN_TRANSIT_KEY,
  YURTICI_MOCK_OPERATION_CODES,
  YURTICI_MOCK_OPERATION_MESSAGES,
  YURTICI_MOCK_OUT_FOR_DELIVERY_KEY,
  YURTICI_MOCK_RETURNED_KEY,
  YURTICI_MOCK_SEEDED_SHIPMENTS,
  YURTICI_MOCK_TIMEOUT_DELAY_MS,
  YURTICI_MOCK_TIMEOUT_KEY,
  type YurticiMockShipment,
} from './shipments.js';

export * from './shipments.js';

/** Mock Yurtiçi'nin kabul ettiği web servis kullanıcı adı. */
export const YURTICI_MOCK_USERNAME = 'KOPRU_MOCK';

/** Mock Yurtiçi'nin kabul ettiği web servis şifresi. */
export const YURTICI_MOCK_PASSWORD = 'kopru-mock-password';

/** Mock'ta servis adresinin eklenti yoluna göre konumu (gerçek servisle aynı yol). */
export const YURTICI_MOCK_SERVICE_PATH = '/KOPSWebServices/ShippingOrderDispatcherServices';

const NAMESPACE = 'http://yurticikargo.com.tr/ShippingOrderDispatcherServices';

const Text = z.string().default('');
const CredentialsSchema = z.object({ wsUserName: Text, wsPassword: Text });

const ShippingOrderSchema = z.object({
  cargoKey: Text,
  invoiceKey: Text,
  receiverCustName: Text,
  receiverAddress: Text,
  receiverPhone1: Text,
});
const CreateRequestSchema = CredentialsSchema.extend({
  ShippingOrderVO: xmlList(ShippingOrderSchema),
});
const CancelRequestSchema = CredentialsSchema.extend({ cargoKeys: xmlList(z.string()) });
const QueryRequestSchema = CredentialsSchema.extend({
  keys: xmlList(z.string()),
  keyType: z.string().default('0'),
  addHistoricalData: z.string().default('false'),
});

type ShippingOrder = z.infer<typeof ShippingOrderSchema>;

/** Kayıt düzeyindeki hata. */
interface DetailError {
  errCode: string;
  errMessage: string;
}

const error = (errCode: string, errMessage: string): DetailError => ({ errCode, errMessage });

const ERR_CARGO_KEY_MISSING = error('80859', 'Kargo anahtarı boş olamaz.');
const ERR_CARGO_KEY_LENGTH = error('82500', 'Kargo anahtarı en fazla 20 karakter olabilir.');
const ERR_INVOICE_KEY_MISSING = error('60017', 'Fatura anahtarı boş olamaz.');
const ERR_INVOICE_KEY_LENGTH = error('82501', 'Fatura anahtarı en fazla 20 karakter olabilir.');
const ERR_RECEIVER_NAME_MISSING = error('60018', 'Alıcı adı boş olamaz.');
const ERR_RECEIVER_NAME_LENGTH = error('82503', 'Alıcı adı çok uzun.');
const ERR_RECEIVER_ADDRESS_MISSING = error('60019', 'Alıcı adresi boş veya geçersiz.');
const ERR_RECEIVER_ADDRESS_LENGTH = error('82502', 'Alıcı adresi çok uzun.');
const ERR_INVALID_PHONE = error('82516', 'Telefon numarası geçersiz.');
const ERR_CARGO_KEY_EXISTS = error('60020', 'Bu kargo anahtarı daha önce kullanılmış.');
const ERR_CARGO_KEY_NOT_FOUND = error('82519', 'Kargo anahtarı bulunamadı.');
const ERR_ALREADY_CANCELLED = error('82520', 'Kargo daha önce iptal edilmiş.');

function validateOrder(order: ShippingOrder): DetailError | undefined {
  if (order.cargoKey === '') return ERR_CARGO_KEY_MISSING;
  if (order.cargoKey.length > 20) return ERR_CARGO_KEY_LENGTH;
  if (order.invoiceKey === '') return ERR_INVOICE_KEY_MISSING;
  if (order.invoiceKey.length > 20) return ERR_INVOICE_KEY_LENGTH;
  if (order.receiverCustName === '') return ERR_RECEIVER_NAME_MISSING;
  if (order.receiverCustName.length > 200) return ERR_RECEIVER_NAME_LENGTH;
  if (order.receiverAddress === '') return ERR_RECEIVER_ADDRESS_MISSING;
  if (order.receiverAddress.length > 500) return ERR_RECEIVER_ADDRESS_LENGTH;
  if (order.receiverAddress.includes(YURTICI_MOCK_INVALID_ADDRESS_MARKER)) {
    return ERR_RECEIVER_ADDRESS_MISSING;
  }
  if (!/^\d{10}$/.test(order.receiverPhone1)) return ERR_INVALID_PHONE;
  if (YURTICI_MOCK_SEEDED_SHIPMENTS.has(order.cargoKey)) return ERR_CARGO_KEY_EXISTS;
  return undefined;
}

function soapResponse(c: Context, body: Record<string, unknown>, status: 200 | 500 = 200) {
  const xml = buildSoapEnvelope({ namespaces: { ns2: NAMESPACE }, body });
  return c.body(xml, status, { 'Content-Type': 'text/xml; charset=utf-8' });
}

function soapFault(c: Context, faultstring: string) {
  return soapResponse(c, { 'soap:Fault': { faultcode: 'soap:Server', faultstring } }, 500);
}

/** Kayıtların en az biri başarılıysa `0`, hepsi hatalıysa `1`. */
function resultHeader(details: readonly { errCode: string }[]) {
  const ok = details.some((detail) => detail.errCode === '0');
  return {
    outFlag: ok ? '0' : '1',
    outResult: ok ? 'Başarılı' : 'Hata Oluştu',
    count: String(details.length),
  };
}

function operation(status: string) {
  return {
    operationCode: YURTICI_MOCK_OPERATION_CODES[status] ?? '',
    operationStatus: status,
    operationMessage: YURTICI_MOCK_OPERATION_MESSAGES[status] ?? '',
  };
}

async function delayIfTimeoutKey(keys: readonly string[]): Promise<void> {
  if (keys.includes(YURTICI_MOCK_TIMEOUT_KEY)) {
    await new Promise((resolve) => setTimeout(resolve, YURTICI_MOCK_TIMEOUT_DELAY_MS));
  }
}

/**
 * Yurtiçi Kargo `ShippingOrderDispatcherServices` SOAP servisinin taklidi: `createShipment`,
 * `cancelShipment` ve `queryShipment` operasyonları. Kimlik bilgileri:
 * {@link YURTICI_MOCK_USERNAME} / {@link YURTICI_MOCK_PASSWORD}.
 */
export const yurticiPlugin = defineMockPlugin({
  name: 'yurtici',
  basePath: '/yurtici',
  description:
    'Yurtiçi Kargo SOAP servisi taklidi: gönderi oluşturma, iptal ve hareket geçmişiyle takip.',
  scenarios: [
    {
      id: 'create-success',
      description:
        'Geçerli gönderi NOP durumunda oluşturulur; aynı anahtarla tekrar oluşturma kaydı yeniler.',
      trigger: 'Hazır gönderilerde olmayan herhangi bir kargo anahtarı',
    },
    {
      id: 'create-invalid-address',
      description: 'Gönderi oluşturma 60019 (geçersiz alıcı adresi) ile başarısız olur.',
      trigger: `receiverAddress içinde "${YURTICI_MOCK_INVALID_ADDRESS_MARKER}"`,
    },
    {
      id: 'create-duplicate-key',
      description:
        'Gönderi oluşturma 60020 (kargo anahtarı daha önce kullanılmış) ile başarısız olur.',
      trigger: `cargoKey=${YURTICI_MOCK_EXISTING_KEY} veya herhangi bir hazır gönderi anahtarı`,
    },
    {
      id: 'cancel-success',
      description: 'NOP durumundaki gönderi CNL durumuna geçer; ikinci iptal 82520 döner.',
      trigger: 'Oluşturulmuş ve henüz teslim alınmamış gönderinin kargo anahtarı',
    },
    {
      id: 'cancel-not-allowed',
      description: 'Teslim alınmış gönderinin iptali işlem durumuyla (IND/DLV) reddedilir.',
      trigger: `cargoKey=${YURTICI_MOCK_IN_TRANSIT_KEY}`,
    },
    {
      id: 'track-delivered',
      description: 'Beş adımlı hareket geçmişiyle teslim edilmiş gönderi (DLV).',
      trigger: `cargoKey=${YURTICI_MOCK_DELIVERED_KEY}`,
    },
    {
      id: 'track-in-transit',
      description: 'Teslim alınmış, transfer merkezinden çıkmış gönderi (IND).',
      trigger: `cargoKey=${YURTICI_MOCK_IN_TRANSIT_KEY}`,
    },
    {
      id: 'track-out-for-delivery',
      description: 'Dağıtıma çıkmış gönderi (IND, son hareket DG).',
      trigger: `cargoKey=${YURTICI_MOCK_OUT_FOR_DELIVERY_KEY}`,
    },
    {
      id: 'track-returned',
      description:
        'Alıcı adreste bulunamadığı için göndericiye iade edilmiş gönderi (returnStatus=3).',
      trigger: `cargoKey=${YURTICI_MOCK_RETURNED_KEY}`,
    },
    {
      id: 'shipment-not-found',
      description: 'Bilinmeyen kargo anahtarında takip ve iptal 82519 döner.',
      trigger: 'Oluşturulmamış herhangi bir kargo anahtarı',
    },
    {
      id: 'timeout',
      description: `Yanıt ${String(YURTICI_MOCK_TIMEOUT_DELAY_MS)} ms gecikir; istemci zaman aşımı testleri için.`,
      trigger: `cargoKey=${YURTICI_MOCK_TIMEOUT_KEY}`,
    },
    {
      id: 'invalid-credentials',
      description: 'Kullanıcı adı veya şifre hatalıysa SOAP Fault (HTTP 500) döner.',
      trigger: 'wsUserName / wsPassword hatalı',
    },
  ],
  register: (app) => {
    const shipments = new Map<string, YurticiMockShipment>(YURTICI_MOCK_SEEDED_SHIPMENTS);
    let nextJobId = 900_001;

    app.post(YURTICI_MOCK_SERVICE_PATH, async (c) => {
      const envelope = parseSoapEnvelope(await c.req.text());
      if (!envelope.ok) return soapFault(c, 'Geçersiz SOAP isteği.');
      const { body } = envelope.value;
      const [name] = Object.keys(body);
      const credentials = CredentialsSchema.safeParse(name === undefined ? {} : body[name]);
      if (
        !credentials.success ||
        credentials.data.wsUserName !== YURTICI_MOCK_USERNAME ||
        !safeEqual(credentials.data.wsPassword, YURTICI_MOCK_PASSWORD)
      ) {
        return soapFault(c, 'Kullanıcı adı veya şifre hatalı.');
      }

      if (name === 'createShipment') {
        const request = CreateRequestSchema.safeParse(body[name]);
        if (!request.success) return soapFault(c, 'Geçersiz createShipment isteği.');
        const orders = request.data.ShippingOrderVO;
        await delayIfTimeoutKey(orders.map((order) => order.cargoKey));
        const details = orders.map((order) => {
          const failure = validateOrder(order);
          if (failure === undefined) {
            shipments.set(order.cargoKey, {
              operationStatus: 'NOP',
              docId: undefined,
              returnStatus: undefined,
              events: [],
            });
          }
          return {
            cargoKey: order.cargoKey,
            invoiceKey: order.invoiceKey,
            ...(failure ?? { errCode: '0', errMessage: '' }),
          };
        });
        return soapResponse(c, {
          'ns2:createShipmentResponse': {
            ShippingOrderResultVO: {
              ...resultHeader(details),
              jobId: String(nextJobId++),
              shippingOrderDetailVO: details,
            },
          },
        });
      }

      if (name === 'cancelShipment') {
        const request = CancelRequestSchema.safeParse(body[name]);
        if (!request.success) return soapFault(c, 'Geçersiz cancelShipment isteği.');
        await delayIfTimeoutKey(request.data.cargoKeys);
        const details = request.data.cargoKeys.map((cargoKey) => {
          const shipment = shipments.get(cargoKey);
          if (shipment === undefined) return { cargoKey, ...ERR_CARGO_KEY_NOT_FOUND };
          if (shipment.operationStatus === 'CNL' || shipment.operationStatus === 'ISC') {
            return { cargoKey, ...operation('ISC'), ...ERR_ALREADY_CANCELLED };
          }
          if (shipment.operationStatus === 'NOP') shipment.operationStatus = 'CNL';
          return {
            cargoKey,
            invoiceKey: cargoKey,
            ...operation(shipment.operationStatus),
            ...(shipment.docId === undefined ? {} : { docId: shipment.docId }),
            errCode: '0',
            errMessage: '',
          };
        });
        return soapResponse(c, {
          'ns2:cancelShipmentResponse': {
            ShippingOrderResultVO: { ...resultHeader(details), shippingCancelDetailVO: details },
          },
        });
      }

      if (name === 'queryShipment') {
        const request = QueryRequestSchema.safeParse(body[name]);
        if (!request.success) return soapFault(c, 'Geçersiz queryShipment isteği.');
        const { keys, addHistoricalData } = request.data;
        await delayIfTimeoutKey(keys);
        const details = keys.map((cargoKey) => {
          const shipment = shipments.get(cargoKey);
          if (shipment === undefined) return { cargoKey, ...ERR_CARGO_KEY_NOT_FOUND };
          return {
            cargoKey,
            invoiceKey: cargoKey,
            ...operation(shipment.operationStatus),
            errCode: '0',
            errMessage: '',
            ...(shipment.docId === undefined
              ? {}
              : {
                  shippingDeliveryItemDetailVO: {
                    docId: shipment.docId,
                    trackingUrl: `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${shipment.docId}`,
                    returnStatus: shipment.returnStatus ?? '0',
                    ...(addHistoricalData === 'true'
                      ? { invDocCargoVOArray: [...shipment.events] }
                      : {}),
                  },
                }),
          };
        });
        return soapResponse(c, {
          'ns2:queryShipmentResponse': {
            ShippingDeliveryVO: { ...resultHeader(details), shippingDeliveryDetailVO: details },
          },
        });
      }

      return soapFault(c, `Desteklenmeyen operasyon: ${name ?? '(boş)'}`);
    });
  },
});
