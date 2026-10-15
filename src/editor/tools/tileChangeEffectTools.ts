// editor/tools/tileChangeEffectTools.ts
// tile_change_effect — 「과거에서 씨앗을 심으면 미래 맵에 나무가 자란다」를 한 호출로.
//
// 엔진(changeTile → session.mapOverrides → 맵 로드마다 재적용 → 세이브)은 이미 있다. 막혀 있던 것은 저작 수단이다:
// 영역을 칸마다 손으로 써야 했고, 오토타일 이웃이 다시 계산되지 않았고, 2·4층은 못 바꿨다.
// 이 도구는 ① 바뀔 영역을 대상 맵의 **복사본에 paint_tiles 로 칠해** 오토타일·층 라우팅 규칙을 그대로 태우고
// ② 원본과 달라진 칸(이웃 포함, 1~4층)만 뽑아 changeTile 명령 목록으로 바꾸고 ③ 스위치 가드·완료 스위치를 단
// 원인 이벤트(씨앗 심는 곳)를 만든다. 그림자 비트는 changeTile 이 못 다루므로 경고만 한다.

import { isPassable } from "@/project/collision";
import { CHANGE_TILE_USAGE, changeTileProblems } from "@/project/changeTileValidation";
import { layerTileAt, type TileLayerNo } from "@/project/mapLayers";
import type { ChangeTileLayer, Command, Condition, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { genId } from "@/util/id";
import { resolveGraphic } from "./eventCompile";
import { EVENT_TOOLS } from "./eventTools";
import { ensureNamedSwitch } from "./flagHelpers";
import { MAP_TOOLS } from "./mapTools";
import { requireMap } from "./mapHelpers";
import { COORD_SCHEMA, GRAPHIC_SPEC_SCHEMA, RECT_SCHEMA } from "./schemaShapes";
import { unlockCondition } from "./timeGateTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const MAX_CHANGE_COMMANDS = 600;
const CHANGE_KEYS = ["layer", "rect", "cells", "tile"] as const;
const TRIGGER_KEYS = ["mapId", "x", "y", "id", "name", "kind", "graphic", "text", "doneText", "requires", "lockedText"] as const;

const LAYER_NUMBERS: ReadonlyArray<{ readonly no: TileLayerNo; readonly name: ChangeTileLayer }> = [
  { no: 1, name: "lower" }, { no: 2, name: "lower2" }, { no: 3, name: "upper" }, { no: 4, name: "upper2" },
];

function reject(value: unknown, allowed: readonly string[], path: string, hints: Readonly<Record<string, string>> = {}): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ToolError(`${path} 는 객체여야 합니다.`, { code: "invalid-args" });
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) return;
  throw new ToolError(`${path} 에 알 수 없는 키: ${unknown.map((key) => hints[key] ? `${key}→${hints[key]}` : key).join(", ")} — 허용: ${allowed.join(", ")}. 모르는 키는 실행기가 읽지 않아 변경이 조용히 사라진다.`, { code: "invalid-args" });
}

const CHANGE_HINTS: Readonly<Record<string, string>> = { tileId: "tile", tile_id: "tile", x: "rect:{x,y,w,h}", area: "rect", region: "rect", mapId: "(상위 targetMapId)" };

type Change = { layer: string | number; rect?: { x: number; y: number; w: number; h: number }; cells?: { x: number; y: number }[]; tile: number };

function tileAt(map: GameMap, no: TileLayerNo, index: number): number {
  return layerTileAt(map, no, index);
}

