// project/bestiary.ts
// 괴물 도감(일반 RPG 용, 2026-10-31 사냥꾼 계약 공백 B) — 몬스터 수집 도감(monsterJournal)과 별개다.
// 설정은 system.bestiary(항목 → 칸), 플레이어가 알게 된 것은 세이브에 들어가는 session.bestiary 다.
// 칸은 저마다 열리는 방법이 있다: seen(전투에서 처음 만남) · defeated(처음 쓰러뜨림) · weakness(약점을 하나라도 알아냄)
// · condition(조건이 참 — 단서 스위치 둘 다 켜짐 등). 열린 칸은 ESC 메뉴 「도감」에 글이 보이고, 잠긴 칸은 「???」.
// 약점 칸에는 전투에서 알아낸 약점(session.knownWeaknesses)이 함께 적힌다. 새로 열린 칸은 화면 구석 알림 한 줄.
// 이 파일은 순수 규칙(정규화·검증·잠김 판정·알림 고르기)만 갖는다. 메뉴 화면은 player/playerBestiaryDetail.ts.
import { evalCondition } from "./session";
import type { PlaySessionLike } from "./sessionRuntimeTypes";
import type { Condition, Project } from "./types";

export const BESTIARY_UNLOCKS = ["seen", "defeated", "weakness", "condition"] as const;
export type BestiaryUnlock = (typeof BESTIARY_UNLOCKS)[number];
export const BESTIARY_UNLOCK_LABELS: Readonly<Record<BestiaryUnlock, string>> = {
  seen: "처음 만나면",
  defeated: "처음 쓰러뜨리면",
  weakness: "약점을 알아내면",
  condition: "조건이 참이면",
};
export const BESTIARY_DEFAULT_TITLE = "도감";
export const BESTIARY_ENTRY_LIMIT = 200;
export const BESTIARY_SECTION_LIMIT = 8;
export const BESTIARY_TEXT_LIMIT = 400;

export interface BestiarySection {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  /** 생략 = seen. */
  readonly unlock?: BestiaryUnlock;
  /** unlock condition 일 때의 조건. */
  readonly unlockWhen?: Condition;
}

export interface BestiaryEntry {
  readonly id: string;
  readonly name: string;
  /** 이 항목으로 묶이는 적 레코드(같은 괴물의 보스판·변종). 만남·처치·약점은 이 중 하나라도 세운다. */
  readonly enemyIds: readonly string[];
  /** 상세 그림. 생략 = 첫 적의 전투 그림. */
  readonly pictureResourceId?: string;
  readonly sections: readonly BestiarySection[];
}

export interface BestiaryConfig {
  readonly enabled: boolean;
  /** 메뉴 항목·화면 제목(12자 이하). 생략 = 「도감」. */
  readonly title?: string;
  readonly entries: readonly BestiaryEntry[];
}

/** 세이브에 들어가는 플레이어 기록. */
export interface BestiarySessionState {
  /** 전투에서 만난 적 레코드 id. */
  seen?: string[];
  /** 적 레코드 id → 쓰러뜨린 수. */
  defeated?: Record<string, number>;
  /** 이미 알림을 띄운 칸(`항목id/칸id`). 처음 열릴 때만 알린다. */
  noted?: string[];
}

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

export function isBestiaryUnlock(value: unknown): value is BestiaryUnlock {
  return typeof value === "string" && (BESTIARY_UNLOCKS as readonly string[]).includes(value);
}

/** 저장·도구·편집기가 같이 쓰는 정규화. 모양이 틀린 칸·항목은 버리고 id 가 겹치면 앞의 것을 남긴다. */
export function normalizeBestiary(value: unknown): BestiaryConfig | undefined {
  if (!isRecord(value)) return undefined;
  const entries: BestiaryEntry[] = [];
  const entryIds = new Set<string>();
  for (const raw of Array.isArray(value.entries) ? value.entries : []) {
    if (!isRecord(raw)) continue;
    const id = str(raw.id);
    if (!id || entryIds.has(id) || entries.length >= BESTIARY_ENTRY_LIMIT) continue;
    entryIds.add(id);
    const sectionIds = new Set<string>();
    const sections: BestiarySection[] = [];
    for (const rawSection of Array.isArray(raw.sections) ? raw.sections : []) {
      if (!isRecord(rawSection)) continue;
      const sectionId = str(rawSection.id);
      if (!sectionId || sectionIds.has(sectionId) || sections.length >= BESTIARY_SECTION_LIMIT) continue;
      sectionIds.add(sectionId);
      const unlock = isBestiaryUnlock(rawSection.unlock) ? rawSection.unlock : "seen";
      sections.push({
        id: sectionId,
        title: str(rawSection.title) || sectionId,
        text: typeof rawSection.text === "string" ? rawSection.text.slice(0, BESTIARY_TEXT_LIMIT) : "",
        ...(unlock !== "seen" ? { unlock } : {}),
        ...(unlock === "condition" && isRecord(rawSection.unlockWhen) ? { unlockWhen: structuredClone(rawSection.unlockWhen) as Condition } : {}),
      });
    }
    const enemyIds = [...new Set((Array.isArray(raw.enemyIds) ? raw.enemyIds : []).map(str).filter(Boolean))];
    const picture = str(raw.pictureResourceId);
    entries.push({ id, name: str(raw.name) || id, enemyIds, ...(picture ? { pictureResourceId: picture } : {}), sections });
  }
  const title = str(value.title).slice(0, 12);
  return { enabled: value.enabled === true, ...(title ? { title } : {}), entries };
}

/** 켜져 있을 때만 값이 있다. */
export function resolveBestiary(project: Project): BestiaryConfig | undefined {
  const config = project.system.bestiary;
  return config?.enabled ? config : undefined;
}

