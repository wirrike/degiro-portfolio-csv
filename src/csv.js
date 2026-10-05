export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  const input = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field !== '') {
        throw new Error('Invalid CSV: quote inside an unquoted field.');
      }
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (character !== '\r') {
      field += character;
    }
  }

  if (quoted) {
    throw new Error('Invalid CSV: unterminated quoted field.');
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((value) => value !== ''));
}

function escapeCsvField(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function stringifyCsv(rows) {
  return `${rows.map((row) => row.map(escapeCsvField).join(',')).join('\n')}\n`;
}
