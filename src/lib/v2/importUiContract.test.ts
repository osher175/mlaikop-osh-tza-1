import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const uiFiles = [
  'src/pages/ImportCenter.tsx',
  'src/pages/ImportOrderDetail.tsx',
  'src/components/import/center/ImportOrderCard.tsx',
  'src/components/import/wizard/StepOrderDetails.tsx',
  'src/hooks/useImportDashboard.tsx',
  'src/App.tsx',
];

const sampleData = [
  'IMP-2026-0001',
  'IMP-2026-0007',
  'Michelin Europe',
  'Linglong Comfort',
  'Pilot Sport 4',
  'FAL-FK520',
];

test('approved mockup samples are not rendered by the import UI', () => {
  for (const file of uiFiles) {
    const source = readFileSync(file, 'utf8');
    for (const sample of sampleData) {
      assert.equal(source.includes(sample), false, `${file} contains ${sample}`);
    }
  }
});

test('the new receiving label cannot post inventory', () => {
  const detail = readFileSync('src/pages/ImportOrderDetail.tsx', 'utf8');
  const routes = readFileSync('src/App.tsx', 'utf8');
  assert.equal(detail.includes('FUTURE_RECEIVING_LABEL'), true);
  assert.equal(detail.includes('import_receipt_confirm'), false);
  assert.equal(routes.includes('/import/:id/receiving'), false);
  assert.match(detail, /\{FUTURE_RECEIVING_LABEL\}/);
  assert.match(detail, /disabled title="מסך הקליטה החדש אינו פעיל"/);
});

test('an empty business has its own message and a failed load does not', () => {
  const center = readFileSync('src/pages/ImportCenter.tsx', 'utf8');
  assert.equal(center.includes('עדיין לא נפתחו הזמנות יבוא'), true);
  assert.equal(center.includes('לא ניתן לטעון את הזמנות היבוא'), true);
  assert.equal(center.includes("view === 'empty'"), true);
  assert.equal(center.includes("view === 'filtered-empty'"), true);
});