export function bestiaryTitle(project: Project): string {
  return project.system.bestiary?.title || BESTIARY_DEFAULT_TITLE;
}

/** 세이브에서 읽은 값 — 모양이 틀린 칸은 버린다. 값이 없으면 undefined. */
export function normalizeBestiarySession(raw: unknown): BestiarySessionState | undefined {
  if (!isRecord(raw)) return undefined;
  const ids = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const out = [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))].slice(0, 2000);
    return out.length ? out : undefined;
  };
  const defeated: Record<string, number> = {};
  if (isRecord(raw.defeated)) {
    for (const [id, count] of Object.entries(raw.defeated)) {
      if (typeof count === "number" && Number.isFinite(count) && count > 0) defeated[id] = Math.min(999_999, Math.trunc(count));
    }
  }
  const seen = ids(raw.seen);
  const noted = ids(raw.noted);
  const out: BestiarySessionState = {
    ...(seen ? { seen } : {}),
    ...(Object.keys(defeated).length ? { defeated } : {}),
    ...(noted ? { noted } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

/** 전투가 적는 약점 장부(PlaySession.knownWeaknesses 와 같은 모양). PlaySessionLike 에는 없어 따로 받는다. */
type KnownWeaknessHost = { readonly knownWeaknesses?: Readonly<Record<string, Readonly<Record<string, number>>>> };
type BestiarySessionLike = PlaySessionLike & KnownWeaknessHost;

export function bestiaryEntrySeen(session: Pick<PlaySessionLike, "bestiary">, entry: BestiaryEntry): boolean {
  const seen = session.bestiary?.seen;
  return Boolean(seen && entry.enemyIds.some((id) => seen.includes(id)));
}

export function bestiaryEntryDefeated(session: Pick<PlaySessionLike, "bestiary">, entry: BestiaryEntry): number {
  const defeated = session.bestiary?.defeated ?? {};
  return entry.enemyIds.reduce((sum, id) => sum + (defeated[id] ?? 0), 0);
}

/** 이 항목의 적들에게서 알아낸 약점·저항(`element:<id>`·`type:<kind>` → 배율). 같은 키는 처음 것. */
export function bestiaryKnownWeaknesses(session: KnownWeaknessHost, entry: BestiaryEntry): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of entry.enemyIds) {
    for (const [key, rate] of Object.entries(session.knownWeaknesses?.[id] ?? {})) if (!(key in out)) out[key] = rate;
  }
  return out;
}

export function bestiarySectionUnlocked(session: BestiarySessionLike, entry: BestiaryEntry, section: BestiarySection): boolean {
  switch (section.unlock ?? "seen") {
    case "seen": return bestiaryEntrySeen(session, entry);
    case "defeated": return bestiaryEntryDefeated(session, entry) > 0;
    case "weakness": return Object.keys(bestiaryKnownWeaknesses(session, entry)).length > 0;
    // 조건이 비었으면 열 길이 없다(편집 중인 칸) — 참으로 보지 않는다.
    case "condition": return section.unlockWhen ? evalCondition(session, section.unlockWhen) : false;
  }
}

/** 목록에 이름이 보이는가 — 만났거나 칸이 하나라도 열렸으면. 아니면 「???」. */
export function bestiaryEntryKnown(session: BestiarySessionLike, entry: BestiaryEntry): boolean {
  return bestiaryEntrySeen(session, entry) || entry.sections.some((section) => bestiarySectionUnlocked(session, entry, section));
}

/** 전투가 끝날 때 — 만난 적을 적고, 이겼으면 쓰러진 적을 센다. 도감이 꺼진 게임은 아무것도 적지 않는다. */
export function recordBestiaryBattle(
  project: Project,
  session: PlaySessionLike,
  enemies: readonly { readonly recordId: string; readonly hp: number }[],
  result: "victory" | "defeat" | "escape",
): void {
  if (!resolveBestiary(project)) return;
  const state: BestiarySessionState = (session.bestiary ??= {});
  const seen = new Set(state.seen ?? []);
  for (const enemy of enemies) if (enemy.recordId) seen.add(enemy.recordId);
  if (seen.size) state.seen = [...seen];
  if (result !== "victory") return;
  const defeated = { ...(state.defeated ?? {}) };
  for (const enemy of enemies) if (enemy.recordId && enemy.hp <= 0) defeated[enemy.recordId] = (defeated[enemy.recordId] ?? 0) + 1;
  if (Object.keys(defeated).length) state.defeated = defeated;
}

export type BestiaryNotice = { readonly entryId: string; readonly sectionId: string; readonly message: string };

/**
 * 새로 열렸지만 아직 알리지 않은 칸을 알림으로 바꾸고 noted 에 적는다(같은 칸은 두 번 알리지 않는다).
 * 알림 문구는 「도감에 적었다 — 익사귀 · 약점」. 호출부가 화면 구석 알림으로 띄운다.
 */
export function takeBestiaryNotices(project: Project, session: BestiarySessionLike): BestiaryNotice[] {
  const config = resolveBestiary(project);
  if (!config) return [];
  const noted = new Set(session.bestiary?.noted ?? []);
  const notices: BestiaryNotice[] = [];
  for (const entry of config.entries) {
    for (const section of entry.sections) {
      const key = `${entry.id}/${section.id}`;
      if (noted.has(key) || !bestiarySectionUnlocked(session, entry, section)) continue;
      noted.add(key);
      notices.push({ entryId: entry.id, sectionId: section.id, message: `${bestiaryTitle(project)}에 적었다 — ${entry.name} · ${section.title}` });
    }
  }
  if (notices.length) (session.bestiary ??= {}).noted = [...noted];
  return notices;
}
