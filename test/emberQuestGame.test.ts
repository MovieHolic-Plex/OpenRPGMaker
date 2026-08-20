// 《잿불의 유산》 완성 RPG 프로젝트의 무결성 검증 + 임포트용 JSON 산출.
import { describe, expect, it } from "vitest";
import type { Command, GameEvent, GameMap, Project } from "@/project/types";
import { computeReachableCells, isAdjacentOrOn } from "@/project/lint/reachability";
import { deserialize, resolveEventPage, serialize } from "@/project/io";
import { validateProjectReferences } from "@/project/io/references";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { createEmberQuestProject, EMBER_MAP, EMBER_SWITCH } from "@/project/defaults/emberQuestGame";

const NPC_EVENT_IDS = [
  "ev_ember_chief",
  "ev_ember_guard",
  "ev_ember_shop",
  "ev_ember_inn",
  "ev_ember_smith",
  "ev_ember_child",
  "ev_forest_herbalist",
  "ev_forest_hunter",
  "ev_mine_miner",
  "ev_mine_worker",
  "ev_pass_hermit",
  "ev_sanctum_keeper",
];

function allEvents(project: Project): GameEvent[] {
  return Object.values(project.maps).flatMap((map) => map.events);
}

function allCommands(project: Project): Command[] {
  const result: Command[] = [];
  const walk = (commands: readonly Command[]): void => {
    for (const command of commands) {
      result.push(command);
      if (command.kind === "choices") {
        for (const option of command.options) walk(option.branch);
        if (command.cancelBranch) walk(command.cancelBranch);
      } else if (command.kind === "fork") {
        walk(command.then);
        if (command.else) walk(command.else);
      } else if (command.kind === "loop") {
        walk(command.body);
      }
    }
  };
  for (const event of allEvents(project)) {
    walk(event.commands);
    for (const page of event.pages ?? []) walk(page.commands);
  }
  for (const commonEvent of project.commonEvents) walk(commonEvent.commands);
  return result;
}

