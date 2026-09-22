// New-project seed only. Absence in an existing document means no opening;
// loading a document must never recreate a removed sequence.
import { buildOpeningPresetSequence, findOpeningPreset } from "@/editor/openingPresets";
import type { CinematicSequence } from "@/project/types";

export const DEFAULT_OPENING_PRESET_ID = "kingdom-prologue";

export function defaultOpeningSequence(title = "새 프로젝트"): CinematicSequence {
  const preset = findOpeningPreset(DEFAULT_OPENING_PRESET_ID);
  if (!preset) throw new Error("기본 오프닝 프리셋을 찾을 수 없습니다: kingdom-prologue");
  return buildOpeningPresetSequence(preset, { title });
}
