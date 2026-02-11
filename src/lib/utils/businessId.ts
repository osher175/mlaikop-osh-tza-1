const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that a string is a proper UUID v4 format.
 */
export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Returns the business_id if valid, otherwise throws with a clear error.
 * Use before any Supabase call that needs business_id.
 */
export function getActiveBusinessId(businessId: string | null | undefined): string {
  if (!businessId) {
    const msg = 'business_id is missing — user has no active business selected.';
    console.error('[businessId guard]', msg);
    throw new BusinessIdError(msg);
  }

  if (!isValidUUID(businessId)) {
    const msg = `business_id is not a valid UUID: "${businessId}"`;
    console.error('[businessId guard]', msg, { businessId });
    throw new BusinessIdError(msg);
  }

  return businessId;
}

export class BusinessIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessIdError';
  }
}
