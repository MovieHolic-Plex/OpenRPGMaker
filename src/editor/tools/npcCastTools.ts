// editor/tools/npcCastTools.ts
// author_npc_cast — 캐스트 시트를 맵의 대기 NPC 페이지와 세계관에 적용하는 유일한 경로.
//
// 왜 툴인가: 세션의 캐스트 라이터(lite 모델)가 시트를 쓰더라도 적용은 runTool 을 지나야 diff·감사·제안·
// 되돌리기가 다른 쓰기와 같은 계약을 탄다. 모델이 시트를 직접 짜서 부를 수도 있다.
// 대사를 넣을 때 페이지의 비텍스트 커맨드(상점·회복 등)는 그대로 남긴다 — 페이지를 갈아치우면 기능이
// 조용히 사라진다(dewVillageDialogue 가드가 지키는 그 결함).

import { castSheetToWorldPatch, type CastSheet } from "@/ai/npcCast";
import { normalizeWorld } from "@/project/world/guards";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { compileSimplePage } from "./eventCompile";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const RESIDENT_SCHEMA = {
  type: "object",
  properties: {
    eventId: { type: "string", description: "대사를 채울 NPC 이벤트 id" },
    name: { type: "string", description: "주민 이름(한국어 2~3음절)" },
    role: { type: "string", description: "역할(어부·잡화점 주인…)" },
    summary: { type: "string", description: "세계관 개체 요약 한 줄" },
    knows: { type: "array", items: { type: "string" }, description: "서로 아는 주민의 eventId" },
    pages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pageId: { type: "string" },
          lines: { type: "array", items: { type: "string" } },
        },
        required: ["pageId", "lines"],
      },
    },
  },
  required: ["eventId", "name", "pages"],
} as const;

const authorNpcCast: ToolDefinition = {
  name: "author_npc_cast",
  description:
    "대사 없는 NPC 들에게 캐스트 시트(이름·역할·관계·페이지별 대사)를 적용하고 주민을 세계관(world) 의 character 개체와 knows/locatedIn 관계로 등록한다. "
    + "페이지의 상점 등 비텍스트 커맨드는 보존된다. 세션이 캐스트 라이터 결과를 적용할 때 쓰며, 모델이 직접 시트를 짜서 불러도 된다. "
    + "residents[].pages[].pageId 는 대상 이벤트의 실제 페이지 id 여야 한다.",
  mode: "write",
  domains: ["event"],
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      residents: { type: "array", items: RESIDENT_SCHEMA },
    },
    required: ["mapId", "residents"],
  },
  invalidArgsExample: {
    mapId: "map_town",
    residents: [{ eventId: "ev_village_1", name: "은호", role: "어부", summary: "새벽 그물을 걷는 청년", knows: ["ev_village_2"], pages: [{ pageId: "ev_village_1_p0", lines: ["다래 가게에 은어를 넘겼어요."] }] }],
  },
  run(draft, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" ? args.mapId : "";
    const map = draft.maps[mapId];
    if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "map-not-found", mapId });
    const sheet = sheetFromArgs(args.residents);
    const warnings: string[] = [];
    let filledPages = 0;
    for (const resident of sheet.residents) {
      const event = map.events.find((entry) => entry.id === resident.eventId);
      if (!event) throw new ToolError(`NPC 이벤트를 찾을 수 없습니다: ${resident.eventId}`, { code: "event-not-found", mapId });
      filledPages += applyResidentToEvent(draft, map.id, event, resident, warnings);
    }
    draft.world = normalizeWorld(castSheetToWorldPatch(draft, map.id, sheet));
    const names = sheet.residents.map((resident) => resident.name).join("·");
    return {
      summary: `${map.name} 주민 ${sheet.residents.length}명 캐스트 적용 (${names}) — 대사 페이지 ${filledPages}개, 세계관 등록`,
      data: { mapId: map.id, residents: sheet.residents.length, filledPages, eventIds: sheet.residents.map((resident) => resident.eventId) },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

function sheetFromArgs(raw: unknown): CastSheet {
  if (!Array.isArray(raw) || raw.length === 0) throw new ToolError("residents 는 비어 있지 않은 배열이어야 합니다.", { code: "invalid-args" });
  const residents = raw.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) throw new ToolError(`residents[${index}] 가 객체가 아닙니다.`, { code: "invalid-args" });
    const record = entry as Record<string, unknown>;
    const eventId = stringField(record.eventId, `residents[${index}].eventId`);
    const name = stringField(record.name, `residents[${index}].name`);
    const pagesRaw = Array.isArray(record.pages) ? record.pages : [];
    const pages = pagesRaw.map((page, pageIndex) => {
      if (typeof page !== "object" || page === null) throw new ToolError(`residents[${index}].pages[${pageIndex}] 가 객체가 아닙니다.`, { code: "invalid-args" });
      const pageRecord = page as Record<string, unknown>;
      const lines = Array.isArray(pageRecord.lines) ? pageRecord.lines.filter((line): line is string => typeof line === "string" && line.trim().length > 0).map((line) => line.trim()) : [];
      if (lines.length === 0) throw new ToolError(`residents[${index}].pages[${pageIndex}].lines 가 비었습니다 — 빈 대사는 적용하지 않습니다.`, { code: "invalid-args" });
      return { pageId: stringField(pageRecord.pageId, `residents[${index}].pages[${pageIndex}].pageId`), lines };
    });
    if (pages.length === 0) throw new ToolError(`residents[${index}](${eventId}) 에 pages 가 없습니다.`, { code: "invalid-args" });
    const knows = Array.isArray(record.knows) ? record.knows.filter((id): id is string => typeof id === "string" && id.trim().length > 0 && id !== eventId) : [];
    return {
      eventId,
      name,
      role: typeof record.role === "string" ? record.role.trim() : "",
      summary: typeof record.summary === "string" ? record.summary.trim() : "",
      knows,
      pages,
    };
  });
  return { residents };
}

