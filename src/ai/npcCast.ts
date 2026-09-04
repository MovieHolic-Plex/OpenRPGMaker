// ai/npcCast.ts
// 캐스트 라이터 순수 모듈 — 코드는 NPC 대사를 한 줄도 만들지 않는다.
//
// 배경(2026-09-03 사용자 지적): 마을을 지을 때마다 주민 대사가 비슷했다. 생성 코드에 고정 대사가
// 박혀 있었기 때문이다(DEFAULT_NPCS 10명 · "안녕하세요." · "일하는 중이야." · "${name}입니다."). 대사는
// 테마에 맞아야 하고, 주민끼리 서로를 언급해야 하고, 세계관(project.world)과 엮여야 한다. 그래서 NPC 를
// 만드는 툴은 text 커맨드 없는 '대기' 페이지만 만들고, 세션이 이 모듈로 대기 NPC 를 모아 lite 모델에게
// **한 장의 캐스트 시트**를 받아(`buildCastWriterMessages` → `parseCastSheet`) `author_npc_cast` 툴로
// 적용한다. 검증은 코드가 한다: 전원 대사, 상호 언급, 세계관 언급. 실패는 재킥이지 대체 문구가 아니다.
//
// 브라우저·Phaser·세션 비의존. 프로젝트를 읽기만 하고 바꾸지 않는다(적용은 툴이 한다).

import type { ChatMessage } from "@/ai/llmClient";
import { findWorldCanonAbsenceHits, worldCanonPromptSection } from "@/ai/worldCanonContext";
import { normalizeProjectWorld } from "@/project/world/guards";
import type { WorldCanon } from "@/project/world/canon";
import type { ProjectWorld, WorldEntity, WorldRelation } from "@/project/world/types";
import type { EventPage, EventPageCondition, GameEvent, Project } from "@/project/types";

export interface PendingNpcPage {
  readonly pageId: string;
  /** 사람 말 조건 라벨. 기본 페이지는 빈 문자열. */
  readonly condition: string;
}

export interface PendingNpc {
  readonly mapId: string;
  readonly eventId: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly hasShop: boolean;
  readonly activities: readonly string[];
  readonly pages: readonly PendingNpcPage[];
}

export interface CastContext {
  readonly mapId: string;
  readonly mapName: string;
  readonly theme: string;
  readonly requestText: string;
  readonly worldDigest: string;
  readonly worldNames: readonly string[];
  /** 「이 세계」 캐논 — 있으면 프롬프트에 고정 블록으로 실리고 금지어가 검증된다. */
  readonly worldCanon?: WorldCanon;
  readonly existingCast: readonly { readonly name: string; readonly line: string }[];
  readonly residents: readonly PendingNpc[];
}

export interface CastResidentPage {
  readonly pageId: string;
  readonly lines: readonly string[];
}

export interface CastResident {
  readonly eventId: string;
  readonly name: string;
  readonly role: string;
  readonly summary: string;
  readonly knows: readonly string[];
  readonly pages: readonly CastResidentPage[];
}

export interface CastSheet {
  readonly residents: readonly CastResident[];
}

export type ParseCastSheetResult =
  | { readonly ok: true; readonly sheet: CastSheet }
  | { readonly ok: false; readonly issues: readonly string[] };

/** 캐스트 라이터 요청을 다른 LLM 호출과 구분하는 표지 — 시스템 프롬프트 첫 줄에 들어간다. */
export const CAST_WRITER_MARKER = "캐스트 라이터";

const MAX_EXISTING_CAST = 12;

export function eventHasDialogue(event: GameEvent): boolean {
  return (event.pages ?? []).some(pageHasText);
}

function pageHasText(page: EventPage): boolean {
  return page.commands.some((command) => command.kind === "text");
}

function pageHasShop(page: EventPage): boolean {
  return page.commands.some((command) => command.kind === "shop");
}

/**
 * 대사 없는 페이지를 가진 NPC — **기준선에 없던 이벤트만**. 사용자가 직접 놓은 말 없는 NPC 는 사용자 것이다.
 * 투명 그래픽 이벤트(출입구·트리거)는 사람이 아니므로 제외한다.
 */
