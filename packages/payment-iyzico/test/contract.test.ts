import { runPaymentProviderContract } from '@kopru/core/testing';
import { iyzico } from '../src/index.js';
import { chargeInput, mockConfig, threeDSInput } from './fixtures.js';

runPaymentProviderContract({
  createProvider: () => iyzico(mockConfig()),
  fixtures: {
    successfulCharge: chargeInput(),
    declinedCharge: chargeInput('4129111111111111'),
    threeDSInit: threeDSInput(),
  },
});
