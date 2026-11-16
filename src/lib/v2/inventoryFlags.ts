/** The ledger tables and save_purchase_order are deployed. The client still does not call them while PURCHASE_ORDERS_READY is false. */
export const PURCHASE_ORDERS_READY = false;
export const PURCHASE_RECEIPT_ATOMIC_READY = false;
export const STOCK_ADJUSTMENT_RPC_READY = false;
export const SUPPLIER_RETURN_READY = false;
/**
 * Reserved-for-return is closed. products.quantity is both physical stock and
 * what sales treat as available. A reservation would have to decrease that
 * column, which is a stock-out. Do not turn this on until sale writers reject
 * reserved units and a return document can reserve without that decrease.
 */
export const SUPPLIER_RETURN_RESERVATION_READY = false;
/**
 * Confirmed physical dispatch. Prepared in
 * docs/v2/supplier-return-dispatch.UNAPPLIED.sql and not deployed.
 * The screen must not call the RPC while this is false.
 */
export const SUPPLIER_RETURN_DISPATCH_READY = false;
export const CUSTOMER_RETURN_READY = false;
