// project/vnExtras.ts
// 미연시 시스템 UI 2단계 — 갤러리(CG·엔딩 회상, 잠금 표시) · 엔딩 목록(인물별 체크리스트) · 세이브 카드(날짜·대표 장면 한 줄) (2026-10-17).
// 장르 공통 옵트인 저작 데이터 한 곳: meta.oprnVnExtras. 저작이 없으면 옛 동작 그대로(옛 프로젝트 불변),
// 관계 중심(연애) 게임만 저작 없이도 기본 구성이 켜진다(resolveVnExtras). 새 그림은 만들지 않는다 — 있는 갤러리 해금·엔딩 정의·세이브를 읽어 보여 줄 뿐이다.
// 무거운 의존이 없는 잎 모듈(플레이어·편집기·조수 도구가 같이 쓴다).
import { DIALOGUE_UI_LANGUAGES, type BacklogEntry, type DialogueUiLanguage } from "./dialogueSystem";
import { friendshipDisplayName } from "./friendship";
import { isGalleryEnabled } from "./gallery";
import { collectCommands } from "./mapInspection";
import { ROMANCE_ENDING_HAPPY_AT, ROMANCE_ENDING_HAPPY_ID, ROMANCE_ENDING_NORMAL_AT, ROMANCE_ENDING_NORMAL_ID, SEGMENT_END_ENDING_ID } from "./playableSegmentContract";
import { usesRelationshipMenu } from "./relationshipMenu";
import type { Command, EndingDef, Project } from "./types";

export const VN_EXTRAS_VERSION = 1 as const;
/** 갤러리에 보이는 CG 칸 상한(세이브 해금 상한과 같다). */
export const GALLERY_SLOT_MAX = 200;
/** 엔딩 목록에 보이는 엔딩 상한. */
export const ENDING_LIST_MAX = 64;
/** 세이브 카드의 대표 장면 한 줄 길이(글자). */
export const SCENE_LINE_MAX = 44;
/** 이 값이 인물 키이면 「가장 호감이 높은 사람」 기준이다(session.ts ANY_FRIENDSHIP_KEY 와 같은 값 — 잎 모듈이라 복사한다). */
const ANY_KEY = "*";

export type AuthoredVnExtras = {
  version: 1;
  /** 글자 언어. 생략 = 대사 시스템(meta.oprnDialogueSystem)의 언어를 따르고 그것도 없으면 ko. */
  language?: DialogueUiLanguage;
  /** 갤러리: 아직 안 연 CG 칸을 「잠김」으로 보이고, 본 엔딩을 회상으로 다시 읽을 수 있게 한다. */
  gallery: { enabled: boolean; showLocked: boolean };
  /** 엔딩 목록: 엔딩 정의를 읽어 자동으로 채운다. hideUnseen = 아직 못 본 엔딩 이름을 「???」 로 가린다. */
  endings: { enabled: boolean; hideUnseen: boolean };
  /** 세이브 카드: 저장 칸에 대표 장면 한 줄(마지막 대사)을 함께 보인다. */
  saveCards: { enabled: boolean };
};

const TOP_KEYS = ["version", "language", "gallery", "endings", "saveCards"];

export function defaultVnExtras(): AuthoredVnExtras {
  return {
    version: 1,
    gallery: { enabled: false, showLocked: true },
    endings: { enabled: false, hideUnseen: true },
    saveCards: { enabled: false },
  };
}

