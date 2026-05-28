# Index Components Design

## Goal

When a user searches a coin, show which public index components are used by each exchange's contract index price when the exchange exposes this data.

## Scope

- Add index component data under the existing `price` object.
- Use public endpoints only.
- Support direct public component APIs for Binance, OKX, Gate.io, and Bitget.
- Mark Bybit, Kraken, and HTX as unavailable when no direct public component API is integrated.
- Keep component failures isolated from trading, funding, and price status.

## Data Model

Each `ExchangePriceStatus` can include:

- `indexComponentSource`: `public` or `unavailable`.
- `indexComponents`: a list of component rows.

Each component row contains:

- `exchange`: source exchange name.
- `symbol`: source symbol or spot pair.
- `price`: component or equivalent price.
- `weight`: calculation weight as returned by the exchange.

## Endpoint Mapping

- Binance: `GET https://fapi.binance.com/fapi/v1/constituents?symbol={COIN}USDT`
- OKX: `GET https://www.okx.com/api/v5/market/index-components?index={COIN}-USDT`
- Gate.io: `GET https://api.gateio.ws/api/v4/futures/usdt/index_constituents/{COIN}_USDT`
- Bitget: `GET https://api.bitget.com/api/v3/market/index-components?symbol={COIN}USDT`

## UI

The price cell shows a compact `Components N` details section when components are available. Expanding it shows exchange, symbol, price, and weight. If no public component API is integrated or the request fails, the row shows `Components unavailable` only when there is room in the price cell; detailed warnings remain in the row warnings.

## Error Handling

Component requests are best-effort. A timeout, unsupported symbol, or malformed response returns `indexComponentSource: "unavailable"` and an empty `indexComponents` array without changing the row's spot, contract, funding, or price fields.

## Testing

- Adapter tests verify Binance and OKX component mapping.
- Existing adapter tests continue to pass for all exchanges.
- Frontend tests verify the component summary and at least one weighted source row render after search.
