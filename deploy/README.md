# Deploying the data proxy

The proxy can run behind Caddy on a Linux VPS so a mobile device can access live transport data over HTTPS.

1. Install Docker with the Compose plugin and point a DNS A record at the VPS.
2. Clone the repository and enter `deploy/`.
3. Copy `proxy.env.example` to `proxy.env` and set `PROXY_KEY` plus any provider keys. Copy `.env.example` to `.env` and set `PROXY_DOMAIN`.
4. Run `docker compose up -d`.
5. Check `/health` and run `./smoke.sh https://<domain> <PROXY_KEY>`.

Rebuild with `docker compose up -d --build`. The named data volume keeps the transport cache and quota counter. Set `EXPO_PUBLIC_PROXY_URL=https://<domain>` and the matching `EXPO_PUBLIC_PROXY_KEY` in `apps/mobile/.env`, then rebuild the mobile client.

For the optional local passkey lock, use `PROXY_DOMAIN` as `PASSKEY_RP_ID` in `proxy.env` and as `EXPO_PUBLIC_PASSKEY_RP_ID` in the mobile environment. Supply the Apple Team ID and each Android signing certificate SHA-256 fingerprint in `proxy.env` before rebuilding the proxy. Check both `https://<domain>/.well-known/apple-app-site-association` and `https://<domain>/.well-known/assetlinks.json` without redirects. The mobile build must include the matching iOS associated domain; Android's `EXPO_PUBLIC_PASSKEY_ANDROID_ORIGINS` must contain the signing certificate hash in `android:apk-key-hash:<base64url>` format. A new native build is required after these values change.
