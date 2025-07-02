-- Supabase RPC: reports_aggregate
-- Aggregates business reports for a given business_id and date range

create or replace function public.reports_aggregate(
  business_id uuid,
  date_from timestamptz,
  date_to timestamptz
)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
  top_product_record record;
begin
  -- סה"כ מוצרים שנכנסו למלאי
  -- סה"כ מוצרים שיצאו מהמלאי
  -- שווי מלאי (כמות * מחיר)
  -- המוצר הנרכש ביותר
  -- רווח גולמי/נטו
  -- ספקים breakdown
  -- timeline breakdown

  -- Top product
  select p.name as name, sum(ia.quantity_changed) as quantity into top_product_record
  from inventory_actions ia
    join products p on ia.product_id = p.id
  where ia.business_id = reports_aggregate.business_id
    and ia.action_type = 'add'
    and ia.timestamp between date_from and date_to
  group by p.name
  order by sum(ia.quantity_changed) desc
  limit 1;

  select jsonb_build_object(
    'total_added', coalesce((select sum(quantity_changed) from inventory_actions where business_id = reports_aggregate.business_id and action_type = 'add' and timestamp between date_from and date_to), 0),
    'total_removed', coalesce((select sum(quantity_changed) from inventory_actions where business_id = reports_aggregate.business_id and action_type = 'remove' and timestamp between date_from and date_to), 0),
    'total_value', coalesce((select sum(ia.quantity_changed * coalesce(p.price,0)) from inventory_actions ia join products p on ia.product_id = p.id where ia.business_id = reports_aggregate.business_id and ia.action_type = 'add' and ia.timestamp between date_from and date_to), 0),
    'top_product', to_jsonb(top_product_record),
    'gross_profit', coalesce((select sum(ia.quantity_changed * coalesce(p.price,0)) - sum(ia.quantity_changed * coalesce(p.cost,0)) from inventory_actions ia join products p on ia.product_id = p.id where ia.business_id = reports_aggregate.business_id and ia.action_type = 'remove' and ia.timestamp between date_from and date_to), 0),
    'net_profit', coalesce((select (sum(ia.quantity_changed * coalesce(p.price,0)) - sum(ia.quantity_changed * coalesce(p.cost,0))) * 0.83 from inventory_actions ia join products p on ia.product_id = p.id where ia.business_id = reports_aggregate.business_id and ia.action_type = 'remove' and ia.timestamp between date_from and date_to), 0),
    'suppliers_breakdown', coalesce((select jsonb_agg(row_to_json(s)) from (select p.supplier_id, s.name, sum(ia.quantity_changed) as total from inventory_actions ia join products p on ia.product_id = p.id join suppliers s on p.supplier_id = s.id where ia.business_id = reports_aggregate.business_id and ia.action_type = 'add' and ia.timestamp between date_from and date_to group by p.supplier_id, s.name) s), '[]'::jsonb),
    'timeline_breakdown', coalesce((select jsonb_agg(row_to_json(t)) from (select date_trunc('day', ia.timestamp) as period, sum(ia.quantity_changed * coalesce(p.price,0)) as value, sum(ia.quantity_changed) as quantity from inventory_actions ia join products p on ia.product_id = p.id where ia.business_id = reports_aggregate.business_id and ia.timestamp between date_from and date_to group by period order by period) t), '[]'::jsonb)
  ) into result;

  return result;
end;
$$; 