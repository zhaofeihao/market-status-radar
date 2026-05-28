# Price Index Status Design

## Goal

When a user searches a coin, each exchange row should also show public market prices for the same coin where the exchange exposes them: spot last price, contract last price, index price, and mark price.

## Scope

- Add a `price` object to every `ExchangeCoinStatus`.
- Use public endpoints only for price data.
- Keep the existing API-key flow unchanged; configured keys are still used only for funding endpoints.
- Do not block trading or funding status if any price endpoint fails.
- Display compact price lines in the result table.

## Data Model

`ExchangeCoinStatus.price` contains:

- `quote`: display quote such as `USDT`, `USD`, or `USDT/USD`.
- `spotLastPrice`: spot market last price when available.
- `contractLastPrice`: contract ticker last price when available.
- `indexPrice`: contract or public index price when available.
- `markPrice`: contract mark price when available.
- `source`: `public` when at least one price field was loaded, otherwise `unavailable`.
- `warnings`: price-specific warning messages.

## Exchange Endpoints

- Binance: spot ticker price, USD-M futures ticker price, and premium index.
- OKX: spot ticker, swap ticker, index ticker, and public mark price.
- Bybit: spot and linear market tickers.
- Gate.io: spot tickers and USDT futures tickers.
- Bitget: spot market tickers and mix symbol price.
- Kraken: spot REST ticker and futures tickers.
- HTX: spot merged ticker and linear swap index / merged ticker.

## Error Handling

Price requests run independently from market and funding requests. If one price endpoint fails, the adapter returns any price fields it did obtain. If all price endpoints fail, `price.source` is `unavailable` and the row remains otherwise usable.

## UI

Add a `Price` column before chain status. The cell shows only available fields:

- `Spot <value>`
- `Contract <value>`
- `Index <value>`
- `Mark <value>`

If no price field is available, show `Price unavailable`. Price warnings appear with the existing row warnings.

## Testing

- Adapter tests cover price mapping for representative exchange response shapes.
- UI tests cover rendering the new price cell.
- Existing search, credential, and filtering behavior must keep passing.