function stringField(value: unknown, label: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  throw new ToolError(`${label} 문자열이 필요합니다.`, { code: "invalid-args" });
}

function applyResidentToEvent(draft: Project, mapId: string, event: GameEvent, resident: CastSheet["residents"][number], warnings: string[]): number {
  const pages = event.pages ?? [];
  const previousName = pages[0]?.name?.trim() ?? "";
  let filled = 0;
  for (const written of resident.pages) {
    const index = pages.findIndex((page) => page.id === written.pageId);
    if (index < 0) throw new ToolError(`${resident.eventId} 에 페이지 ${written.pageId} 가 없습니다.`, { code: "page-not-found", mapId });
    pages[index] = pageWithDialogue(pages[index]!, resident.name, written.lines, warnings);
    filled += 1;
  }
  for (const [index, page] of pages.entries()) pages[index] = { ...page, name: resident.name };
  event.pages = pages;
  if (previousName && previousName !== resident.name) renameInteriorMaps(draft, previousName, resident.name);
  return filled;
}

function pageWithDialogue(page: EventPage, speaker: string, lines: readonly string[], warnings: string[]): EventPage {
  const compiled = compileSimplePage(page.id, speaker, { lines }, page.graphic, { warnings, movement: page.movement, priority: page.priority });
  const dialogue = compiled.commands.filter((command) => command.kind === "text" || command.kind === "changeFace");
  const kept = page.commands.filter((command: Command) => command.kind !== "text" && command.kind !== "changeFace");
  return { ...page, name: speaker, commands: [...dialogue, ...kept] };
}

function renameInteriorMaps(draft: Project, previousName: string, nextName: string): void {
  const suffix = "의 집 내부";
  for (const map of Object.values(draft.maps)) {
    if (map.name === `${previousName}${suffix}`) map.name = `${nextName}${suffix}`;
  }
}

export const NPC_CAST_TOOLS: readonly ToolDefinition[] = [authorNpcCast];
