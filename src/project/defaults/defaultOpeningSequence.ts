// New-project seed only. Absence in an existing document means no opening;
// loading a document must never recreate a removed sequence.
import { buildOpeningPresetSequence, findOpeningPreset } from "@/editor/openingPresets";
import type { GameDesignBrief } from "@/project/gameDesignBrief";
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
 * 동기 문장이 없으면 제목 카드 하나만 둔다(기본 왕국 오프닝을 남기지 않는다).
 */
export function briefOpeningSequence(opening: CinematicSequence, motive: string, title: string): CinematicSequence {
  const text = motive.trim();
  return {
    ...opening,
    scenes: [
      ...(text ? [{ id: genId("cinematic-scene"), kind: "text" as const, narration: text, durationMs: 6200 }] : []),
      { id: genId("cinematic-scene"), kind: "text", narration: `— ${title} —`, durationMs: 4200 },
    ],
  };
}

/** 첫 인터뷰 질문이 「이야기의 발단」 을 묻는 프리셋 — 그 답은 게임 안 서술로 읽힌다. */
const PREMISE_EXPERIENCE_PRESETS: ReadonlySet<string> = new Set(["adventure-jrpg"]);
const OPENING_MOTIVE_MAX = 90;

/**
 * 오프닝에 옮겨 적을 기획 문장. 다른 프리셋의 첫 질문은 감정·분위기(「뒤늦게 이해하는 충격」)이거나,
 * 「내 말로 답하기」 로 쓴 기획 설명 전체였다 — 2026-09-24 추리 도그푸딩에서 오프닝 첫 장면이
 * 「추리 게임이에요 … 진범은 모로 박사예요」 400자로 떠 범인을 시작부터 누설했다.
 * 발단을 묻는 프리셋의 답만, 앞 문장 90자 안에서 쓴다. 나머지는 제목 카드만 두고 조수가 도입을 쓴다.
 */
export function briefOpeningMotive(brief: Pick<GameDesignBrief, "presetId" | "answers">): string {
  if (!PREMISE_EXPERIENCE_PRESETS.has(brief.presetId)) return "";
  const text = (brief.answers.experience?.text ?? "").replace(/\s+/gu, " ").trim();
  if (text.length <= OPENING_MOTIVE_MAX) return text;
  const sentences = text.match(/[^.!?。…]+[.!?。…]+/gu) ?? [];
  let out = "";
  for (const sentence of sentences) {
    if ((out + sentence).trim().length > OPENING_MOTIVE_MAX) break;
    out += sentence;
  }
  return out.trim();
}
