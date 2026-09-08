import assert from "node:assert/strict";
import type { BattleRuntime, BattleSnapshot } from "@/battle/types";
import type { FaceGraphic, MessageWindowSettings } from "@/project/types";

// Prospective public contract only. No fake runtime or implementation substitutes.
export type EventPause =
  | { readonly id: number; readonly kind: "wait"; readonly ms: number }
  | { readonly id: number; readonly kind: "inputWait"; readonly variableId?: string }
  | {
      readonly id: number; readonly kind: "text"; readonly body: string;
      readonly speaker?: string; readonly face?: FaceGraphic;
      readonly settings?: MessageWindowSettings; readonly autoAdvance?: boolean;
      readonly emotion?: string;
    };
export type PauseResponse =
  | { readonly kind: "wait" }
  | { readonly kind: "text" }
  | { readonly kind: "inputWait"; readonly keyCode: number };
export type SequentialRuntime = BattleRuntime & {
  resumeEventPause?: (id: number, response: PauseResponse) => boolean;
};
export function eventPause(runtime: BattleRuntime): EventPause {
  const snapshot: BattleSnapshot & { readonly eventPause?: EventPause } = runtime.snapshot();
  assert.ok(snapshot.eventPause, "battle must expose its suspended event request");
  return snapshot.eventPause;
}
export function acknowledge(runtime: SequentialRuntime, id: number, response: PauseResponse): boolean {
  assert.ok(runtime.resumeEventPause, "a suspended request needs its matching acknowledgement");
  return runtime.resumeEventPause(id, response);
}
