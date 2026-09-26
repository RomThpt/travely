# Travely

Travely is an Expo travel tracker with a Bun and Hono data proxy. The app tracks trips, weather, and local alerts; completed legs become local visual passport stamps. `packages/shared` holds the travel models and provider adapters.

Run `bun install`, then `bun run dev:proxy` and `bun run dev:mobile`. Set a proxy key of at least 16 characters in `apps/proxy/.env` and use the same value as `EXPO_PUBLIC_PROXY_KEY` in `apps/mobile/.env`. Provider keys are optional. Without a proxy URL, the app uses demo data. A physical device needs a LAN or public proxy URL.

Mobile routes require zkLogin. Set an Enoki public testnet key in `EXPO_PUBLIC_ENOKI_PUBLIC_KEY`; Google login additionally needs the proxy OAuth settings. The iOS simulator can use an HTTP localhost callback; physical devices need a public HTTPS callback. Apple login requires the iOS Sign in with Apple capability. The login uses SecureStore and expires with its JWT or Sui epoch window. Protection purchases use this zkLogin address and require an Enoki private sponsorship key on the proxy.

The optional native passkey locks only a still-valid local zkLogin session. It cannot recover the direct zkLogin address. It requires a public HTTPS RP domain, iOS associated domain, Android asset links and matching signing certificates; see the mobile and proxy READMEs. Rebuild the native app after enabling it.

After changes, run `bun run typecheck`, `bun run lint`, and `bun run test`. Keep provider secrets on the proxy. Mobile `EXPO_PUBLIC_*` values are bundled into the app. Passport stamps are derived from local trip data and do not verify travel independently.

The Sui testnet market lives in `sui/flight_delay_market`, with a native Expo screen in `apps/mobile/app/market/[legId].tsx` and an optional browser UI in `apps/market`. Run `sui move test --path sui/flight_delay_market -e testnet` after Move changes. The shared `Leg` model remains independent of the market. Hermes needs the `Intl.PluralRules` polyfill loaded in `apps/mobile/index.js` before importing the Sui client. Markets use native testnet USDC, while Enoki sponsors network gas in SUI. A holder of `ResolverCap` supplies the final arrival time. The demo seeder creates five thresholds for each stable future demo flight.
