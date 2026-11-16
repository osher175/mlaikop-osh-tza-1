import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advance,
  buildOrderPayload,
  catalogMessage,
  claimSubmit,
  creationResult,
  emptyDraft,
  emptyLine,
  loadCode,
  retreat,
  submissionMessage,
  supplierMessage,
  tireSizeLabel,
  validateDetails,
  wizardTotals,
  WIZARD_NOTICE,
  type WizardDraft,
  type WizardLine,
} from './importOrderWizard.ts';

const today = '2026-11-12';

function readyDetails(extra: Partial<WizardDraft> = {}): WizardDraft {
  return {
    ...emptyDraft(today, '11111111-1111-4111-8111-111111111111'),
    supplierId: '11111111-1111-4111-8111-111111111111',
    purchaseType: 'direct_import',
    currency: 'USD',
    orderDate: today,
    ...extra,
  };
}

function line(partial: Partial<WizardLine> = {}): WizardLine {
  return {
    ...emptyLine('a'),
    productId: '22222222-2222-4222-8222-222222222222',
    productName: 'צמיג שמור',
    brandName: 'מותג',
    modelName: 'דגם',
    sizeLabel: '205/55R16',
    quantity: '50',
    unitPrice: '15',
    ...partial,
  };
}

test('step navigation keeps the entered values', () => {
  const draft = readyDetails({ reference: 'PO-9', lines: [line()] });
  const next = advance(draft, 1);
  assert.equal(next.step, 2);
  assert.equal(draft.reference, 'PO-9');
  assert.equal(advance(draft, 2).step, 3);
  assert.equal(retreat(3), 2);
  assert.equal(retreat(2), 1);
  assert.equal(draft.lines[0].unitPrice, '15');
});

test('required order fields block the first step', () => {
  const errors = validateDetails(emptyDraft(today));
  assert.equal(errors.some((error) => error.includes('ספק')), true);
  assert.equal(errors.some((error) => error.includes('מטבע')), true);
  assert.equal(advance(emptyDraft(today), 1).step, 1);
});

test('several product rows keep their own quantity and price', () => {
  const draft = readyDetails({
    lines: [
      line({ key: 'a', quantity: '50', unitPrice: '15' }),
      line({
        key: 'b',
        productId: '33333333-3333-4333-8333-333333333333',
        quantity: '100',
        unitPrice: '20',
        productName: 'צמיג שני',
      }),
    ],
  });
  const totals = wizardTotals(draft.lines);
  assert.equal(totals.lineCount, 2);
  assert.equal(totals.quantity, 150);
  assert.equal(totals.value, 2750);
  assert.equal(advance(draft, 2).errors.length, 0);
});

test('a missing supplier price is rejected and a typed zero is kept', () => {
  const missing = readyDetails({ lines: [line({ unitPrice: '' })] });
  assert.equal(advance(missing, 2).errors.some((error) => error.includes('מחיר ספק')), true);
  const zero = buildOrderPayload(readyDetails({ lines: [line({ unitPrice: '0' })] }));
  assert.equal(zero.ok && zero.payload.lines[0].supplier_unit_cost, 0);
});

test('planned selling price is optional and is not turned into zero', () => {
  const built = buildOrderPayload(readyDetails({ lines: [line({ plannedSale: '' })] }));
  assert.equal(built.ok && built.payload.lines[0].planned_sale_price_ils, null);
  const priced = buildOrderPayload(readyDetails({ lines: [line({ plannedSale: '620' })] }));
  assert.equal(priced.ok && priced.payload.lines[0].planned_sale_price_ils, 620);
});

test('a missing working rate stays null', () => {
  const built = buildOrderPayload(readyDetails({ rate: '', lines: [line()] }));
  assert.equal(built.ok && built.payload.working_exchange_rate_to_ils, null);
  assert.equal(advance(readyDetails({ rate: '' }), 1).errors.length, 0);
  assert.equal(validateDetails(readyDetails({ rate: '1' })).length, 0);
  assert.equal(validateDetails(readyDetails({ rate: '0' })).some((error) => error.includes('שער')), true);
});

test('line currency follows the selected order currency', () => {
  const built = buildOrderPayload(readyDetails({ currency: 'EUR', lines: [line()] }));
  assert.equal(built.ok && built.payload.currency_code, 'EUR');
  assert.equal(built.ok && 'currency_code' in built.payload.lines[0], false);
  assert.equal(validateDetails(readyDetails({ currency: 'ABC' })).some((error) => error.includes('מטבע')), true);
});

