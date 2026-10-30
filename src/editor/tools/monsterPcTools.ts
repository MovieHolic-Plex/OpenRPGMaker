// editor/tools/monsterPcTools.ts
// place_monster_pc — 몬스터 보관함(PC) 이벤트 한 칸. 말을 걸면 「PC를 켰다」 뒤 보관함 화면(상자 격자)이 열리고,
// 닫으면 이벤트가 이어진다. 새 명령이 아니다: 「메뉴 화면 열기」(m2-078) 에 fields.screen='monster-box' 를 실은 한 줄이다.  (스킬 장착 화면은 같은 명령에 fields.screen="skills" + 선택 actorId.)
// 그림은 새로 만들지 않는다 — 맵에 이미 있는 컴퓨터·단말 그림 칸 위에 투명 이벤트로 얹는다(벽 위 허용, 이웃 한 칸은 걸을 수 있어야 한다).
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { genId } from "@/util/id";
import { assertEventShape, placementAdjustedWarning, resolveEventPlacement, upsertEventIntoMap } from "./eventTools";
import { inMapBounds, requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const KEYS = ["mapId", "x", "y", "name", "line", "id"] as const;

export const MONSTER_PC_TOOLS: readonly ToolDefinition[] = [
  {
    name: "place_monster_pc",
    mode: "write",
    description:
      "몬스터 보관함(PC) 한 칸을 놓는다: 말을 걸면 「PC를 켰다」 뒤 보관함 화면이 열린다(상자 여러 개의 격자, 파티로 데려가기·다른 칸으로 옮기기·놓아주기). 닫으면 이벤트가 이어진다. " +
      "파티가 가득 찬 뒤 잡은 몬스터가 가는 곳이 이 보관함이므로, 몬스터 수집 게임에는 센터(place_monster_center) 근처에 하나는 둔다. " +
      "맵에 이미 있는 컴퓨터·단말 그림 칸 위에 놓는다(그림은 새로 만들지 않고 이벤트는 투명이다). 놓을 칸 이웃 한 칸은 걸을 수 있어야 한다. " +
      "상자 이름은 configure_monster_system {boxNames:[…]} 로 정한다. 쓰지 말 것: 몬스터를 주는 NPC(give_starter_monsters), 회복(place_monster_center).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        mapId: { type: "string" },
        x: { type: "integer" },
        y: { type: "integer" },
        name: { type: "string", description: "이벤트 이름(생략 = PC)" },
        line: { type: "string", description: "화면을 열기 전 한 줄(생략 = 「PC를 켰다.」)" },
        id: { type: "string" },
      },
      required: ["mapId", "x", "y"],
    },
    run(draft: Project, args: Record<string, unknown>): ToolExecResult {
      for (const key of Object.keys(args)) {
        if (!(KEYS as readonly string[]).includes(key)) {
          throw new ToolError(`place_monster_pc 는 '${key}' 칸을 받지 않습니다. 받는 칸: ${KEYS.join(", ")}. 상자 이름은 configure_monster_system {boxNames}.`, { code: "invalid-args" });
        }
      }
      const map = requireMap(draft, args.mapId as string);
      const x = Number(args.x), y = Number(args.y);
      if (!Number.isInteger(x) || !Number.isInteger(y) || !inMapBounds(map, x, y)) {
        throw new ToolError(`PC 위치가 맵 밖입니다: (${String(args.x)}, ${String(args.y)})`, { code: "pc-out-of-bounds", mapId: map.id });
      }
      if (draft.system.monsterCollection !== true) {
        throw new ToolError("보관함은 포획이 켜진 몬스터 수집 게임에서만 씁니다 — 먼저 configure_monster_system {enabled:true}.", { code: "monster-collection-off" });
      }
      const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : "PC";
      const id = typeof args.id === "string" && args.id.trim() ? args.id.trim() : genId("ev_monster_pc");
      const placement = resolveEventPlacement(draft, map, x, y, { kind: "interaction", ignoreEventId: id, label: `PC '${name}'`, code: "pc-impassable" });
      const warnings: string[] = [];
      const line = typeof args.line === "string" && args.line.trim() ? args.line.trim() : "PC를 켰다.";
      const commands: Command[] = [
        { kind: "text", body: line },
        { kind: "m2Command", commandId: "m2-078-open-menu-screen", fields: { screen: "monster-box" } },
      ];
      const pcPage: EventPage = {
        id: `${id}_pc`, name, conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "below",
        overlapForbidden: false, animationType: "fixedGraphic", movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
      };
      const event: GameEvent = { id, name, x: placement.x, y: placement.y, trigger: { kind: "action" }, commands: [], pages: [pcPage] };
      assertEventShape(event, warnings, event, draft);
      upsertEventIntoMap(map, event);
      if (placement.adjusted) warnings.push(placementAdjustedWarning(`PC '${name}'`, { x, y }, { x: placement.x, y: placement.y }));
      return {
        summary: `${map.name} (${placement.x}, ${placement.y}) 에 보관함 PC '${name}' — 말을 걸면 보관함 화면이 열립니다`,
        data: { eventId: id, x: placement.x, y: placement.y, adjusted: placement.adjusted },
        ...(warnings.length > 0 ? { warnings } : {}),
      };
    },
  },
];
