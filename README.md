# DEGIRO portfolio CSV

A dependency-free command-line tool for Node.js 24.21 that converts an English
DEGIRO **Transactions** CSV export into a current portfolio overview in EUR.

## Requirements

- Node.js 24.21 or newer
- An English DEGIRO Transactions CSV export

No installation of third-party packages is required.

## Usage

```sh
node src/cli.js Transactions.csv portfolio.csv
```

Closed positions are omitted by default. Include them for reconciliation with:

```sh
node src/cli.js Transactions.csv portfolio.csv --include-closed
```

The output contains:

- `Quantity`: current number of units.
- `Acquisition cost EUR`: acquisition cost of the remaining units, including
  transaction and AutoFX fees present in DEGIRO's `Total EUR` value.
- `Average acquisition price EUR`: acquisition cost divided by current quantity.
- `Net invested EUR`: all cash paid minus all cash received for the product,
  including fees. This differs from acquisition cost after a sale.

## Calculation method

Transactions are processed chronologically. Purchases add their absolute
`Total EUR` to the acquisition cost. Sales remove the sold units at the current
weighted-average acquisition price. Sale proceeds affect `Net invested EUR`,
but not the acquisition cost of the remaining units.

Paired, cash-neutral rows without an order ID are treated as corporate actions
(for example, a stock split). Their net quantity change is applied while the
existing EUR acquisition cost is preserved.

The tool reports historical DEGIRO `Product` labels separately, even when two
labels share an ISIN. It does not fetch market prices, so the result is a cost
overview rather than a current market valuation.

## Tests

```sh
npm test
```

The test suite uses only Node.js built-in modules and synthetic data. Personal
DEGIRO exports should not be committed to a repository.

## Input assumptions

The CSV must use DEGIRO's English headers and contain `Date`, `Time`, `Product`,
`ISIN`, `Quantity`, `Value EUR`, `Total EUR`, and `Order ID`. European decimal
commas and quoted CSV fields are supported.

## License

MIT
