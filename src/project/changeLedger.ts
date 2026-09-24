// project/changeLedger.ts — 「무엇이 바뀌었나」의 **긴 명세**.
//
// 왜 필요한가 (실측 2026-09-14, 감독 지시): 칩 한 줄과 지도 그림 두 장은 큰 위임을 검토하기에
// 모자란다. 위임이 클수록 사용자가 봐야 하는 것은 **항목별 before → after** 다 — 어느 이벤트가
// 어디로 갔고, 어떤 퀘스트가 생겼고, 어느 레코드의 어느 필드가 무엇에서 무엇으로 바뀌었는가.
//
// 이 모듈은 그 명세를 두 프로젝트에서 계산한다. 영역을 열거하되 판정은 **여집합**이다 — 모르는
// 모양은 키 이름과 값 요약으로 그대로 남으므로, 새 필드가 생겨도 변경이 사라지지 않는다.
import type { Project } from "./types";

export type ChangeLedgerChange = "added" | "removed" | "changed";

export interface ChangeLedgerEntry {
  /** 사람 말 영역 이름 — 「맵」·「이벤트 · 달빛 숲」·「데이터베이스 · 아이템」. */
  readonly area: string;
  /** 항목 이름 — 「달빛 숲」·「NPC_가드」·「포션」. */
  readonly label: string;
  readonly change: ChangeLedgerChange;
  readonly before?: string;
  readonly after?: string;
  /** 이 항목 **안에서** 무엇이 바뀌었나 — `이름: 이전 → 이후`. */
  readonly detail?: readonly string[];
}

export interface ChangeLedger {
  readonly entries: readonly ChangeLedgerEntry[];
  /** 잘라내기 전 전체 항목 수 — 화면이 "N건 중 M건" 이라고 말할 수 있게. */
  readonly total: number;
}

/** 카드 한 장에 담기는 상한. 넘으면 자르고 남은 수를 `total` 로 알린다(조용한 절단 금지). */
const DEFAULT_MAX_ENTRIES = 400;
/** 레코드 하나가 명세를 다 먹지 않게. 넘으면 `…외 N개 필드`. */
const DETAIL_LIMIT_PER_RECORD = 10;
/** 값 요약 한 줄의 길이 상한 — 200줄짜리 대사가 카드를 밀어내지 않게. */
const VALUE_CLIP = 90;

const FIELD_LABELS: Readonly<Record<string, string>> = {
  name: "이름",
  title: "제목",
  summary: "요약",
  author: "만든 사람",
  terms: "용어",
  description: "설명",
  graphicNote: "그림 메모",
  x: "X",
  y: "Y",
  width: "너비",
  height: "높이",
  tileSize: "타일 크기",
  lowerTiles: "아래층 타일",
  upperTiles: "위층 타일",
  lowerOverlayTiles: "2층 타일",
  upperOverlayTiles: "4층 타일",
  shadowBits: "그림자",
  lowerTileStacks: "아래층 겹침",
  upperTileStacks: "위층 겹침",
  tilesetId: "타일셋",
  bgm: "BGM",
  bgs: "배경음",
  encounterRate: "인카운터율",
  troopIds: "적 그룹",
  encounterTable: "인카운터 표",
  fieldSpawns: "필드 스폰",
  events: "이벤트",
  pages: "페이지",
  commands: "명령",
  condition: "조건",
  trigger: "발동",
  sprite: "그림",
  moveRoute: "이동 경로",
  schedule: "시간표",
  characterId: "캐릭터",
  placementRole: "배치 역할",
  fields: "필드",
  price: "가격",
  maxLevel: "최대 레벨",
  levelUpRewards: "레벨 보상",
  skillType: "스킬 종류",
  steps: "단계",
  objectives: "목표",
  gates: "조건",
  rewards: "보상",
  kind: "종류",
  type: "종류",
  locationId: "장소",
  speciesId: "종",
  startMapId: "시작 맵",
  startPos: "시작 위치",
  playerEnabled: "플레이어 통행",
  npcEnabled: "NPC 통행",
  from: "출발",
  to: "도착",
  passages: "통행",
  priority: "우선순위",
  epilogue: "에필로그",
  text: "본문",
  body: "본문",
  blocks: "블록",
  markdown: "본문",
};

