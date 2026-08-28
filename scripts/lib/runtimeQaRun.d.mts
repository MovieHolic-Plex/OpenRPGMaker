// scripts/lib/runtimeQaRun.mjs 의 타입 계약(부수효과 담당).
import type { Page } from "@playwright/test";
import type { RuntimeQaReport, RuntimeQaScenario } from "./runtimeQa.d.mts";

export type PlayerQaServer = {
  readonly url: string;
  readonly port: number;
  readonly close: () => Promise<void>;
};

export declare function startPlayerQaServer(opts?: {
  readonly port?: number;
  readonly logLevel?: "silent" | "error" | "warn" | "info";
}): Promise<PlayerQaServer>;

export declare function writeReport(outDir: string, report: RuntimeQaReport): Promise<void>;

export declare function runRuntimeQa(
  page: Page,
  scenario: RuntimeQaScenario,
  opts: { readonly serverUrl: string; readonly outDir?: string },
): Promise<RuntimeQaReport>;
