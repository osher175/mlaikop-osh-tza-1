/**
 * In-memory receipt scenarios. This process never opens a network connection
 * and never reads PO-2. It runs the receipt function body whose MD5 was read
 * from the active database, inside a disposable Postgres.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const production = 'gtakgctmtayalcbpnryg';
const activeBodyMd5 = 'f0f4008447798e72826edf071c01f06b';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

for (const value of Object.values(process.env)) {
  if (typeof value === 'string' && value.includes(production) && /postgres(ql)?:\/\//i.test(value)) {
    console.error('isolated receipt test refused a production database URL');
    process.exit(1);
  }
}

const source = readFileSync(join(root, 'docs/v2/purchase-order-receipts.UNAPPLIED.sql'), 'utf8');
const marker = 'LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $post$';
const start = source.lastIndexOf(marker);
const end = source.indexOf('$post$;', start);
const body = source.slice(start + marker.length, end);
const digest = createHash('md5').update(body).digest('hex');
if (digest !== activeBodyMd5) {
  console.error('isolated receipt test refused: function body does not match the active database function');
  process.exit(1);
}

const pgliteRoot = process.env.PGLITE_ROOT || '';
if (!pgliteRoot || pgliteRoot.toLowerCase().includes(production)) {
  console.error('isolated receipt test needs PGLITE_ROOT pointing at a local PGlite install');
  process.exit(1);
}
const { PGlite } = createRequire(join(pgliteRoot, 'package.json'))('@electric-sql/pglite');
const db = new PGlite();

const user = '11111111-1111-4111-8111-111111111111';
const businessA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const businessB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const employee = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const supplier = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const linkedProduct = 'e1111111-1111-4111-8111-111111111111';
const chosenProduct = 'e2222222-2222-4222-8222-222222222222';
const partialProduct = 'e3333333-3333-4333-8333-333333333333';
const failProduct = 'e4444444-4444-4444-8444-444444444444';
const foreignProduct = 'e5555555-5555-4555-8555-555555555555';
const otherChoice = 'e6666666-6666-4666-8666-666666666666';

const ids = {
  linkedOrder: 'f1111111-1111-4111-8111-111111111111',
  linkedLine: 'f1111111-1111-4111-8111-111111111112',
  chooseOrder: 'f2222222-2222-4222-8222-222222222221',
  chooseLine: 'f2222222-2222-4222-8222-222222222222',
  createOrder: 'f3333333-3333-4333-8333-333333333331',
  createLine: 'f3333333-3333-4333-8333-333333333332',
  partialOrder: 'f4444444-4444-4444-8444-444444444441',
  partialLine: 'f4444444-4444-4444-8444-444444444442',
  failOrder: 'f5555555-5555-4555-8555-555555555551',
  failLine: 'f5555555-5555-4555-8555-555555555552',
  failOpenLine: 'f5555555-5555-4555-8555-555555555553',
  foreignOrder: 'f6666666-6666-4666-8666-666666666661',
  foreignLine: 'f6666666-6666-4666-8666-666666666662',
  deniedOrder: 'f7777777-7777-4777-8777-777777777771',
  deniedLine: 'f7777777-7777-4777-8777-777777777772',
};

await db.exec(`
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('mlaiko.user_id', true), '')::uuid
  $$;
  CREATE TABLE public.businesses (id uuid PRIMARY KEY);
  CREATE TABLE public.suppliers (id uuid PRIMARY KEY);
  CREATE TABLE public.employees (id uuid PRIMARY KEY, business_id uuid NOT NULL, is_active boolean NOT NULL);
  CREATE TABLE public.business_members (business_id uuid NOT NULL, user_id uuid NOT NULL, PRIMARY KEY (business_id, user_id));
  CREATE FUNCTION public.is_business_member(p_business_id uuid, p_user_id uuid) RETURNS boolean
  LANGUAGE sql STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM public.business_members WHERE business_id = p_business_id AND user_id = p_user_id)
  $$;
  CREATE FUNCTION public.can_business_write(p_business_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
  CREATE TABLE public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, name text NOT NULL,
    created_by uuid, quantity integer, cost numeric, updated_at timestamptz
  );
  CREATE TABLE public.purchase_orders (
    id uuid PRIMARY KEY, business_id uuid NOT NULL, supplier_id uuid, status text NOT NULL, completion text
  );
  CREATE TABLE public.purchase_order_lines (
    id uuid PRIMARY KEY, business_id uuid NOT NULL, purchase_order_id uuid NOT NULL, product_id uuid,
    brand text, model text, size_label text, load_index text, speed_rating text, supplier_sku text,
    barcode text, description text, ordered_qty integer NOT NULL, received_qty integer NOT NULL DEFAULT 0,
    agreed_unit_cost numeric
  );
  CREATE TABLE public.purchase_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, purchase_order_id uuid NOT NULL,
    receiving_employee_id uuid NOT NULL, idempotency_key uuid NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (business_id, idempotency_key)
  );
  CREATE TABLE public.purchase_receipt_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, receipt_id uuid NOT NULL,
    purchase_order_line_id uuid NOT NULL, product_id uuid NOT NULL, quantity integer NOT NULL,
    agreed_unit_cost numeric, actual_unit_cost numeric, cost_ack_employee_id uuid, cost_ack_at timestamptz, cost_reason text
  );
  CREATE TABLE public.purchase_order_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, purchase_order_id uuid NOT NULL,
    employee_id uuid, event_type text NOT NULL, detail jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE public.inventory_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid, user_id uuid, product_id uuid, action_type text,
    quantity_changed integer, currency text, purchase_unit_ils numeric, purchase_total_ils numeric, supplier_id uuid,
    notes text, timestamp timestamptz, source text, reference_type text, reference_id uuid, is_reversal boolean, reference_meta jsonb
  );
  CREATE TABLE public.inventory_lots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, product_id uuid NOT NULL,
    received_at timestamptz, original_quantity integer NOT NULL, remaining_quantity integer NOT NULL,
    unit_cost_ils numeric, supplier_id uuid, source_type text NOT NULL, receipt_reference_type text, receipt_reference_id uuid
  );
`);

await db.exec(`
  CREATE FUNCTION public.post_purchase_receipt(
    p_business_id uuid, p_order_id uuid, p_idempotency_key uuid, p_receiving_employee_id uuid,
    p_lines jsonb, p_update_current_cost boolean DEFAULT false
  ) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $post$${body}$post$;
`);

await db.exec(`
  INSERT INTO public.businesses VALUES ('${businessA}'), ('${businessB}');
  INSERT INTO public.suppliers VALUES ('${supplier}');
  INSERT INTO public.employees VALUES ('${employee}', '${businessA}', true);
  INSERT INTO public.business_members VALUES ('${businessA}', '${user}');
  INSERT INTO public.products (id, business_id, name, quantity) VALUES
    ('${linkedProduct}', '${businessA}', 'linked', 10),
    ('${chosenProduct}', '${businessA}', 'chosen', 0),
    ('${partialProduct}', '${businessA}', 'partial', 0),
    ('${failProduct}', '${businessA}', 'fail', 4),
    ('${otherChoice}', '${businessA}', 'other', 8),
    ('${foreignProduct}', '${businessB}', 'foreign', 3);
`);

function orderSql(order, business, line, product, ordered) {
  const productSql = product ? `'${product}'` : 'NULL';
  return `
    INSERT INTO public.purchase_orders (id, business_id, supplier_id, status)
    VALUES ('${order}', '${business}', '${supplier}', 'awaiting_receipt');
    INSERT INTO public.purchase_order_lines (
      id, business_id, purchase_order_id, product_id, brand, model, size_label, load_index, speed_rating,
      ordered_qty, agreed_unit_cost
    ) VALUES (
      '${line}', '${business}', '${order}', ${productSql}, 'Brand', 'Model', '205/55R16', '91', 'V', ${ordered}, 10
    );
  `;
}

await db.exec(`
  ${orderSql(ids.linkedOrder, businessA, ids.linkedLine, linkedProduct, 6)}
  ${orderSql(ids.chooseOrder, businessA, ids.chooseLine, null, 4)}
  ${orderSql(ids.createOrder, businessA, ids.createLine, null, 4)}
  ${orderSql(ids.partialOrder, businessA, ids.partialLine, null, 5)}
  ${orderSql(ids.failOrder, businessA, ids.failLine, failProduct, 3)}
  INSERT INTO public.purchase_order_lines (
    id, business_id, purchase_order_id, product_id, brand, model, size_label, load_index, speed_rating, ordered_qty, agreed_unit_cost
  ) VALUES (
    '${ids.failOpenLine}', '${businessA}', '${ids.failOrder}', NULL, 'Open', 'Spec', '195/65R15', '91', 'H', 2, 10
  );
  ${orderSql(ids.foreignOrder, businessA, ids.foreignLine, null, 1)}
  ${orderSql(ids.deniedOrder, businessB, ids.deniedLine, null, 1)}
`);

async function receive(order, key, lines) {
  await db.query(`SELECT set_config('mlaiko.user_id', $1, false)`, [user]);
  try {
    const result = await db.query(
      `SELECT public.post_purchase_receipt($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::jsonb, false) AS result`,
      [businessA, order, key, employee, JSON.stringify(lines)],
    );
    return { ok: true, result: result.rows[0].result };
  } catch (error) {
    return { ok: false, message: String(error instanceof Error ? error.message : error) };
  }
}

async function value(sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows[0];
}

function assert(name, condition) {
  if (!condition) throw new Error(`isolated receipt failed: ${name}`);
  console.log(`ok ${name}`);
}

const linkedKey = '91111111-1111-4111-8111-111111111111';
const linked = await receive(ids.linkedOrder, linkedKey, [{ line_id: ids.linkedLine, quantity: 2, actual_unit_cost: 10, cost_ack: false }]);
assert('existing product posts once', linked.ok === true && linked.result.replayed === false);
assert('existing product stock increased by the received quantity', (await value(`SELECT quantity FROM public.products WHERE id = $1`, [linkedProduct])).quantity === 12);
const replay = await receive(ids.linkedOrder, linkedKey, [{ line_id: ids.linkedLine, quantity: 2, actual_unit_cost: 10, cost_ack: false, product_id: otherChoice }]);
assert('same retry key does not receive again', replay.ok === true && replay.result.replayed === true);
assert('retry keeps the original product quantity', (await value(`SELECT quantity FROM public.products WHERE id = $1`, [linkedProduct])).quantity === 12);
assert('retry does not switch the stored product', (await value(`SELECT product_id FROM public.purchase_order_lines WHERE id = $1`, [ids.linkedLine])).product_id === linkedProduct);

const chosen = await receive(ids.chooseOrder, '92222222-2222-4222-8222-222222222222', [{
  line_id: ids.chooseLine, quantity: 4, actual_unit_cost: 10, cost_ack: false, product_id: chosenProduct,
}]);
assert('explicit existing product links the line', chosen.ok === true);
assert('linked quantity is the received quantity', (await value(`SELECT quantity FROM public.products WHERE id = $1`, [chosenProduct])).quantity === 4);
assert('line stores the chosen product', (await value(`SELECT product_id, received_qty FROM public.purchase_order_lines WHERE id = $1`, [ids.chooseLine])).product_id === chosenProduct);

const created = await receive(ids.createOrder, '93333333-3333-4333-8333-333333333333', [{
  line_id: ids.createLine, quantity: 2, actual_unit_cost: 10, cost_ack: false, create_product: true,
}]);
assert('explicit create posts', created.ok === true);
const createdLine = await value(`SELECT product_id, received_qty FROM public.purchase_order_lines WHERE id = $1`, [ids.createLine]);
assert('create stores one product on the line', createdLine.product_id !== null && createdLine.received_qty === 2);
const createdProduct = await value(`SELECT business_id, quantity, name FROM public.products WHERE id = $1`, [createdLine.product_id]);
assert('created product belongs to the receiving business and starts from the received quantity', createdProduct.business_id === businessA && createdProduct.quantity === 2 && createdProduct.name === 'Brand Model 205/55R16 91 V');
const continued = await receive(ids.createOrder, '93333333-3333-4333-8333-333333333334', [{
  line_id: ids.createLine, quantity: 2, actual_unit_cost: 10, cost_ack: false,
}]);
assert('remainder of a created product posts without creating another', continued.ok === true && continued.result.replayed === false);
assert('remainder stays on the created product', (await value(`SELECT product_id, received_qty FROM public.purchase_order_lines WHERE id = $1`, [ids.createLine])).product_id === createdLine.product_id);
assert('created product received both parts once', (await value(`SELECT quantity FROM public.products WHERE id = $1`, [createdLine.product_id])).quantity === 4);
assert('explicit create added one product', (await value(`SELECT count(*)::int AS n FROM public.products WHERE name = 'Brand Model 205/55R16 91 V'`)).n === 1);

const firstPartial = await receive(ids.partialOrder, '94444444-4444-4444-8444-444444444444', [{
  line_id: ids.partialLine, quantity: 2, actual_unit_cost: 10, cost_ack: false, product_id: partialProduct,
}]);
assert('partial receipt posts', firstPartial.ok === true);
const secondPartial = await receive(ids.partialOrder, '94444444-4444-4444-8444-444444444445', [{
  line_id: ids.partialLine, quantity: 3, actual_unit_cost: 10, cost_ack: false, product_id: otherChoice, create_product: true,
}]);
assert('remainder uses the stored product', secondPartial.ok === true && secondPartial.result.replayed === false);
const partialLine = await value(`SELECT product_id, received_qty FROM public.purchase_order_lines WHERE id = $1`, [ids.partialLine]);
assert('partial then remainder completes the same link', partialLine.product_id === partialProduct && partialLine.received_qty === 5);
assert('partial quantities add once', (await value(`SELECT quantity FROM public.products WHERE id = $1`, [partialProduct])).quantity === 5);
assert('a later product choice does not replace the stored link', (await value(`SELECT quantity FROM public.products WHERE id = $1`, [otherChoice])).quantity === 8);
assert('completed order is closed', (await value(`SELECT status FROM public.purchase_orders WHERE id = $1`, [ids.partialOrder])).status === 'completed');

const failed = await receive(ids.failOrder, '95555555-5555-4555-8555-555555555555', [
  { line_id: ids.failLine, quantity: 1, actual_unit_cost: 10, cost_ack: false },
  { line_id: ids.failOpenLine, quantity: 1, actual_unit_cost: 10, cost_ack: false },
]);
assert('one unresolved line rejects the receipt', failed.ok === false && failed.message.includes('not one catalog product'));
assert('failed receipt leaves the linked product unchanged', (await value(`SELECT quantity FROM public.products WHERE id = $1`, [failProduct])).quantity === 4);
assert('failed receipt writes no receipt row', (await value(`SELECT count(*)::int AS n FROM public.purchase_receipts WHERE purchase_order_id = $1`, [ids.failOrder])).n === 0);
assert('failed receipt does not keep a new link', (await value(`SELECT product_id, received_qty FROM public.purchase_order_lines WHERE id = $1`, [ids.failOpenLine])).product_id === null);
assert('failed receipt does not advance the first line', (await value(`SELECT received_qty FROM public.purchase_order_lines WHERE id = $1`, [ids.failLine])).received_qty === 0);

const foreign = await receive(ids.foreignOrder, '96666666-6666-4666-8666-666666666666', [{
  line_id: ids.foreignLine, quantity: 1, actual_unit_cost: 10, cost_ack: false, product_id: foreignProduct,
}]);
assert('a product from another business is rejected', foreign.ok === false && foreign.message.includes('product not found'));
assert('foreign product quantity stays unchanged', (await value(`SELECT quantity FROM public.products WHERE id = $1`, [foreignProduct])).quantity === 3);
assert('rejected foreign link is not stored', (await value(`SELECT product_id, received_qty FROM public.purchase_order_lines WHERE id = $1`, [ids.foreignLine])).received_qty === 0);

await db.query(`SELECT set_config('mlaiko.user_id', $1, false)`, [user]);
let denied = '';
try {
  await db.query(
    `SELECT public.post_purchase_receipt($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::jsonb, false)`,
    [businessB, ids.deniedOrder, '97777777-7777-4777-8777-777777777777', employee, JSON.stringify([{ line_id: ids.deniedLine, quantity: 1, actual_unit_cost: 10, cost_ack: false, create_product: true }])],
  );
} catch (error) {
  denied = String(error instanceof Error ? error.message : error);
}
assert('another business is rejected before stock changes', denied.includes('access denied'));
assert('rejected business created no product', (await value(`SELECT count(*)::int AS n FROM public.products WHERE business_id = $1`, [businessB])).n === 1);

console.log('isolated purchase receipt scenarios passed');
