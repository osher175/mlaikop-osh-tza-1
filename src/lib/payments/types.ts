// CODE FREEZE: Subscription lock and payment flow are stable.
// Do not modify without explicit approval. See CODE_FREEZE_SUBSCRIPTION.md
export type GrowPaymentStatus =
  | 'pending_payment'
  | 'payment_link_created'
  | 'paid'
  | 'failed';

export interface GrowProduct {
  catalogNumber: string;
  productName: string;
  price: number;
  quantity: number;
}

export interface GrowCustomer {
  businessId: string;
  businessName: string;
  name: string;
  email: string;
  phone: string;
}

export interface GrowPayload {
  paymentType: 'Payments';
  maxOrCustom: 'Max Payments';
  paymentsMaxNumber: number;
  products: GrowProduct[];
  customer: GrowCustomer;
}

export interface GrowSubscriptionInput {
  business: { id: string; name: string };
  user: { full_name: string; email: string; phone: string };
  plan: { id: string; name: string; monthly_price: number };
}