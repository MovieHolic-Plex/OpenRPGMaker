// project/dialogueSystem.ts
// 대사창 읽기 보조(백로그·오토·스킵·숨기기) — 장르 공통 저작 데이터와 순수 규칙(2026-10-17, 미연시 시스템 UI 1단계).
// 연애 전용이 아니다: JRPG·포켓몬류도 meta.oprnDialogueSystem 으로 켠다. 저작이 없으면 옛 동작 그대로(옛 프로젝트 불변),
// 관계 중심(연애) 게임만 저작 없이도 기본 구성이 켜진다(resolveDialogueSystem). 무거운 의존이 없는 잎 모듈이다(플레이어·편집기·조수 도구가 같이 쓴다).
// 사용자 설정(텍스트 속도·오토 속도·스킵 범위·투명도)은 기기 설정이고, 여기의 defaults 는 그 값이 없을 때의 시작값이다.
import { usesRelationshipMenu } from "./relationshipMenu";
import type { Project } from "./types";

export const DIALOGUE_SYSTEM_VERSION = 1 as const;
export const DIALOGUE_SPEEDS = ["slow", "normal", "fast"] as const;
export type DialogueSpeed = (typeof DIALOGUE_SPEEDS)[number];
export const SKIP_SCOPES = ["read", "all"] as const;
export type SkipScope = (typeof SKIP_SCOPES)[number];
/** 버튼·패널 글자의 언어. auto 는 기기 언어, 그 밖은 게임이 쓰는 언어를 저작자가 못박는다(기본 ko — 게임 글자는 번역하지 않는다). */
export const DIALOGUE_UI_LANGUAGES = ["ko", "en", "ja", "zh", "auto"] as const;
export type DialogueUiLanguage = (typeof DIALOGUE_UI_LANGUAGES)[number];

export const BACKLOG_LIMIT_DEFAULT = 100;
export const BACKLOG_LIMIT_MIN = 20;
export const BACKLOG_LIMIT_MAX = 500;
export const WINDOW_OPACITY_MIN = 0.4;
export const WINDOW_OPACITY_MAX = 1;
/** 읽은 글 표시 상한. 넘으면 오래된 것부터 잊는다(세이브 크기를 묶는다). */
export const READ_FLAG_LIMIT = 4000;

export type AuthoredDialogueSystem = {
  version: 1;
  language: DialogueUiLanguage;
  backlog: { enabled: boolean; limit: number };
  auto: { enabled: boolean };
  skip: { enabled: boolean };
  hideButton: { enabled: boolean };
  defaults: { textSpeed: DialogueSpeed; autoSpeed: DialogueSpeed; skipScope: SkipScope; windowOpacity: number };
};

const TOP_KEYS = ["version", "language", "backlog", "auto", "skip", "hideButton", "defaults"];
const DEFAULT_KEYS = ["textSpeed", "autoSpeed", "skipScope", "windowOpacity"];

export function defaultDialogueSystem(): AuthoredDialogueSystem {
  return {
    version: 1,
    language: "ko",
    backlog: { enabled: false, limit: BACKLOG_LIMIT_DEFAULT },
    auto: { enabled: false },
    skip: { enabled: false },
    hideButton: { enabled: false },
    defaults: { textSpeed: "normal", autoSpeed: "normal", skipScope: "read", windowOpacity: 1 },
  };
}

/** 연애·관계 중심 게임의 기본 구성 — 네 기능 전부 켠다. */
export function romanceDialogueSystem(): AuthoredDialogueSystem {
  return {
    ...defaultDialogueSystem(),
    backlog: { enabled: true, limit: BACKLOG_LIMIT_DEFAULT },
    auto: { enabled: true },
    skip: { enabled: true },
    hideButton: { enabled: true },
  };
}

/** 연애·오토메 전신 양쪽 스탠딩 + 반투명 베일 대화창 프리셋 id. */
export const DUAL_FULLBODY_VEIL_PRESET_ID = "dual-fullbody-veil" as const;
/** 전신·스탠딩 초상의 기본 등신비 계약: 어린이·노인 등 특수 체형을 제외한 모든 기본 인물은 7.5~8등신. */
export const DEFAULT_PORTRAIT_HEAD_RATIO = "7.5-to-8-heads" as const;
export const PORTRAIT_HEAD_RATIOS = ["7.5-to-8-heads", "child-6-heads", "elderly-7-heads"] as const;
export type PortraitHeadRatio = (typeof PORTRAIT_HEAD_RATIOS)[number];

