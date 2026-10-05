#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import process from 'node:process';
import { analyzeTransactions, createPortfolioCsv } from './portfolio.js';

function usage() {
  return `Usage:
  degiro-portfolio <transactions.csv> <portfolio.csv> [--include-closed]

Options:
  --include-closed  Include products whose current quantity is zero.
  -h, --help        Show this help.`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) {
    console.log(usage());
    return;
  }

  const includeClosed = args.includes('--include-closed');
  const files = args.filter((argument) => argument !== '--include-closed');
  if (files.length !== 2) {
    throw new Error(usage());
  }

  const [inputPath, outputPath] = files;
  const input = await readFile(inputPath, 'utf8');
  const positions = analyzeTransactions(input);
  const output = createPortfolioCsv(positions, { includeClosed });
  await writeFile(outputPath, output, 'utf8');
  const openCount = positions.filter((position) => position.quantity !== 0).length;
  console.log(`Created ${basename(outputPath)} with ${openCount} open positions.`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