export const DATABASE_AREA_LABELS: Readonly<Record<string, string>> = {
  actors: "액터",
  classes: "클래스",
  skills: "스킬",
  items: "아이템",
  equipment: "장비",
  enemies: "적",
  troops: "부대",
  states: "상태",
  battleAnimations: "전투 애니메이션",
  characterAppearances: "캐릭터 외형",
  equipmentSlots: "장비 슬롯",
  elements: "속성",
  terrains: "지형",
  battleCommands: "전투 커맨드",
  monsterSpecies: "몬스터 종",
  crops: "작물",
  lifeSkills: "생활 스킬",
  farmAnimalSpecies: "가축",
  fishSpecies: "물고기",
  farmBuildingTypes: "농장 건물",
};

/**
 * 값 하나를 한 줄로. 목록은 개수 + 앞부분만, 개체는 **키 이름**만 — 대사 200줄짜리 페이지나
 * JSON 덩어리가 카드를 삼키면 나머지 항목을 못 읽는다(그건 명세가 아니라 소음이다).
 */
export function summarizeLedgerValue(value: unknown): string {
  if (value === undefined || value === null) return "없음";
  if (typeof value === "string") return value.trim().length === 0 ? "빈 값" : clip(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "없음";
    if (value.every((item) => item === null || ["string", "number", "boolean"].includes(typeof item))) {
      return `${clip(value.map((item) => String(item)).join(", "))} (${value.length}개)`;
    }
    return `${value.length}개 항목`;
  }
  const object = asRecord(value);
  if (object) {
    const keys = Object.keys(object);
    if (keys.length === 0) return "빈 값";
    const scalarsOnly = keys.every((key) => object[key] === null || ["string", "number", "boolean"].includes(typeof object[key]));
    if (scalarsOnly) {
      return `${clip(keys.map((key) => `${fieldLabel(key)} ${summarizeLedgerValue(object[key])}`).join(", "))} (${keys.length}개)`;
    }
    return `${clip(keys.slice(0, 5).join(", "))} … (${keys.length}개 항목)`;
  }
  return clip(String(value));
}

function clip(text: string): string {
  const flat = text.replace(/\s+/gu, " ").trim();
  return flat.length > VALUE_CLIP ? `${flat.slice(0, VALUE_CLIP)}…` : flat;
}

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

function same(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

interface ChangedFieldsOptions {
  /** 이 키는 다른 항목이 맡는다(맵의 이벤트 목록 등) — 여기서 줄을 만들지 않는다. */
  readonly skip?: readonly string[];
  /** 기본 요약 대신 쓸 문장. `undefined` 를 돌려주면 기본 요약을 쓴다. */
  readonly summarize?: (key: string, before: unknown, after: unknown) => string | undefined;
  /** `added`/`removed` 는 한쪽만 있다 — 「없음 → 값」 대신 `이름: 값` 으로 읽히게. */
  readonly side?: "both" | "after" | "before";
}

/** 레코드 하나 안에서 바뀐 필드들 — `이름: 이전 → 이후`. */
function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  options: ChangedFieldsOptions = {},
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const side = options.side ?? "both";
  const lines: string[] = [];
  let hidden = 0;
  for (const key of keys) {
    if (key === "id" || options.skip?.includes(key) === true) continue;
    const prev = before[key];
    const next = after[key];
    if (same(prev, next)) continue;
    if (lines.length >= DETAIL_LIMIT_PER_RECORD) {
      hidden += 1;
      continue;
    }
    const fallback = side === "after"
      ? summarizeLedgerValue(next)
      : side === "before"
        ? summarizeLedgerValue(prev)
        : `${summarizeLedgerValue(prev)} → ${summarizeLedgerValue(next)}`;
    lines.push(`${fieldLabel(key)}: ${options.summarize?.(key, prev, next) ?? fallback}`);
  }
  if (hidden > 0) lines.push(`…외 ${hidden}개 필드`);
  return lines;
}

