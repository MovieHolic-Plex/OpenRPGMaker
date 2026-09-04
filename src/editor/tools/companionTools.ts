// editor/tools/companionTools.ts
// 동료(플레이어를 따라오는 액터/마스코트) 전용 저작 툴.
//
// 왜 별도 파일인가: 동료의 단일 진실 원천은 데이터베이스 레코드가 아니라 런타임 세션
// (PlaySession.followers / monsterParty)이다. 저작 수단은 이벤트 커맨드(addFollower)이고,
// 전역 규칙만 project.system.companions 에 산다. 그래서 add_companion 은 event 도메인,
// configure_companion_rules 는 system 도메인으로 노출한다.
//
// 그래픽은 반드시 charsetFollowerGraphic 을 거친다 — addFollower.graphic.pattern 은
// "0~3 패턴"이 아니라 시트 프레임 인덱스이고, 원시 숫자를 넣으면 캐릭터가 0번으로 고정된다.

import { pickNpcGraphic } from "@/assets/charsetQuery";
import {
  charsetFollowerGraphic,
  MAX_FOLLOWER_TRAIL_POINTS,
  resolveCompanionRules,
} from "@/project/followers";
import type { Command, EventPage, EventPageGraphic, GameEvent, GameMap, Project, Trigger } from "@/project/types";
import { genId } from "@/util/id";
import { ensureNamedSwitch } from "./flagHelpers";
import { requireMap, inMapBounds } from "./mapHelpers";
import { resolveGraphicQuery } from "./eventCompile";
import { resolveEventPlacement, upsertEventIntoMap } from "./eventTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const PASSIVE: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };

type CompanionWho =
  | { readonly kind: "actor"; readonly actorId: string }
  | { readonly kind: "graphic"; readonly graphic: EventPageGraphic; readonly label: string };

function resolveWho(project: Project, value: unknown): CompanionWho {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError(
      'who 는 {actorId} | {query} | {textureKey, characterIndex} 객체여야 합니다.',
      { code: "companion-who" }
    );
  }
  const record = value as { actorId?: unknown; query?: unknown; textureKey?: unknown; characterIndex?: unknown };

  if (typeof record.actorId === "string" && record.actorId.trim().length > 0) {
    const actorId = record.actorId.trim();
    const actor = project.database.actors.find((entry) => entry.id === actorId);
    if (!actor) {
      const known = project.database.actors.map((entry) => `${entry.id}(${entry.name})`).slice(0, 12).join(", ");
      throw new ToolError(
        `who.actorId 가 데이터베이스에 없습니다: ${actorId}. 보유 액터: ${known || "없음"}. get_database_records(kind:"actors")로 확인하세요.`,
        { code: "companion-actor-missing" }
      );
    }
    return { kind: "actor", actorId };
  }

  if (typeof record.textureKey === "string" && record.textureKey.trim().length > 0) {
    const characterIndex = typeof record.characterIndex === "number" ? Math.trunc(record.characterIndex) : 0;
    if (characterIndex < 0 || characterIndex > 7) {
      throw new ToolError("who.characterIndex 는 0~7 이어야 합니다(charset 한 장에 캐릭터 8칸).", { code: "companion-character-index" });
    }
    return {
      kind: "graphic",
      graphic: charsetFollowerGraphic(record.textureKey.trim(), characterIndex),
      label: `${record.textureKey.trim()}#${characterIndex}`,
    };
  }

  if (typeof record.query === "string" && record.query.trim().length > 0) {
    const query = record.query.trim();
    const entry = pickNpcGraphic(query, { overrides: project.charsetLabels });
    if (!entry) {
      throw new ToolError(
        `동료 그래픽 검색어에 맞는 charset 을 찾지 못했습니다: "${query}". list_npc_graphics 또는 list_resources(kind:"charset")로 후보를 조회하거나 who 를 {textureKey, characterIndex}로 지정하세요.`,
        { code: "graphic-not-found" }
      );
    }
    return {
      kind: "graphic",
      graphic: charsetFollowerGraphic(entry.textureKey, entry.characterIndex),
      label: query,
    };
  }

  throw new ToolError('who 에 actorId · query · textureKey 중 하나가 필요합니다.', { code: "companion-who" });
}

function companionDisplayName(project: Project, who: CompanionWho, nameArg: unknown): string {
  if (typeof nameArg === "string" && nameArg.trim().length > 0) return nameArg.trim();
  if (who.kind === "actor") {
    const actor = project.database.actors.find((entry) => entry.id === who.actorId);
    return actor?.name?.trim() || who.actorId;
  }
  return who.label;
}

