// editor/tools/timeGateTools.ts
// create_time_gate — 크로노 트리거식 시간의 문. 두 지점을 잇는 왕복 출입구에 시간 이동 연출을 입힌다.
// effect(flash|swirl|pillar|warp|…)로 연출을 고르고, unlockWhen/lockedMessage 로 문을 잠글 수 있다
// (잠긴 페이지를 앞에, 열린 페이지를 뒤에 둔다 — 런타임은 조건이 모두 맞는 마지막 페이지를 쓴다).
//
// 자리 고르기·착지·봉쇄 검사는 create_transfer_pair 가 이미 한다. 여기서 그 판정을 다시 쓰면
// 두 도구가 서로 다른 자리를 고르게 되므로, 그 도구를 그대로 부르고 만들어진 두 출입구만 꾸민다:
// 전이 앞에 흰 섬광(Flash Screen → PlayScene.flashCamera), 전이 페이드는 white, 이름은 「<name> A/B」.
//
// 그래픽: 번들 캐릭터 시트에는 소용돌이·차원문 그림이 없다(차원문은 전투 이펙트 시트뿐). 그래서
// 기본은 투명(밟으면 발동)이고, graphic 을 주면 그 그림을 쓴다 — 이모트나 사람 그림을 대신 끼우지 않는다.

import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { storyFlagById } from "@/project/storyFlags";
import { TIME_PHASES, type TimePhase } from "@/project/gameTime";
import type { Command, Condition, EventPage, EventPageGraphic, GameEvent, GameMap, Project } from "@/project/types";
import { genId } from "@/util/id";
import { ensureNamedSwitch, ensureNamedVariable } from "./flagHelpers";
import { resolveGraphic } from "./eventCompile";
import { EVENT_TOOLS } from "./eventTools";
import { GRAPHIC_SPEC_SCHEMA } from "./schemaShapes";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const FLASH_MS = 400;

function m2(title: string, fields: Record<string, string | number | boolean>): Command {
  const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
  if (!entry) throw new ToolError(`${title} 명령이 카탈로그에 없습니다.`, { code: "time-gate-command-missing" });
  return { kind: "m2Command", commandId: entry.id, fields };
}

function flashScreen(durationMs: number): Command {
  return m2("Flash Screen", { color: "white", durationMs });
}

export const TIME_GATE_EFFECTS = ["flash", "swirl", "pillar", "warp", "quake"] as const;
export type TimeGateEffect = (typeof TIME_GATE_EFFECTS)[number];

const EFFECT_GUIDE =
  "flash(기본: 흰 섬광) · swirl(소용돌이: 화면이 돌며 일렁이다 흰빛으로 사라짐) · pillar(빛기둥: 반짝이는 빛무리가 일며 흰빛) · "
  + "warp(차원 도약: 모자이크로 흩어졌다 모자이크 전환) · quake(시공 진동: 화면이 흔들린 뒤 흰빛).";

/**
 * 전이 **앞**에 깔리는 연출 명령. 새 그림 없이 화면 왜곡·섬광·흔들림·파티클 조합만 쓴다.
 * 맵 이벤트는 transfer 뒤 명령을 실행하지 않으므로(후속 명령 불가) 왜곡은 전이 전에 스스로 풀어야 한다 —
 * 흰 섬광(blocking, 800ms 이상 화면을 85% 덮는다) 직전에 clearDistortion 을 걸어 섬광 아래에서 풀린다.
 * 왜곡은 세션에 남아 맵을 건너도 유지되므로 이 풀기를 빼면 도착한 맵이 계속 비틀린다.
 */
