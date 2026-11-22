import { runCargoProviderContract } from '@kopru/core/testing';
import { yurtici } from '../src/index.js';
import { mockConfig, shipmentInput } from './fixtures.js';

runCargoProviderContract({
  createProvider: () => yurtici(mockConfig()),
  fixtures: {
    shipment: shipmentInput('KOPRU-CONTRACT'),
    missingShipment: { referenceId: 'KOPRU-MISSING' },
  },
});
