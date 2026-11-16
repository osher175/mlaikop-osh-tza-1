import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { classificationColumn, missingClassificationColumn } from './supplierClassification.ts';

const sql = readFileSync('docs/v2/import-upgrade/i3/01-import-wizard-commit.UNAPPLIED.sql', 'utf8');
const commit = sql.slice(sql.indexOf('FUNCTION public.import_wizard_commit'), sql.indexOf('REVOKE ALL ON FUNCTION public.import_wizard_commit'));

test('supplier lists use the classification column for each channel', () => {
  assert.equal(classificationColumn('import'), 'serves_import');
  assert.equal(classificationColumn('local'), 'serves_local');
  assert.equal(missingClassificationColumn({ code: '42703', message: 'column serves_import does not exist' }), true);
  assert.equal(missingClassificationColumn({ message: 'permission denied' }), false);
});

test('the unapplied wizard function does not post stock and keeps both channels', () => {
  assert.match(commit, /SECURITY INVOKER/);
  assert.doesNotMatch(commit, /UPDATE public\.products/);
  assert.doesNotMatch(commit, /INSERT INTO public\.inventory_actions/);
  assert.match(commit, /,\s*0,\s*auth\.uid\(\)/);
  assert.match(commit, /serves_import = true/);
  assert.match(sql, /CHECK \(serves_import OR serves_local\)/);
  assert.match(sql, /serves_local\s*\n\s*\) VALUES \([\s\S]*false/);
  assert.match(sql, /BEFORE INSERT OR UPDATE OF supplier_id ON public\.inventory_actions/);
  assert.match(commit, /planned_sale_price_ils, load_index, speed_rating/);
  assert.match(commit, /v_load,\s*\n\s*v_speed/);
  assert.match(commit, /FROM public\.purchase_order_lines pol/);
  assert.match(commit, /po\.business_id = v_business/);
  assert.match(commit, /Ambiguous tire identity/);
  assert.doesNotMatch(commit, /UPDATE public\.products/);
  assert.doesNotMatch(commit, /products\.barcode|p\.name|ilike/);
  assert.doesNotMatch(sql, /ON public\.import_orders[\s\S]{0,120}reject_import_only_supplier/);
});