export function collectPendingNpcs(project: Project, baseline: Project | null, mapIds?: readonly string[]): PendingNpc[] {
  const pending: PendingNpc[] = [];
  for (const map of Object.values(project.maps)) {
    if (mapIds && !mapIds.includes(map.id)) continue;
    const baselineIds = new Set((baseline?.maps[map.id]?.events ?? []).map((event) => event.id));
    for (const event of map.events) {
      if (baselineIds.has(event.id)) continue;
      const pages = event.pages ?? [];
      if (pages.length === 0 || pages.every((page) => page.graphic.transparent === true)) continue;
      const missing = pages.filter((page) => !pageHasText(page));
      if (missing.length === 0) continue;
      pending.push({
        mapId: map.id,
        eventId: event.id,
        name: pages[0]?.name?.trim() || event.id,
        x: event.x,
        y: event.y,
        hasShop: pages.some(pageHasShop),
        activities: [...new Set((event.schedule ?? []).map((entry) => entry.activity).filter((activity): activity is string => typeof activity === "string" && activity.trim().length > 0))],
        pages: missing.map((page) => ({ pageId: page.id, condition: describeConditions(page.conditions) })),
      });
    }
  }
  return pending;
}

function describeConditions(conditions: readonly EventPageCondition[]): string {
  return conditions.map(describeCondition).join(", ");
}

function describeCondition(condition: EventPageCondition): string {
  switch (condition.kind) {
    case "npcActivity":
      return `활동: ${condition.activity}`;
    case "timePhase":
      return `시간대: ${condition.phase}`;
    case "season":
      return `계절: ${condition.season}`;
    case "friendshipAtLeast":
      return `호감도 ${condition.value} 이상`;
    case "switch":
      return `스위치 ${condition.switchId}=${condition.value ? "on" : "off"}`;
    case "selfSwitch":
      return `셀프스위치 ${condition.key}=${condition.value ? "on" : "off"}`;
    case "variable":
      return `변수 ${condition.variableId} ${condition.op} ${condition.value}`;
    case "item":
      return `아이템 ${condition.itemId} ${condition.present ? "소지" : "미소지"}`;
    default:
      return condition.kind;
  }
}

export function worldEntityNames(project: Project): string[] {
  return normalizeProjectWorld(project).entities.map((entity) => entity.name.trim()).filter((name) => name.length > 0);
}

/** 같은 맵에서 이미 대사가 있는 NPC 들 — 새 주민이 이들을 언급하고 이들과 어긋나지 않게 한다. */
export function existingCastOnMap(project: Project, mapId: string, exclude: ReadonlySet<string>): { name: string; line: string }[] {
  const map = project.maps[mapId];
  if (!map) return [];
  const cast: { name: string; line: string }[] = [];
  for (const event of map.events) {
    if (exclude.has(event.id) || !eventHasDialogue(event)) continue;
    const page = (event.pages ?? []).find(pageHasText);
    const text = page?.commands.find((command) => command.kind === "text");
    if (!page || !text || text.kind !== "text") continue;
    cast.push({ name: page.name?.trim() || event.id, line: text.body });
    if (cast.length >= MAX_EXISTING_CAST) break;
  }
  return cast;
}

