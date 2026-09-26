# @travely/proxy

Bun and Hono API for transport data. It keeps provider credentials outside the app, caches responses, and returns `Leg` and weather models from `@travely/shared`.

## Run

```sh
cp ../../.env.example .env
bun run --cwd apps/proxy dev
```

`PROXY_KEY` is required and must contain at least 16 characters. Provider keys are optional; an unavailable provider returns `503 provider_not_configured`. `DATA_DIR` defaults to `data/`, `FIXTURES_DIR` to the repository fixtures, and `RATE_LIMIT_PER_IP_PER_MIN` to 60.

Google zkLogin requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`. Use a Google OAuth Web client and register the exact callback URI. For the iOS simulator, use `http://localhost:8787/auth/google/callback`; physical devices need a public HTTPS proxy URL ending in `/auth/google/callback`. The callback verifies Google's ID token and nonce, then returns a one-use ticket to `travely://login`. The ticket is bound to a secret retained by the mobile app during login. Register the same client ID with the mobile Enoki application. Keep the Google client secret only on this proxy.

For the optional local passkey lock, set `PASSKEY_RP_ID` to the public HTTPS hostname serving this proxy. Set `PASSKEY_APPLE_TEAM_ID` for iOS and `PASSKEY_ANDROID_SHA256_FINGERPRINTS` for Android (comma-separated SHA-256 signing certificate fingerprints, with colons). The proxy then serves `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` on that hostname. Use the same hostname in the mobile `EXPO_PUBLIC_PASSKEY_RP_ID`. These public association files do not authenticate API requests.

All `/v1/*` routes require `x-travely-key`. The mobile app bundles this value, so IP and key rate limits also protect the proxy. `/health` and the Google OAuth callback are public. The bundled proxy key is not user authentication.

Sponsored insurance requires `ENOKI_PRIVATE_API_KEY`, `SUI_PACKAGE_ID`, `SUI_USDC_TYPE`, and `SUI_RPC_URL`. Keep the Enoki private key only in the proxy environment. Purchase and claim preparation also require the user's `zklogin-jwt`; the proxy derives the address through Enoki, constructs the exact transaction kind and limits the sponsored Move target to `market::buy` or `market::claim`.

The demo keeps prepared digests and idempotency keys in process memory. Use a shared atomic store before running multiple proxy instances or accepting production traffic.

## Routes

- `GET /health`: status and provider quota.
- `GET /.well-known/apple-app-site-association`, `GET /.well-known/assetlinks.json`: optional native passkey association.
- `POST /v1/auth/google/start`, `GET /auth/google/callback`, `POST /v1/auth/google/complete`: Google OAuth for zkLogin.
- `GET /v1/legs/flight/:number/:date`: live flight, with optional `origin` and `destination` query parameters.
- `GET /v1/legs/train/:number/:date`: live train.
- `GET /v1/legs/demo` and `GET /v1/legs/demo/:number/:date`: fictional demo services.
- `GET /v1/search?operator=AF&number=11&date=2026-09-12`: cached service search.
- `GET /v1/positions/flight/:callsign` and `/v1/positions/vessel/:mmsi`: live positions.
- `GET /v1/weather?lat&lon&at=` and `/v1/weather/airport/:iata?at=`: weather and delay risk.
- `GET /v1/airports/:iata`, `/v1/airports/index`, and `/v1/stations/:uic`: places.
- `GET /v1/sui/config`: public testnet coin, package, fee and sponsor status.
- `POST /v1/protection/prepare`: canonical sponsored USDC purchase transaction.
- `POST /v1/protection/claim/prepare`: canonical sponsored payout transaction.
- `POST /v1/protection/execute`: execute a previously prepared digest with its zkLogin signature.

The proxy serves cached data when a provider reaches its quota. See [deployment](../../deploy/README.md) for HTTPS setup.