function effectPrelude(effect: TimeGateEffect): { readonly commands: Command[]; readonly transition: "fade" | "mosaic" } {
  switch (effect) {
    case "swirl":
      return {
        commands: [
          m2("Screen Effect", { effect: "rotate", value: "150", durationMs: 900 }),
          m2("Screen Effect", { effect: "wave", value: "12", durationMs: 900 }),
          { kind: "wait", ms: 900 },
          m2("Screen Effect", { effect: "clearDistortion", value: "", durationMs: 800 }),
          flashScreen(800),
        ],
        transition: "fade",
      };
    case "pillar":
      return {
        commands: [
          m2("Particle Effect", { preset: "sparkle", target: "player", durationMs: 1400, wait: false }),
          m2("Screen Effect", { effect: "wave", value: "3", durationMs: 600 }),
          { kind: "wait", ms: 700 },
          m2("Screen Effect", { effect: "clearDistortion", value: "", durationMs: 600 }),
          flashScreen(700),
        ],
        transition: "fade",
      };
    case "warp":
      return {
        commands: [
          m2("Screen Effect", { effect: "mosaic", value: "18", durationMs: 700 }),
          { kind: "wait", ms: 700 },
          m2("Screen Effect", { effect: "clearDistortion", value: "", durationMs: 600 }),
          flashScreen(600),
        ],
        transition: "mosaic",
      };
    case "quake":
      return {
        commands: [m2("Shake Screen", { value: 6, intensity: "6", durationMs: 800, direction: "both" }), flashScreen(600)],
        transition: "fade",
      };
    default:
      return { commands: [flashScreen(FLASH_MS)], transition: "fade" };
  }
}

function endpoint(value: unknown, label: string): { mapId: string; x: number; y: number } {
  const record = value as { mapId?: unknown; x?: unknown; y?: unknown } | null;
  if (!record || typeof record !== "object" || typeof record.mapId !== "string" || typeof record.x !== "number" || typeof record.y !== "number") {
    throw new ToolError(`${label} 는 {mapId,x,y} 객체여야 합니다.`, { code: "time-gate-endpoint" });
  }
  return { mapId: record.mapId, x: Math.trunc(record.x), y: Math.trunc(record.y) };
}

const UNLOCK_KEYS = new Set(["switchId", "storyFlagId", "variableId", "op", "value", "timePhase", "itemId"]);
const DEFAULT_LOCKED_MESSAGE = "시간의 문이 굳게 닫혀 있다. 아직 열 방법을 찾지 못했다.";