export function buildCastWriterMessages(ctx: CastContext): ChatMessage[] {
  const canonSection = worldCanonPromptSection(ctx.worldCanon);
  const system = [
    `${CAST_WRITER_MARKER}: RPG 마을 주민의 이름·역할·관계·대사를 한 장의 캐스트 시트(JSON)로 쓴다.`,
    "규칙:",
    "- 모든 대기 페이지(pageId)에 1~3줄의 대사를 쓴다. 빈 페이지·생략 금지.",
    "- 주민끼리 엮는다: 절반 이상의 주민이 다른 주민(새 주민 또는 기존 주민)의 **이름**을 대사에서 언급한다. knows 에 그 주민의 eventId 를 적는다.",
    "- 세계관과 엮는다: 세계관 개체가 있으면 최소 한 줄은 그 개체의 **이름**을 그대로 언급한다(세력·장소·사건).",
    ...(canonSection ? ["- 「이 세계」에 없는 것(금지 목록)에 적힌 말은 대사에 절대 쓰지 않는다."] : []),
    "- 테마에 맞는 한국어 구어체. 도구명·좌표·id 를 대사에 쓰지 않는다. 인사말만 있는 대사 금지 — 구체적인 일·소문·관계를 말한다.",
    "- 조건이 붙은 페이지는 그 조건(활동·시간대·호감도)에 맞는 말을 한다.",
    "- 상점 주인은 파는 것과 손님을 말하되 상점 UI 는 코드가 붙이므로 언급하지 않는다.",
    "- 이름은 한국어 2~3음절, 서로 다르게. placeholder(주민 N)는 쓰지 않는다.",
    "출력은 JSON 하나: {\"residents\":[{\"eventId\",\"name\",\"role\",\"summary\",\"knows\":[eventId...],\"pages\":[{\"pageId\",\"lines\":[...]}]}]}",
  ].join("\n");
  const residents = ctx.residents.map((npc) => [
    `- eventId=${npc.eventId} 현재이름=${npc.name} 위치=(${npc.x},${npc.y})${npc.hasShop ? " 상점주인" : ""}${npc.activities.length > 0 ? ` 일과=${npc.activities.join("/")}` : ""}`,
    ...npc.pages.map((page) => `  · pageId=${page.pageId}${page.condition ? ` 조건: ${page.condition}` : " 기본 대사"}`),
  ].join("\n")).join("\n");
  const existing = ctx.existingCast.length > 0
    ? ctx.existingCast.map((entry) => `- ${entry.name}: "${entry.line}"`).join("\n")
    : "(없음)";
  const user = [
    `## 테마\n${ctx.theme || "(테마 없음 — 요청문을 따른다)"}`,
    `## 사용자 요청\n${ctx.requestText}`,
    `## 맵\n${ctx.mapName} (${ctx.mapId})`,
    `## 세계관 다이제스트\n${ctx.worldDigest}`,
    ...(canonSection ? [canonSection] : []),
    `## 이미 대사가 있는 주민\n${existing}`,
    `## 대사를 써야 할 주민(대기)\n${residents}`,
  ].join("\n\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function parseCastSheet(raw: string, ctx: CastContext): ParseCastSheetResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(raw));
  } catch (cause) {
    return { ok: false, issues: [`JSON 해석 실패: ${cause instanceof Error ? cause.message : String(cause)}`] };
  }
  if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as { residents?: unknown }).residents)) {
    return { ok: false, issues: ["residents 배열이 없습니다."] };
  }
  const issues: string[] = [];
  const byId = new Map(ctx.residents.map((npc) => [npc.eventId, npc]));
  const residents: CastResident[] = [];
  for (const [index, entry] of ((parsed as { residents: unknown[] }).residents).entries()) {
    const resident = normalizeResident(entry, index, byId, issues);
    if (resident) residents.push(resident);
  }
  for (const npc of ctx.residents) {
    const resident = residents.find((entry) => entry.eventId === npc.eventId);
    if (!resident) {
      issues.push(`${npc.eventId} 주민이 시트에 없습니다.`);
      continue;
    }
    for (const page of npc.pages) {
      const written = resident.pages.find((entry) => entry.pageId === page.pageId);
      if (!written || written.lines.length === 0) issues.push(`${npc.eventId} 의 페이지 ${page.pageId} 에 대사가 없습니다.`);
    }
  }
  const names = new Set(residents.map((resident) => resident.name));
  if (names.size !== residents.length) issues.push("주민 이름이 겹칩니다 — 서로 다른 이름을 쓰세요.");
  if (residents.length >= 2) {
    const mentionable = [...names, ...ctx.existingCast.map((entry) => entry.name)];
    const linked = residents.filter((resident) =>
      resident.pages.some((page) => page.lines.some((line) => mentionable.some((name) => name !== resident.name && line.includes(name))))
    ).length;
    const required = Math.ceil(residents.length / 2);
    if (linked < required) issues.push(`주민끼리 엮이지 않았습니다 — 다른 주민 이름을 언급한 주민 ${linked}/${residents.length} (최소 ${required}). 서로의 이름을 대사에 넣으세요.`);
  }
  if (ctx.worldNames.length > 0) {
    const mentionsWorld = residents.some((resident) => resident.pages.some((page) => page.lines.some((line) => ctx.worldNames.some((name) => line.includes(name)))));
    if (!mentionsWorld) issues.push(`세계관과 엮이지 않았습니다 — 다음 이름 중 하나를 대사에 그대로 언급하세요: ${ctx.worldNames.slice(0, 8).join(", ")}`);
  }
  const absenceHits = new Set<string>();
  for (const resident of residents) {
    for (const page of resident.pages) {
      for (const line of page.lines) {
        for (const hit of findWorldCanonAbsenceHits(line, ctx.worldCanon)) absenceHits.add(hit);
      }
    }
  }
  if (absenceHits.size > 0) {
    issues.push(`「이 세계」에 없는 것을 썼습니다 — 대사에서 빼세요: ${[...absenceHits].join(", ")}`);
  }
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, sheet: { residents } };
}

