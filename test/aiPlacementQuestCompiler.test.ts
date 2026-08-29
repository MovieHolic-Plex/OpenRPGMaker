// 퀘스트 컴파일러 배치 통행 가능성 계약.
// 왜: questCompiler는 저작 좌표를 그대로 믿고 이벤트를 만들었고, 강 위에 컴파일하면
// 물 속에 선 NPC와 절대 밟을 수 없는 도달 마커가 생겼다.
// RM2K3 의미: 캐릭터형(기버·대화 NPC·몬스터)과 밟아서 발동하는 마커(playerTouch + priority !== "same")는
// 반드시 통행 가능 칸에 서야 하고, action 트리거 마커/차단 게이트는 벽 위에 있어도 되지만 도달 가능해야 한다.

import { describe, expect, it } from "vitest";

import { getTool } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { compileQuest } from "@/project/quest/questCompiler";
import type { QuestDef } from "@/project/quest/questDef";
import type { GameEvent, GameMap, Project } from "@/project/types";

const QUEST_KEY = "q_river";

// 저작 좌표(전부 강 위) — 물이라서 계약대로면 전부 보정/보고돼야 한다.
const AUTHORED = {
  giver: { x: 7, y: 10 },
  talk: { x: 8, y: 4 },
  kill: { x: 8, y: 2 },
  reach: { x: 8, y: 7 },
  gate: { x: 9, y: 12 },
} as const;

function fixture(): { project: Project; map: GameMap; mapId: string } {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  return { project, map, mapId };
}

/** x 열 전체를 물로 채워 남북으로 흐르는 강을 만든다. */
function carveRiver(map: GameMap, columns: readonly number[]): void {
  for (const x of columns) {
    for (let y = 0; y < map.height; y += 1) {
      map.lowerTiles[y * map.width + x] = TILE.WATER;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
    }
  }
}

function troopId(project: Project): string {
  const id = project.database.troops[0]?.id;
  if (!id) throw new Error("fixture troop missing");
  return id;
}

function itemId(project: Project): string {
  const id = project.database.items[0]?.id;
  if (!id) throw new Error("fixture item missing");
  return id;
}

function questDef(project: Project, mapId: string): QuestDef {
  return {
    key: QUEST_KEY,
    title: "강 건너 심부름",
    summary: "강가 사람들의 부탁을 처리한다.",
    giver: {
      create: {
        mapId,
        x: AUTHORED.giver.x,
        y: AUTHORED.giver.y,
        name: "뱃사공 나루",
        textureKey: "tex_easyrpg_charset_people1",
        characterIndex: 6,
      },
    },
    steps: [
      {
        kind: "talk",
        target: {
          create: {
            mapId,
            x: AUTHORED.talk.x,
            y: AUTHORED.talk.y,
            name: "낚시꾼 도리",
            textureKey: "tex_easyrpg_charset_people1",
            characterIndex: 2,
          },
        },
        lines: ["강 상류가 시끄럽다네."],
      },
      {
        kind: "kill",
        troopId: troopId(project),
        at: { mapId, x: AUTHORED.kill.x, y: AUTHORED.kill.y, graphicQuery: "슬라임" },
      },
      { kind: "reach", mapId, x: AUTHORED.reach.x, y: AUTHORED.reach.y },
      {
        kind: "collect",
        itemId: itemId(project),
        count: 1,
        sources: [{ kind: "pickup", mapId, x: 3, y: 3, lookText: "무언가 반짝인다." }],
      },
    ],
    gates: [
      {
        mapId,
        x: AUTHORED.gate.x,
        y: AUTHORED.gate.y,
        requiresStep: 0,
        lockedText: "아직 건널 수 없다.",
      },
    ],
  };
}

function eventById(map: GameMap, id: string): GameEvent {
  const found = map.events.find((entry) => entry.id === id);
  if (!found) throw new Error(`event not found: ${id}`);
  return found;
}

