// editor/tools/timeGateTools.ts
// create_time_gate — 크로노 트리거식 시간의 문. 두 지점을 잇는 왕복 출입구에 흰 섬광 전이를 입힌다.
//
// 자리 고르기·착지·봉쇄 검사는 create_transfer_pair 가 이미 한다. 여기서 그 판정을 다시 쓰면
// 두 도구가 서로 다른 자리를 고르게 되므로, 그 도구를 그대로 부르고 만들어진 두 출입구만 꾸민다:
// 전이 앞에 흰 섬광(Flash Screen → PlayScene.flashCamera), 전이 페이드는 white, 이름은 「<name> A/B」.
//
// 그래픽: 번들 캐릭터 시트에는 소용돌이·차원문 그림이 없다(차원문은 전투 이펙트 시트뿐). 그래서
// 기본은 투명(밟으면 발동)이고, graphic 을 주면 그 그림을 쓴다 — 이모트나 사람 그림을 대신 끼우지 않는다.

import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import type { Command, EventPageGraphic, GameEvent } from "@/project/types";
import { resolveGraphic } from "./eventCompile";
import { EVENT_TOOLS } from "./eventTools";
import { GRAPHIC_SPEC_SCHEMA } from "./schemaShapes";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const FLASH_MS = 400;

function flashScreen(durationMs: number): Command {
  const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === "Flash Screen");
  if (!entry) throw new ToolError("Flash Screen 명령이 카탈로그에 없습니다.", { code: "time-gate-flash-missing" });
  return { kind: "m2Command", commandId: entry.id, fields: { color: "white", durationMs } };
}

function endpoint(value: unknown, label: string): { mapId: string; x: number; y: number } {
  const record = value as { mapId?: unknown; x?: unknown; y?: unknown } | null;
  if (!record || typeof record !== "object" || typeof record.mapId !== "string" || typeof record.x !== "number" || typeof record.y !== "number") {
    throw new ToolError(`${label} 는 {mapId,x,y} 객체여야 합니다.`, { code: "time-gate-endpoint" });
  }
  return { mapId: record.mapId, x: Math.trunc(record.x), y: Math.trunc(record.y) };
}

function decorateGate(event: GameEvent, name: string, flash: Command, graphic: EventPageGraphic): void {
  event.name = name;
  for (const page of event.pages ?? []) {
    page.name = name;
    page.graphic = graphic;
    page.commands = page.commands.flatMap((command) => command.kind === "transfer"
      ? [flash, { ...command, fade: "white" } as Command]
      : [command]);
  }
}

const createTimeGate: ToolDefinition = {
  name: "create_time_gate",
  description:
    "크로노 트리거식 시간의 문(왕복 게이트)을 만든다. {a:{mapId,x,y}, b:{mapId,x,y}, name?} — 두 지점을 create_transfer_pair 와 같은 규칙으로 잇고"
    + " 밟으면 흰 섬광(Flash Screen) 뒤 흰 페이드로 상대편 게이트 옆에 착지한다. 시대·차원 이동 연출용이며 일반 문·계단은 create_transfer_pair."
    + " graphic 을 주면 게이트에 그 그림을 쓰고, 생략하면 투명 게이트(바닥 표식은 paint_tiles 로 따로 칠한다).",
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
      graphic: GRAPHIC_SPEC_SCHEMA,
    },
    required: ["a", "b"],
    additionalProperties: false,
  },
  invalidArgsExample: { a: { mapId: "map_present", x: 10, y: 4 }, b: { mapId: "map_past", x: 6, y: 8 }, name: "시간의 문" },
  run(draft, args): ToolExecResult {
    const a = endpoint(args.a, "a");
    const b = endpoint(args.b, "b");
    const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : "시간의 문";
    const pair = EVENT_TOOLS.find((tool) => tool.name === "create_transfer_pair");
    if (!pair) throw new ToolError("create_transfer_pair 도구를 찾지 못했습니다.", { code: "time-gate-pair-missing" });
    const paired = pair.run(draft, { a, b, fade: "white" });
    const data = paired.data as { eventIdA: string; eventIdB: string; gateA: { x: number; y: number }; gateB: { x: number; y: number } };
    const graphic: EventPageGraphic = args.graphic === undefined
      ? { transparent: true }
      : resolveGraphic(args.graphic as Parameters<typeof resolveGraphic>[0], { overrides: draft.charsetLabels });
    const flash = flashScreen(FLASH_MS);
    const found = [
      { map: requireMap(draft, a.mapId), id: data.eventIdA, label: `${name} A` },
      { map: requireMap(draft, b.mapId), id: data.eventIdB, label: `${name} B` },
    ];
    for (const { map, id, label } of found) {
      const event = map.events.find((entry) => entry.id === id);
      if (!event) throw new ToolError(`게이트 이벤트를 찾지 못했습니다: ${id}`, { code: "time-gate-event-missing" });
      decorateGate(event, label, flash, graphic);
    }
    return {
      summary: `시간의 문 '${name}': ${found[0]!.map.name}(${data.gateA.x},${data.gateA.y}) ↔ ${found[1]!.map.name}(${data.gateB.x},${data.gateB.y}) — 흰 섬광 전이`,
      data: { ...data, name },
      ...(paired.warnings?.length ? { warnings: paired.warnings } : {}),
    };
  },
};

export const TIME_GATE_TOOLS: readonly ToolDefinition[] = [createTimeGate];