interface Identified {
  readonly id: string;
  readonly label: string;
}

/**
 * 항목의 신원. `id` → `key` → 자리 번호 순으로 찾고, 이름은 `name`/`title`/`label` → 신원 순.
 * 어느 것도 없으면 **자리 번호로라도** 남긴다 — 신원을 못 찾았다고 항목이 사라지면 안 된다.
 */
function identify(record: unknown, index: number): Identified {
  const object = asRecord(record) ?? {};
  const id = stringField(object.id) ?? stringField(object.key) ?? `#${index + 1}`;
  const name = stringField(object.name) ?? stringField(object.title) ?? stringField(object.label);
  return { id, label: name ?? id };
}

function diffRecords(area: string, beforeList: readonly unknown[], afterList: readonly unknown[], out: ChangeLedgerEntry[]): void {
  const beforeById = new Map<string, { readonly record: unknown; readonly label: string }>();
  beforeList.forEach((record, index) => {
    const { id, label } = identify(record, index);
    beforeById.set(id, { record, label });
  });
  const seen = new Set<string>();
  afterList.forEach((record, index) => {
    const { id, label } = identify(record, index);
    seen.add(id);
    const prev = beforeById.get(id);
    if (!prev) {
      out.push({ area, label, change: "added", detail: changedFields({}, asRecord(record) ?? {}, { side: "after" }) });
      return;
    }
    const detail = changedFields(asRecord(prev.record) ?? {}, asRecord(record) ?? {});
    if (detail.length === 0) return;
    out.push({ area, label, change: "changed", detail });
  });
  for (const [id, entry] of beforeById) {
    if (seen.has(id)) continue;
    out.push({ area, label: entry.label, change: "removed", detail: changedFields(asRecord(entry.record) ?? {}, {}, { side: "before" }) });
  }
}
/** 싱글톤(또는 임의 값)의 변경 — 한 항목에 `필드: 이전 → 이후` 로 모은다. */
function diffValue(area: string, label: string, before: unknown, after: unknown, out: ChangeLedgerEntry[]): void {
  if (same(before, after)) return;
  const beforeObject = asRecord(before);
  const afterObject = asRecord(after);
  const detail = beforeObject && afterObject ? changedFields(beforeObject, afterObject) : [];
  const scalar = (value: unknown): boolean =>
    value === undefined || value === null || ["string", "number", "boolean"].includes(typeof value);
  // 개체는 아래 `필드:` 줄들이 무엇이 바뀌었는지 말한다 — 같은 요약을 위에 또 붙이면
  // `terms, title, author … → terms, title, author …` 처럼 **같아 보이는 두 줄**만 남는다.
  const showValues = scalar(before) || scalar(after);
  out.push({
    area,
    label,
    change: before === undefined || before === null ? "added" : after === undefined || after === null ? "removed" : "changed",
    ...(showValues ? { before: summarizeLedgerValue(before), after: summarizeLedgerValue(after) } : {}),
    ...(detail.length > 0 ? { detail } : {}),
  });
}

/** 타일 배열 두 개에서 실제로 달라진 칸 수 — 명세에 만 칸 배열을 쏟지 않기 위한 요약. */
function countTileCells(before: unknown, after: unknown): number {
  const beforeCells = Array.isArray(before) ? before : [];
  const afterCells = Array.isArray(after) ? after : [];
  const size = Math.max(beforeCells.length, afterCells.length);
  let changed = 0;
  for (let index = 0; index < size; index += 1) {
    if (beforeCells[index] !== afterCells[index]) changed += 1;
  }
  return changed;
}

