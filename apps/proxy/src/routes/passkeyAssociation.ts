import { Hono } from "hono";
import type { Config } from "../config";

/** Public platform association files for the domain used by local passkeys. */
export function passkeyAssociationRoutes(config: Config): Hono {
  const app = new Hono();
  const association = config.passkeyAssociation;

  app.get("/apple-app-site-association", (c) => {
    if (!association?.appleTeamId || c.req.header("host")?.split(":")[0]?.toLowerCase() !== association.rpId) {
      return c.notFound();
    }
    c.header("Cache-Control", "public, max-age=300");
    return c.json({ webcredentials: { apps: [`${association.appleTeamId}.app.travely.mobile`] } });
  });

  app.get("/assetlinks.json", (c) => {
    if (!association?.androidFingerprints.length || c.req.header("host")?.split(":")[0]?.toLowerCase() !== association.rpId) {
      return c.notFound();
    }
    c.header("Cache-Control", "public, max-age=300");
    return c.json([{
      relation: ["delegate_permission/common.get_login_creds"],
      target: {
        namespace: "android_app",
        package_name: "app.travely.mobile",
        sha256_cert_fingerprints: association.androidFingerprints,
      },
    }]);
  });

  return app;
}