describe("questCompiler 통행 가능 착지", () => {
  it("강 위에 컴파일해도 새로 만든 대화 NPC는 통행 가능 칸에 선다", () => {
    const { project, map, mapId } = fixture();
    carveRiver(map, [7, 8, 9]);
    expect(isPassable(project, map, AUTHORED.talk.x, AUTHORED.talk.y)).toBe(false);

    getTool("create_quest")!.run(project, { def: questDef(project, mapId) });

    const npc = eventById(map, `ev_${QUEST_KEY}_talk0`);
    expect(isPassable(project, map, npc.x, npc.y)).toBe(true);
  });

  it("playerTouch 도달 마커는 밟을 수 있는 칸으로 옮긴다", () => {
    const { project, map, mapId } = fixture();
    carveRiver(map, [7, 8, 9]);
    expect(isPassable(project, map, AUTHORED.reach.x, AUTHORED.reach.y)).toBe(false);

    getTool("create_quest")!.run(project, { def: questDef(project, mapId) });

    const marker = eventById(map, `ev_${QUEST_KEY}_reach2`);
    expect(isPassable(project, map, marker.x, marker.y)).toBe(true);
  });

  it("기버 NPC와 전투 블로커도 통행 가능 칸에 선다", () => {
    const { project, map, mapId } = fixture();
    carveRiver(map, [7, 8, 9]);
    expect(isPassable(project, map, AUTHORED.giver.x, AUTHORED.giver.y)).toBe(false);
    expect(isPassable(project, map, AUTHORED.kill.x, AUTHORED.kill.y)).toBe(false);

    getTool("create_quest")!.run(project, { def: questDef(project, mapId) });

    const giver = eventById(map, `ev_${QUEST_KEY}_giver`);
    const blocker = eventById(map, `ev_${QUEST_KEY}_kill1`);
    expect(isPassable(project, map, giver.x, giver.y)).toBe(true);
    expect(isPassable(project, map, blocker.x, blocker.y)).toBe(true);
  });

  it("물 위 게이트는 통행 가능 칸으로 착지하거나 경고로 보고된다", () => {
    const { project, map, mapId } = fixture();
    carveRiver(map, [7, 8, 9]);
    expect(isPassable(project, map, AUTHORED.gate.x, AUTHORED.gate.y)).toBe(false);

    const result = compileQuest(project, questDef(project, mapId));

    const gate = eventById(map, `ev_${QUEST_KEY}_gate0`);
    const reported = (result.warnings ?? []).some(
      (warning) => warning.includes(`(${AUTHORED.gate.x}, ${AUTHORED.gate.y})`),
    );
    expect(isPassable(project, map, gate.x, gate.y) || reported).toBe(true);
  });

  it("평지에 컴파일하면 저작 좌표를 하나도 건드리지 않는다", () => {
    const { project, map, mapId } = fixture();

    const result = compileQuest(project, questDef(project, mapId));

    expect([eventById(map, `ev_${QUEST_KEY}_giver`).x, eventById(map, `ev_${QUEST_KEY}_giver`).y]).toEqual([
      AUTHORED.giver.x,
      AUTHORED.giver.y,
    ]);
    expect([eventById(map, `ev_${QUEST_KEY}_talk0`).x, eventById(map, `ev_${QUEST_KEY}_talk0`).y]).toEqual([
      AUTHORED.talk.x,
      AUTHORED.talk.y,
    ]);
    expect([eventById(map, `ev_${QUEST_KEY}_kill1`).x, eventById(map, `ev_${QUEST_KEY}_kill1`).y]).toEqual([
      AUTHORED.kill.x,
      AUTHORED.kill.y,
    ]);
    expect([eventById(map, `ev_${QUEST_KEY}_reach2`).x, eventById(map, `ev_${QUEST_KEY}_reach2`).y]).toEqual([
      AUTHORED.reach.x,
      AUTHORED.reach.y,
    ]);
    expect([eventById(map, `ev_${QUEST_KEY}_gate0`).x, eventById(map, `ev_${QUEST_KEY}_gate0`).y]).toEqual([
      AUTHORED.gate.x,
      AUTHORED.gate.y,
    ]);
    expect(result.warnings ?? []).toEqual([]);
  });

  it("컴파일 결과 경고가 옮긴 이벤트마다 원래 좌표와 최종 좌표를 알려준다", () => {
    const { project, map, mapId } = fixture();
    carveRiver(map, [7, 8, 9]);

    const result = compileQuest(project, questDef(project, mapId));

    const warnings = result.warnings ?? [];
    for (const authored of [AUTHORED.giver, AUTHORED.talk, AUTHORED.kill, AUTHORED.reach]) {
      const moved = warnings.find((warning) => warning.includes(`(${authored.x}, ${authored.y})`));
      expect(moved, `(${authored.x}, ${authored.y}) 경고 누락: ${warnings.join(" | ")}`).toBeTruthy();
      expect(moved).toContain("→");
    }
    // 컴파일 카운트는 정직하게 유지된다(대화 1 + 전투 1 + 도달 1 + 수집 1 + 기버 1 + 게이트 1).
    expect(result.eventsCreated).toBe(6);
  });
});
