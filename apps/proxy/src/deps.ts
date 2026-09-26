import type { Config } from "./config";
import type { Cache } from "./cache";
import type { Quota } from "./quota";
import type { AirportsIndex } from "./airports";
import type { AisStreamClient } from "./providers/aisstream";
import type { SuiGrpcClient } from "@mysten/sui/grpc";

export interface AppDeps {
  config: Config;
  cache: Cache;
  quota: Quota;
  airportsIndex: AirportsIndex;
  aisStream: AisStreamClient;
  fetchImpl: typeof fetch;
  now: () => Date;
  startedAtMs: number;
  suiClient: SuiGrpcClient;
}
