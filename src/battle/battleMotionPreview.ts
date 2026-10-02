import type { MotionContext } from "@/battle/battleMotionProgram";
import { applyChoreographyHandles } from "@/battle/retroChoreographyHandles";
import type { RetroSkillTimeline } from "@/battle/retroSkillTimeline";

export type BattleMotionPreviewOutcome = "hit" | "miss" | "cancel";

/** Preview scenarios are explicit action outcomes. A failed proc is NOT a cancelled action. */
export function buildBattleMotionPreview(
  record: Parameters<typeof applyChoreographyHandles>[1],
  buildBase: (hits: number) => RetroSkillTimeline,
  options: {
    character?: MotionContext["character"];
    casting?: boolean;
    outcome?: BattleMotionPreviewOutcome;
    hits?: number;
    followOnHit?: boolean;
    preparing?: boolean;
  } = {},
): RetroSkillTimeline {
  const outcome = options.outcome ?? "hit";
  const follows =
    options.followOnHit ??
    ["air-chase", "sky-crush", "throw", "bounce", "relay"].includes(
      record?.movement?.pattern ?? "",
    );
  const count =
    outcome === "miss" && follows ? 1 : Math.max(1, options.hits ?? 1);
  const context: MotionContext = {
    character: options.character,
    casting: options.casting,
    hit: outcome === "hit",
    contactHits: Array.from({ length: count }, () => outcome === "hit"),
    actionBlocked:
      outcome === "cancel" ||
      (outcome === "miss" && options.preparing === true),
    preparing: options.preparing,
  };
  return applyChoreographyHandles(buildBase(count), record, context);
}
