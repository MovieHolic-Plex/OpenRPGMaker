import type { ConstructionAuditRecord } from "@/editor/construction/constructionAudit";
import type {
  CanonicalConstructionRoute,
  ConstructionDiffTotals,
  ConstructionRouteChange,
} from "@/editor/construction/contracts";

export const CONSTRUCTION_HARNESS_SCHEMA = "construction-harness/v1" as const;
export const CONSTRUCTION_HARNESS_FILES = [
  "manifest.json",
  "tool-audit.jsonl",
  "qa.json",
  "before-after.json",
  "result.json",
] as const;

export type HarnessOutcome = "exact" | "partial" | "blocked" | "failed";
export type HarnessCategory = "happy" | "blocked" | "partial" | "spec-gate";

export type HarnessQa = {
  readonly mapIds: readonly string[];
  readonly eventCount: number;
  readonly exteriorMapId: string;
  readonly interiorMapIds: readonly string[];
  readonly requestedCount: number;
  readonly actualCount: number;
  readonly structuralQaOk: boolean | null;
  readonly targetMapPresent: boolean;
  readonly linkedTransferCount: number;
};

export type HarnessCaseRecord = {
  readonly id: string;
  readonly category: HarnessCategory;
  readonly seed: number;
  readonly expectedOutcome: HarnessOutcome;
  readonly actualOutcome: HarnessOutcome;
  readonly passed: boolean;
  readonly requestedEntrypoint: CanonicalConstructionRoute;
  readonly canonicalRoute: CanonicalConstructionRoute;
  readonly selectedImplementation: string;
  readonly routeChanges: readonly ConstructionRouteChange[];
  readonly beforeHash: string;
  readonly afterHash: string;
  readonly changed: boolean;
  readonly resultOk: boolean;
  readonly summary: string;
  readonly issueCodes: readonly string[];
  readonly diff: ConstructionDiffTotals;
  readonly audit: ConstructionAuditRecord;
  readonly qa: HarnessQa;
};

export type HarnessManifest = {
  readonly schemaVersion: typeof CONSTRUCTION_HARNESS_SCHEMA;
  readonly runId: string;
  readonly generatedAt: string;
  readonly seed: number;
  readonly command: "npm run construction:harness";
  readonly files: typeof CONSTRUCTION_HARNESS_FILES;
  readonly caseIds: readonly string[];
  readonly registeredRoutes: readonly CanonicalConstructionRoute[];
  readonly policy: {
    readonly network: "disabled";
    readonly persistence: "in-memory-only";
    readonly repositoryFixture: false;
  };
};

export type HarnessQaArtifact = {
  readonly schemaVersion: typeof CONSTRUCTION_HARNESS_SCHEMA;
  readonly seed: number;
  readonly cases: readonly {
    readonly id: string;
    readonly outcome: HarnessOutcome;
    readonly qa: HarnessQa;
  }[];
  readonly replay: {
    readonly stable: boolean;
    readonly firstDigest: string;
    readonly secondDigest: string;
  };
};

export type HarnessBeforeAfterArtifact = {
  readonly schemaVersion: typeof CONSTRUCTION_HARNESS_SCHEMA;
  readonly cases: readonly {
    readonly id: string;
    readonly beforeHash: string;
    readonly afterHash: string;
    readonly changed: boolean;
    readonly diff: ConstructionDiffTotals;
  }[];
};

export type HarnessResultArtifact = {
  readonly schemaVersion: typeof CONSTRUCTION_HARNESS_SCHEMA;
  readonly runId: string;
  readonly passed: boolean;
  readonly negativeControl: boolean;
  readonly caseCount: number;
  readonly passedCount: number;
  readonly failedCaseIds: readonly string[];
  readonly semanticReplayStable: boolean;
  readonly networkCalls: number;
};

export type HarnessEvidencePack = {
  readonly manifest: HarnessManifest;
  readonly cases: readonly HarnessCaseRecord[];
  readonly qa: HarnessQaArtifact;
  readonly beforeAfter: HarnessBeforeAfterArtifact;
  readonly result: HarnessResultArtifact;
};

export type HarnessCaseDefinition = {
  readonly id: string;
  readonly category: HarnessCategory;
  readonly seed: number;
  readonly expectedOutcome: HarnessOutcome;
  readonly run: () => Promise<HarnessCaseRecord>;
};
