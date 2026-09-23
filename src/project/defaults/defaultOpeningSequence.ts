// New-project seed only. Absence in an existing document means no opening;
// loading a document must never recreate a removed sequence.
import { buildOpeningPresetSequence, findOpeningPreset } from "@/editor/openingPresets";
import type { CinematicSequence } from "@/project/types";
import { genId } from "@/util/id";

export const DEFAULT_OPENING_PRESET_ID = "kingdom-prologue";

export function defaultOpeningSequence(title = "새 프로젝트"): CinematicSequence {
  const preset = findOpeningPreset(DEFAULT_OPENING_PRESET_ID);
  if (!preset) throw new Error("기본 오프닝 프리셋을 찾을 수 없습니다: kingdom-prologue");
  return buildOpeningPresetSequence(preset, { title });
}

/** 씨앗이 넣은 기본 오프닝(제목만 바꾼 kingdom-prologue)이 손대지 않은 채인가. 장면 id 는 매번 새로 만들어 비교하지 않는다. */
export function isUntouchedDefaultOpening(opening: CinematicSequence | undefined, title: string): boolean {
  if (!opening) return false;
  const shape = (sequence: CinematicSequence) => JSON.stringify({
    music: sequence.musicResourceId ?? null,
    scenes: sequence.scenes.map(scene => [scene.kind, "resourceId" in scene ? scene.resourceId ?? null : null, scene.narration ?? ""]),
  });
  return shape(opening) === shape(defaultOpeningSequence(title));
}

/**
 * 확정 기획이 있는 새 프로젝트의 오프닝. 기본 프리셋은 「강을 낀 왕국 … 달빛만 남은 호숫가」 그림이라
 * 눈보라 항구 이야기 같은 기획과 정면으로 어긋났다(2026-09-23 도그푸딩). 그림을 지어내지 않고 기획의
 * 동기 문장과 제목 카드만 글 장면으로 둔다 — 그림은 조수가 set_opening/edit_opening 으로 얹는다.
 */
export function briefOpeningSequence(opening: CinematicSequence, motive: string, title: string): CinematicSequence {
  const text = motive.trim();
  if (!text) return opening;
  return {
    ...opening,
    scenes: [
      { id: genId("cinematic-scene"), kind: "text", narration: text, durationMs: 6200 },
      { id: genId("cinematic-scene"), kind: "text", narration: `— ${title} —`, durationMs: 4200 },
    ],
  };
}