function companionEventGraphic(project: Project, who: CompanionWho | undefined): EventPageGraphic {
  if (who?.kind === "graphic") return who.graphic;
  const actor = who?.kind === "actor"
    ? project.database.actors.find((entry) => entry.id === who.actorId)
    : undefined;
  const resourceId = actor?.characterResourceId?.trim();
  return resourceId
    ? charsetFollowerGraphic(resourceId, actor?.characterIndex ?? 0)
    : resolveGraphicQuery("villager");
}

function addFollowerCommand(who: CompanionWho, name: string, hidden: boolean): Command {
  if (who.kind === "actor") {
    return { kind: "addFollower", actorId: who.actorId, name } as Command;
  }
  const graphic = hidden ? { ...who.graphic, transparent: true } : who.graphic;
  return { kind: "addFollower", name, graphic } as Command;
}

function findEvent(project: Project, eventId: string, mapId: unknown): { map: GameMap; event: GameEvent } {
  const maps = typeof mapId === "string" && mapId.trim().length > 0
    ? [requireMap(project, mapId.trim())]
    : Object.values(project.maps);
  for (const map of maps) {
    const event = map.events.find((entry) => entry.id === eventId);
    if (event) return { map, event };
  }
  throw new ToolError(`이벤트를 찾지 못했습니다: ${eventId}. find_events 로 id 를 확인하세요.`, { code: "companion-event-missing" });
}

// RM 계열은 조건을 만족하는 **마지막** 페이지가 실행된다 — 첫 페이지에 넣으면
// 조건 가드용 빈 페이지에 커맨드가 박혀 실행되지 않는다.
function commandSink(event: GameEvent): Command[] {
  const page = event.pages?.at(-1);
  if (page) {
    page.commands ??= [];
    return page.commands;
  }
  event.commands ??= [];
  return event.commands;
}