test('empty suppliers and an unavailable catalog are explicit', () => {
  assert.match(supplierMessage(0, false) ?? '', /אין ספקי יבוא/);
  assert.match(supplierMessage(null, true, 'column serves_import does not exist') ?? '', /לא קיים במסד/);
  assert.match(supplierMessage(null, true) ?? '', /לא ניתן לטעון/);
  assert.equal(supplierMessage(2, false), null);
  assert.match(catalogMessage(0, false) ?? '', /אין מוצרים/);
  assert.match(catalogMessage(null, true) ?? '', /לא ניתן לטעון/);
  assert.equal(catalogMessage(4, false), null);
});

test('a failed submission does not navigate or claim success', () => {
  const result = creationResult({ ok: false, id: '11111111-1111-4111-8111-111111111111' });
  assert.equal(result.success, false);
  assert.equal(result.navigateTo, null);
  assert.match(submissionMessage(new Error('row-level security')), /אין הרשאה/);
  assert.match(submissionMessage(null), /לא נשמרה/);
});

test('a second submit is refused while the first is in flight', () => {
  const first = claimSubmit(false);
  assert.equal(first.ok, true);
  assert.equal(claimSubmit(first.inFlight).ok, false);
});

test('the saved payload has no stock, payment, receipt, or landed-cost fields', () => {
  const built = buildOrderPayload(readyDetails({ lines: [line()] }));
  assert.equal(built.ok, true);
  if (!built.ok) return;
  const encoded = JSON.stringify(built.payload);
  for (const key of ['received_quantity', 'import_payments', 'import_receipts', 'inventory', 'expected_unit_cost_ils', 'import_number', 'shipment']) {
    assert.equal(encoded.includes(key), false);
  }
  assert.equal(built.payload.client_request_id, '11111111-1111-4111-8111-111111111111');
  assert.equal(built.payload.lines[0].ordered_quantity, 50);
  assert.match(WIZARD_NOTICE, /אינה משנה מלאי/);
});

test('success navigates by the persisted record id', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  assert.equal(creationResult({ ok: true, id }).navigateTo, `/import/${id}`);
  assert.equal(creationResult({ ok: true, id: 'IMP-2026-0002' }).navigateTo, null);
});

test('a tire size is composed only from stored spec parts', () => {
  assert.equal(tireSizeLabel({ width_mm: 205, aspect_ratio: 55, rim_inch: 16, load_index: 91, speed_rating: 'V' }), '205/55R16 91V');
  assert.equal(tireSizeLabel({ width_mm: 205, aspect_ratio: null, rim_inch: 16 }), null);
  assert.equal(tireSizeLabel(null), null);
});

test('a new tire keeps load and speed apart', () => {
  const built = buildOrderPayload(readyDetails({
    lines: [line({
      definition: 'new',
      productId: '',
      width: '195',
      aspect: '65',
      rim: '15',
      loadIndex: '91',
      speedRating: 'v',
    })],
  }));
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.payload.lines[0].load_index, 91);
  assert.equal(built.payload.lines[0].speed_rating, 'V');
  assert.equal(built.payload.lines[0].size_label, '195/65R15 91V');
  const wider = buildOrderPayload(readyDetails({
    lines: [line({
      definition: 'new',
      productId: '',
      width: '205',
      aspect: '55',
      rim: '16',
      loadIndex: '104',
      speedRating: 'W',
    })],
  }));
  assert.equal(wider.ok && wider.payload.lines[0].load_index, 104);
  assert.equal(wider.ok && wider.payload.lines[0].speed_rating, 'W');
  assert.equal(wider.ok && wider.payload.lines[0].size_label, '205/55R16 104W');
  const missing = advance(readyDetails({
    lines: [line({
      definition: 'new',
      productId: '',
      width: '195',
      aspect: '65',
      rim: '15',
      loadIndex: '',
      speedRating: 'V',
    })],
  }), 2);
  assert.equal(missing.step, 2);
  assert.equal(missing.errors.some((error) => error.includes('קוד עומס')), true);
  assert.equal(loadCode('101'), 101);
  assert.equal(loadCode('94'), 94);
  assert.equal(loadCode(''), null);
  assert.equal(loadCode('091'), null);
});