function normalizeResident(entry: unknown, index: number, byId: ReadonlyMap<string, PendingNpc>, issues: string[]): CastResident | null {
  if (typeof entry !== "object" || entry === null) {
    issues.push(`residents[${index}] 가 객체가 아닙니다.`);
    return null;
  }
  const record = entry as Record<string, unknown>;
  const eventId = typeof record.eventId === "string" ? record.eventId.trim() : "";
  if (!byId.has(eventId)) {
    issues.push(`residents[${index}].eventId '${eventId}' 는 대기 주민이 아닙니다. 주어진 eventId 만 쓰세요.`);
    return null;
  }
  const name = cleanString(record.name);
  if (!name || /^주민\s*\d+$/u.test(name)) issues.push(`${eventId} 의 name 이 비었거나 placeholder 입니다.`);
  const pagesRaw = Array.isArray(record.pages) ? record.pages : [];
  const pages: CastResidentPage[] = [];
  for (const page of pagesRaw) {
    if (typeof page !== "object" || page === null) continue;
    const pageRecord = page as Record<string, unknown>;
    const pageId = cleanString(pageRecord.pageId);
    const lines = Array.isArray(pageRecord.lines) ? pageRecord.lines.map(cleanString).filter((line): line is string => line !== null) : [];
    if (pageId) pages.push({ pageId, lines });
  }
  const knows = Array.isArray(record.knows) ? record.knows.map(cleanString).filter((id): id is string => id !== null && id !== eventId) : [];
  return {
    eventId,
    name: name ?? eventId,
    role: cleanString(record.role) ?? "",
    summary: cleanString(record.summary) ?? "",
    knows,
    pages,
  };
}

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
}

const WORLD_PLACE_PREFIX = "w_place_";
const WORLD_NPC_PREFIX = "w_npc_";

export function worldIdForNpc(eventId: string): string {
  return `${WORLD_NPC_PREFIX}${sanitizeWorldIdBody(eventId)}`;
}

export function worldIdForMap(mapId: string): string {
  return `${WORLD_PLACE_PREFIX}${sanitizeWorldIdBody(mapId)}`;
}

function sanitizeWorldIdBody(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/gu, "_");
}

/**
 * 주민을 세계관에 등록한 결과 — 맵 place 개체(없으면 생성) + 주민 character 개체 + locatedIn/knows 관계.
 * 사용자(origin user)·잠긴 개체는 덮지 않는다. 양방향 knows 는 한 쌍으로 접는다. 순수 함수 — 새 world 를 돌려준다.
 */
export function castSheetToWorldPatch(project: Project, mapId: string, sheet: CastSheet): ProjectWorld {
  const world = normalizeProjectWorld(project);
  const entities = [...world.entities];
  const relations = [...world.relations];
  const byId = new Map(entities.map((entity, index) => [entity.id, index]));
  const upsert = (entity: WorldEntity): void => {
    const index = byId.get(entity.id);
    if (index === undefined) {
      byId.set(entity.id, entities.length);
      entities.push(entity);
      return;
    }
    const existing = entities[index]!;
    if (existing.origin === "user" || existing.locked === true) return;
    entities[index] = { ...existing, ...entity, refs: mergeRefs(existing, entity) };
  };
  const placeId = worldIdForMap(mapId);
  const mapName = project.maps[mapId]?.name ?? mapId;
  if (!byId.has(placeId)) {
    upsert({ id: placeId, type: "place", name: mapName, summary: `${mapName} — 주민들이 사는 마을`, refs: [{ kind: "map", id: mapId }], origin: "ai" });
  }
  const npcIds = new Map(sheet.residents.map((resident) => [resident.eventId, worldIdForNpc(resident.eventId)]));
  for (const resident of sheet.residents) {
    upsert({
      id: npcIds.get(resident.eventId)!,
      type: "character",
      name: resident.name,
      summary: [resident.role, resident.summary].filter((part) => part.length > 0).join(" — ") || resident.name,
      tags: resident.role ? [resident.role] : undefined,
      refs: [{ kind: "event", id: resident.eventId }, { kind: "map", id: mapId }],
      origin: "ai",
    });
  }
  const relationKey = (relation: WorldRelation): string => `${relation.kind}:${[relation.a, relation.b].sort().join("|")}`;
  const seen = new Set(relations.map(relationKey));
  const push = (relation: WorldRelation): void => {
    const key = relationKey(relation);
    if (seen.has(key)) return;
    seen.add(key);
    relations.push(relation);
  };
  for (const resident of sheet.residents) {
    const self = npcIds.get(resident.eventId)!;
    push({ a: self, b: placeId, kind: "locatedIn" });
    for (const known of resident.knows) {
      const other = npcIds.get(known) ?? (byId.has(worldIdForNpc(known)) ? worldIdForNpc(known) : null);
      if (other && other !== self) push({ a: self, b: other, kind: "knows" });
    }
  }
  return { entities, relations };
}

function mergeRefs(existing: WorldEntity, incoming: WorldEntity): WorldEntity["refs"] {
  const refs = [...(existing.refs ?? [])];
  for (const ref of incoming.refs ?? []) {
    if (!refs.some((entry) => entry.kind === ref.kind && entry.id === ref.id)) refs.push(ref);
  }
  return refs.length > 0 ? refs : undefined;
}