describe("emberQuestGame", () => {
  const project = createEmberQuestProject();

  it("스펙 충족: 맵 5 / NPC 12 / 몬스터 5 / 아이템 8 / 퀘스트 3 / 주인공 1 / 전투 5", () => {
    expect(Object.keys(project.maps)).toHaveLength(5);
    const eventIds = new Set(allEvents(project).map((event) => event.id));
    for (const npcId of NPC_EVENT_IDS) expect(eventIds.has(npcId), npcId).toBe(true);
    expect(NPC_EVENT_IDS).toHaveLength(12);
    expect(project.database.enemies).toHaveLength(5);
    expect(project.database.items).toHaveLength(8);
    expect(project.database.actors).toHaveLength(1);
    expect(project.session.partyActorIds).toEqual(["actor_hero"]);
    const battles = allCommands(project).filter((command) => command.kind === "battleProcessing");
    expect(battles).toHaveLength(5);
    expect(new Set(battles.map((command) => command.kind === "battleProcessing" && command.troopId)).size).toBe(5);
    // 퀘스트 3개 = 시작/완료 스위치 쌍 3개.
    const names = new Map(project.switches.map((entry) => [entry.id, entry.name]));
    for (const id of [EMBER_SWITCH.q1Started, EMBER_SWITCH.q1Clear, EMBER_SWITCH.q2Started, EMBER_SWITCH.q2Done, EMBER_SWITCH.q3Started, EMBER_SWITCH.q3Done]) {
      expect(names.get(id), id).toBeTruthy();
    }
  });

  it("전투 5종이 몬스터 5종을 모두 사용한다", () => {
    const used = new Set<string>();
    for (const troop of project.database.troops) for (const enemyId of troop.enemyIds) used.add(enemyId);
    expect([...used].sort()).toEqual(project.database.enemies.map((enemy) => enemy.id).sort());
  });

  it("transfer 대상 맵/좌표가 유효하다", () => {
    for (const command of allCommands(project)) {
      if (command.kind !== "transfer") continue;
      const target = project.maps[command.mapId];
      expect(target, command.mapId).toBeTruthy();
      if (!target) continue;
      expect(command.x).toBeGreaterThan(0);
      expect(command.y).toBeGreaterThan(0);
      expect(command.x).toBeLessThan(target.width - 1);
      expect(command.y).toBeLessThan(target.height - 1);
    }
  });

  it("잿불 마을 동문은 Q1 시작 후 playerTouch 전이 페이지를 해석한다", () => {
    const gate = project.maps[EMBER_MAP.village].events.find((event) => event.id === "ev_ember_gate_a");
    expect(gate).toBeTruthy();
    if (!gate) return;

    const page = resolveEventPage(gate, {
      switches: { [EMBER_SWITCH.q1Started]: true },
      variables: {},
      inventory: {},
      partyActorIds: project.session.partyActorIds,
    });

    expect(page?.id).toBe("ev_ember_gate_a_open");
    expect(page?.commands).toEqual([
      { kind: "transfer", mapId: EMBER_MAP.forest, x: 2, y: 14, fade: "black" },
    ]);
  });

  // #19 재검증(2026-08-20): "playerTouch 성문 전이가 걸어 들어가도 발동 안 됨" 의심은 오탐.
  // 텔레포트({kind:"move", to})가 아니라 실제 한 칸 걷기({kind:"move", dir})로 밟기 경로를 고정한다.
  it("q1Started ON 상태에서 성문(30,12)으로 걸어 들어가면 안개 숲 (2,14)로 전이된다", () => {
    const result = runSceneTest(project, {
      mapId: EMBER_MAP.village,
      start: { x: 29, y: 12 },
      steps: [
        { kind: "set", switches: [EMBER_SWITCH.q1Started], manualHint: "Q1 시작 스위치 ON" },
        { kind: "move", dir: "right" },
      ],
    });
    expect(result.ok, result.failureReason).toBe(true);
    expect(result.log).toContain("event ev_ember_gate_a start");
    expect(result.session.currentMapId).toBe(EMBER_MAP.forest);
    expect(result.session.x).toBe(2);
    expect(result.session.y).toBe(14);
  });

  it("q1Started OFF 상태에서 성문을 밟으면 _closed 대사 페이지만 발화하고 마을에 남는다", () => {
    const result = runSceneTest(project, {
      mapId: EMBER_MAP.village,
      start: { x: 29, y: 12 },
      steps: [{ kind: "move", dir: "right" }],
    });
    expect(result.ok, result.failureReason).toBe(true);
    expect(result.log).toContain("event ev_ember_gate_a start");
    expect(result.session.currentMapId).toBe(EMBER_MAP.village);
    // 스위치 OFF 시 해석되는 페이지가 _closed(대사)임을 함께 고정한다.
    const gate = project.maps[EMBER_MAP.village]?.events.find((event) => event.id === "ev_ember_gate_a");
    expect(gate).toBeTruthy();
    if (!gate) return;
    const page = resolveEventPage(gate, result.session);
    expect(page?.id).toBe("ev_ember_gate_a_closed");
    expect(page?.commands.every((command) => command.kind === "text")).toBe(true);
  });

  it("모든 맵에서 시작/입장 지점으로부터 주요 이벤트에 도달할 수 있다", () => {
    // 이벤트를 무시한 타일 통행성 BFS(reachability 라이브러리 재사용).
    // 각 맵의 진입점에서 NPC/전투/출구가 인접 도달 가능해야 한다.
    const reachable = (map: GameMap, sx: number, sy: number): Set<string> => computeReachableCells(project, map, sx, sy);
    const adjacentOrOn = isAdjacentOrOn;

    const entries: Array<{ mapId: string; from: [number, number]; targets: string[] }> = [
      { mapId: EMBER_MAP.village, from: [16, 14], targets: ["ev_ember_chief", "ev_ember_guard", "ev_ember_shop", "ev_ember_inn", "ev_ember_smith", "ev_ember_child", "ev_ember_gate_a"] },
      { mapId: EMBER_MAP.forest, from: [2, 14], targets: ["ev_forest_herbalist", "ev_forest_hunter", "ev_forest_slime", "ev_forest_hornets", "ev_forest_herb_1", "ev_forest_herb_2", "ev_forest_herb_3", "ev_forest_mine_door", "ev_forest_return"] },
      { mapId: EMBER_MAP.mine, from: [13, 18], targets: ["ev_mine_miner", "ev_mine_worker", "ev_mine_bats", "ev_mine_golem", "ev_mine_back_exit", "ev_mine_return"] },
      { mapId: EMBER_MAP.pass, from: [2, 9], targets: ["ev_pass_hermit", "ev_pass_west", "ev_pass_east"] },
      { mapId: EMBER_MAP.sanctum, from: [10, 15], targets: ["ev_sanctum_keeper", "ev_sanctum_dragon", "ev_sanctum_return"] },
    ];
    for (const { mapId, from, targets } of entries) {
      const map = project.maps[mapId];
      expect(map, mapId).toBeTruthy();
      if (!map) continue;
      const seen = reachable(map, from[0], from[1]);
      for (const targetId of targets) {
        const event = map.events.find((entry) => entry.id === targetId);
        expect(event, `${mapId}:${targetId}`).toBeTruthy();
        if (!event) continue;
        expect(adjacentOrOn(seen, event.x, event.y), `${mapId}:${targetId} 도달 불가`).toBe(true);
      }
    }
  });

  it("직렬화 왕복과 참조 검증을 통과한다", () => {
    const restored = deserialize(serialize(project));
    validateProjectReferences(restored);
    expect(Object.keys(restored.maps)).toHaveLength(5);
    expect(restored.startMapId).toBe(EMBER_MAP.village);
  });

  it("임포트용 JSON 아티팩트를 생성한다", async () => {
    const moduleName = "node:fs";
    const fs = (await import(moduleName)) as {
      readonly mkdirSync: (path: URL, options: { recursive: boolean }) => void;
      readonly writeFileSync: (path: URL, data: string, encoding: string) => void;
    };
    fs.mkdirSync(new URL("../.playwright-mcp/", import.meta.url), { recursive: true });
    fs.writeFileSync(new URL("../.playwright-mcp/ember-quest.json", import.meta.url), serialize(project), "utf8");
  });
});