const CHILD_ARCHETYPE_PATTERN = /(?:어린이|아이|유아|초등학생|꼬마|소꿉친구\s*아이|child|kid|young\s*(?:boy|girl)|toddler)/iu;
const ELDERLY_ARCHETYPE_PATTERN = /(?:노인|할머니|할아버지|장로|원로|노파|노옹|elder|elderly|old\s*(?:man|woman)|grandmother|grandfather)/iu;

/** 인물 설명·역할에서 전신 스탠딩 등신비를 결정한다. 특수 체형(어린이·노인)이 아니면 언제나 7.5~8등신이 기본값이다. */
export function resolvePortraitHeadRatio(archetypeOrDescription?: string): PortraitHeadRatio {
  const text = archetypeOrDescription?.trim() ?? "";
  if (!text) return DEFAULT_PORTRAIT_HEAD_RATIO;
  if (CHILD_ARCHETYPE_PATTERN.test(text)) return "child-6-heads";
  if (ELDERLY_ARCHETYPE_PATTERN.test(text)) return "elderly-7-heads";
  return DEFAULT_PORTRAIT_HEAD_RATIO;
}

/** 양쪽 전신 스탠딩 무대 기본 비율 — 미디엄 풀샷(머리~골반·허벅지 상단)이 화면 높이의 ~92%를 꽉 채우도록 세운다(98% × (1 - 0.06) ≈ 92.1%). */
export const ROMANCE_FULL_PORTRAIT_DEFAULTS = { height: 98, drop: 6 } as const;
export type DialogueSystemPresetId = "default" | "romance" | typeof DUAL_FULLBODY_VEIL_PRESET_ID;
export type DialogueSystemPresetDefinition = {
  readonly id: DialogueSystemPresetId;
  readonly label: string;
  readonly description: string;
  readonly dialogueStyle: "glass" | typeof DUAL_FULLBODY_VEIL_PRESET_ID;
  readonly fullPortrait?: { readonly height: number; readonly drop: number };
  readonly bilateralStanding: boolean;
  readonly system: () => AuthoredDialogueSystem;
};