/** 연애·관계 중심 게임의 기본 구성 — 세 기능 전부 켠다. */
export function romanceVnExtras(): AuthoredVnExtras {
  return {
    version: 1,
    gallery: { enabled: true, showLocked: true },
    endings: { enabled: true, hideUnseen: true },
    saveCards: { enabled: true },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function flagGroup(name: string, value: unknown, keys: readonly string[]): void {
  if (!isRecord(value)) throw Error(`vnExtras: ${name} object required`);
  const bad = Object.keys(value).find((key) => !keys.includes(key));
  if (bad) throw Error(`vnExtras: unknown ${name} field ${bad}`);
  for (const key of keys) if (typeof value[key] !== "boolean") throw Error(`vnExtras: ${name}.${key} boolean required`);
}

/** 저장 직전 검증. 모르는 칸·잘못된 값은 거절한다(저작 데이터는 조용히 고치지 않는다). */
export function validateVnExtras(value: unknown): asserts value is AuthoredVnExtras {
  if (!isRecord(value)) throw Error("vnExtras: object required");
  const bad = Object.keys(value).find((key) => !TOP_KEYS.includes(key));
  if (bad) throw Error(`vnExtras: unknown field ${bad}`);
  if (value.version !== VN_EXTRAS_VERSION) throw Error("vnExtras: version 1 required");
  if (value.language !== undefined && !DIALOGUE_UI_LANGUAGES.includes(value.language as DialogueUiLanguage)) {
    throw Error(`vnExtras: language must be one of ${DIALOGUE_UI_LANGUAGES.join("|")}`);
  }
  flagGroup("gallery", value.gallery, ["enabled", "showLocked"]);
  flagGroup("endings", value.endings, ["enabled", "hideUnseen"]);
  flagGroup("saveCards", value.saveCards, ["enabled"]);
}

export type VnExtrasPatch = {
  readonly language?: DialogueUiLanguage | "inherit";
  readonly gallery?: boolean;
  readonly galleryShowLocked?: boolean;
  readonly endings?: boolean;
  readonly endingsHideUnseen?: boolean;
  readonly saveCards?: boolean;
};

/** 부분 저작을 현재 값 위에 덮어 완성형으로 만든다(도구용). 검증은 호출자가 validateVnExtras 로. */
export function mergeVnExtras(base: AuthoredVnExtras | undefined, patch: VnExtrasPatch): AuthoredVnExtras {
  const from = base ?? defaultVnExtras();
  const language = patch.language === "inherit" ? undefined : patch.language ?? from.language;
  return {
    version: 1,
    ...(language ? { language } : {}),
    gallery: { enabled: patch.gallery ?? from.gallery.enabled, showLocked: patch.galleryShowLocked ?? from.gallery.showLocked },
    endings: { enabled: patch.endings ?? from.endings.enabled, hideUnseen: patch.endingsHideUnseen ?? from.endings.hideUnseen },
    saveCards: { enabled: patch.saveCards ?? from.saveCards.enabled },
  };
}

type VnExtrasHost = Pick<Project, "system" | "gameDesignBrief"> & { readonly meta?: { readonly oprnVnExtras?: AuthoredVnExtras; readonly oprnDialogueSystem?: { readonly language?: DialogueUiLanguage } } };

/** 이 프로젝트의 추가 화면 설정. 저작이 우선, 없으면 관계 중심(연애) 게임은 기본 구성, 그 밖은 undefined(= 옛 동작 그대로). */
export function resolveVnExtras(project: VnExtrasHost | undefined): AuthoredVnExtras | undefined {
  if (!project) return undefined;
  const authored = project.meta?.oprnVnExtras;
  if (authored) return authored;
  return usesRelationshipMenu(project) ? romanceVnExtras() : undefined;
}

/** 갤러리가 켜져 있는가 — 기존 system.gallery(그림 해금 기록) 또는 연애 기본 구성/저작의 갤러리. */
export function galleryActive(project: VnExtrasHost | undefined): boolean {
  return isGalleryEnabled(project as Parameters<typeof isGalleryEnabled>[0]) || resolveVnExtras(project)?.gallery.enabled === true;
}

/** 글자 언어: 저작 > 대사 시스템 언어 > ko. dialogueUiText 의 첫 인자로 쓴다. */
export function vnExtrasLanguage(project: VnExtrasHost | undefined): { readonly language: DialogueUiLanguage } {
  const authored = resolveVnExtras(project)?.language;
  return { language: authored ?? project?.meta?.oprnDialogueSystem?.language ?? "ko" };
}

// ── 갤러리: CG 칸 목록 ───────────────────────────────────────────────────────────────

const gallerySlotCache = new WeakMap<object, readonly string[]>();

/**
 * 이 게임에서 갤러리에 기록되도록 저작된 CG(showPicture recordInGallery)를 이벤트 순서대로 모은다.
 * 해금 전에도 칸 수를 알 수 있어야 「잠김」을 보일 수 있다. 맵 이벤트·공통 이벤트를 훑는다.
 */
export function listGallerySlots(project: Pick<Project, "maps" | "commonEvents">): readonly string[] {
  const cached = gallerySlotCache.get(project);
  if (cached) return cached;
  const found: string[] = [];
  const take = (command: Command): void => {
    if (command.kind === "showPicture" && command.recordInGallery === true && typeof command.resourceId === "string" && command.resourceId.trim()) {
      const id = command.resourceId.trim();
      if (!found.includes(id) && found.length < GALLERY_SLOT_MAX) found.push(id);
    }
  };
  for (const map of Object.values(project.maps ?? {})) for (const command of collectCommands(map.events ?? [])) take(command);
  for (const common of project.commonEvents ?? []) for (const command of collectCommands([{ commands: common.commands } as never])) take(command);
  gallerySlotCache.set(project, found);
  return found;
}

/** 칸 목록 + 이미 해금된 것(옛 저장·다른 경로로 열린 그림은 칸 밖이라도 보인다). 해금된 것은 해금 순서를 지킨다. */
export function galleryRows(slots: readonly string[], unlocked: readonly string[]): readonly { readonly resourceId: string; readonly locked: boolean }[] {
  const unlockedSet = new Set(unlocked);
  const rows = slots.map((resourceId) => ({ resourceId, locked: !unlockedSet.has(resourceId) }));
  const known = new Set(slots);
  for (const resourceId of unlocked) if (!known.has(resourceId)) rows.push({ resourceId, locked: false });
  return rows.slice(0, GALLERY_SLOT_MAX);
}

// ── 엔딩 목록·체크리스트 ─────────────────────────────────────────────────────────────

export type EndingTier = "happy" | "normal" | "solo" | "other";
export const ENDING_TIERS: readonly EndingTier[] = ["happy", "normal", "solo"];

export type EndingRow = {
  readonly id: string;
  readonly name: string;
  readonly tier: EndingTier;
  /** 이 엔딩이 특정 인물의 호감으로 갈리면 그 인물 키. 인물 무관(공통)이면 undefined. */
  readonly characterId?: string;
  readonly seen: boolean;
};

function friendshipConditions(ending: EndingDef): { readonly key: string; readonly value: number }[] {
  const out: { key: string; value: number }[] = [];
  for (const condition of ending.conditions) {
    if (condition.kind === "friendshipAtLeast") out.push({ key: condition.npcKey ?? ANY_KEY, value: condition.value });
  }
  return out;
}

/** 엔딩의 결말 종류. 연애 뼈대 엔딩 id → 문턱 값 → 그 밖은 other. 조건 없는 뼈대 끝 엔딩은 「혼자」다. */
export function endingTierOf(ending: EndingDef): EndingTier {
  if (ending.id === ROMANCE_ENDING_HAPPY_ID) return "happy";
  if (ending.id === ROMANCE_ENDING_NORMAL_ID) return "normal";
  if (ending.id === SEGMENT_END_ENDING_ID) return "solo";
  const best = Math.max(-1, ...friendshipConditions(ending).map((row) => row.value));
  if (best >= ROMANCE_ENDING_HAPPY_AT) return "happy";
  if (best >= ROMANCE_ENDING_NORMAL_AT) return "normal";
  if (best >= 0) return "solo";
  return "other";
}

/** 엔딩 정의를 읽어 목록을 만든다(우선순위 높은 순 → 정의 순). seenIds = 기기 클리어 기록의 엔딩 id. */
export function listEndingRows(project: Pick<Project, "endings">, seenIds: readonly string[] | undefined): readonly EndingRow[] {
  const seen = new Set(seenIds ?? []);
  return [...(project.endings ?? [])]
    .map((ending, index) => ({ ending, index }))
    .sort((a, b) => b.ending.priority - a.ending.priority || a.index - b.index)
    .slice(0, ENDING_LIST_MAX)
    .map(({ ending }) => {
      const characters = friendshipConditions(ending).filter((row) => row.key !== ANY_KEY);
      return {
        id: ending.id,
        name: ending.name,
        tier: endingTierOf(ending),
        ...(characters[0] ? { characterId: characters[0].key } : {}),
        seen: seen.has(ending.id),
      };
    });
}

export type EndingChecklistRow = {
  /** 인물 키. 공통 엔딩(인물 무관)은 undefined. */
  readonly characterId?: string;
  readonly name: string;
  /** 결말 3종마다: 그 인물의 엔딩이 있는가(없으면 공통 엔딩으로 갈음) · 봤는가. */
  readonly tiers: readonly { readonly tier: EndingTier; readonly defined: boolean; readonly seen: boolean }[];
};

/**
 * 인물별 결말 3종 체크리스트. 인물 전용 엔딩이 있으면 그 인물 행을, 공통 엔딩이 있으면 「공통」 행을 만든다.
 * 인물 행에서 자기 엔딩이 없는 결말 칸은 공통 엔딩이 갈음한다(호감 가장 높은 사람 기준 엔딩이 그 인물에게도 닿으므로).
 */
export function endingChecklist(project: Project, seenIds: readonly string[] | undefined, commonLabel: string): readonly EndingChecklistRow[] {
  const rows = listEndingRows(project, seenIds);
  const characters: string[] = [];
  for (const row of rows) if (row.characterId && !characters.includes(row.characterId)) characters.push(row.characterId);
  const common = rows.filter((row) => !row.characterId);
  const cell = (tier: EndingTier, list: readonly EndingRow[], fallback: readonly EndingRow[]) => {
    const own = list.filter((row) => row.tier === tier);
    const pool = own.length > 0 ? own : fallback.filter((row) => row.tier === tier);
    return { tier, defined: pool.length > 0, seen: pool.some((row) => row.seen) };
  };
  const out: EndingChecklistRow[] = [];
  for (const characterId of characters) {
    const own = rows.filter((row) => row.characterId === characterId);
    out.push({ characterId, name: friendshipDisplayName(project, characterId) ?? characterId, tiers: ENDING_TIERS.map((tier) => cell(tier, own, common)) });
  }
  // 인물 행이 있으면 공통 엔딩은 각 행의 빈 결말 칸을 갈음하므로 따로 행을 만들지 않는다. 인물 전용 엔딩이 없는 게임만 「공통」 한 행.
  if (characters.length === 0 && common.length > 0) out.push({ name: commonLabel, tiers: ENDING_TIERS.map((tier) => cell(tier, common, [])) });
  return out;
}

/** 엔딩 회상: 에필로그 beat 의 대사(say)만 순서대로. 인터프리터를 다시 돌리지 않는다(읽기 전용). */
export function endingRecallLines(ending: Pick<EndingDef, "epilogue">): readonly BacklogEntry[] {
  const lines: BacklogEntry[] = [];
  for (const beat of ending.epilogue ?? []) {
    if (!isRecord(beat) || beat.kind !== "say" || typeof beat.text !== "string") continue;
    const text = beat.text.trim();
    if (!text) continue;
    const speaker = typeof beat.speaker === "string" && beat.speaker.trim() ? beat.speaker.trim() : undefined;
    lines.push({ kind: "line", text, ...(speaker ? { speaker } : {}) });
  }
  return lines;
}

// ── 세이브 카드: 대표 장면 한 줄 ─────────────────────────────────────────────────────

/** 저장 시점의 마지막 대사 한 줄(「화자: 글」). 백로그가 없으면 undefined. 길면 말줄임. */
export function saveSceneLine(backlog: readonly BacklogEntry[] | undefined): string | undefined {
  if (!backlog) return undefined;
  for (let index = backlog.length - 1; index >= 0; index -= 1) {
    const entry = backlog[index];
    if (!entry || entry.kind !== "line") continue;
    const text = entry.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const full = entry.speaker ? `${entry.speaker}: ${text}` : text;
    const chars = [...full];
    return chars.length > SCENE_LINE_MAX ? `${chars.slice(0, SCENE_LINE_MAX - 1).join("")}…` : full;
  }
  return undefined;
}

/** 저장 시각(ISO) → 「YYYY.MM.DD HH:mm」 로컬 시각. 무효면 빈 문자열. playerLoadPanel.formatSavedAt 과 같은 모양(그쪽은 스토어를 끌어와 잎 모듈이 못 쓴다). */
export function formatSaveDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad2 = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** 저장본에서 읽은 값을 안전한 한 줄로. */
export function normalizeSceneLine(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  const chars = [...text];
  return chars.length > SCENE_LINE_MAX ? `${chars.slice(0, SCENE_LINE_MAX - 1).join("")}…` : text;
}
