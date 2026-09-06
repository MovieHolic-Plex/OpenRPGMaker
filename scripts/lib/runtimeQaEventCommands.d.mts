import type { Page } from "@playwright/test";
import type { RuntimeQaEventCommandOp, RuntimeQaEventCommandTrace } from "./runtimeQa.d.mts";

export declare function armEventCommandObservation(op: RuntimeQaEventCommandOp): void;
export declare function eventCommandQaOp(page: Page, op: RuntimeQaEventCommandOp): Promise<Omit<RuntimeQaEventCommandTrace, "op">>;
