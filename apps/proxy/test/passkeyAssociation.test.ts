import { describe, expect, test } from "bun:test";
import { buildTestApp } from "./helpers";

const fingerprint = Array.from({ length: 32 }, () => "AB").join(":");

describe("passkey association files", () => {
  test("stay unavailable until public app identifiers are configured", async () => {
    const { app } = buildTestApp();
    const response = await app.request("https://auth.example.com/.well-known/apple-app-site-association");
    expect(response.status).toBe(404);
  });

  test("serve exact iOS and Android identifiers only on the RP domain", async () => {
    const { app } = buildTestApp({ config: {
      passkeyAssociation: {
        rpId: "auth.example.com",
        appleTeamId: "ABCDEFGHIJ",
        androidFingerprints: [fingerprint],
      },
    } });
    const apple = await app.request("https://auth.example.com/.well-known/apple-app-site-association", {
      headers: { host: "auth.example.com" },
    });
    expect(apple.status).toBe(200);
    expect(await apple.json()).toEqual({ webcredentials: { apps: ["ABCDEFGHIJ.app.travely.mobile"] } });

    const android = await app.request("https://auth.example.com/.well-known/assetlinks.json", {
      headers: { host: "auth.example.com" },
    });
    expect(android.status).toBe(200);
    expect(await android.json()).toEqual([{
      relation: ["delegate_permission/common.get_login_creds"],
      target: {
        namespace: "android_app",
        package_name: "app.travely.mobile",
        sha256_cert_fingerprints: [fingerprint],
      },
    }]);

    const otherHost = await app.request("https://other.example.com/.well-known/assetlinks.json", {
      headers: { host: "other.example.com" },
    });
    expect(otherHost.status).toBe(404);
  });
});
