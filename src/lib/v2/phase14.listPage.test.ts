import assert from 'node:assert/strict';
import { clampPage, pageSlice } from '@/lib/v2/listPage';

const rows = Array.from({ length: 722 }, (_, index) => index + 1);
const first = pageSlice(rows, 1, 25);
assert.equal(first.items.length, 25);
assert.equal(first.from, 1);
assert.equal(first.to, 25);
assert.equal(first.pages, 29);
const last = pageSlice(rows, 29, 25);
assert.equal(last.items.length, 22);
assert.equal(last.items[0], 701);
assert.equal(clampPage(40, 30, 25), 2);
assert.equal(pageSlice(rows, 9, 100).page, 8);
assert.equal(pageSlice([], 4, 25).items.length, 0);
assert.equal(pageSlice([], 4, 25).from, 0);
console.log('phase14 procurement list assertions passed');