const addCompanion: ToolDefinition = {
  name: "add_companion",
  description:
    "플레이어를 따라오는 동료를 저작한다. target.eventId 면 그 이벤트 커맨드 끝에 붙이고, target.mapId/x/y 면 새 이벤트를 만든다(trigger:\"talk\"=말 걸면 합류하고 사라짐, \"autorun\"=맵 진입 시 1회 자동 합류). who 는 {actorId} 또는 {query:\"고양이\"} 또는 {textureKey, characterIndex}. action:\"remove\" 면 동료를 해제하는 커맨드를 넣는다. 간격·인원 상한 같은 전역 규칙은 configure_companion_rules 가 담당한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["add", "remove"], description: "기본 add" },
      who: {
        type: "object",
        description: '{actorId} | {query:"고양이"} | {textureKey:"tex_easyrpg_charset_animal", characterIndex:1}',
        properties: {
          actorId: { type: "string" },
          query: { type: "string" },
          textureKey: { type: "string" },
          characterIndex: { type: "integer" },
        },
      },
      target: {
        type: "object",
        description: "{eventId} 로 기존 이벤트에 추가하거나 {mapId,x,y} 로 새 이벤트를 만든다.",
        properties: {
          eventId: { type: "string" },
          mapId: { type: "string" },
          x: { type: "integer" },
          y: { type: "integer" },
        },
      },
      trigger: { type: "string", enum: ["talk", "autorun"], description: "새 이벤트를 만들 때만 쓴다. 기본 talk" },
      name: { type: "string", description: "동료 표시 이름. 생략 시 액터명/검색어" },
      hidden: { type: "boolean", description: "true 면 투명 동료(그래픽 지정 경로만)" },
      all: { type: "boolean", description: "action:\"remove\" 에서 전원 해제" },
    },
    required: ["target"],
    additionalProperties: false,
  },
  invalidArgsExample: {
    who: { query: "고양이" },
    target: { mapId: "map_start", x: 6, y: 5 },
    trigger: "talk",
    name: "야옹이",
  },
  run(draft, args): ToolExecResult {
    const action = args.action === "remove" ? "remove" : "add";
    const target = args.target;
    if (typeof target !== "object" || target === null || Array.isArray(target)) {
      throw new ToolError("target 은 {eventId} 또는 {mapId,x,y} 객체여야 합니다.", { code: "companion-target" });
    }
    const targetRecord = target as { eventId?: unknown; mapId?: unknown; x?: unknown; y?: unknown };

    let who: CompanionWho | undefined;
    let name = "";
    if (action === "add") {
      who = resolveWho(draft, args.who);
      name = companionDisplayName(draft, who, args.name);
    } else if (typeof args.name === "string") {
      name = args.name.trim();
    }

    const command: Command = action === "add"
      ? addFollowerCommand(who as CompanionWho, name, args.hidden === true)
      : args.all === true || name.length === 0
        ? ({ kind: "removeFollower", all: true } as Command)
        : ({ kind: "removeFollower", name } as Command);

    if (typeof targetRecord.eventId === "string" && targetRecord.eventId.trim().length > 0) {
      const { map, event } = findEvent(draft, targetRecord.eventId.trim(), targetRecord.mapId);
      commandSink(event).push(command);
      return {
        summary: action === "add"
          ? `${map.name} '${event.id}' 이벤트에 동료 '${name}' 합류 커맨드 추가`
          : `${map.name} '${event.id}' 이벤트에 동료 해제 커맨드 추가`,
        data: { eventId: event.id, mapId: map.id, action, name },
      };
    }

    if (typeof targetRecord.mapId !== "string" || typeof targetRecord.x !== "number" || typeof targetRecord.y !== "number") {
      throw new ToolError("target 에 eventId 또는 {mapId,x,y} 가 필요합니다.", { code: "companion-target" });
    }
    const map = requireMap(draft, targetRecord.mapId);
    const requestedX = Math.trunc(targetRecord.x);
    const requestedY = Math.trunc(targetRecord.y);
    if (!inMapBounds(map, requestedX, requestedY)) {
      throw new ToolError(`동료 이벤트 위치가 맵 밖입니다: (${requestedX}, ${requestedY})`, {
        code: "companion-out-of-bounds",
        mapId: map.id,
        x: requestedX,
        y: requestedY,
      });
    }
    const triggerKind = args.trigger === "autorun" ? "autorun" : "talk";
    const placement = resolveEventPlacement(draft, map, requestedX, requestedY, {
      kind: triggerKind === "talk" ? "interaction" : "character",
      label: "동료 이벤트",
      code: "companion-impassable",
    });
    const id = genId("ev_companion");
    const eventName = action === "add" ? `${name} 합류` : "동료 해제";
    const graphic: EventPageGraphic = action === "add"
      ? companionEventGraphic(draft, who)
      : { transparent: true };

    let pages: EventPage[];
    if (triggerKind === "autorun") {
      // 자동 실행은 스위치 가드 없이 두면 맵에 들어올 때마다 다시 붙는다.
      const switchId = `sw_${id}_done`;
      ensureNamedSwitch(draft, switchId, `${eventName} 완료`);
      const trigger: Trigger = { kind: "auto" };
      pages = [
        {
          id: `${id}_page`,
          name: eventName,
          conditions: [{ kind: "switch", switchId, value: false }],
          graphic: { transparent: true },
          trigger,
          priority: "below",
          overlapForbidden: false,
          animationType: "fixedGraphic",
          movement: PASSIVE,
          commands: [command, { kind: "setSwitch", switchId, value: true } as Command],
        },
      ];
    } else {
      // 합류한 NPC 가 제자리에 남으면 중복 합류로 읽힌다 — 셀프 스위치 페이지로 사라지게 한다.
      const trigger: Trigger = { kind: "action" };
      pages = [
        {
          id: `${id}_page_joined`,
          name: `${eventName} 후`,
          conditions: [{ kind: "selfSwitch", key: "A", value: true }],
          graphic: { transparent: true },
          trigger,
          priority: "below",
          overlapForbidden: false,
          animationType: "fixedGraphic",
          movement: PASSIVE,
          commands: [],
        },
        {
          id: `${id}_page`,
          name: eventName,
          conditions: [],
          graphic,
          trigger,
          priority: "same",
          overlapForbidden: true,
          animationType: "fixedGraphic",
          movement: PASSIVE,
          commands: [command, { kind: "setSelfSwitch", key: "A", value: true } as Command],
        },
      ];
    }

    const event: GameEvent = {
      id,
      x: placement.x,
      y: placement.y,
      trigger: pages[0]?.trigger ?? { kind: "action" },
      commands: [],
      pages,
    };
    upsertEventIntoMap(map, event);
    return {
      summary: `${map.name} (${placement.x}, ${placement.y})에 ${triggerKind === "autorun" ? "자동 합류" : "말 걸어 합류"} 동료 이벤트 '${eventName}' 배치`,
      data: { eventId: id, mapId: map.id, x: placement.x, y: placement.y, trigger: triggerKind, action, name },
      ...(placement.adjusted
        ? { warnings: [`동료 이벤트 위치 자동 조정: (${requestedX}, ${requestedY}) → (${placement.x}, ${placement.y})`] }
        : {}),
    };
  },
};

