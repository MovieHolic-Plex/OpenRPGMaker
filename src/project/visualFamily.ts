// project/visualFamily.ts
// 얼굴·전투 그림 계열(2026-10-16) — 장르 잠금(genreLock.ts)의 faceset·battle 잠금이 쓰는 분류. charsetFamily.ts(걷기 칩)·tilesetFamily.ts(맵 칩셋)의 짝이다.
// 이 파일은 일부러 무거운 번들 표(sharedCharacterGraphics.json·몬스터 카탈로그)를 불러오지 않는다 — 리소스 id 의 모양만 보고 가른다.
// 새 번들이 생기면 아래 표에 한 줄을 더한다(모르는 번들은 "other", 업로드·생성한 그림은 "uploaded").

export type FaceFamilyId =
  | "fantasy-people-face"   // RTP Actor1·2·People1·2 얼굴, 공용 표정 세트·흉상·전신(사람), 생성 「누락 사람」 얼굴 — 판타지 RPG 사람
  | "fantasy-creature-face" // RTP Monster 얼굴·동물 얼굴, 공용 표정 세트(몬스터·동물), 생성 몬스터·동물 얼굴
  | "scarloxy-face"         // 몬스터 테이밍 팩(Scarloxy) 트레이너·도장 보스 얼굴(생성 「누락 Scarloxy」 10칸)
  | "oprn-creature-face"    // OPRN 몬스터 수집용 생성 얼굴(미믹·드래곤·불꽃)
  | "uploaded"              // 이 프로젝트에 사용자가 올렸거나 조수가 생성해 등록한 그림
  | "other";                // 위 어디에도 안 맞는 번들(허용 여부는 프리셋 표가 정한다)

export const FACE_FAMILY_LABELS: Readonly<Record<FaceFamilyId, string>> = {
  "fantasy-people-face": "판타지 사람 얼굴·흉상(RTP·공용 표정 세트)",
  "fantasy-creature-face": "판타지 몬스터·동물 얼굴",
  "scarloxy-face": "Scarloxy 트레이너 얼굴",
  "oprn-creature-face": "OPRN 몬스터 얼굴",
  uploaded: "올린·생성한 그림",
  other: "기타 번들 얼굴",
};

const CREATURE_FACE_STEM = /^(?:monster-|people2-(?:dog|cat|rooster|sheep|cow|horse|tiger|lion)-)/u;
/** `generated-faceset-missing-people-NN` 중 사람이 아닌 칸(하피·기계 병사·마족·고양이). */
const GENERATED_PEOPLE_CREATURE_CELLS: ReadonlySet<string> = new Set(["11", "12", "13", "15"]);

export interface VisualFamilyContext {
  /** 프로젝트에 사용자가 올리거나 생성해 등록한 자산(없으면 업로드 판정을 건너뛴다). */
  readonly assets?: { readonly uploaded?: Readonly<Record<string, unknown>> };
}

const isUploaded = (project: VisualFamilyContext | undefined, id: string): boolean =>
  project?.assets?.uploaded !== undefined && Object.hasOwn(project.assets.uploaded, id);

/** 얼굴·흉상·전신 그림 하나(리소스 id)의 계열. */
export function faceFamilyOf(project: VisualFamilyContext | undefined, resourceId: string): FaceFamilyId {
  const id = resourceId.toLowerCase();
  let match = /^generated-faceset-missing-(people|scarloxy|monster)-(\d+)$/u.exec(id);
  if (match) {
    if (match[1] === "scarloxy") return "scarloxy-face";
    if (match[1] === "monster") return "oprn-creature-face";
    return GENERATED_PEOPLE_CREATURE_CELLS.has(String(Number(match[2]))) ? "fantasy-creature-face" : "fantasy-people-face";
  }
  match = /^easyrpg-faceset-(actor1|actor2|people1|people2|monster)-(\d+)$/u.exec(id);
  if (match) {
    if (match[1] === "monster") return "fantasy-creature-face";
    // People2 8~15 는 강아지·고양이·수탉·양·소·말·호랑이·사자 얼굴이다.
    return match[1] === "people2" && Number(match[2]) >= 8 ? "fantasy-creature-face" : "fantasy-people-face";
  }
  // 공용 표정 세트: shared-<줄기>-expressions(-NN | -bust|full-<표정>)
  match = /^shared-(.+?)-expressions(?:-|$)/u.exec(id);
  if (match && !isUploaded(project, resourceId)) return CREATURE_FACE_STEM.test(`${match[1]}-`) ? "fantasy-creature-face" : "fantasy-people-face";
  if (isUploaded(project, resourceId)) return "uploaded";
  return "other";
}

// ── 전투 그림 ─────────────────────────────────────────────────────────────────────────────────────────

export type BattlerFamilyId =
  | "scarloxy-monster"  // 몬스터 테이밍 팩(Scarloxy) 몬스터 앞모습
  | "harness-monster"   // 몬스터 수집 하네스가 사람이 고른 종 그림(앞·뒤)
  | "generic-enemy"     // 도트 일반 적(슬라임·박쥐·골렘·해골…)·옛 RTP 몬스터 — JRPG 일반 적이지 몬스터 수집용이 아니다
  | "uploaded"
  | "other";

