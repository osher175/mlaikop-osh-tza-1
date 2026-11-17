/** The ledger tables and save_purchase_order are deployed. The client still does not call them while PURCHASE_ORDERS_READY is false. */
export const PURCHASE_ORDERS_READY = true;
export const PURCHASE_RECEIPT_ATOMIC_READY = true;
export const STOCK_ADJUSTMENT_RPC_READY = true;
export const SUPPLIER_RETURN_READY = false;
/**
 * The final release uses confirm_supplier_return_dispatch once.
 * Reservation stays closed so the same units cannot be deducted again by
 * dispatch_reserved_supplier_return. Do not turn this flag on in that release.
 */
export const SUPPLIER_RETURN_RESERVATION_READY = false;
export const SUPPLIER_RETURN_AUTHORITY = 'confirm_supplier_return_dispatch' as const;
/**
 * Confirmed physical dispatch. Prepared in
 * docs/v2/supplier-return-dispatch.UNAPPLIED.sql and not deployed.
 * The screen must not call the RPC while this is false.
 */
export const SUPPLIER_RETURN_DISPATCH_READY = true;
export const CUSTOMER_RETURN_READY = true;
