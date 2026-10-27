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

/** 씨앗·빈 프로젝트가 남기는 기본 제목 — 이 이름의 제목 카드는 아직 아무도 쓰지 않은 자리다. */
const PLACEHOLDER_OPENING_TITLES: Readonly<Record<string, true>> = { "새 게임": true, "새 프로젝트": true, "New Game": true, "New Project": true };
const TITLE_CARD = /^[—–-]+\s*(.+?)\s*[—–-]+$/u;

/** 제목 카드 글(「— 제목 —」·「- 제목 -」)에서 제목을 꺼낸다. 카드 모양이 아니면 글 그대로. */
function titleCardName(narration: string): string {
  const text = narration.trim();
  return TITLE_CARD.exec(text)?.[1]?.trim() ?? text;
}

/** 이 글이 제목만 적은 카드인가 — 「— 무엇 —」 모양(제목과 달라도), 기본 제목 「새 게임」, 또는 게임 제목 그대로. */
export function isTitleCardNarration(narration: string, title?: string): boolean {
  const text = narration.trim();
  if (TITLE_CARD.test(text)) return true;
  const name = title?.trim();
  return PLACEHOLDER_OPENING_TITLES[text] === true || (!!name && text === name);
}

/**
 * 자료집 「게임 타이틀」은 만든 사람이 나중에 이름을 고치는 칸이다.
 * 타이틀 화면 글자만 바꾸고 프로젝트 이름(meta.title)을 두면, 편집기 위쪽과
 * 시작 화면의 게임 목록은 「새 게임」·「새 프로젝트」로 남는다.
 * 비어 있지 않은 새 제목이면 프로젝트 이름을 맞추고, 씨앗이 남긴 제목 카드 한 장도 같이 옮긴다.
 * 칸을 잠시 비우는 중간 입력은 프로젝트 이름을 지우지 않는다.
 */
export function applyEditedGameTitle(
  project: { meta: { title: string }; system: { opening?: CinematicSequence } },
  previousGameTitle: string,
  nextGameTitle: string,
): void {
  const next = nextGameTitle.trim();
  if (!next) return;
  const previousTitles = [project.meta.title, previousGameTitle];
  if (project.meta.title !== next) project.meta.title = next;
  const opening = retitlePlaceholderOpening(project.system.opening, previousTitles, next);
  if (opening) project.system.opening = opening;
}

/**
 * 게임 제목이 바뀔 때 씨앗이 남긴 제목 카드 한 장짜리 오프닝(「— 새 게임 —」)의 글자도 새 제목으로 옮긴다.
 * 연애 인터뷰 씨앗은 동기 문장이 없어 이 한 장만 남고, 제목을 정한 뒤에도 새 게임을 누르면 「— 새 게임 —」 이 떴다(2026-10-17).
 * 장면이 하나뿐인 그림 없는 글 장면이고 그 글이 옛 제목 또는 기본 제목의 카드일 때만 바꾼다 — 저작된 오프닝은 그대로다.
 * 바꿀 것이 없으면 undefined.
 */
export function retitlePlaceholderOpening(opening: CinematicSequence | undefined, previousTitles: readonly string[], nextTitle: string): CinematicSequence | undefined {
  const scene = opening?.scenes.length === 1 ? opening.scenes[0] : undefined;
  const next = nextTitle.trim();
  if (!opening || !scene || scene.kind !== "text" || typeof scene.narration !== "string" || !next) return undefined;
  const name = titleCardName(scene.narration);
  if (name === next) return undefined;
  const previous = previousTitles.map((title) => title.trim()).filter(Boolean);
  if (PLACEHOLDER_OPENING_TITLES[name] !== true && !previous.includes(name)) return undefined;
  return { ...opening, scenes: [{ ...scene, narration: `— ${next} —` }] };
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
 * 자리표시 답(「(채팅에서 정함)」「미정」「TBD」 …)은 오프닝 글이 아니다. jrpg-real-1 J12 에서 씨앗 brief 의 자리표시 문구가
 * 그대로 오프닝 첫 글자로 떴다. 괄호로 전체를 감싼 짧은 답이나 미정을 뜻하는 낱말만 있는 답은 비운다(제목 카드만 남는다).
 */
const PLACEHOLDER_MOTIVE = /^[(（[].{0,40}[)）\]]$|채팅에서 정|^\s*(미정|추후|나중에)|\bTBD\b|\bTODO\b/iu;

/**
 * 오프닝에 옮겨 적을 기획 문장. 다른 프리셋의 첫 질문은 감정·분위기(「뒤늦게 이해하는 충격」)이거나,
 * 「내 말로 답하기」 로 쓴 기획 설명 전체였다 — 2026-09-24 추리 도그푸딩에서 오프닝 첫 장면이
 * 「추리 게임이에요 … 진범은 모로 박사예요」 400자로 떠 범인을 시작부터 누설했다.
 * 발단을 묻는 프리셋의 답만, 앞 문장 90자 안에서 쓴다. 나머지는 제목 카드만 두고 조수가 도입을 쓴다.
 */
export function briefOpeningMotive(brief: Pick<GameDesignBrief, "presetId" | "answers">): string {
  if (!PREMISE_EXPERIENCE_PRESETS.has(brief.presetId)) return "";
  const text = (brief.answers.experience?.text ?? "").replace(/\s+/gu, " ").trim();
  if (PLACEHOLDER_MOTIVE.test(text)) return "";
  if (text.length <= OPENING_MOTIVE_MAX) return text;
  const sentences = text.match(/[^.!?。…]+[.!?。…]+/gu) ?? [];
  let out = "";
  for (const sentence of sentences) {
    if ((out + sentence).trim().length > OPENING_MOTIVE_MAX) break;
    out += sentence;
  }
  return out.trim();
}
