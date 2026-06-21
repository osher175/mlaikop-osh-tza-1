// CODE FREEZE: Subscription lock and payment flow are stable.
// Do not modify without explicit approval. See CODE_FREEZE_SUBSCRIPTION.md
import { z } from 'zod';
import type { GrowPayload, GrowSubscriptionInput } from './types';

export class GrowPayloadValidationError extends Error {
  code: string;
  issues: string[];
  constructor(code: string, issues: string[]) {
    super(`Invalid Grow subscription input: ${issues.join('; ')}`);
    this.name = 'GrowPayloadValidationError';
    this.code = code;
    this.issues = issues;
  }
}

export const GrowSubscriptionInputSchema = z.object({
  business: z.object({
    id: z.string().uuid({ message: 'MISSING_BUSINESS_ID' }),
    name: z.string().trim().min(1, { message: 'MISSING_BUSINESS_NAME' }).max(255),
  }),
  user: z.object({
    full_name: z.string().trim().min(1, { message: 'MISSING_USER_NAME' }).max(255),
    email: z.string().trim().email({ message: 'MISSING_EMAIL' }).max(255),
    phone: z.string().trim().min(7, { message: 'MISSING_PHONE' }).max(30),
  }),
  plan: z.object({
    id: z.string().trim().min(1, { message: 'MISSING_PLAN_ID' }).max(100),
    name: z.string().trim().min(1, { message: 'MISSING_PLAN_NAME' }).max(255),
    monthly_price: z
      .number({ invalid_type_error: 'MISSING_PRICE' })
      .positive({ message: 'MISSING_PRICE' }),
  }),
});

/**
 * Build a validated Grow checkout payload for a monthly subscription.
 *
 * Always: 1 product, quantity 1, Payments / Max Payments / 1.
 * Price is the monthly price INCLUDING 18% VAT (Grow expects gross).
 *
 * @throws GrowPayloadValidationError when required fields are missing/invalid.
 */
export function buildGrowSubscriptionPayload(
  input: GrowSubscriptionInput,
): GrowPayload {
  const parsed = GrowSubscriptionInputSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.message);
    const code = issues[0] ?? 'INVALID_INPUT';
    throw new GrowPayloadValidationError(code, issues);
  }

  const { business, user, plan } = parsed.data;

  return {
    paymentType: 'Payments',
    maxOrCustom: 'Max Payments',
    paymentsMaxNumber: 1,
    products: [
      {
        catalogNumber: plan.id,
        productName: `${plan.name} - מנוי חודשי`,
        price: Number(plan.monthly_price.toFixed(2)),
        quantity: 1,
      },
    ],
    customer: {
      businessId: business.id,
      businessName: business.name,
      name: user.full_name,
      email: user.email,
      phone: user.phone,
    },
  };
}