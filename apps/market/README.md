# Travely delay market

Browser companion for the Travely flight delay market on Sui testnet. It uses the current Sui dApp Kit and a Sui wallet. The mobile flight detail card opens it with the flight identity and scheduled times.

## Local demo

```sh
cd ../..
bun install
cp apps/market/.env.example apps/market/.env
bun run dev:market
```

Open `http://localhost:5173`. The page loads a funded fictional flight market by default. To open it from Expo, set `EXPO_PUBLIC_MARKET_URL=http://localhost:5173` in `apps/mobile/.env` and restart Expo. A physical device needs the computer's LAN or public URL instead of `localhost`.

Testnet deployment:

| Item | ID |
| --- | --- |
| Package | `0x15b2b349eb5b7ef96ba76fe50db525134b99b86ff38986ad64ba71c879d9805a` |
| Market | `0x97239901832c279a3f93b89c86d49fdc12609e794d48d1b44916d29038a5705a` |
| LP share | `0x22ca1f20c0c4a3f6f4ee7b11d21e37deacf2242c87610d07d81cb0124c524125` |
| ResolverCap | `0xbd54fc1c0b0ea4ce5b0e77b6be8c70d6c19a393f47793ffbe9d729c8299d5110` |
| Publish transaction | `F5U3RH4cWWGyLHDjkjueViK7abHwt8dQ8N4p6WHbh1Yw` |
| Seed transaction | `Ft4aC18SL5xzRd6j96E69xiGUgDiuczkBJXzhoPCKGEi` |

The fictional DEMO DM042 is HND–KIX on 2026-09-26, scheduled 18:00–19:10 JST. Its market closes at 17:50 JST, began with a 0.4 testnet SUI reserve, and expires at 19:10 JST the next day. A 0.05 SUI testnet purchase of a 0.1 SUI YES position was confirmed in transaction `G9cmhr7KBY8Y3VvGb2iiQxRvoCeqeoFiHnb524r38eUD`; the market currently holds 0.45 SUI. The winning YES threshold is an arrival at or after 19:40 JST. There is no claim that this fictional flight actually operates.

To create a market for another flight, connect a Sui testnet wallet with test SUI, enter the flight identity and scheduled ISO times with offset, and choose the initial reserve. The web app signs the creation and the seed deposit in one transaction. It scans the latest 50 creation events for a matching flight when opened from Travely; enter the market ID manually for older markets.

The flight fingerprint is SHA-256 of `OPERATOR|NUMBER|YYYY-MM-DD|ORIGIN|DESTINATION|DEPARTURE_MS|ARRIVAL_MS`, with identity fields trimmed and uppercased. The app compares it with the onchain fingerprint before allowing an action on a linked flight.

## Resolution and limits

The wallet holding `ResolverCap` enters the **actual final arrival** after the scheduled arrival. The contract decides whether the 30-minute threshold was met. This is a trusted reporter for the prototype, not an independent oracle. The reporter should verify the provider's final timestamp and route before submitting. If no report arrives by the deadline, anyone can cancel; positions refund their premiums. LP withdrawal keeps cash for outstanding winning claims or refunds.

For a real AeroDataBox flight, `scripts/resolve.ts` checks the proxy's final runway time against the market's immutable flight fingerprint and schedule. It rejects stale/degraded route fallbacks, non-final status, missing final times, and mismatched market data. It prints the result first and submits only when `--execute` is passed. It uses the Sui CLI keystore for signing; no private key belongs in the web app or script environment.

```sh
TRAVELY_PROXY_URL=http://localhost:8787 TRAVELY_PROXY_KEY=... SUI_CLIENT_CONFIG=/path/to/testnet-client.yaml \
  bun apps/market/scripts/resolve.ts --market 0x... --cap 0x... --flight AF123 --date 2026-09-26 --origin CDG --destination HND
# After reviewing the output, repeat the command with --execute.
```

The seed market is fictional, so it cannot be resolved through AeroDataBox. Its ResolverCap holder can demonstrate the resolution path using the web form once the scheduled arrival has passed. The meaning of “arrival” for a real AeroDataBox flight is its final runway timestamp.

Market prices respond to outstanding YES and NO payout exposure. They are simple testnet prototype prices, not a calibrated probability or a guaranteed return. There is no production claim, real-money liquidity, or automated flight-data attestation.

## Checks

```sh
bun run --cwd apps/market typecheck
bun run --cwd apps/market lint
bun run --cwd apps/market test
bun run --cwd apps/market build
```
