# Travely delay market

Browser companion for the Travely flight delay market on Sui testnet. It uses the current Sui dApp Kit and a Sui wallet. The mobile flight detail card opens it with the flight identity and scheduled times.

## Local demo

```sh
cd ../..
bun install
cp apps/market/.env.example apps/market/.env
bun run dev:market
```

Open `http://localhost:5173`. Configure `VITE_MARKET_PACKAGE_ID` with the current package and optionally set `VITE_MARKET_ID` to open one market. The browser UI is an operator companion: a Sui wallet pays its own gas and can create, fund and resolve markets. The mobile traveller flow is separate and uses zkLogin plus sponsored gas.

Markets use native Circle USDC on Sui testnet, with six decimal places. Purchases add a 1% service fee to the quoted premium. A winning claim deducts 0.5% from the gross payout. Cancellation refunds both the premium and its purchase fee.

The current testnet package is `0x364922c3a44683eed8c1e05b5bf1b79d4c3a88ac2ad748b295740e4fb4e04da2`, published in transaction `HcjCgC2kfNq8sL7goEWKfRBy88HZYg269H7JBMzeCkwF`.

## Deterministic demo markets

The shared manifest defines two future fictional flights:

- `DM042`, CDG–LIS, 15 October 2026;
- `DM117`, LHR–JFK, 20 October 2026.

Each flight has one market for 30 minutes, 1 hour, 2 hours, 4 hours and 6 hours, for ten `Market<USDC>` objects in total. The seeder contributes 1.9 test USDC per market and skips combinations already emitted by the package.

Use a dedicated testnet operator address, fund it with at least 19 test USDC through the Circle faucet and enough SUI for gas, then set its testnet-only private key locally:

```sh
SUI_PACKAGE_ID=0x... SUI_OPERATOR_PRIVATE_KEY=suiprivkey... \
  bun run --cwd apps/market seed:demo
```

Never commit the operator key or reuse a key that controls real assets. The returned `ResolverCap`, `FeeCap` and LP shares remain owned by that operator address.

The current ten-market batch was created in transaction `6UQjTouGoYnMwwmPd9wZxq1cP7t7gUQDnTFBNkcuQNkT`, with 1.9 test USDC per market.

The flight fingerprint is SHA-256 of `OPERATOR|NUMBER|YYYY-MM-DD|ORIGIN|DESTINATION|DEPARTURE_MS|ARRIVAL_MS`, with identity fields trimmed and uppercased. The app compares it with the onchain fingerprint before allowing an action on a linked flight.

## Resolution and limits

The wallet holding `ResolverCap` enters the **actual final arrival** after the scheduled arrival. The contract decides whether that market's immutable threshold was met. This is a trusted reporter for the prototype, not an independent oracle. The reporter should verify the provider's final timestamp and route before submitting. If no report arrives by the deadline, anyone can cancel; positions refund their premiums and purchase fees. LP withdrawal keeps cash for outstanding winning claims or refunds.

For a real AeroDataBox flight, `scripts/resolve.ts` checks the proxy's final runway time against the market's immutable flight fingerprint and schedule. It rejects stale/degraded route fallbacks, non-final status, missing final times, and mismatched market data. It prints the result first and submits only when `--execute` is passed. It uses the Sui CLI keystore for signing; no private key belongs in the web app or script environment.

```sh
TRAVELY_PROXY_URL=http://localhost:8787 TRAVELY_PROXY_KEY=... SUI_CLIENT_CONFIG=/path/to/testnet-client.yaml \
  bun apps/market/scripts/resolve.ts --market 0x... --cap 0x... --flight AF123 --date 2026-09-26 --origin CDG --destination HND
# After reviewing the output, repeat the command with --execute.
```

The demo flights are fictional, so they cannot be resolved through AeroDataBox. Their `ResolverCap` holder can demonstrate the resolution path using the web form once the scheduled arrival has passed. The meaning of “arrival” for a real AeroDataBox flight is its final runway timestamp.

Market prices respond to outstanding YES and NO payout exposure. They are simple testnet prototype prices, not a calibrated probability or a guaranteed return. There is no production claim, real-money liquidity, or automated flight-data attestation.

## Checks

```sh
bun run --cwd apps/market typecheck
bun run --cwd apps/market lint
bun run --cwd apps/market test
bun run --cwd apps/market build
```
