# @travely/mobile

Expo Router app for trips, live status, maps, weather, alerts, and a local travel passport.

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_PROXY_URL` and `EXPO_PUBLIC_PROXY_KEY` to use live transport data. With no proxy URL, the demo catalogue remains available.

The app now requires zkLogin before opening any route. Set `EXPO_PUBLIC_ENOKI_PUBLIC_KEY` to an Enoki public key with zkLogin enabled for Sui testnet. Add the same Google OAuth Web client to Enoki and to the proxy's `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`. Register `GOOGLE_REDIRECT_URI` exactly in Google Cloud. For the iOS simulator, use `http://localhost:8787/auth/google/callback`; physical devices need a reachable public HTTPS proxy callback. The proxy redirects back to `travely://login`. On iOS, enable Sign in with Apple for the bundle ID and register it in Enoki. Rebuild the native app after changing the Apple capability. No OAuth client secret belongs in `EXPO_PUBLIC_*`.

The zkLogin session is kept in SecureStore until its JWT or Sui epoch window expires. The Sui address is shown on Profile. Trips and passport stamps remain local to the device and are not synced by this login. The testnet market still has its separate prototype wallet; zkLogin does not yet sign market trades.

The account keeps a direct zkLogin address. Users must retain access to the same Google or Apple account to recover their Sui address after changing devices. A passkey can be enabled in Profile only as a local lock for an unexpired zkLogin session. It locks the app after backgrounding or restarting; reopening requires a fresh passkey assertion. The alternative OAuth button clears that device session and signs in again. The passkey cannot sign for the direct zkLogin address or renew an expired JWT. See `docs/mobile-sui-account-abstraction-spec.md`.

To enable the local passkey lock, set `EXPO_PUBLIC_PASSKEY_RP_ID` to the public HTTPS proxy hostname, without `https://` or a port. Rebuild the native app so `app.config.js` adds the iOS `webcredentials:` associated domain. On Android, also set `EXPO_PUBLIC_PASSKEY_ANDROID_ORIGINS` to the exact `android:apk-key-hash:<base64url>` origin for each signing certificate, separated by commas. The proxy must serve `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` for that hostname with the matching app identifiers. The passkey option stays unavailable until its platform configuration is complete. Expo Go cannot supply the native passkey module or the app's associated domain.

```sh
bun run dev:mobile
```

Use a LAN or public proxy URL on a physical device. The travel history is stored locally; completed legs become visual passport stamps that can be shared as images.

Flight details open a native Sui testnet delay market. The screen reads a matching market onchain, shows live quotes, buys YES or NO positions, claims payouts or refunds, and lets a liquidity provider create, fund, and withdraw from a market. The holder of the resolver capability can report the final arrival. A pre-funded fictional DEMO market is available from any flight market screen.

Create a testnet wallet in the market screen or import a testnet-only `suiprivkey` key. Never import a key that controls real funds. The key is stored with Expo SecureStore on the device. Back it up before buying a position; losing the key loses access to its positions. The in-app faucet can request test SUI, subject to its rate limits. Set `EXPO_PUBLIC_SUI_PACKAGE_ID` and `EXPO_PUBLIC_SUI_DEMO_MARKET_ID` in `.env` to target another published testnet package and seeded market. No provider or wallet secret belongs in an `EXPO_PUBLIC_*` setting.
