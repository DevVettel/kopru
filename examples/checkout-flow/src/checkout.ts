import {
  ok,
  toDecimalString,
  type Card,
  type ChargeRequestInput,
  type ChargeResult,
  type KopruError,
  type RefundResult,
  type Result,
  type Shipment,
  type ShipmentTracking,
} from '@kopru/core';
import { submitThreeDSForm } from './browser.ts';
import { startCallbackServer } from './callback-server.ts';
import type { Clients } from './clients.ts';
import { SAMPLE_BUYER, createOrder, type Order } from './order.ts';

/** Akışın adımlarını kullanıcıya bildiren fonksiyon. */
export type Logger = (message: string) => void;

/** `runCheckout` girdisi. */
export interface CheckoutInput {
  orderId: string;
  /** İlk denemede kullanılan ve bankanın reddettiği kart. */
  declinedCard: Card;
  /** 3D Secure ile ödemenin yapıldığı kart. */
  card: Card;
  /** Hareket geçmişi gösterilecek, daha önce gönderilmiş bir kargonun referansı. */
  shippedReferenceId: string;
}

/** Akışın sonucu. */
export interface CheckoutSummary {
  order: Order;
  declineCode: string;
  payment: ChargeResult;
  shipment: Shipment;
  history: ShipmentTracking;
  refund: RefundResult;
}

function chargeRequest(order: Order, card: Card): ChargeRequestInput {
  return { orderId: order.id, amount: order.amount, card, buyer: SAMPLE_BUYER };
}

/**
 * 3D Secure ödemesini baştan sona yürütür. Callback verisi kullanıcının tarayıcısından
 * geçtiği için tek başına güvenilmez: sonuç `completeThreeDS` ile sunucudan kesinleştirilir
 * ve sipariş kaydıyla karşılaştırılır.
 */
async function payWithThreeDS(
  { payments }: Clients,
  order: Order,
  card: Card,
): Promise<Result<ChargeResult, KopruError>> {
  let outcome: Result<ChargeResult, KopruError> | undefined;
  const callback = await startCallbackServer(async (payload) => {
    outcome = await payments.completeThreeDS({ payload });
    return { status: outcome.ok ? 200 : 402 };
  });

  try {
    const init = await payments.initThreeDS({
      ...chargeRequest(order, card),
      callbackUrl: callback.url,
    });
    if (!init.ok) return init;
    await submitThreeDSForm(init.value.action);
  } finally {
    await callback.stop();
  }

  if (outcome === undefined) throw new Error('3DS callback was not received');
  if (outcome.ok && !matchesOrder(order, outcome.value)) {
    throw new Error(`Payment ${outcome.value.transactionId} does not match order ${order.id}`);
  }
  return outcome;
}

/** Tahsilatın gerçekten bu siparişe ve bu tutara ait olduğunu doğrular. */
export function matchesOrder(order: Order, payment: ChargeResult): boolean {
  return (
    payment.orderId === order.id &&
    payment.amount.value === order.amount.value &&
    payment.amount.currency === order.amount.currency
  );
}

/**
 * Uçtan uca alışveriş akışı: reddedilen kart → 3D Secure ödeme → gönderi → takip →
 * gönderi iptali → iade. Beklenen hatalar `Result` olarak döner.
 */
export async function runCheckout(
  clients: Clients,
  input: CheckoutInput,
  log: Logger,
): Promise<Result<CheckoutSummary, KopruError>> {
  const { payments, cargo } = clients;
  const order = createOrder(input.orderId);
  const price = `${toDecimalString(order.amount)} ${order.amount.currency}`;
  log(`1. Sipariş ${order.id} oluşturuldu (${price})`);

  const declined = await payments.charge(chargeRequest(order, input.declinedCard));
  if (declined.ok) throw new Error('The declined test card was unexpectedly charged');
  if (declined.error.category !== 'payment') return declined;
  log(`2. İlk kart reddedildi: ${declined.error.code} → "${declined.error.userMessage}"`);

  const paid = await payWithThreeDS(clients, order, input.card);
  if (!paid.ok) return paid;
  order.status = 'paid';
  order.transactionId = paid.value.transactionId;
  log(
    `3. 3D Secure ile ödendi: işlem ${paid.value.transactionId}, kart •••• ${paid.value.cardLastFour ?? '????'}`,
  );

  const { address } = SAMPLE_BUYER;
  if (address === undefined || SAMPLE_BUYER.phone === undefined) {
    throw new Error('Sample buyer must have an address and a phone');
  }
  const shipment = await cargo.createShipment({
    referenceId: order.id,
    recipient: {
      name: `${SAMPLE_BUYER.firstName} ${SAMPLE_BUYER.lastName}`,
      phone: SAMPLE_BUYER.phone,
      address,
    },
    desi: 2,
  });
  if (!shipment.ok) return shipment;
  order.status = 'shipped';
  const tracked = await cargo.trackShipment({ referenceId: order.id });
  if (!tracked.ok) return tracked;
  log(`4. Gönderi oluşturuldu: ${tracked.value.referenceId}, durum ${tracked.value.status}`);

  const history = await cargo.trackShipment({ referenceId: input.shippedReferenceId });
  if (!history.ok) return history;
  log(`5. Önceki gönderinin takibi: ${history.value.referenceId}, durum ${history.value.status}`);
  for (const event of history.value.events) {
    log(`   ${event.occurredAt}  ${event.status.padEnd(16)}  ${event.description}`);
  }

  const cancelled = await cargo.cancelShipment({ referenceId: order.id });
  if (!cancelled.ok) return cancelled;
  log(`6. Alıcı vazgeçti, gönderi iptal edildi: durum ${cancelled.value.status}`);

  const refund = await payments.refund({ transactionId: paid.value.transactionId });
  if (!refund.ok) return refund;
  order.status = 'refunded';
  log(
    `7. Ödeme iade edildi: ${toDecimalString(refund.value.amount)} ${refund.value.amount.currency}`,
  );

  return ok({
    order,
    declineCode: declined.error.code,
    payment: paid.value,
    shipment: shipment.value,
    history: history.value,
    refund: refund.value,
  });
}
