# @travely/mobile

Expo Router app for trips, live status, maps, weather, alerts, and a local travel passport.

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_PROXY_URL` and `EXPO_PUBLIC_PROXY_KEY` to use live transport data. With no proxy URL, the demo catalogue remains available.

The app now requires zkLogin before opening any route. Set `EXPO_PUBLIC_ENOKI_PUBLIC_KEY` to an Enoki public key with zkLogin enabled for Sui testnet. Add the same Google OAuth Web client to Enoki and to the proxy's `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`. Register `GOOGLE_REDIRECT_URI` exactly in Google Cloud. For the iOS simulator, use `http://localhost:8787/auth/google/callback`; physical devices need a reachable public HTTPS proxy callback. The proxy redirects back to `travely://login`. On iOS, enable Sign in with Apple for the bundle ID and register it in Enoki. Rebuild the native app after changing the Apple capability. No OAuth client secret belongs in `EXPO_PUBLIC_*`.

The zkLogin session is kept in SecureStore until its JWT or Sui epoch window expires. The Sui address is shown on Profile. Trips and passport stamps remain local to the device and are not synced by this login. The same zkLogin account signs insurance purchases and payout claims.

The account keeps a direct zkLogin address. Users must retain access to the same Google or Apple account to recover their Sui address after changing devices. A passkey can be enabled in Profile only as a local lock for an unexpired zkLogin session. It locks the app after backgrounding or restarting; reopening requires a fresh passkey assertion. The alternative OAuth button clears that device session and signs in again. The passkey cannot sign for the direct zkLogin address or renew an expired JWT. See `docs/mobile-sui-account-abstraction-spec.md`.

To enable the local passkey lock, set `EXPO_PUBLIC_PASSKEY_RP_ID` to the public HTTPS proxy hostname, without `https://` or a port. Rebuild the native app so `app.config.js` adds the iOS `webcredentials:` associated domain. On Android, also set `EXPO_PUBLIC_PASSKEY_ANDROID_ORIGINS` to the exact `android:apk-key-hash:<base64url>` origin for each signing certificate, separated by commas. The proxy must serve `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` for that hostname with the matching app identifiers. The passkey option stays unavailable until its platform configuration is complete. Expo Go cannot supply the native passkey module or the app's associated domain.

```sh
bun run dev:mobile
```

Use a LAN or public proxy URL on a physical device. The travel history is stored locally; completed legs become visual passport stamps that can be shared as images.

Flight details keep their full scrolling information layout, show the aircraft model with a carrier-coloured tail, and include a compact delay-insurance card. A traveller can select 30 minutes, 1 hour, 2 hours, 4 hours, or 6 hours; the app finds the matching market from the flight fingerprint and threshold. The insurance screen shows the live USDC quote, both fees and the potential net payout. Operator-only liquidity and resolution controls remain in the browser companion.

Profile links to a USDC balance and top-up page. It copies the zkLogin address and opens the official Circle faucet; select USDC and Sui Testnet there. Travely sponsors gas through the proxy, so the user account does not need SUI. Set `EXPO_PUBLIC_SUI_PACKAGE_ID` to the deployed package. The matching proxy needs `SUI_PACKAGE_ID` and a private Enoki key enabled for sponsored transactions. No provider, operator wallet or sponsor secret belongs in an `EXPO_PUBLIC_*` setting.
