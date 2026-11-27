import { runCargoProviderContract, runPaymentProviderContract } from '../src/testing/index.js';
import {
  DECLINED_CARD,
  fakeNotification,
  installmentQueryInput,
  chargeInput,
  fakeCargo,
  fakeCargoBasic,
  fakePay,
  fakePayBasic,
  shipmentInput,
  threeDSInput,
} from './fakes.js';

runPaymentProviderContract({
  createProvider: () => fakePay({ apiKey: 'test' }),
  fixtures: {
    successfulCharge: chargeInput,
    declinedCharge: { ...chargeInput, card: { ...chargeInput.card, number: DECLINED_CARD } },
    threeDSInit: threeDSInput,
    installmentQuery: installmentQueryInput,
    notification: {
      valid: fakeNotification({ orderId: 'ORDER-1', status: 'success' }),
      tampered: {
        ...fakeNotification({ orderId: 'ORDER-1', status: 'success' }),
        body: 'orderId=ORDER-1&status=failed',
      },
    },
  },
});

runPaymentProviderContract({
  createProvider: () => fakePayBasic({ apiKey: 'test' }),
  fixtures: { successfulCharge: chargeInput },
});

runCargoProviderContract({
  createProvider: () => fakeCargo({ apiKey: 'test' }),
  fixtures: { shipment: shipmentInput, missingShipment: { referenceId: 'MISSING' } },
});

runCargoProviderContract({
  createProvider: () => fakeCargoBasic({ apiKey: 'test' }),
  fixtures: { shipment: shipmentInput },
});
