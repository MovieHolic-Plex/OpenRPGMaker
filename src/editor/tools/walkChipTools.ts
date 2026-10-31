// src/editor/tools/walkChipTools.ts
/**
 * 조수 도구 generate_walk_chip — 새 인물의 걷기 칩(RPG Maker 2000 캐릭터칩, 24×32 4방향×3걸음)을 설명으로 만든다.
 * 이 도구(쓰기)는 캐릭터 외형을 만들거나 고르고, 그 인물의 배우·이벤트를 외형(appearanceId)에 잇는다. 외형에는 지금 쓰는 칩이
 * 임시로 들어간다. 실제 생성은 편집기가 한다(ui-required, assistantSession 의 분기): 공방 작업 줄에 호스트 char-gen 작업
 * (설명 → RTP 머리·몸 종이 인형 → 오류 검사 → Opus 쌍 비교 1위)을 세우고 바로 돌아온다. 수 분 뒤 다 그리면 칩이 캐릭터 목록에
 * 들어가고 그 외형의 걷기 칩이 새 칩으로 바뀐다 — 외형을 쓰는 이벤트·배우가 함께 바뀐다(resolveActorAppearance·runtimeEventState).
 */
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { CharacterAppearanceRecord, Project } from "@/project/types";
import { genId } from "@/util/id";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition } from "./types";

export const WALK_CHIP_TOOL = "generate_walk_chip";

const MIN_DESCRIPTION = 6;

type Chip = { resourceId: string; characterIndex: number };

function stringList(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new ToolError(`${label} 는 id 문자열 배열이어야 합니다.`, { code: "invalid-args" });
  }
  return value as string[];
}

function eventRefs(value: unknown): { mapId: string; eventId: string }[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ToolError("events 는 [{mapId, eventId}] 배열이어야 합니다.", { code: "invalid-args" });
  return value.map((entry) => {
    const ref = entry as { mapId?: unknown; eventId?: unknown } | null;
    if (!ref || typeof ref.mapId !== "string" || typeof ref.eventId !== "string") {
      throw new ToolError("events 의 각 항목은 {mapId, eventId} 여야 합니다.", { code: "invalid-args" });
    }
    return { mapId: ref.mapId, eventId: ref.eventId };
  });
}

/** 외형을 만들거나 고르고 배우·이벤트를 잇는다(draft 를 바꾼다). -> 외형 id·설명·이은 수 */
export function linkWalkChipAppearance(draft: Project, args: Record<string, unknown>): {
  readonly record: CharacterAppearanceRecord; readonly description: string; readonly actors: number; readonly events: number; readonly created: boolean;
} {
  const actorIds = stringList(args.actorIds, "actorIds");
  const refs = eventRefs(args.events);
  const appearances = draft.database.characterAppearances ?? (draft.database.characterAppearances = []);
  const given = typeof args.description === "string" ? args.description.replace(/\s+/gu, " ").trim().slice(0, 600) : "";
  let record: CharacterAppearanceRecord | undefined;
  let created = false;
  if (typeof args.appearanceId === "string" && args.appearanceId) {
    record = appearances.find((entry) => entry.id === args.appearanceId);
    if (!record) throw new ToolError(`외형을 찾을 수 없습니다: ${args.appearanceId}. appearanceId 를 빼고 name 으로 새 외형을 만드세요.`, { code: "not-found" });
  } else {
    const name = typeof args.name === "string" ? args.name.trim().slice(0, 40) : "";
    if (!name) throw new ToolError("새 외형에는 name(인물 이름)이 필요합니다. 이미 있는 외형이면 appearanceId 를 주세요.", { code: "invalid-args" });
    record = { id: genId("appearance"), name, description: given };
    appearances.push(record);
    created = true;
  }
  const description = given || record.description.trim();
  if (description.length < MIN_DESCRIPTION) {
    throw new ToolError("걷기 칩을 만들 인물 설명이 없습니다. 성별·나이·머리(색·길이)·수염·머리쓰개·옷과 색을 description 에 적으세요.", { code: "invalid-args" });
  }
  if (!record.description.trim()) record.description = description;
  let placeholder: Chip | undefined = record.charset;
  for (const id of actorIds) {
    const actor = draft.database.actors.find((entry) => entry.id === id);
    if (!actor) throw new ToolError(`배우를 찾을 수 없습니다: ${id}`, { code: "actor-not-found" });
    actor.appearanceId = record.id;
    if (!placeholder && actor.characterResourceId) placeholder = { resourceId: actor.characterResourceId, characterIndex: actor.characterIndex ?? 0 };
  }
  for (const { mapId, eventId } of refs) {
    const event = requireMap(draft, mapId).events.find((entry) => entry.id === eventId);
    if (!event) throw new ToolError(`이벤트를 찾을 수 없습니다: ${mapId}/${eventId}`, { code: "event-not-found", mapId });
    for (const page of event.pages ?? []) {
      if (page.graphic.transparent === true || (!page.graphic.sprite && !page.graphic.appearanceId)) continue;
      page.graphic.appearanceId = record.id;
      const sprite = page.graphic.sprite;
      if (!placeholder && sprite) placeholder = { resourceId: sprite.id, characterIndex: decodeCharsetFrameIndex(page.graphic.pattern ?? 1).characterIndex };
    }
  }
  if (!record.charset && placeholder) record.charset = placeholder;
  return { record, description, actors: actorIds.length, events: refs.length, created };
}