const configureCompanionRules: ToolDefinition = {
  name: "configure_companion_rules",
  description:
    "동료 추종 규칙을 설정한다. formation 은 대형(line=일렬, beside=플레이어 옆에 붙어 다니기). gap 은 일렬 대형의 동료 사이 간격(칸, 1~16): 1이면 바로 뒤, 8이면 여덟 칸씩 벌어져 멀리서 따라온다. maxCompanions 는 동시 추종 인원 상한이고 overflow 는 상한 초과 시 정책(reject=새 동료 거부, replaceOldest=가장 오래된 동료를 밀어냄). clearOnTransfer:true 면 맵 이동 시 동료가 해제된다. reset:true 면 규칙을 지워 기본값(일렬·간격 1·무제한·유지)으로 되돌린다. 몬스터 열차는 monsterParty 가 지배하므로 상한에 포함되지 않는다.",
  mode: "write",
  domains: ["system"],
  parameters: {
    type: "object",
    properties: {
      gap: { type: "integer", description: "동료 사이 간격(칸). 1~16" },
      maxCompanions: { type: "integer", description: "동시 추종 액터 동료 수 상한. 1~8" },
      overflow: { type: "string", enum: ["reject", "replaceOldest"], description: "상한 초과 시 정책. 기본 reject" },
      formation: { type: "string", enum: ["line", "beside"], description: "line(기본)=일렬로 뒤따라옴, beside=플레이어 사방 인접 칸에 붙어 다님(앞 4명, gap 무시)" },
      clearOnTransfer: { type: "boolean", description: "true 면 맵을 옮길 때 동료가 해제된다. 기본 false(유지)" },
      reset: { type: "boolean", description: "true 면 규칙 제거(기본값 복귀)" },
    },
    additionalProperties: false,
  },
  invalidArgsExample: { gap: 3, maxCompanions: 2, overflow: "replaceOldest" },
  run(draft, args): ToolExecResult {
    if (args.reset === true) {
      delete draft.system.companions;
      return { summary: "동료 규칙 초기화 — 간격 1칸, 인원 무제한.", data: { reset: true } };
    }
    const current = draft.system.companions ?? {};
    const next = { ...current };
    if (args.gap !== undefined) {
      const gap = Math.trunc(Number(args.gap));
      if (!Number.isFinite(gap) || gap < 1 || gap > 16) {
        throw new ToolError("gap 은 1~16 칸이어야 합니다.", { code: "companion-gap" });
      }
      next.gap = gap;
    }
    if (args.maxCompanions !== undefined) {
      const max = Math.trunc(Number(args.maxCompanions));
      if (!Number.isFinite(max) || max < 1 || max > 8) {
        throw new ToolError("maxCompanions 는 1~8 명이어야 합니다.", { code: "companion-max" });
      }
      next.maxCompanions = max;
    }
    if (args.formation !== undefined) {
      if (args.formation !== "line" && args.formation !== "beside") {
        throw new ToolError('formation 은 "line" 또는 "beside" 여야 합니다.', { code: "companion-formation" });
      }
      next.formation = args.formation;
    }
    if (args.clearOnTransfer !== undefined) {
      next.clearOnTransfer = args.clearOnTransfer === true;
    }
    if (args.overflow !== undefined) {
      if (args.overflow !== "reject" && args.overflow !== "replaceOldest") {
        throw new ToolError('overflow 는 "reject" 또는 "replaceOldest" 여야 합니다.', { code: "companion-overflow" });
      }
      next.overflow = args.overflow;
    }

    const rules = resolveCompanionRules(next);
    const needed = (rules.maxCompanions ?? 1) * rules.gap;
    if (rules.formation === "line" && needed > MAX_FOLLOWER_TRAIL_POINTS) {
      throw new ToolError(
        `간격 ${rules.gap}칸 × 동료 ${rules.maxCompanions}명 = 궤적 ${needed}칸이 필요하지만 궤적 버퍼는 ${MAX_FOLLOWER_TRAIL_POINTS}칸입니다. 뒤 동료가 플레이어 칸에 겹칩니다 — 간격이나 인원을 줄이세요.`,
        { code: "companion-trail-overflow" }
      );
    }

    draft.system.companions = next;
    return {
      summary: rules.formation === "beside"
        ? `동료 규칙 — 옆에 붙어 다니기(앞 4명), 상한 ${rules.maxCompanions ?? "무제한"}, 맵 이동 시 ${rules.clearOnTransfer ? "해제" : "유지"}.`
        : `동료 규칙 — 간격 ${rules.gap}칸, 상한 ${rules.maxCompanions ?? "무제한"}, 초과 시 ${rules.overflow === "reject" ? "거부" : "가장 오래된 동료 교체"}, 맵 이동 시 ${rules.clearOnTransfer ? "해제" : "유지"}.`,
      data: {
        gap: rules.gap,
        maxCompanions: rules.maxCompanions ?? null,
        overflow: rules.overflow,
        formation: rules.formation,
        clearOnTransfer: rules.clearOnTransfer,
      },
    };
  },
};

export const COMPANION_TOOLS: readonly ToolDefinition[] = [addCompanion, configureCompanionRules];
