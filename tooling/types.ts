import type { HealthResult } from "./health.ts";
import type { Candidate } from "./storage.ts";
import type { CertPaths } from "./tls.ts";

export interface StatusFacts {
  configError?: string;
  selectedMode?: "dev" | "preview";
  running:
    | { alive: false; stale?: boolean; note?: string }
    | {
        alive: true;
        mode: "dev" | "preview";
        pid: number;
        startedAt: string;
        port: number;
        scheme: "https" | "http";
        certSource: "self-signed" | "custom" | "none";
        health?: HealthResult;
        url: string;
        stale?: false;
        note?: undefined;
      };
  disk:
    | { unknown: true }
    | { unknown?: false; totalBytes: number; usedBytes: number; percent: number; mount: string; level: "low" | "high" | "critical" };
  rebuildable: { total: number; human: string; items: Candidate[] };
  certPaths: CertPaths;
  certHowto: string;
  httpsAvailable: boolean;
}
