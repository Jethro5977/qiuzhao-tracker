import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBatch } from '../lib/batch.ts';

test('two-column batch import detects delimiters, invalid lines and duplicates inside the batch', () => {
  const rows = parseBatch('公司A\t前端工程师\n公司A|前端工程师\n公司B,后端工程师\n只有公司', []);
  assert.deepEqual(rows.map((row) => row.state), ['ready', 'duplicate', 'ready', 'invalid']);
  assert.equal(rows[2].job?.company, '公司B');
});
