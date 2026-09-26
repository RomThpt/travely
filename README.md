# Travely

Travely tracks flights and trains with live transport data, weather, and local delay alerts. Ferries and buses are available through a clearly labelled demo catalogue. Completed legs appear as visual stamps in a shareable travel passport on the device.

## Run

Requires Bun 1.3 and an Expo development client for the mobile app.

```sh
bun install
cp .env.example apps/proxy/.env
cp apps/mobile/.env.example apps/mobile/.env
bun run dev:proxy
bun run dev:mobile
```

Set `PROXY_KEY` to at least 16 characters in `apps/proxy/.env`, then put the same value in `EXPO_PUBLIC_PROXY_KEY` for the mobile app. Provider keys are optional. Without a proxy URL, the app uses its local demo catalogue.

For a physical device, use the host's LAN or public address in `EXPO_PUBLIC_PROXY_URL`; `localhost` points to the device itself.

## Check

```sh
bun run typecheck
bun run lint
bun run test
```

The mobile app uses Expo Router. The Bun and Hono proxy holds transport provider keys, caches responses, and normalises them into the shared `Leg` model. See [architecture](docs/architecture.md), [mobile setup](apps/mobile/README.md), and [proxy API](apps/proxy/README.md).

Travel history and passport stamps are stored locally. The passport is a visual record derived from trip data and does not claim independent verification of travel.

## Sui testnet delay market

Travely integrates delay insurance directly into the mobile flight detail flow. A traveller picks a threshold (30 minutes, 1 hour, 2 hours, 4 hours, or 6 hours), pays the quoted premium in native testnet USDC, and can receive a payout after resolution. The flight fingerprint and threshold select the market automatically; no market ID is entered in the mobile app.

The traveller signs with the existing zkLogin account. The proxy uses a private Enoki key to sponsor Sui gas, so the traveller does not need SUI. Profile contains a USDC balance and top-up page that copies the zkLogin address and opens the official Circle faucet. The contract charges 1% of the premium at purchase and 0.5% of a winning gross payout.

```sh
cp apps/market/.env.example apps/market/.env
bun run dev:market
```

The browser companion remains available for operator and resolver demos. The deterministic seed command creates ten markets: five thresholds for each of the two future DEMO flights. See [mobile setup](apps/mobile/README.md), [market setup](apps/market/README.md), and the [Move contract](sui/flight_delay_market/README.md).
