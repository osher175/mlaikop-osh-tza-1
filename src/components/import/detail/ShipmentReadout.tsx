import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const SHIPMENT_LABELS: Record<string, string> = {
  preparing: 'בהכנה',
  ready_to_ship: 'מוכן לשילוח',
  departed: 'יצא',
  in_transit: 'בדרך',
  arrived_port: 'הגיע לנמל',
  customs_clearance: 'במכס',
  inland_transport: 'הובלה פנימית',
  arrived_warehouse: 'הגיע למחסן',
  cancelled: 'בוטל',
};

interface Props {
  businessId: string;
  orderId: string;
}

/** Saved shipment rows only. Creating or editing a shipment is not available in this phase. */
export const ShipmentReadout: React.FC<Props> = ({ businessId, orderId }) => {
  const shipments = useQuery({
    queryKey: ['import-shipment-readout', orderId],
    queryFn: () => loadShipments(businessId, orderId),
  });

  return (
    <section className="space-y-3" dir="rtl">
      <div className="rounded-2xl border border-dashed p-4 text-sm">
        עדכון משלוח, מכולות ואבני דרך חדשים אינם זמינים בשלב זה. מוצג רק מה שכבר שמור.
      </div>
      {shipments.isLoading && <p className="text-sm text-muted-foreground">טוען נתוני שילוח…</p>}
      {shipments.isError || shipments.data?.unavailable ? (
        <p className="text-sm text-muted-foreground">נתוני השילוח אינם זמינים לקריאה.</p>
      ) : null}
      {shipments.data && !shipments.data.unavailable && shipments.data.rows.length === 0 && (
        <p className="text-sm text-muted-foreground">אין משלוח שמור להזמנה הזו.</p>
      )}
      {shipments.data?.rows.map((row) => (
        <article key={row.id} className="rounded-2xl border p-4 space-y-1">
          <p className="font-semibold">{row.shipment_number}</p>
          <p className="text-sm">מצב: {SHIPMENT_LABELS[row.logistics_status] ?? row.logistics_status}</p>
          <p className="text-sm text-muted-foreground">יציאה צפויה: {row.expected_departure_on ?? 'לא הוגדר'}</p>
          <p className="text-sm text-muted-foreground">הגעה לנמל צפויה: {row.expected_port_arrival_on ?? 'לא הוגדר'}</p>
          <p className="text-sm text-muted-foreground">הגעה למחסן צפויה: {row.expected_warehouse_on ?? 'לא הוגדר'}</p>
          <p className="text-sm text-muted-foreground">הגעה בפועל למחסן: {row.actual_warehouse_on ?? 'לא נרשמה'}</p>
        </article>
      ))}
    </section>
  );
};

async function loadShipments(businessId: string, orderId: string) {
  const client = supabase as unknown as { from: (table: string) => any };
  const links = await client
    .from('import_shipment_orders')
    .select('shipment_id')
    .eq('business_id', businessId)
    .eq('import_order_id', orderId);
  if (links.error) return { unavailable: true, rows: [] as ShipmentRow[] };
  const ids = (links.data ?? []).map((row: { shipment_id: string }) => row.shipment_id);
  if (ids.length === 0) return { unavailable: false, rows: [] as ShipmentRow[] };
  const shipments = await client
    .from('import_shipments')
    .select('id, shipment_number, logistics_status, expected_departure_on, expected_port_arrival_on, expected_warehouse_on, actual_warehouse_on')
    .eq('business_id', businessId)
    .in('id', ids);
  if (shipments.error) return { unavailable: true, rows: [] as ShipmentRow[] };
  return { unavailable: false, rows: (shipments.data ?? []) as ShipmentRow[] };
}

interface ShipmentRow {
  id: string;
  shipment_number: string;
  logistics_status: string;
  expected_departure_on: string | null;
  expected_port_arrival_on: string | null;
  expected_warehouse_on: string | null;
  actual_warehouse_on: string | null;
}