/** 대상 맵의 복사본에 changes 를 paint_tiles 로 칠해, 원본과 달라진 칸을 changeTile 명령 목록으로 돌려준다. */
export function planTileChanges(draft: Project, targetMapId: string, changes: readonly Change[]): { commands: Command[]; blocked: { x: number; y: number }[]; opened: { x: number; y: number }[]; shadowChanged: boolean; warnings: string[] } {
  const real = requireMap(draft, targetMapId);
  const paint = MAP_TOOLS.find((tool) => tool.name === "paint_tiles");
  if (!paint) throw new ToolError("paint_tiles 도구를 찾지 못했습니다.", { code: "tile-effect-paint-missing" });
  const scratchMap = structuredClone(real);
  const scratch: Project = { ...draft, maps: { ...draft.maps, [targetMapId]: scratchMap } };
  const warnings: string[] = [];
  changes.forEach((change, index) => {
    reject(change, CHANGE_KEYS, `changes[${index}]`, CHANGE_HINTS);
    if (!change.rect === !change.cells) throw new ToolError(`changes[${index}] 는 rect({x,y,w,h}) 와 cells([{x,y}]) 중 정확히 하나가 필요합니다.`, { code: "invalid-args" });
    if (change.rect) reject(change.rect, ["x", "y", "w", "h"], `changes[${index}].rect`);
    const args: Record<string, unknown> = change.rect
      ? { mapId: targetMapId, layer: String(change.layer), mode: "rect", tile: change.tile, from: { x: change.rect.x, y: change.rect.y }, to: { x: change.rect.x + change.rect.w - 1, y: change.rect.y + change.rect.h - 1 } }
      : { mapId: targetMapId, layer: String(change.layer), mode: "cells", tile: change.tile, cells: change.cells };
    const result = paint.run(scratch, args);
    for (const warning of result.warnings ?? []) warnings.push(`changes[${index}]: ${warning}`);
  });
  const commands: Command[] = [];
  const blocked: { x: number; y: number }[] = [];
  const opened: { x: number; y: number }[] = [];
  let shadowChanged = false;
  for (let y = 0; y < real.height; y += 1) {
    for (let x = 0; x < real.width; x += 1) {
      const index = y * real.width + x;
      let cellChanged = false;
      for (const { no, name } of LAYER_NUMBERS) {
        const before = tileAt(real, no, index);
        const after = tileAt(scratchMap, no, index);
        if (before === after) continue;
        cellChanged = true;
        commands.push({ kind: "changeTile", mapId: targetMapId, layer: name, x, y, tile: after });
      }
      if ((real.shadowBits?.[index] ?? 0) !== (scratchMap.shadowBits?.[index] ?? 0)) shadowChanged = true;
      if (cellChanged) {
        const was = isPassable(draft, real, x, y);
        const now = isPassable(scratch, scratchMap, x, y);
        if (was && !now) blocked.push({ x, y });
        if (!was && now) opened.push({ x, y });
      }
    }
  }
  return { commands, blocked, opened, shadowChanged, warnings };
}

