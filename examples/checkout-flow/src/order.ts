import type { Buyer, Money } from '@kopru/core';

/** Mağazanın sipariş kaydı. Gerçek uygulamada veritabanında tutulur. */
export interface Order {
  id: string;
  amount: Money;
  status: 'pending' | 'paid' | 'shipped' | 'refunded';
  /** Ödeme tamamlandığında sağlayıcının verdiği işlem kimliği; iade için saklanır. */
  transactionId?: string;
}

/** Örnek alıcı. Bütün bilgiler sentetiktir; TCKN yalnızca algoritmik olarak geçerlidir. */
export const SAMPLE_BUYER: Buyer = {
  id: 'CUSTOMER-1',
  firstName: 'Ada',
  lastName: 'Yılmaz',
  email: 'ada@example.com',
  phone: '+905320000000',
  identityNumber: '10000000146',
  ip: '127.0.0.1',
  address: {
    cityCode: '06',
    district: 'Çankaya',
    neighborhood: 'Kızılay',
    addressLine: 'Örnek Caddesi No: 1',
  },
};

/** Ödenmeyi bekleyen yeni bir sipariş oluşturur. */
export function createOrder(id: string): Order {
  return { id, amount: { value: 124_990, currency: 'TRY' }, status: 'pending' };
}