function mapEntries(before: Project, after: Project, out: ChangeLedgerEntry[]): void {
  const mapIds = new Set([...Object.keys(before.maps), ...Object.keys(after.maps)]);
  for (const id of mapIds) {
    const prev = before.maps[id];
    const next = after.maps[id];
    const name = next?.name ?? prev?.name ?? id;
    const label = `${name} (${id})`;
    if (!prev) {
      out.push({
        area: "맵",
        label,
        change: "added",
        after: `${next!.width}×${next!.height} · 타일셋 ${next!.tilesetId} · 이벤트 ${next!.events?.length ?? 0}건`,
      });
      continue;
    }
    if (!next) {
      out.push({ area: "맵", label, change: "removed" });
      continue;
    }
    const detail = changedFields(prev as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>, {
      skip: ["events"],
      summarize: (key, beforeValue, afterValue) => {
        if (key === "lowerTiles" || key === "upperTiles" || key === "lowerOverlayTiles" || key === "upperOverlayTiles" || key === "shadowBits") {
          const changed = countTileCells(beforeValue, afterValue);
          return changed > 0 ? `${changed}칸 바뀜` : undefined;
        }
        if (key === "lowerTileStacks" || key === "upperTileStacks") {
          return `${Object.keys(asRecord(afterValue) ?? {}).length}자리`;
        }
        return undefined;
      },
    });
    if (detail.length > 0) out.push({ area: "맵", label, change: "changed", detail });
  }
}

function eventEntries(before: Project, after: Project, out: ChangeLedgerEntry[]): void {
  const mapIds = new Set([...Object.keys(before.maps), ...Object.keys(after.maps)]);
  for (const mapId of mapIds) {
    const prev = before.maps[mapId];
    const next = after.maps[mapId];
    const mapName = next?.name ?? prev?.name ?? mapId;
    diffRecords(`이벤트 · ${mapName}`, prev?.events ?? [], next?.events ?? [], out);
  }
}

function databaseEntries(before: Project, after: Project, out: ChangeLedgerEntry[]): void {
  const beforeDatabase = asRecord(before.database) ?? {};
  const afterDatabase = asRecord(after.database) ?? {};
  const keys = new Set([...Object.keys(beforeDatabase), ...Object.keys(afterDatabase)]);
  for (const key of keys) {
    const beforeList = Array.isArray(beforeDatabase[key]) ? (beforeDatabase[key] as unknown[]) : [];
    const afterList = Array.isArray(afterDatabase[key]) ? (afterDatabase[key] as unknown[]) : [];
    if (beforeList.length === 0 && afterList.length === 0) continue;
    diffRecords(`데이터베이스 · ${DATABASE_AREA_LABELS[key] ?? key}`, beforeList, afterList, out);
  }
}

type ProjectCollectionReader = (project: Project) => readonly unknown[];

/** 신원이 `id` 가 아닌 컬렉션은 여기서 정규화한다 — 신원 없는 항목도 자리 번호로 남는다. */
function identified(list: readonly unknown[], idOf: (record: Record<string, unknown>) => string | null): readonly unknown[] {
  return list.map((record, index) => {
    const object = asRecord(record) ?? {};
    const id = idOf(object) ?? stringField(object.id) ?? `#${index + 1}`;
    return { ...object, id };
  });
}