const tileChangeEffect: ToolDefinition = {
  name: "tile_change_effect",
  description:
    "타일이 바뀌는 인과를 한 호출로 만든다 — 「과거에서 씨앗을 심으면 미래 맵에 나무가 자란다」「스위치를 켜면 돌문이 열린다」. "
    + "{targetMapId(타일이 바뀌는 맵; 다른 시대 맵이어도 된다), changes:[{layer,rect|cells,tile}], trigger:{mapId,x,y,name?,graphic?,text?,doneText?,requires?,lockedText?}, doneSwitchId?, alsoSetSwitches?, emitOnly?} "
    + "changes 는 paint_tiles 와 같은 규칙(층 1~4 또는 lower|upper, 투명 칩 층 라우팅, 오토타일 이웃 재성형)으로 대상 맵 복사본에 먼저 칠해 보고, 원본과 달라진 칸(이웃 포함, 1~4층)을 전부 changeTile 로 만든다. "
    + "trigger 는 원인 이벤트(씨앗 심는 자리·레버): 조사하면 text 를 보이고 변경을 일으키며 완료 스위치(doneSwitchId, 생략 시 자동)를 켠다. requires({switchId}|{storyFlagId}|{variableId,op,value})가 있으면 그 조건이 참일 때만 일어나고 아니면 lockedText 가 뜬다. "
    + "변경은 세션에 남아 저장·불러오기·맵 재방문에서도 유지된다(플레이어가 그 맵에 들어갈 때 적용). 완료 스위치를 다른 시대 NPC·문의 페이지 조건으로 쓰면 인과가 사람에게도 보인다. "
    + "emitOnly:true 면 이벤트를 만들지 않고 data.commands(changeTile 목록)만 돌려준다 — 기존 이벤트에 patch_event_page 로 붙일 때. "
    + "한계: 그림자 비트는 못 바꾼다(경고). 통행이 막히거나 열리는 칸 수를 경고한다. changeTile 명령 모양은 {kind,mapId,layer(lower|lower2|upper|upper2),x,y,tile} 뿐이며 upsert_event 에서 tileId 같은 다른 키는 거절된다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      targetMapId: { type: "string", description: "타일이 바뀌는 맵 id" },
      changes: {
        type: "array",
        description: "바꿀 영역 목록 [{layer(1|2|3|4|lower|upper), rect:{x,y,w,h}|cells:[{x,y}], tile}]",
        items: { type: "object", properties: { layer: { type: "string" }, rect: RECT_SCHEMA, cells: { type: "array", items: COORD_SCHEMA }, tile: { type: "integer" } }, required: ["layer", "tile"] },
      },
      trigger: {
        type: "object",
        description: "원인 이벤트 {mapId, x, y, id?, name?, kind?(action 기본|playerTouch), graphic?, text?, doneText?, requires?, lockedText?}",
        properties: { mapId: { type: "string" }, x: { type: "integer" }, y: { type: "integer" }, id: { type: "string" }, name: { type: "string" }, kind: { type: "string", enum: ["action", "playerTouch"] }, graphic: GRAPHIC_SPEC_SCHEMA, text: { type: "string" }, doneText: { type: "string" }, requires: { type: "object", additionalProperties: true }, lockedText: { type: "string" } },
        additionalProperties: true,
      },
      doneSwitchId: { type: "string", description: "인과가 일어난 뒤 켜지는 스위치(없으면 자동 등록: sw_tilefx_<이벤트 id>)" },
      alsoSetSwitches: { type: "array", items: { type: "string" }, description: "함께 켤 스위치들(예: 미래 NPC 가 반응하는 플래그)" },
      emitOnly: { type: "boolean", description: "이벤트를 만들지 않고 changeTile 명령 목록만 돌려준다" },
    },
    required: ["targetMapId", "changes"],
    additionalProperties: false,
  },
  invalidArgsExample: {
    targetMapId: "map_future",
    changes: [{ layer: 3, rect: { x: 10, y: 8, w: 2, h: 3 }, tile: 1240 }],
    trigger: { mapId: "map_past", x: 10, y: 8, name: "씨앗 심는 땅", text: "씨앗을 심었다.", doneText: "싹이 올라오고 있다." },
  },
  run(draft, args): ToolExecResult {
    const targetMapId = String(args.targetMapId ?? "");
    const target = requireMap(draft, targetMapId);
    if (!Array.isArray(args.changes) || args.changes.length === 0) throw new ToolError("changes 에 바꿀 영역을 하나 이상 넣으세요: [{layer,rect:{x,y,w,h},tile}].", { code: "invalid-args" });
    const emitOnly = args.emitOnly === true;
    if (!emitOnly && !args.trigger) throw new ToolError("trigger({mapId,x,y,…})가 필요합니다 — 원인 이벤트 없이 명령만 받으려면 emitOnly:true.", { code: "invalid-args" });

    const plan = planTileChanges(draft, targetMapId, args.changes as Change[]);
    if (plan.commands.length === 0) {
      throw new ToolError(`changes 를 적용해도 맵 ${target.id} 의 타일이 달라지는 칸이 없습니다 — 이미 그 타일이거나 범위·층이 잘못됐습니다. tile_query 로 번호를, get_map_region 으로 현재 상태를 확인하세요.`, { code: "tile-effect-noop" });
    }
    if (plan.commands.length > MAX_CHANGE_COMMANDS) {
      throw new ToolError(`달라지는 칸이 ${plan.commands.length}개로 너무 많습니다(최대 ${MAX_CHANGE_COMMANDS}). 영역을 줄이거나 tile_change_effect 를 나눠 부르세요.`, { code: "tile-effect-too-large" });
    }
    const problems = plan.commands.flatMap((command) => changeTileProblems(command, draft));
    if (problems.length > 0) throw new ToolError(`${problems[0]} — ${CHANGE_TILE_USAGE}`, { code: "invalid-args" });

    const warnings = [...plan.warnings];
    if (plan.shadowChanged) warnings.push("그림자 비트가 바뀌는 칸이 있지만 changeTile 은 그림자를 못 바꿉니다 — 그 칸의 그림자는 원래대로 남습니다.");
    if (plan.blocked.length > 0) warnings.push(`변경 뒤 통행 불가가 되는 칸 ${plan.blocked.length}개(예: ${plan.blocked.slice(0, 4).map((cell) => `${cell.x},${cell.y}`).join(" ")}) — 길·문·이벤트를 막지 않는지 check_reachability 로 확인하세요.`);
    if (plan.opened.length > 0) warnings.push(`변경 뒤 통행 가능해지는 칸 ${plan.opened.length}개.`);
    const eventsOnChanged = target.events.filter((event) => plan.commands.some((command) => command.kind === "changeTile" && command.x === event.x && command.y === event.y));
    if (eventsOnChanged.length > 0) warnings.push(`타일이 바뀌는 칸 위에 이벤트가 있습니다: ${eventsOnChanged.slice(0, 5).map((event) => `${event.id}(${event.x},${event.y})`).join(", ")}.`);
    const layerCount = new Set(plan.commands.map((command) => (command as { layer: string }).layer)).size;

    if (emitOnly) {
      return {
        summary: `${target.name} 타일 변경 명령 ${plan.commands.length}개(층 ${layerCount}종) 생성 — 이벤트는 만들지 않음. 기존 이벤트 페이지 commands 에 붙이세요(patch_event_page).`,
        data: { targetMapId, commands: plan.commands, blocked: plan.blocked.length, opened: plan.opened.length },
        ...(warnings.length ? { warnings } : {}),
      };
    }

    const trigger = args.trigger as Record<string, unknown>;
    reject(trigger, TRIGGER_KEYS, "trigger", { eventId: "id", pos: "x,y", at: "x,y", message: "text", requireSwitch: "requires" });
    const triggerMap = requireMap(draft, String(trigger.mapId ?? ""));
    if (typeof trigger.x !== "number" || typeof trigger.y !== "number") throw new ToolError("trigger.x / trigger.y(정수)가 필요합니다.", { code: "invalid-args" });
    const eventId = typeof trigger.id === "string" && trigger.id.trim() ? trigger.id.trim() : `ev_tilefx_${genId("x").replace(/^x_/u, "").slice(0, 8)}`;
    if (triggerMap.events.some((event) => event.id === eventId)) throw new ToolError(`이벤트 id '${eventId}' 가 ${triggerMap.id} 에 이미 있습니다 — 다른 id 를 쓰거나 emitOnly:true 로 명령만 받으세요.`, { code: "invalid-args" });
    const doneSwitchId = typeof args.doneSwitchId === "string" && args.doneSwitchId.trim() ? args.doneSwitchId.trim() : `sw_tilefx_${eventId.replace(/[^A-Za-z0-9_]/gu, "_")}`;
    const eventName = typeof trigger.name === "string" && trigger.name.trim() ? trigger.name.trim() : "변화를 일으키는 곳";
    ensureNamedSwitch(draft, doneSwitchId, `${eventName} 완료`);
    const extraSwitches = Array.isArray(args.alsoSetSwitches) ? (args.alsoSetSwitches as unknown[]).map((entry) => String(entry).trim()).filter(Boolean) : [];
    for (const switchId of extraSwitches) ensureNamedSwitch(draft, switchId, `${eventName} 결과`);
    const guard = trigger.requires === undefined ? undefined : unlockCondition(draft, trigger.requires);
    if (guard?.note) warnings.push(guard.note);
    if (trigger.lockedText !== undefined && trigger.requires === undefined) throw new ToolError("trigger.lockedText 는 trigger.requires 와 함께만 쓴다.", { code: "invalid-args" });
    const graphic = trigger.graphic === undefined ? { transparent: true as const } : resolveGraphic(trigger.graphic as Parameters<typeof resolveGraphic>[0], { overrides: draft.charsetLabels });
    const kind = trigger.kind === "playerTouch" ? "playerTouch" : "action";
    const text = typeof trigger.text === "string" ? trigger.text.trim() : "";
    const doneText = typeof trigger.doneText === "string" && trigger.doneText.trim() ? trigger.doneText.trim() : "이미 끝난 일이다.";
    const lockedText = typeof trigger.lockedText === "string" && trigger.lockedText.trim() ? trigger.lockedText.trim() : "아직 이것을 할 수 없다.";

    const basePage = (suffix: string, conditions: Condition[], commands: Command[]): EventPage => ({
      id: genId("page"), name: `${eventName} (${suffix})`, conditions, graphic, trigger: { kind }, priority: "same", movement: { type: "fixed" }, commands,
    } as EventPage);
    const fireCommands: Command[] = [
      ...(text ? [{ kind: "text", body: text } as Command] : []),
      ...plan.commands,
      ...extraSwitches.map((switchId) => ({ kind: "setSwitch", switchId, value: true }) as Command),
      { kind: "setSwitch", switchId: doneSwitchId, value: true } as Command,
    ];
    const pages: EventPage[] = guard
      ? [
        basePage("잠김", [], [{ kind: "text", body: lockedText }]),
        basePage("실행", [guard.condition], fireCommands),
        basePage("완료", [{ kind: "switch", switchId: doneSwitchId, value: true }], [{ kind: "text", body: doneText }]),
      ]
      : [
        basePage("실행", [], fireCommands),
        basePage("완료", [{ kind: "switch", switchId: doneSwitchId, value: true }], [{ kind: "text", body: doneText }]),
      ];
    const upsert = EVENT_TOOLS.find((tool) => tool.name === "upsert_event");
    if (!upsert) throw new ToolError("upsert_event 도구를 찾지 못했습니다.", { code: "tile-effect-upsert-missing" });
    const event: Partial<GameEvent> & { id: string } = { id: eventId, name: eventName, x: trigger.x, y: trigger.y, trigger: { kind }, pages };
    const result = upsert.run(draft, { mapId: triggerMap.id, event, replacePages: true });
    for (const warning of result.warnings ?? []) warnings.push(warning);
    const placed = result.data as { x?: number; y?: number } | undefined;
    return {
      summary: `${triggerMap.name}(${placed?.x ?? trigger.x},${placed?.y ?? trigger.y})의 '${eventName}' → ${target.name} 타일 ${plan.commands.length}칸 변경(층 ${layerCount}종, 완료 스위치 ${doneSwitchId})`,
      data: { eventId, triggerMapId: triggerMap.id, targetMapId, doneSwitchId, changedCells: plan.commands.length, blocked: plan.blocked.length, opened: plan.opened.length },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const TILE_CHANGE_EFFECT_TOOLS: readonly ToolDefinition[] = [tileChangeEffect];
