// 2026-09-24 JRPG 도그푸딩 ember r1 tools.jsonl:
// - place_npc 귀환 포탈의 transfer 가 마을 (34,3) 통행 불가라 이벤트 전체가 커밋 거부됐다.
// - upsert_equipment 가 아직 없는 actor_toma·actor_mira 때문에 장비 전체를 거부했다.
import { describe, expect, it } from "vitest";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { runTool } from "@/editor/tools";
import type { Command, Project } from "@/project/types";

function transfersOf(commands: readonly Command[] | undefined, out: Extract<Command, { kind: "transfer" }>[] = []): Extract<Command, { kind: "transfer" }>[] {
  for (const command of commands ?? []) {
    if (command.kind === "transfer") out.push(command);
    for (const list of nestedCommandLists(command)) transfersOf(list, out);
  }
  return out;
}

function block(project: Project, x: number, y: number): void {
  const map = project.maps[project.startMapId]!;
  map.lowerTiles[y * map.width + x] = TILE.WATER;
  map.upperTiles[y * map.width + x] = TILE.EMPTY;
}

describe("통행 불가 transfer 는 이벤트 전체를 버리지 않고 가까운 착지로 옮긴다", () => {
  it("place_npc 선택지 안의 벽 착지를 반경 3 통행 칸으로 옮기고 커밋한다", () => {
    const project = createBlankProject();
    const ctx = { project };
    const mapId = project.startMapId;
    block(project, 10, 6);
    expect(isPassable(project, project.maps[mapId]!, 10, 6)).toBe(false);
    const result = runTool(ctx, "place_npc", {
      mapId,
      name: "귀환 마법진",
      x: 6,
      y: 6,
      pages: [{
        lines: ["마을로 돌아갈까?"],
        choices: [{ text: "돌아간다", commands: [{ kind: "transfer", mapId, x: 10, y: 6 }] }],
      }],
    });
    expect(result.ok, result.summary).toBe(true);
    const event = ctx.project.maps[mapId]!.events.find((entry) => entry.name === "귀환 마법진");
    const landed = event?.pages?.flatMap((page) => transfersOf(page.commands)) ?? [];
    expect(landed).toHaveLength(1);
    const landing = landed[0]!;
    expect(landing.x === 10 && landing.y === 6).toBe(false);
    expect(Math.max(Math.abs(landing.x - 10), Math.abs(landing.y - 6))).toBeLessThanOrEqual(3);
    expect(isPassable(ctx.project, ctx.project.maps[mapId]!, landing.x, landing.y)).toBe(true);
    expect(result.diff?.warnings.join("\n")).toContain("통행 불가");
  });

  it("이미 통행 가능한 착지는 그대로 둔다", () => {
    const project = createBlankProject();
    const ctx = { project };
    const mapId = project.startMapId;
    const result = runTool(ctx, "upsert_event", {
      mapId,
      event: {
        id: "ev_gate",
        name: "문",
        x: 6,
        y: 6,
        pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "transfer", mapId, x: 8, y: 6 }] }],
      },
    });
    expect(result.ok, result.summary).toBe(true);
    const event = ctx.project.maps[mapId]!.events.find((entry) => entry.id === "ev_gate");
    expect(transfersOf(event?.pages?.[0]?.commands)).toMatchObject([{ x: 8, y: 6 }]);
    expect(result.diff?.warnings.join("\n") ?? "").not.toContain("통행 불가");
  });
});

describe("upsert_equipment 없는 착용 제한", () => {
  it("아직 없는 배우·직업 id 만 빼고 장비는 저장한다", () => {
    const project = createBlankProject();
    const ctx = { project };
    const actorId = project.database.actors[0]!.id;
    const classId = project.database.classes[0]!.id;
    const result = runTool(ctx, "upsert_equipment", {
      equipment: {
        id: "equip_acolyte_staff",
        name: "사제 지팡이",
        slot: "weapon",
        equippableActorIds: ["actor_toma", actorId],
        equippableClassIds: ["class_not_yet", classId],
        statBonuses: { mind: 12, attack: 4 },
      },
    });
    expect(result.ok, result.summary).toBe(true);
    const equipment = ctx.project.database.equipment.find((entry) => entry.id === "equip_acolyte_staff");
    expect(equipment?.equippableActorIds).toEqual([actorId]);
    expect(equipment?.equippableClassIds).toEqual([classId]);
    expect(equipment?.statBonuses.mind).toBe(12);
    const warnings = result.diff?.warnings.join("\n") ?? "";
    expect(warnings).toContain("actor_toma");
    expect(warnings).toContain("class_not_yet");
  });
});