export const DIALOGUE_SYSTEM_PRESETS: Readonly<Record<DialogueSystemPresetId, DialogueSystemPresetDefinition>> = {
  default: {
    id: "default",
    label: "기본 대사창",
    description: "장르 공통 기본 대화창 구성입니다.",
    dialogueStyle: "glass",
    bilateralStanding: false,
    system: defaultDialogueSystem,
  },
  romance: {
    id: "romance",
    label: "연애 기본 구성",
    description: "백로그·오토·스킵·숨기기와 양쪽 전신 반투명 베일 무대를 함께 켭니다.",
    dialogueStyle: DUAL_FULLBODY_VEIL_PRESET_ID,
    fullPortrait: ROMANCE_FULL_PORTRAIT_DEFAULTS,
    bilateralStanding: true,
    system: romanceDialogueSystem,
  },
  "dual-fullbody-veil": {
    id: "dual-fullbody-veil",
    label: "양쪽 전신 · 반투명 베일",
    description: "화면 양쪽에 전신 스탠딩 초상을 함께 세우고, 하단에는 테두리 없는 반투명 다크 그라데이션 대화창을 겹칩니다.",
    dialogueStyle: DUAL_FULLBODY_VEIL_PRESET_ID,
    fullPortrait: ROMANCE_FULL_PORTRAIT_DEFAULTS,
    bilateralStanding: true,
    system: romanceDialogueSystem,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function enabledFlag(name: string, value: unknown): void {
  if (!isRecord(value) || typeof value.enabled !== "boolean") throw Error(`dialogueSystem: ${name}.enabled boolean required`);
}

/** 저장 직전 검증. 모르는 칸·범위 밖 값은 거절한다(저작 데이터는 조용히 고치지 않는다). */
export function validateDialogueSystem(value: unknown): asserts value is AuthoredDialogueSystem {
  if (!isRecord(value)) throw Error("dialogueSystem: object required");
  const bad = Object.keys(value).find((key) => !TOP_KEYS.includes(key));
  if (bad) throw Error(`dialogueSystem: unknown field ${bad}`);
  if (value.version !== DIALOGUE_SYSTEM_VERSION) throw Error("dialogueSystem: version 1 required");
  if (!DIALOGUE_UI_LANGUAGES.includes(value.language as DialogueUiLanguage)) throw Error(`dialogueSystem: language must be one of ${DIALOGUE_UI_LANGUAGES.join("|")}`);
  const backlog = value.backlog;
  enabledFlag("backlog", backlog);
  const limit = (backlog as Record<string, unknown>).limit;
  if (Object.keys(backlog as object).some((key) => !["enabled", "limit"].includes(key))) throw Error("dialogueSystem: unknown backlog field");
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < BACKLOG_LIMIT_MIN || limit > BACKLOG_LIMIT_MAX) {
    throw Error(`dialogueSystem: backlog.limit integer ${BACKLOG_LIMIT_MIN}..${BACKLOG_LIMIT_MAX} required`);
  }
  for (const name of ["auto", "skip", "hideButton"] as const) {
    enabledFlag(name, value[name]);
    if (Object.keys(value[name] as object).some((key) => key !== "enabled")) throw Error(`dialogueSystem: unknown ${name} field`);
  }
  const defaults = value.defaults;
  if (!isRecord(defaults) || Object.keys(defaults).some((key) => !DEFAULT_KEYS.includes(key))) throw Error("dialogueSystem: defaults object with known fields required");
  for (const key of ["textSpeed", "autoSpeed"] as const) {
    if (!DIALOGUE_SPEEDS.includes(defaults[key] as DialogueSpeed)) throw Error(`dialogueSystem: defaults.${key} must be one of ${DIALOGUE_SPEEDS.join("|")}`);
  }
  if (!SKIP_SCOPES.includes(defaults.skipScope as SkipScope)) throw Error(`dialogueSystem: defaults.skipScope must be one of ${SKIP_SCOPES.join("|")}`);
  const opacity = defaults.windowOpacity;
  if (typeof opacity !== "number" || !Number.isFinite(opacity) || opacity < WINDOW_OPACITY_MIN || opacity > WINDOW_OPACITY_MAX) {
    throw Error(`dialogueSystem: defaults.windowOpacity ${WINDOW_OPACITY_MIN}..${WINDOW_OPACITY_MAX} required`);
  }
}

/** 부분 저작을 현재 값 위에 덮어 완성형으로 만든다(도구용). 검증은 호출자가 validateDialogueSystem 으로. */
export function mergeDialogueSystem(base: AuthoredDialogueSystem | undefined, patch: DialogueSystemPatch): AuthoredDialogueSystem {
  const from = base ?? defaultDialogueSystem();
  return {
    version: 1,
    language: patch.language ?? from.language,
    backlog: { enabled: patch.backlog ?? from.backlog.enabled, limit: patch.backlogLimit ?? from.backlog.limit },
    auto: { enabled: patch.auto ?? from.auto.enabled },
    skip: { enabled: patch.skip ?? from.skip.enabled },
    hideButton: { enabled: patch.hideButton ?? from.hideButton.enabled },
    defaults: {
      textSpeed: patch.defaults?.textSpeed ?? from.defaults.textSpeed,
      autoSpeed: patch.defaults?.autoSpeed ?? from.defaults.autoSpeed,
      skipScope: patch.defaults?.skipScope ?? from.defaults.skipScope,
      windowOpacity: patch.defaults?.windowOpacity ?? from.defaults.windowOpacity,
    },
  };
}

export type DialogueSystemPatch = {
  readonly language?: DialogueUiLanguage;
  readonly backlog?: boolean;
  readonly backlogLimit?: number;
  readonly auto?: boolean;
  readonly skip?: boolean;
  readonly hideButton?: boolean;
  readonly defaults?: Partial<AuthoredDialogueSystem["defaults"]>;
};

type DialogueSystemHost = Pick<Project, "system" | "gameDesignBrief"> & { readonly meta?: { readonly oprnDialogueSystem?: AuthoredDialogueSystem } };

/**
 * 이 프로젝트의 대사 시스템. 저작이 우선이다. 없으면 관계 중심(연애) 게임은 기본 구성, 그 밖은 undefined(= 옛 동작 그대로).
 * 모든 기능이 꺼진 저작도 그대로 돌려준다 — 호출자가 기능별 enabled 를 본다.
 */
export function resolveDialogueSystem(project: DialogueSystemHost | undefined): AuthoredDialogueSystem | undefined {
  if (!project) return undefined;
  const authored = project.meta?.oprnDialogueSystem;
  if (authored) return authored;
  return usesRelationshipMenu(project) ? romanceDialogueSystem() : undefined;
}

/** 읽기 보조가 하나라도 켜졌는가(오토·스킵·숨기기·백로그). 켜지면 대사창에 옛 「기록」 단추를 두지 않는다(대사창 단추 줄은 없다). */
export function dialogueSystemHasControls(system: AuthoredDialogueSystem | undefined): boolean {
  return !!system && (system.backlog.enabled || system.auto.enabled || system.skip.enabled || system.hideButton.enabled);
}

export function backlogEnabled(project: DialogueSystemHost | undefined): boolean {
  return resolveDialogueSystem(project)?.backlog.enabled === true;
}

// ── 백로그: 최근 N건 링 버퍼(세이브에 저장) ─────────────────────────────────────────────

export type BacklogEntry =
  | { readonly kind: "line"; readonly text: string; readonly speaker?: string; readonly color?: string; readonly context?: string }
  | { readonly kind: "choice"; readonly picked: string; readonly prompt?: string };

const TEXT_MAX = 600;
const SPEAKER_MAX = 40;
const COLOR_MAX = 40;
const PICKED_MAX = 200;

function clip(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\u0000/g, "").trim();
  if (!text) return undefined;
  return [...text].length > max ? [...text].slice(0, max).join("") : text;
}

