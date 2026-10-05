import { parseCsv, stringifyCsv } from './csv.js';

const REQUIRED_HEADERS = ['Date', 'Time', 'Product', 'ISIN', 'Quantity', 'Value EUR', 'Total EUR', 'Order ID'];
const EPSILON = 1e-9;

function parseEuropeanNumber(value, label, rowNumber) {
  const normalized = value.trim().replaceAll('\u00a0', '').replaceAll(' ', '').replace(',', '.');
  if (normalized === '') return 0;
  const number = Number(normalized);
  if (!Number.isFinite(number)) {
    throw new Error(`Invalid ${label} on CSV row ${rowNumber}: ${JSON.stringify(value)}`);
  }
  return number;
}

function timestamp(date, time, rowNumber) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(date);
  if (!match || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error(`Invalid date or time on CSV row ${rowNumber}: ${date} ${time}`);
  }
  const [, day, month, year] = match;
  return `${year}-${month}-${day}T${time}`;
}

function readTransactions(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length === 0) throw new Error('The input CSV is empty.');

  const headers = rows[0];
  const indexes = Object.fromEntries(REQUIRED_HEADERS.map((header) => [header, headers.indexOf(header)]));
  const missing = REQUIRED_HEADERS.filter((header) => indexes[header] === -1);
  if (missing.length > 0) {
    throw new Error(`Unsupported DEGIRO export. Missing columns: ${missing.join(', ')}`);
  }

  return rows.slice(1).map((row, offset) => {
    const rowNumber = offset + 2;
    const product = row[indexes.Product]?.trim() ?? '';
    const isin = row[indexes.ISIN]?.trim() ?? '';
    if (product === '' || isin === '') {
      throw new Error(`Missing Product or ISIN on CSV row ${rowNumber}.`);
    }
    const date = row[indexes.Date]?.trim() ?? '';
    const time = row[indexes.Time]?.trim() ?? '';
    return {
      product,
      isin,
      date,
      time,
      timestamp: timestamp(date, time, rowNumber),
      quantity: parseEuropeanNumber(row[indexes.Quantity] ?? '', 'Quantity', rowNumber),
      valueEur: parseEuropeanNumber(row[indexes['Value EUR']] ?? '', 'Value EUR', rowNumber),
      totalEur: parseEuropeanNumber(row[indexes['Total EUR']] ?? '', 'Total EUR', rowNumber),
      orderId: row[indexes['Order ID']]?.trim() ?? '',
      rowNumber,
    };
  });
}

function isCorporateAction(group) {
  if (group.length < 2 || group.some((transaction) => transaction.orderId !== '')) return false;
  const hasPositive = group.some((transaction) => transaction.quantity > EPSILON);
  const hasNegative = group.some((transaction) => transaction.quantity < -EPSILON);
  const totalValue = group.reduce((sum, transaction) => sum + transaction.valueEur, 0);
  const totalCash = group.reduce((sum, transaction) => sum + transaction.totalEur, 0);
  return hasPositive && hasNegative && Math.abs(totalValue) < 0.005 && Math.abs(totalCash) < 0.005;
}

function clean(number) {
  return Math.abs(number) < EPSILON ? 0 : number;
}

export function analyzeTransactions(csvText) {
  const transactions = readTransactions(csvText).sort(
    (left, right) => left.timestamp.localeCompare(right.timestamp) || left.rowNumber - right.rowNumber,
  );
  const positions = new Map();

  for (let start = 0; start < transactions.length;) {
    const first = transactions[start];
    const key = `${first.product}\u0000${first.isin}`;
    let end = start + 1;
    while (
      end < transactions.length
      && transactions[end].timestamp === first.timestamp
      && transactions[end].product === first.product
      && transactions[end].isin === first.isin
    ) end += 1;
    const group = transactions.slice(start, end);

    const position = positions.get(key) ?? {
      product: first.product,
      isin: first.isin,
      quantity: 0,
      acquisitionCostEur: 0,
      netInvestedEur: 0,
    };

    if (isCorporateAction(group)) {
      position.quantity += group.reduce((sum, transaction) => sum + transaction.quantity, 0);
      position.netInvestedEur -= group.reduce((sum, transaction) => sum + transaction.totalEur, 0);
    } else {
      for (const transaction of group) {
        position.netInvestedEur -= transaction.totalEur;
        if (transaction.quantity > EPSILON) {
          position.quantity += transaction.quantity;
          position.acquisitionCostEur += -transaction.totalEur;
        } else if (transaction.quantity < -EPSILON) {
          const sold = -transaction.quantity;
          if (sold > position.quantity + EPSILON) {
            throw new Error(
              `Position ${position.product} (${position.isin}) is oversold on CSV row ${transaction.rowNumber}.`,
            );
          }
          const averageCost = position.quantity > EPSILON
            ? position.acquisitionCostEur / position.quantity
            : 0;
          position.acquisitionCostEur -= averageCost * sold;
          position.quantity -= sold;
        }
      }
    }

    position.quantity = clean(position.quantity);
    position.acquisitionCostEur = clean(position.acquisitionCostEur);
    position.netInvestedEur = clean(position.netInvestedEur);
    positions.set(key, position);
    start = end;
  }

  return [...positions.values()].sort((left, right) => (
    left.product.localeCompare(right.product, 'en', { numeric: true }) || left.isin.localeCompare(right.isin)
  ));
}

function formatNumber(value, maximumDecimals) {
  return value.toFixed(maximumDecimals).replace(/\.?0+$/, '');
}

export function createPortfolioCsv(positions, { includeClosed = false } = {}) {
  const rows = [[
    'Product',
    'ISIN',
    'Quantity',
    'Acquisition cost EUR',
    'Average acquisition price EUR',
    'Net invested EUR',
  ]];

  for (const position of positions) {
    if (!includeClosed && Math.abs(position.quantity) < EPSILON) continue;
    const average = position.quantity > EPSILON
      ? position.acquisitionCostEur / position.quantity
      : 0;
    rows.push([
      position.product,
      position.isin,
      formatNumber(position.quantity, 10),
      position.acquisitionCostEur.toFixed(2),
      average.toFixed(4),
      position.netInvestedEur.toFixed(2),
    ]);
  }
  return stringifyCsv(rows);
}