export const BATTLER_FAMILY_LABELS: Readonly<Record<BattlerFamilyId, string>> = {
  "scarloxy-monster": "Scarloxy 몬스터(몬스터 수집 팩)",
  "harness-monster": "하네스 몬스터 앞·뒷모습(몬스터 수집)",
  "generic-enemy": "일반 JRPG 적 그림(슬라임·박쥐·골렘 …)",
  uploaded: "올린·생성한 그림(캠페인 전용 그림 포함)",
  other: "기타 번들 몬스터 그림",
};

/** 몬스터(적·종) 전투 그림 하나의 계열. */
export function battlerFamilyOf(project: VisualFamilyContext | undefined, resourceId: string): BattlerFamilyId {
  const id = resourceId.toLowerCase();
  if (/^scarloxy-monster-/u.test(id)) return "scarloxy-monster";
  if (/^harness-monster-/u.test(id)) return "harness-monster";
  if (isUploaded(project, resourceId)) return "uploaded";
  if (/^(?:generated-enemy-|easyrpg-monster-|generated-troop-preview-|bskin-enemy-)/u.test(id)) return "generic-enemy";
  return "other";
}

export type TrainerArtFamilyId =
  | "oprn-trainer"   // public/assets/battle-trainers/<역할> — OPRN 몬스터 수집 트레이너(생성형 → 사람이 고름)
  | "uploaded"       // 업로드·캠페인 전용 그림(oprn_emerald_trainer_*)
  | "unknown";       // 번들 역할 목록에도 업로드에도 없는 id — 그림이 안 뜬다

export const TRAINER_ART_FAMILY_LABELS: Readonly<Record<TrainerArtFamilyId, string>> = {
  "oprn-trainer": "OPRN 몬스터 수집 트레이너 그림",
  uploaded: "올린·캠페인 전용 그림",
  unknown: "알 수 없는 트레이너 그림 id",
};

/** 번들 트레이너 역할 id 인가는 호출부가 index.json 으로 알려 준다(이 파일은 JSON 을 끌어오지 않는다). */
export function trainerArtFamilyOf(project: VisualFamilyContext | undefined, id: string, bundledRoles: ReadonlySet<string>): TrainerArtFamilyId {
  if (isUploaded(project, id)) return "uploaded";
  return bundledRoles.has(id) ? "oprn-trainer" : "unknown";
}

export type BackdropFamilyId =
  | "scarloxy-backdrop"   // 몬스터 테이밍 팩 전투 배경
  | "emerald-terrain"     // `emerald:<갈래>` — 몬스터 대치(에메랄드풍) 전투장
  | "oprn-scenery"        // battle-scenery-* — 도트 겹 배경(몬스터 대치 스킨은 줄무늬 바닥으로 푼다)
  | "pokemon-backdrop"    // battle-skin-pokemon-backdrop — 몬스터 대치 정본 바닥
  | "rtp-backdrop"        // EasyRPG RTP 파노라마 — 판타지 RPG 배경
  | "retired-backdrop"    // 지운 옛 스킨·참고 그림 배경
  | "uploaded"
  | "other";

export const BACKDROP_FAMILY_LABELS: Readonly<Record<BackdropFamilyId, string>> = {
  "scarloxy-backdrop": "Scarloxy 전투 배경",
  "emerald-terrain": "에메랄드풍 전투장(emerald:갈래)",
  "oprn-scenery": "OPRN 도트 겹 배경(battle-scenery-*)",
  "pokemon-backdrop": "몬스터 대치 정본 바닥",
  "rtp-backdrop": "RTP 판타지 파노라마 배경",
  "retired-backdrop": "지운 옛 스킨·참고 배경",
  uploaded: "올린·생성한 그림",
  other: "기타 번들 배경",
};

/** 전투 배경 하나의 계열. 맵의 `emerald:<갈래>` 표기도 받는다. */
export function backdropFamilyOf(project: VisualFamilyContext | undefined, id: string): BackdropFamilyId {
  const lower = id.toLowerCase();
  if (/^emerald:\w+$/u.test(lower)) return "emerald-terrain";
  if (/^scarloxy-backdrop-/u.test(lower)) return "scarloxy-backdrop";
  if (/^battle-scenery-/u.test(lower)) return "oprn-scenery";
  if (lower === "battle-skin-pokemon-backdrop") return "pokemon-backdrop";
  if (isUploaded(project, id)) return "uploaded";
  if (/^easyrpg-backdrop-/u.test(lower)) return "rtp-backdrop";
  if (/^battle-skin-.*-backdrop$/u.test(lower) || /^generated-battle-reference-/u.test(lower)) return "retired-backdrop";
  return "other";
}

/** 전투 화면 UI 스킨 id → 잠금 표에 적는 계열 id(`skin:<id>`). */
export const skinFamilyOf = (skinId: string): string => `skin:${skinId}`;
export const SKIN_FAMILY_LABELS: Readonly<Record<string, string>> = {
  "skin:pokemon": "몬스터 대치(포켓몬식) 전투 화면",
  "skin:retro2003": "도트 측면(RM2003식) 전투 화면",
};