/** 저장본·옛 세이브에서 온 값을 안전한 백로그로 정리한다. 깨진 항목은 버리고 마지막 limit 건만 남긴다. */
export function normalizeBacklog(value: unknown, limit: number = BACKLOG_LIMIT_MAX): BacklogEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cap = Math.max(1, Math.min(BACKLOG_LIMIT_MAX, Math.trunc(Number.isFinite(limit) ? limit : BACKLOG_LIMIT_MAX)));
  const out: BacklogEntry[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    if (raw.kind === "choice") {
      const picked = clip(raw.picked, PICKED_MAX);
      if (!picked) continue;
      const prompt = clip(raw.prompt, PICKED_MAX);
      out.push({ kind: "choice", picked, ...(prompt ? { prompt } : {}) });
    } else if (raw.kind === "line") {
      const text = clip(raw.text, TEXT_MAX);
      if (!text) continue;
      const speaker = clip(raw.speaker, SPEAKER_MAX);
      const color = clip(raw.color, COLOR_MAX);
      const context = clip(raw.context, SPEAKER_MAX);
      out.push({ kind: "line", text, ...(speaker ? { speaker } : {}), ...(color ? { color } : {}), ...(context ? { context } : {}) });
    }
  }
  const kept = out.length > cap ? out.slice(out.length - cap) : out;
  return kept.length > 0 ? kept : undefined;
}

export type BacklogHost = { dialogueBacklog?: BacklogEntry[]; dialogueRead?: string[] };

/** 새 항목을 덧붙이고 limit 을 넘으면 오래된 것부터 버린다. 무한히 자라지 않는다. */
export function appendBacklog(host: BacklogHost, entry: BacklogEntry, limit: number): void {
  const cap = Math.max(1, Math.min(BACKLOG_LIMIT_MAX, Math.trunc(Number.isFinite(limit) ? limit : BACKLOG_LIMIT_DEFAULT)));
  const next = [...(host.dialogueBacklog ?? []), entry];
  host.dialogueBacklog = next.length > cap ? next.slice(next.length - cap) : next;
}

// ── 읽은 글 표시 ──────────────────────────────────────────────────────────────────────────