function collectionEntries(before: Project, after: Project, out: ChangeLedgerEntry[]): void {
  const collections: readonly (readonly [string, ProjectCollectionReader])[] = [
    ["스위치", (project) => project.switches ?? []],
    ["변수", (project) => project.variables ?? []],
    ["퀘스트", (project) => project.quests ?? []],
    ["스토리 플래그", (project) => project.storyFlags ?? []],
    ["캐릭터", (project) => identified(Object.entries(project.characters ?? {}).map(([key, profile]) => ({ id: key, ...profile })), () => null)],
    ["공통 이벤트", (project) => project.commonEvents ?? []],
    ["엔딩", (project) => project.endings ?? []],
    ["테스트 프리셋", (project) => project.testPresets ?? []],
    // 자원은 `kind:name` 이 유일하지 않다(같은 이름의 그림이 여럿) — assetId 가 먼저다.
    ["자원", (project) => identified(project.resourceProfiles ?? [], (record) => {
      const assetId = stringField(record.assetId);
      return assetId ? `${String(record.kind)}:${assetId}` : `${String(record.kind)}:${String(record.name)}`;
    })],
    ["맵 연결", (project) => project.mapConnections ?? []],
    ["세계관", (project) => project.world?.entities ?? []],
    ["집 형태", (project) => project.villageTemplates ?? []],
    ["마을 배치 프리셋", (project) => project.villagePresets ?? []],
    ["마을 문서", (project) => project.villageInfoDocuments ?? []],
    ["AI 문서", (project) => project.aiDocuments ?? []],
    ["칩셋 이름", (project) => identified(project.charsetLabels ?? [], (record) => `${String(record.textureKey)}#${String(record.characterIndex)}`)],
  ];
  for (const [area, read] of collections) {
    diffRecords(area, read(before), read(after), out);
  }
}

function propertyEntries(before: Project, after: Project, out: ChangeLedgerEntry[]): void {
  diffValue("프로젝트 정보", "게임 정보", before.meta, after.meta, out);
  diffValue("시스템", "게임 시스템", before.system, after.system, out);
  diffValue("세션", "시작 상태", before.session, after.session, out);
  diffValue("세계 정본", "세계 정본", before.worldCanon, after.worldCanon, out);
  diffValue("세계 그래프", "세계 그래프", before.worldGraph, after.worldGraph, out);
  diffValue("성장 그래프", "성장 그래프", before.growth, after.growth, out);
  diffValue("세력", "세력", before.factions, after.factions, out);
  diffValue(
    "시작 위치",
    "시작 위치",
    { startMapId: before.startMapId, startPos: before.startPos },
    { startMapId: after.startMapId, startPos: after.startPos },
    out,
  );
  diffValue("플래그", "프로젝트 플래그", before.flags, after.flags, out);
  diffValue("AI 지시문", "AI 지시문", before.aiInstructions, after.aiInstructions, out);
  diffValue("기본 설계서", "기본 마을 설계서", before.defaultVillagePresetId, after.defaultVillagePresetId, out);
}

function tilesetEntries(before: Project, after: Project, out: ChangeLedgerEntry[]): void {
  const ids = new Set([...Object.keys(before.tilesets ?? {}), ...Object.keys(after.tilesets ?? {})]);
  for (const id of ids) {
    const prev = before.tilesets?.[id];
    const next = after.tilesets?.[id];
    if (same(prev, next)) continue;
    if (!prev) {
      out.push({ area: "타일셋", label: id, change: "added" });
      continue;
    }
    if (!next) {
      out.push({ area: "타일셋", label: id, change: "removed" });
      continue;
    }
    const detail = changedFields(prev as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>);
    out.push({
      area: "타일셋",
      label: stringField((next as unknown as Record<string, unknown>).name) ?? id,
      change: "changed",
      ...(detail.length > 0 ? { detail } : {}),
    });
  }
}

/**
 * 명세 전체. 순서는 **고정**이다 — 사용자가 매번 같은 자리에서 같은 영역을 읽는다:
 * 프로젝트 정보 → 시작 위치 → 시스템·세션 → 맵 → 이벤트 → 데이터베이스 → 나머지 컬렉션 → 타일셋.
 */
export function buildChangeLedger(
  before: Project,
  after: Project,
  options?: { readonly maxEntries?: number },
): ChangeLedger {
  const out: ChangeLedgerEntry[] = [];
  propertyEntries(before, after, out);
  mapEntries(before, after, out);
  eventEntries(before, after, out);
  databaseEntries(before, after, out);
  collectionEntries(before, after, out);
  tilesetEntries(before, after, out);
  const maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  return { entries: out.slice(0, maxEntries), total: out.length };
}