/** unlockWhen 인자를 페이지 조건 하나로 바꾼다. 모르는 키·둘 이상의 지정은 거절한다(조용히 버리면 문이 그냥 열린다). */
export function unlockCondition(project: Project, raw: unknown): { readonly condition: Condition; readonly note?: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ToolError("unlockWhen 은 {switchId} | {storyFlagId} | {variableId,op,value} | {timePhase} | {itemId} 객체여야 합니다.", { code: "invalid-args" });
  }
  const record = raw as Record<string, unknown>;
  const unknownKeys = Object.keys(record).filter((key) => !UNLOCK_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw new ToolError(`unlockWhen 에 알 수 없는 키: ${unknownKeys.join(", ")} — 허용: ${[...UNLOCK_KEYS].join(", ")}. 키 이름이 틀리면 조건이 사라져 문이 잠기지 않는다.`, { code: "invalid-args" });
  }
  const given = ["switchId", "storyFlagId", "variableId", "timePhase", "itemId"].filter((key) => typeof record[key] === "string" && String(record[key]).trim());
  if (given.length !== 1) {
    throw new ToolError(`unlockWhen 은 switchId · storyFlagId · variableId · timePhase · itemId 중 정확히 하나여야 합니다(받은 것: ${given.join(", ") || "없음"}). 스위치를 모르면 declare_story_flag 로 먼저 만든다.`, { code: "invalid-args" });
  }
  // 시간대 문(밤에만 열리는 늪 길·낮에만 여는 성문). 시간 시스템이 꺼져 있으면 시간대가 늘 낮이라 밤 문은 영영 닫힌다 — 알린다.
  if (given[0] === "timePhase") {
    const phase = String(record.timePhase).trim();
    if (!(TIME_PHASES as readonly string[]).includes(phase)) throw new ToolError(`unlockWhen.timePhase 는 ${TIME_PHASES.join(", ")} 중 하나여야 합니다(받은 값: ${phase}).`, { code: "invalid-args" });
    return { condition: { kind: "timePhase", phase: phase as TimePhase },
      ...(project.system.timeSystem?.enabled ? {} : { note: "시간 시스템이 꺼져 있어 시간대 조건이 바뀌지 않는다 — configure_time_system {enabled:true} 로 켜고, 기다리게 하려면 restMenu 도 준다." }) };
  }
  // 아이템을 가지고 있어야 열리는 문(옥상 열쇠, 「낱장 세 장을 다 모아야」) — 페이지 조건 item. 여러 개를 다 요구하면 AND 목록으로.
  // 예전엔 스위치만 받아 「열쇠를 얻으면 스위치를 켜는」 줍기 이벤트를 따로 짜거나 잠긴 문 페이지를 손으로 짰다(2026-10-31 「이상 없음」 옥상 철문).
  if (given[0] === "itemId") {
    const itemId = String(record.itemId).trim();
    const known = project.database.items.some((item) => item.id === itemId);
    if (!known) throw new ToolError(`아이템 '${itemId}' 이 데이터베이스에 없습니다 — 먼저 아이템을 만들거나(upsert_item) 있는 id 를 쓰세요.`, { code: "invalid-args" });
    return { condition: { kind: "item", itemId, present: true } };
  }
  if (given[0] === "switchId") {
    const switchId = String(record.switchId).trim();
    const known = project.switches.some((entry) => entry.id === switchId);
    if (!known) ensureNamedSwitch(project, switchId, "시간의 문 해금");
    return { condition: { kind: "switch", switchId, value: true }, ...(known ? {} : { note: `스위치 '${switchId}' 가 없어 새로 등록했습니다 — 이 스위치를 켜는 이벤트(setSwitch)를 만들어야 문이 열립니다.` }) };
  }
  if (given[0] === "storyFlagId") {
    const flag = storyFlagById(project, String(record.storyFlagId).trim());
    if (!flag) throw new ToolError(`story flag '${String(record.storyFlagId)}' 를 찾을 수 없습니다 — declare_story_flag 로 등록하거나 switchId 를 쓰세요.`, { code: "story-flag-not-found" });
    if (flag.kind === "switch") return { condition: { kind: "switch", switchId: flag.targetId, value: true } };
    const op = (typeof record.op === "string" ? record.op : ">=") as Extract<Condition, { kind: "variable" }>["op"];
    return { condition: { kind: "variable", variableId: flag.targetId, op, value: typeof record.value === "number" ? record.value : 1 } };
  }
  const variableId = String(record.variableId).trim();
  const op = (typeof record.op === "string" ? record.op : ">=") as Extract<Condition, { kind: "variable" }>["op"];
  if (!["==", ">=", "<=", ">", "<", "!="].includes(op)) throw new ToolError(`unlockWhen.op 는 ==, >=, <=, >, <, != 중 하나여야 합니다(받은 값: ${String(record.op)}).`, { code: "invalid-args" });
  if (typeof record.value !== "number") throw new ToolError("unlockWhen.variableId 에는 비교할 value(숫자)가 필요합니다.", { code: "invalid-args" });
  const known = project.variables.some((entry) => entry.id === variableId);
  if (!known) ensureNamedVariable(project, variableId, "시간의 문 해금");
  return { condition: { kind: "variable", variableId, op, value: record.value }, ...(known ? {} : { note: `변수 '${variableId}' 가 없어 새로 등록했습니다 — 값을 올리는 이벤트(setVariable)를 만들어야 문이 열립니다.` }) };
}

/**
 * 투명 시간의 문 자리에서 반짝이는 빛 — 그림이 없는 문은 화면에 아무 표시도 없어 플레이어가 문을 찾을 수 없었다
 * (jrpg-loop-1 ct1: 현자가 「서쪽 푸른 시간문(14,25)」 이라고 좌표를 읊어야 했다). 새 그림 없이 파티클(m2-224 「magic」)만 쓴다:
 * 문 칸에 겹쳐 놓은 병렬 이벤트가 1.6초짜리 빛을 1.2초마다 다시 피운다. 걷기·접촉 판정이 없는 이벤트라 문 동작은 그대로다.
 */
function addGateBeacon(map: GameMap, x: number, y: number, name: string): string {
  const id = genId("ev_beacon");
  const label = `${name} 빛`;
  map.events.push({
    id, name: label, x, y, trigger: { kind: "parallel" }, commands: [],
    pages: [{
      id: `${id}_page`, name: label, conditions: [], graphic: { transparent: true }, trigger: { kind: "parallel" },
      priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [
        m2("Particle Effect", { preset: "magic", target: "tile", x, y, eventId: "", durationMs: 1600, wait: false }),
        { kind: "wait", ms: 1200 },
      ],
    }],
  } as GameEvent);
  return id;
}

