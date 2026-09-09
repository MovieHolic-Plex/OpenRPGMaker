import type { WorkPlan } from "./workPlan";
import type { IntentDeclaration } from "./intentDeclaration";
import type { AdventureRequirements } from "./adventureCompletion";
import type { VolumeBar, VolumeSnapshot } from "./volumeContract";

/** A clean planning boundary, not a general session/process checkpoint. Success evidence,
 * provider/tool journals, counters and proposals are deliberately not transferable. */
export interface PlanOnlyGoalState {
  readBeforeWrite: IntentDeclaration["readBeforeWrite"] | null;
  adventure: AdventureRequirements | null;
  volume: { baseline: VolumeSnapshot; minimum: VolumeBar } | null;
}
export interface PlanOnlyContinuation extends PlanOnlyGoalState {
  workPlan: WorkPlan;
}