/** 화자+본문의 32비트 FNV-1a 해시(base36). 읽은 글 판정 키 — 충돌은 「읽은 줄을 한 번 더 건너뜀」 정도의 손해뿐이다. */
export function dialogueReadKey(speaker: string | undefined, text: string): string {
  let hash = 0x811c9dc5;
  const input = `${speaker ?? ""}\u0000${text}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

export function normalizeReadKeys(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string" || !/^[0-9a-z]{1,8}$/.test(raw) || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  const kept = out.length > READ_FLAG_LIMIT ? out.slice(out.length - READ_FLAG_LIMIT) : out;
  return kept.length > 0 ? kept : undefined;
}

export function isDialogueRead(host: BacklogHost | undefined, key: string): boolean {
  return host?.dialogueRead?.includes(key) === true;
}

export function markDialogueRead(host: BacklogHost, key: string): void {
  const current = host.dialogueRead ?? [];
  if (current.includes(key)) return;
  const next = [...current, key];
  host.dialogueRead = next.length > READ_FLAG_LIMIT ? next.slice(next.length - READ_FLAG_LIMIT) : next;
}

// ── 오토·스킵 규칙(순수) ──────────────────────────────────────────────────────────────────

/** 오토가 한 쪽을 다 보여 준 뒤 다음으로 넘기기까지 기다리는 시간. 글이 길수록 오래 — 속도는 기기 설정. */
export function autoAdvanceDelayMs(charCount: number, speed: DialogueSpeed): number {
  const base = { slow: 1400, normal: 800, fast: 400 }[speed];
  const perChar = { slow: 120, normal: 70, fast: 38 }[speed];
  const chars = Math.max(0, Math.trunc(Number.isFinite(charCount) ? charCount : 0));
  return Math.min(12000, Math.max(600, base + perChar * chars));
}

/** 스킵 한 줄 사이 숨 돌림(너무 빠르면 화면이 깜빡이기만 한다). */
export const SKIP_STEP_DELAY_MS = 70;

/** 오토·스킵을 멈추는 이유. 사용자가 끈 것(manual) 외에는 안전 규칙이다. */
export type ReadingStopReason = "manual" | "choices" | "boundary" | "ending" | "unread" | "locked" | "disabled" | "hidden";

/**
 * 이 줄을 스킵으로 넘어가도 되는가. 선택지·엔딩·넘기기금지 구간은 어떤 범위에서도 넘기지 않는다.
 * 「읽은 글만」 범위는 읽지 않은 줄에서 멈춘다.
 */
export function skipVerdict(input: {
  readonly enabled: boolean;
  readonly scope: SkipScope;
  readonly isRead: boolean;
  readonly endingEpilogue: boolean;
  readonly lockedText: boolean;
}): { readonly ok: true } | { readonly ok: false; readonly reason: ReadingStopReason } {
  if (!input.enabled) return { ok: false, reason: "disabled" };
  if (input.endingEpilogue) return { ok: false, reason: "ending" };
  if (input.lockedText) return { ok: false, reason: "locked" };
  if (input.scope === "read" && !input.isRead) return { ok: false, reason: "unread" };
  return { ok: true };
}

/** 인터프리터의 막는 단계 중 오토·스킵을 멈춰야 하는 것(사람이 직접 골라야 하거나 장면이 바뀌는 것). */
const READING_STOP_STEP_KINDS: ReadonlySet<string> = new Set([
  "choices", "presentItem", "planSchedule", "inputNumber", "enterHeroName", "timedChoice", "quickTimeEvent", "teleportMenu",
  "transfer", "battleProcessing", "tacticsBattle", "shop", "inn", "gameOver", "returnToTitle",
  "openSaveMenu", "openMenuScreen", "openLoadMenu", "openChest", "sleepUntilMorning", "playMovie", "inputWait",
]);

export function stopsReading(stepKind: string): boolean {
  return READING_STOP_STEP_KINDS.has(stepKind);
}

export function stepStopReason(stepKind: string): ReadingStopReason {
  if (stepKind === "choices" || stepKind === "presentItem" || stepKind === "planSchedule" || stepKind === "inputNumber" || stepKind === "enterHeroName" || stepKind === "timedChoice" || stepKind === "quickTimeEvent" || stepKind === "teleportMenu") return "choices";
  if (stepKind === "returnToTitle" || stepKind === "gameOver") return "ending";
  return "boundary";
}