export const WALK_CHIP_TOOLS: readonly ToolDefinition[] = [{
  name: WALK_CHIP_TOOL,
  description: "새 인물(이름 있는 NPC·파티원)의 걷기 캐릭터칩을 설명으로 만들어 준다. 번들 칩 중에 설명(머리 색·길이, 수염, 머리쓰개, 옷과 색)과 맞는 것이 없을 때 쓴다. "
    + "캐릭터 외형을 만들고(또는 appearanceId 로 고르고) actorIds·events 의 배우·이벤트를 그 외형에 잇는다. 외형에는 지금 그 배우·이벤트의 칩이 임시로 들어간다 — 그러니 먼저 비슷한 번들 칩으로 놓고 부른다. "
    + "편집기에서는 공방 작업으로 걷기 칩 생성을 시작하고 바로 돌아온다(수 분). 다 되면 외형의 칩이 저절로 바뀌고 이은 배우·이벤트도 함께 바뀐다. 기다리지 말고 다음 작업을 계속한다. 헤드리스에서는 연결까지만 하고 UI 필요 상태를 반환한다.",
  mode: "write",
  // 모델이 칩 번호를 고르지 않는다(지금 칩을 임시로 옮기고, 새 칩은 생성기가 정한다) — charsetSelectionGate 대상이 아니다.
  choosesOwnGraphic: true,
  parameters: {
    type: "object",
    properties: {
      appearanceId: { type: "string", minLength: 1, description: "이미 있는 캐릭터 외형 id. 없으면 생략하고 name 으로 새로 만든다" },
      name: { type: "string", maxLength: 40, description: "새 외형(인물) 이름" },
      description: { type: "string", maxLength: 600, description: "인물 겉모습: 성별·나이·머리 색과 길이·수염·머리쓰개·옷과 색. 비우면 외형 설명을 쓴다" },
      actorIds: { type: "array", items: { type: "string" }, description: "이 외형을 쓸 배우 id(파티원)" },
      events: {
        type: "array", description: "이 외형을 쓸 이벤트(NPC) — 보이는 페이지마다 외형을 잇는다",
        items: { type: "object", properties: { mapId: { type: "string" }, eventId: { type: "string" } }, required: ["mapId", "eventId"], additionalProperties: false },
      },
    },
    additionalProperties: false,
  },
  invalidArgsExample: { name: "대장장이 브론", description: "middle-aged man, short brown hair, full beard, white shirt, brown leather apron", events: [{ mapId: "map_village", eventId: "ev_smith" }] },
  run(draft, args) {
    const { record, description, actors, events, created } = linkWalkChipAppearance(draft, args);
    return {
      summary: `${created ? "외형을 만들고" : "외형"} ${record.name}(${record.id})에 배우 ${actors}·이벤트 ${events}개를 이었습니다. 걷기 칩 생성은 편집기(공방 작업 줄)가 합니다.`,
      data: { status: "ui-required", appearanceId: record.id, description, created },
    };
  },
}];