function decorateGate(event: GameEvent, name: string, prelude: readonly Command[], transition: "fade" | "mosaic", graphic: EventPageGraphic, lock?: { readonly condition: Condition; readonly message: string }): void {
  event.name = name;
  for (const page of event.pages ?? []) {
    page.name = name;
    page.graphic = graphic;
    page.commands = page.commands.flatMap((command) => command.kind === "transfer"
      ? [...structuredClone(prelude), { ...command, fade: "white", ...(transition === "mosaic" ? { transition: "mosaic" as const } : {}) } as Command]
      : [command]);
  }
  if (lock && event.pages?.length) {
    // 뒤 페이지가 이기므로 [잠김 안내, 열림(조건)] 순서. 안내 페이지는 같은 그림·같은 발동으로 둔다.
    const open = event.pages[event.pages.length - 1]!;
    const lockedPage: EventPage = {
      ...structuredClone(open),
      id: genId("page"),
      name: `${name} (잠김)`,
      conditions: [],
      commands: [{ kind: "text", body: lock.message }],
    };
    open.conditions = [...(open.conditions ?? []), structuredClone(lock.condition)];
    event.pages = [...event.pages.slice(0, -1), lockedPage, open];
  }
}

const createTimeGate: ToolDefinition = {
  name: "create_time_gate",
  description:
    "크로노 트리거식 시간의 문(왕복 게이트)을 만든다. {a:{mapId,x,y}, b:{mapId,x,y}, name?, effect?, unlockWhen?, lockedMessage?, lockSide?, graphic?} — 두 지점을 create_transfer_pair 와 같은 규칙으로 잇고"
    + " 밟으면 연출 뒤 흰 페이드로 상대편 게이트 옆에 착지한다. 시대·차원 이동용이며 일반 문·계단은 create_transfer_pair."
    + ` effect(전이 연출, 새 그림 없이 화면 왜곡·섬광·파티클 조합): ${EFFECT_GUIDE}`
    + " unlockWhen({switchId}|{storyFlagId}|{variableId,op,value}|{timePhase}|{itemId})을 주면 그 조건이 참일 때만 열리고, 아니면 lockedMessage(생략 시 기본 안내)가 뜬다"
    + " — 한 호출로 「과거의 장치를 켜야 미래로 가는 문이 열린다」를 만든다. lockSide 는 잠글 쪽(both 기본|a|b; 되돌아오는 쪽은 열어 두려면 지정)."
    + " 알 수 없는 인자·unlockWhen 키는 거절한다. graphic 을 주면 게이트에 그 그림을 쓰고, 생략하면 투명 게이트(바닥 표식은 paint_tiles 로 따로 칠한다).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      a: {
        type: "object",
        description: "{mapId,x,y} 게이트 A",
        properties: { mapId: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } },
        required: ["mapId", "x", "y"],
      },
      b: {
        type: "object",
        description: "{mapId,x,y} 게이트 B",
        properties: { mapId: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } },
        required: ["mapId", "x", "y"],
      },
      name: { type: "string", description: "게이트 이름. 생략 시 「시간의 문」" },
      effect: { type: "string", enum: [...TIME_GATE_EFFECTS], description: `전이 연출. ${EFFECT_GUIDE}` },
      unlockWhen: {
        type: "object",
        description: "열리는 조건 하나: {switchId} | {storyFlagId} | {variableId, op(==,>=,<=,>,<,!=), value} | {timePhase(morning|day|evening|night)}. 생략하면 항상 열려 있다.",
        properties: {
          switchId: { type: "string" },
          storyFlagId: { type: "string" },
          variableId: { type: "string" },
          op: { type: "string", enum: ["==", ">=", "<=", ">", "<", "!="] },
          value: { type: "number" },
          timePhase: { type: "string", enum: ["morning", "day", "evening", "night"] },
        },
      },
      lockedMessage: { type: "string", description: "잠겨 있을 때 뜨는 안내문(unlockWhen 과 함께만)" },
      lockSide: { type: "string", enum: ["both", "a", "b"], description: "잠글 게이트. 기본 both" },
      graphic: GRAPHIC_SPEC_SCHEMA,
    },
    required: ["a", "b"],
    additionalProperties: false,
  },
  invalidArgsExample: { a: { mapId: "map_present", x: 10, y: 4 }, b: { mapId: "map_past", x: 6, y: 8 }, name: "시간의 문", effect: "swirl", unlockWhen: { switchId: "sw_seal_open" }, lockedMessage: "문이 굳게 닫혀 있다." },
  run(draft, args): ToolExecResult {
    const a = endpoint(args.a, "a");
    const b = endpoint(args.b, "b");
    const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : "시간의 문";
    const effect = (args.effect ?? "flash") as TimeGateEffect;
    if (!TIME_GATE_EFFECTS.includes(effect)) {
      throw new ToolError(`effect 는 ${TIME_GATE_EFFECTS.join(" | ")} 중 하나여야 합니다(받은 값: ${String(args.effect)}).`, { code: "invalid-args" });
    }
    if (args.lockedMessage !== undefined && args.unlockWhen === undefined) {
      throw new ToolError("lockedMessage 는 unlockWhen 과 함께만 쓴다 — 잠금 조건 없이 안내문만 주면 문이 그냥 열린다. unlockWhen({switchId|storyFlagId|variableId}) 도 함께 주세요.", { code: "invalid-args" });
    }
    if (args.lockSide !== undefined && args.unlockWhen === undefined) {
      throw new ToolError("lockSide 는 unlockWhen 과 함께만 쓴다.", { code: "invalid-args" });
    }
    const unlock = args.unlockWhen === undefined ? undefined : unlockCondition(draft, args.unlockWhen);
    const lockedMessage = typeof args.lockedMessage === "string" && args.lockedMessage.trim() ? args.lockedMessage.trim() : DEFAULT_LOCKED_MESSAGE;
    const lockSide = (args.lockSide ?? "both") as "both" | "a" | "b";
    const pair = EVENT_TOOLS.find((tool) => tool.name === "create_transfer_pair");
    if (!pair) throw new ToolError("create_transfer_pair 도구를 찾지 못했습니다.", { code: "time-gate-pair-missing" });
    const paired = pair.run(draft, { a, b, fade: "white" });
    const data = paired.data as { eventIdA: string; eventIdB: string; gateA: { x: number; y: number }; gateB: { x: number; y: number } };
    const graphic: EventPageGraphic = args.graphic === undefined
      ? { transparent: true }
      : resolveGraphic(args.graphic as Parameters<typeof resolveGraphic>[0], { overrides: draft.charsetLabels });
    const prelude = effectPrelude(effect);
    const found = [
      { map: requireMap(draft, a.mapId), id: data.eventIdA, label: `${name} A`, side: "a" as const },
      { map: requireMap(draft, b.mapId), id: data.eventIdB, label: `${name} B`, side: "b" as const },
    ];
    for (const { map, id, label, side } of found) {
      const event = map.events.find((entry) => entry.id === id);
      if (!event) throw new ToolError(`게이트 이벤트를 찾지 못했습니다: ${id}`, { code: "time-gate-event-missing" });
      const locked = unlock && (lockSide === "both" || lockSide === side);
      decorateGate(event, label, prelude.commands, prelude.transition, graphic, locked ? { condition: unlock.condition, message: lockedMessage } : undefined);
    }
    // 그림 없는 문(기본)에는 빛을 달아 눈에 보이게 한다. 그림을 준 문은 그 그림이 표식이다.
    const beacons: string[] = [];
    if (args.graphic === undefined) {
      for (const { map, id } of found) {
        const gate = map.events.find((entry) => entry.id === id);
        if (gate) beacons.push(addGateBeacon(map, gate.x, gate.y, typeof gate.name === "string" ? gate.name.replace(/ [AB]$/u, "") : name));
      }
    }
    const warnings = [...(paired.warnings ?? []), ...(unlock?.note ? [unlock.note] : [])];
    const effectLabel = effect === "flash" ? "흰 섬광" : `${effect} 연출`;
    return {
      summary: `시간의 문 '${name}': ${found[0]!.map.name}(${data.gateA.x},${data.gateA.y}) ↔ ${found[1]!.map.name}(${data.gateB.x},${data.gateB.y}) — ${effectLabel} 전이${unlock ? ` · 잠금(${lockSide})` : ""}`,
      data: { ...data, name, effect, ...(beacons.length ? { beaconEventIds: beacons } : {}), ...(unlock ? { unlockWhen: unlock.condition, lockSide, lockedMessage } : {}) },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const TIME_GATE_TOOLS: readonly ToolDefinition[] = [createTimeGate];
