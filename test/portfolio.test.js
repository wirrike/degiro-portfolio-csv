import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseCsv } from '../src/csv.js';
import { analyzeTransactions, createPortfolioCsv } from '../src/portfolio.js';

const fixtureUrl = new URL('./fixtures/transactions.csv', import.meta.url);

test('calculates moving-average acquisition cost and preserves it through a stock split', async () => {
  const input = await readFile(fixtureUrl, 'utf8');
  const positions = analyzeTransactions(input);

  assert.deepEqual(positions, [
    {
      product: 'ALPHA',
      isin: 'XX0000000001',
      quantity: 1,
      acquisitionCostEur: 10.5,
      netInvestedEur: 7,
    },
    {
      product: 'BETA',
      isin: 'XX0000000002',
      quantity: 20,
      acquisitionCostEur: 202,
      netInvestedEur: 202,
    },
  ]);
});

test('writes a valid portfolio CSV', async () => {
  const input = await readFile(fixtureUrl, 'utf8');
  const output = createPortfolioCsv(analyzeTransactions(input));
  const rows = parseCsv(output);

  assert.deepEqual(rows[0], [
    'Product', 'ISIN', 'Quantity', 'Acquisition cost EUR',
    'Average acquisition price EUR', 'Net invested EUR',
  ]);
  assert.deepEqual(rows[1], ['ALPHA', 'XX0000000001', '1', '10.50', '10.5000', '7.00']);
  assert.deepEqual(rows[2], ['BETA', 'XX0000000002', '20', '202.00', '10.1000', '202.00']);
});
