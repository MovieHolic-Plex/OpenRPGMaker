import { describe, expect, it } from "vitest";
import { followArrowWalk, holdArrowWalk, type ArrowRead, type ArrowWorld, type Cell } from "../scripts/qa/assistant-v2/arrowFollowWalk.mts";
import { createBlankProject } from "@/project/defaults";
import { normalizeGameBlueprint, type GameBlueprint } from "@/project/gameBlueprint";
import { applyThemeBackdrop, themeBossTroop, themeFieldTroops } from "@/ai/v2/place/placeTheme";
import { fillBattleBackgrounds, fillEnemyHpLook } from "@/ai/v2/story/shipLookDefaults";
import { growStartPartyCurves } from "@/ai/v2/story/pathBattleTension";
import { isFieldBattleBackdrop, resolveBattleBackdrop } from "@/battle/battleBackdrop";
import { actorBattlers } from "@/battle/battleBattlers";
import { BATTLE_SCENERY_STILLS, unknownSceneryIdMessage } from "@/assets/battleSceneryCatalog";
import { chaserEvents, chaserMapsWithoutHiding } from "@/project/chaserHiding";
import { FIELD_BATTLE_BACKGROUND_ID } from "@/project/databaseEnemyTroopRecordModel";
import { addFitSkills, fitEnemyToStartParty, fitTroopCopy, fitWithinTarget } from "@/editor/tools/bossThreatScaling";
import { parseArtGap } from "@/project/artGap";
import { preloadCurrentMonsterArt } from "@/assets/currentMonsterArt";
import { enemyIdentityProblems } from "@/ai/v2/judge/enemyChecks";
import { fitPathBattlesIn, PATH_TROOP_PREFIX } from "@/ai/v2/story/pathBattleBudget";
import { fitUnwinnableStepBattlesIn } from "@/ai/v2/story/blueprintPathBattles";
import { SENSIBLE_POTION_HP_RATIO, simulateBattle } from "@/battle/simulate";
import type { EnemyRecord, GameEvent, Project, SkillRecord, GameMap } from "@/project/types";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { buildPuzzleChain, type ChainLink } from "@/ai/v2/story/puzzle";
import { carryBuilt, settleCarriedSteps } from "@/ai/v2/story/blueprintCarry";
import type { ToolContext } from "@/editor/tools/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { withTodoLoop } from "@/ai/v2/loop/todoTools";
import { callInText } from "@/ai/v2/loop/nextCall";
import { V2Session, repairCapOf, V2_MAX_REPAIR_ROUNDS } from "@/ai/v2/turn/session";
import { relookChangedPlaces } from "@/ai/v2/turn/relook";
import { v2GateProblems } from "@/ai/v2/judge/finishGate";
import { runTodoCheck } from "@/ai/v2/judge/todoChecks";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { syncGateItems } from "@/ai/v2/judge/gates";
import { turnLateTools } from "@/ai/v2/turn/lateTools";
import { createV2Turn } from "@/ai/v2/turn/turn";
import { TodoStore } from "@/ai/v2/loop/todoStore";
import { todoReport } from "@/ai/v2/judge/finalReport";
import type { PlaceSpec, BuildRun } from "@/ai/v2/shared/types";
import { cityInteriorSeed } from "@/ai/v2/place/builders/cityInteriorSeed";
import { MODERN_KR_BUILDER } from "@/ai/v2/place/builders/modernCity";
import { INTERIOR_BARE_FLOOR_LIMIT, measureInteriorBareFloor } from "@/editor/handInterior/bareFloor";
import { NEIGHBORHOOD_KONBINI } from "@/editor/handInterior/neighborhoodKonbini";
import { isPassable } from "@/project/collision";
import { computeReachableCells } from "@/project/lint/reachability";
import { combatProblems, healingSources, stepsPerEncounter, weakPaidSkills } from "@/ai/v2/judge/combatChecks";
import { withEncountersOnlyWhenAsked } from "@/ai/v2/game";
import type { PiToolShape } from "@/ai/piAgent/toolAdapter";
import { findingLine } from "@/ai/v2/judge/finding";
import { englishToolMessage } from "@/ai/v2/loop/failureText";
import { LOW_LEVEL_COMMAND_SHAPE_HINT } from "@/editor/tools/commandArgs";
import { slowChasers } from "../src/ai/v2/judge/storyFlowChecks";
import { runTool } from "@/editor/tools";
import { roomSpecOf } from "@/editor/handInterior/builder";
import { tilesetSurface } from "@/project/tilesetSurface";
import { reachableCells, unreachableEvents } from "@/ai/v2/judge/eventReach";
import { buildingEntrances, declaredDoorCells, declaredStairCells, isEntranceArt } from "@/ai/v2/place/entrances";
import { builderFor } from "@/ai/v2/place/builders";
import { objectAt } from "@/ai/v2/place/cells";
import { repairEventReach } from "@/ai/v2/place/reachRepairs";
import { WORLDS, worldPlaceSpec } from "@/ai/v2/place/world";
import { seatEntranceSteps } from "@/ai/v2/story/stepArt";
import { isDoorArtCell } from "@/project/staging/doorCells";
import { classifyDoorLabel, inferMapDoor } from "@/project/mapDoorKinds";
import { dayCounterVariables } from "@/ai/v2/judge/gameCheckReads";
import { DUNGEON_CARD, DUNGEON_KINDS, dungeonArgs, dungeonRole, pickDungeonKind } from "@/ai/v2/place/builders/dungeon";
import { DUNGEON_TYPES } from "@/editor/dungeonKit/types";
import { gameContentProblems } from "@/ai/v2/judge/gameChecks";
import { v2ExtraToolNames } from "@/ai/v2/request/readers";
import { isolateTimers } from "./mergedTeardown";

// 명세 은행 «화살표대로 걸어 못 닿음» 의 걷는 이(scripts/qa/assistant-v2/arrowFollowWalk.mts).
// 2026-11-15: 옛 자(화살표를 읽고 4칸씩 누르는 이)는 한 칸 폭 문간을 지나쳤다 되돌아오기를 120번 되풀이해 안내가 멀쩡한 자리를 못 닿음으로 셌다
// (은행 interior-tiers-merge 655/2850 → 701/2865, 「강지기의 집」 (18,7)→ (22,7)↖ (18,7)→ …). 칸마다 다시 읽는 이로 바꾸되 판정은 그대로 —
// 안내가 벽을 가리키거나 서로를 가리키면 여전히 못 닿는다.
describe("aiV2ArrowFollowWalk", () => {
  isolateTimers();
  const STEPS: Cell[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
  type Grid = { open(c: Cell): boolean; target: Cell; start: Cell; left(c: Cell): number; canStep(a: Cell, b: Cell): boolean };
  /** '#' 벽 · '.' 바닥 · 'S' 출발 · 'T' 대상(설 수 있는 칸). */
  function grid(rows: string[]): Grid {
    const h = rows.length, w = rows[0]!.length;
    const at = (ch: string): Cell => { const y = rows.findIndex((r) => r.includes(ch)); return { x: rows[y]!.indexOf(ch), y }; };
    const open = (c: Cell): boolean => c.x >= 0 && c.y >= 0 && c.x < w && c.y < h && rows[c.y]![c.x] !== "#";
    const target = at("T"), start = at("S");
    const dist = new Map<string, number>([[`${target.x},${target.y}`, 0]]);
    const queue = [target];
    for (let i = 0; i < queue.length; i++) for (const s of STEPS) {
      const n = { x: queue[i]!.x + s.x, y: queue[i]!.y + s.y };
      if (!open(n) || dist.has(`${n.x},${n.y}`)) continue;
      dist.set(`${n.x},${n.y}`, dist.get(`${queue[i]!.x},${queue[i]!.y}`)! + 1); queue.push(n);
    }
    return { open, target, start, left: (c) => dist.get(`${c.x},${c.y}`) ?? -1, canStep: (_a, b) => open(b) };
  }
  /** 제품 화살표의 꼴: 길의 다음 곧은 구간 끝 칸을 가리킨다(같은 방향으로 이어지는 동안 따라간다). */
  function legArrow(g: Grid): (c: Cell) => ArrowRead {
    return (c) => {
      let cur = c, dir: Cell | undefined;
      for (;;) {
        const d = g.left(cur);
        const next = (dir && g.left({ x: cur.x + dir.x, y: cur.y + dir.y }) === d - 1 ? [dir] : dir ? [] : STEPS).find((s) => g.open({ x: cur.x + s.x, y: cur.y + s.y }) && g.left({ x: cur.x + s.x, y: cur.y + s.y }) === d - 1);
        if (!next || d <= 1) break;
        dir = next; cur = { x: cur.x + next.x, y: cur.y + next.y };
      }
      return { visible: true, angle: Math.atan2(cur.y - c.y, cur.x - c.x), kind: "route" };
    };
  }
  /** 끊긴 안내의 꼴: 벽을 모르고 대상을 곧장 가리킨다. */
  const straightArrow = (g: Grid, visible: boolean) => (c: Cell): ArrowRead => ({ visible, angle: Math.atan2(g.target.y - c.y, g.target.x - c.x), kind: "straight" });
  const world = (g: Grid, arrowAt: (c: Cell) => ArrowRead): ArrowWorld => ({ canStep: g.canStep, arrowAt, left: g.left });
  // 문간(4,2)은 한 칸 폭. 출발에서 문간 아래까지 3칸 — 4칸씩 누르면 한 칸 지나친다.
  const DOORWAY = grid([
    "#########",
    "#..T....#",
    "####.####",
    "#S......#",
    "#########",
  ]);
  // 문이 반대쪽 끝(7,2)에 있다 — 대상을 곧장 가리키는 안내로는 벽 앞에서 맴돈다.
  const FAR_DOOR = grid([
    "#########",
    "#..T....#",
    "#######.#",
    "#S......#",
    "#########",
  ]);
  describe("arrow walk — the walker re-reads the arrow every cell", () => {
    it("the old 4-cell hold walker overshoots a one-cell doorway and never arrives, although the guidance is right", () => {
      const held = holdArrowWalk(world(DOORWAY, legArrow(DOORWAY)), DOORWAY.start, 4);
      expect(held.reached).toBe(false);
      expect(held.holds).toBe(120);
      expect(held.trace.slice(0, 4)).toEqual(["(1,3)→", "(5,3)←", "(1,3)→", "(5,3)←"]);
    });
    it("the per-cell walker turns at the doorway and arrives on the same guidance", () => {
      const walked = followArrowWalk(world(DOORWAY, legArrow(DOORWAY)), DOORWAY.start);
      expect(walked.reached).toBe(true);
      expect(walked.steps).toBe(5);
      expect(walked.trace).toEqual(["(1,3)→", "(2,3)→", "(3,3)→", "(4,3)↑", "(4,2)↑"]);
      expect(followArrowWalk(world(FAR_DOOR, legArrow(FAR_DOOR)), FAR_DOOR.start).reached).toBe(true);
    });
  });
  describe("arrow walk — the judgment is not loosened", () => {
    it("guidance that points through a wall stays unreached and is blamed on the guidance", () => {
      const walked = followArrowWalk(world(FAR_DOOR, straightArrow(FAR_DOOR, true)), FAR_DOOR.start);
      expect(walked.reached).toBe(false);
      expect(walked.end).toBe("맴돎");
      expect(walked.cause).toBe("안내 틀림");
      expect(walked.firstBad?.cell).toEqual({ x: 4, y: 3 }); // 벽 앞에서 왼쪽으로 되돌아선 칸
      expect(walked.left).toBeGreaterThan(1);
    });
    it("a hidden arrow (target on screen behind a wall) stays unreached and is counted apart", () => {
      const walked = followArrowWalk(world(FAR_DOOR, straightArrow(FAR_DOOR, false)), FAR_DOOR.start);
      expect(walked.reached).toBe(false);
      expect(walked.cause).toBe("화살표 없음");
    });
    it("an arrow into a dead end with no other way is a block", () => {
      const pocket = grid(["#####", "#T#S#", "#.#.#", "#...#", "#####"]);
      const up = (): ArrowRead => ({ visible: true, angle: -Math.PI / 2, kind: "route" });
      const walked = followArrowWalk(world(pocket, up), pocket.start);
      expect(walked.reached).toBe(false);
      expect(walked.end).toBe("막힘");
      expect(walked.cause).toBe("안내 틀림");
      expect(walked.steps).toBe(0);
    });
    it("a start with no way to the target is never counted as reached", () => {
      const sealed = grid(["#####", "#S#T#", "#####"]);
      const walked = followArrowWalk(world(sealed, straightArrow(sealed, true)), sealed.start);
      expect(walked.reached).toBe(false);
      expect(walked.end).toBe("길 없는 칸");
    });
    it("two cells whose arrows point at each other end as a loop, not as an endless walk", () => {
      const hall = grid(["#######", "#S...T#", "#######"]);
      const arrows = (c: Cell): ArrowRead => ({ visible: true, angle: c.x === 2 ? Math.PI : 0, kind: "route" });
      const walked = followArrowWalk(world(hall, arrows), hall.start);
      expect(walked.reached).toBe(false);
      expect(walked.end).toBe("맴돎");
      expect(walked.cause).toBe("안내 틀림");
      expect(walked.steps).toBe(2);
    });
    it("back on a cell with a diagonal arrow the walker tries the other axis once — and only once", () => {
      // (1,1)↘: 기운 축(→)으로 갔다가 (2,1)← 에 밀려 돌아온다. 다른 축(↓)을 눌러 내려가 닿는다.
      const room = grid(["####", "#S.#", "#.##", "#.##", "#T##", "####"]);
      const arrows = (c: Cell): ArrowRead => ({ visible: true, angle: c.x === 2 ? Math.PI : c.y === 1 ? Math.PI / 4 : Math.PI / 2, kind: "route" });
      const walked = followArrowWalk(world(room, arrows), room.start);
      expect(walked.reached).toBe(true);
      expect(walked.swaps).toBe(1);
      // 아래가 벽이면 한 번 바꿔 눌러 보고 끝난다. 처음 어긋난 칸은 되돌려 보낸 (2,1)← — 안내 틀림.
      const shut = grid(["#####", "#S..#", "###.#", "#T..#", "#####"]);
      const stuck = followArrowWalk(world(shut, arrows), shut.start);
      expect(stuck.reached).toBe(false);
      expect(stuck.end).toBe("막힘");
      expect(stuck.cause).toBe("안내 틀림");
      expect(stuck.firstBad?.cell).toEqual({ x: 2, y: 1 });
      expect(stuck.swaps).toBe(0);
    });
  });
});

describe("aiV2BattleFitsPlace", () => {
  isolateTimers();
  // 2026-11-12 오너가 해 본 판(r1s-fun «증기의 심장»): 공장 거리 전투가 햇살 풀밭에서, 보일러실·기관실 전투가 동굴에서 벌어졌다.
  // 길 적은 두 대에 쓰러지며 한 번도 못 쳤고, 레벨이 올라도 최대 HP 가 514 그대로였고, 불의 정령이 «산성 침» 을 썼고, 적 체력이 안 보였고,
  // 순찰 적은 주인공 바로 옆을 스쳐 지나갔다. 문서 openwiki/assistant-v2.md 「전투가 장소·파티에 맞는다」. 재는 법(모델 없음): scripts/qa/assistant-v2/battleFitProbe.mts.

  function world(setting: string, tilesetId: string, places: { name: string; kind: string }[]): { project: Project; mapId: string } {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    map.tilesetId = tilesetId;
    map.name = places[0]!.name;
    project.gameBlueprint = normalizeGameBlueprint({ title: "t", genre: "모험", setting, playerGoal: "g", ending: { name: "끝", how: "끝", feeling: "f" }, places,
      steps: [{ id: "s1", place: map.name, event: "x", action: "a", gives: "가", feeling: "f" }, { id: "s2", place: map.name, event: "y", action: "b", needs: "가", gives: "엔딩", feeling: "f" }] });
    return { project, mapId: map.id };
  }
  const backdropAt = (project: Project, mapId: string, name: string): { id: string | undefined; gap: ReturnType<typeof parseArtGap> } => {
    const map = project.maps[mapId]!;
    map.name = name;
    delete (map as { battleBackground?: string }).battleBackground;
    const res = applyThemeBackdrop(project, mapId);
    return { id: map.battleBackground, gap: res.gap ? parseArtGap(res.gap) : undefined };
  };
  describe("전투 배경은 그 장소의 것이다", () => {
    it("증기 도시의 거리·보일러실·기관실은 그 장소 그림, 그림이 없는 여관은 그 맵 그대로(없는 그림 줄)", () => {
      const { project, mapId } = world("steampunk_city", "steampunk_city", [
        { name: "굴뚝 공업지구", kind: "industrial" }, { name: "보일러실", kind: "boiler-room" }, { name: "기관실", kind: "engine-room" }, { name: "여관", kind: "inn" }]);
      expect(backdropAt(project, mapId, "굴뚝 공업지구")).toEqual({ id: "battle-scenery-brick-street", gap: undefined });
      expect(backdropAt(project, mapId, "보일러실")).toEqual({ id: "battle-scenery-boiler-room", gap: undefined });
      expect(backdropAt(project, mapId, "기관실")).toEqual({ id: "battle-scenery-boiler-room", gap: undefined });
      const inn = backdropAt(project, mapId, "여관");
      expect(inn.id).toBe(FIELD_BATTLE_BACKGROUND_ID);
      expect(inn.gap).toMatchObject({ theme: "steampunk_city/inn", want: "backdrop", standIn: FIELD_BATTLE_BACKGROUND_ID });
    });

    it("세계 표가 가리키는 장소 그림은 모두 번들에 실려 있다(지어낸 id 가 아니다)", () => {
      const stills = new Set(BATTLE_SCENERY_STILLS.map((still) => still.resourceId));
      for (const key of ["tomb", "boiler-room", "brick-street", "ice-cave", "beach", "cloud-sea", "swamp", "volcano", "edo-town", "station", "sky-shrine", "shipwreck"]) {
        expect(stills.has(`battle-scenery-${key}`)).toBe(true);
      }
      expect(unknownSceneryIdMessage(FIELD_BATTLE_BACKGROUND_ID)).toBeUndefined();
    });

    it("세계 표 밖의 맵은 같은 종류라고 말할 수 있을 때만 겹 배경, 아니면 그 맵 그대로 — 실내가 동굴이, 도시가 풀밭이 되지 않는다", () => {
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      const fill = (name: string, tilesetId: string): string | undefined => {
        map.name = name;
        map.tilesetId = tilesetId;
        delete (map as { battleBackground?: string }).battleBackground;
        fillBattleBackgrounds(project, map.id);
        return map.battleBackground;
      };
      expect(fill("이름 없는 방", "atlas_biome_interior")).toBe(FIELD_BATTLE_BACKGROUND_ID);
      expect(fill("중앙 광장 거리", "modern3")).toBe(FIELD_BATTLE_BACKGROUND_ID);
      expect(fill("어두운 숲길", "beodeul_city")).toBe("battle-scenery-forest");
      expect(fill("들판", "beodeul_city")).toBe("battle-scenery-plains");
    });

    it("«그 맵 그대로» 표시는 런타임이 그대로 고른다 — 겹 배경으로 바꾸지 않는다", () => {
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      map.battleBackground = FIELD_BATTLE_BACKGROUND_ID;
      const troopId = project.database.troops[0]!.id;
      const id = resolveBattleBackdrop({ project, troopId, location: { mapId: map.id, x: 1, y: 1 } });
      expect(id).toBe(FIELD_BATTLE_BACKGROUND_ID);
      expect(isFieldBattleBackdrop(id)).toBe(true);
      expect(isFieldBattleBackdrop("battle-scenery-cave")).toBe(false);
    });
  });
  describe("전투가 파티에 맞는다", () => {
    it("레벨이 오르면 능력치가 오른다 — 시작 파티 곡선의 바닥(되풀이 안전)", () => {
      const project = createBlankProject() as Project;
      const ids = project.system.startActorIds!;
      const hpAt = (level: number) => actorBattlers(project, { levels: { [ids[0]!]: level }, partyActorIds: [ids[0]!] })[0]!.maxHp;
      const flat = [hpAt(1), hpAt(2)];
      expect(growStartPartyCurves(project, ids).length).toBeGreaterThan(0);
      expect(hpAt(2)).toBeGreaterThan(flat[0]!);
      expect(hpAt(2)).toBeGreaterThanOrEqual(Math.round(flat[0]! * 1.06));
      expect(hpAt(5)).toBeGreaterThan(hpAt(4));
      expect(hpAt(1)).toBe(flat[0]);
      expect(growStartPartyCurves(project, ids)).toEqual([]);
    });

    it("너무 센 기술은 다른 생물의 기술로 바꾸지 않고 그 적 자신의 기술을 약하게 한 사본으로 쓴다", () => {
      const project = createBlankProject() as Project;
      const source = project.database.skills.find((skill) => skill.effect?.kind === "damage" && skill.effect.affects === "hp" && !skill.damageFormula && skill.scope === "enemy")!;
      const own: SkillRecord = { ...structuredClone(source), id: "skill_ember_burst", name: "불꽃 터뜨리기", power: 400 };
      project.database.skills.push(own);
      const base = project.database.enemies[0]!;
      const enemy: EnemyRecord = { ...structuredClone(base), id: "enemy_spirit_test", name: "불의 정령", actions: [{ ...(base.actions?.[0] ?? { rating: 5 }), skillId: own.id }] } as EnemyRecord;
      project.database.enemies.push(enemy);
      const fit = fitEnemyToStartParty(project, enemy, "field")!;
      expect(fit).toBeDefined();
      addFitSkills(project, fit);
      const used = (fit.actions ?? []).map((action) => project.database.skills.find((skill) => skill.id === action.skillId)!);
      expect(used.length).toBeGreaterThan(0);
      for (const skill of used) {
        expect(skill.name).toBe("불꽃 터뜨리기");
        expect(skill.id.startsWith("skill_fit_field_")).toBe(true);
        expect(skill.power).toBeLessThan(400);
      }
      // 원래 기술은 그대로다(다른 적·영웅에 번지지 않는다).
      expect(project.database.skills.find((skill) => skill.id === own.id)!.power).toBe(400);
    });

    it("도트 측면 전투가 있으면 적 이름표·체력 막대를 켠다 — 저작자가 고른 칸은 그대로", () => {
      const project = createBlankProject() as Project;
      expect(fillEnemyHpLook(project)).toEqual([]);
      const map = project.maps[project.startMapId]!;
      map.events.push({ id: "ev_foe", name: "", x: 3, y: 3, pages: [{ conditions: [], trigger: { kind: "eventTouch" }, commands: [{ kind: "battleProcessing", troopId: project.database.troops[0]!.id }] }] } as never);
      expect(fillEnemyHpLook(project)).toHaveLength(1);
      expect(project.system.battleLook).toMatchObject({ enemyHp: true, enemyNames: true });
      expect(fillEnemyHpLook(project)).toEqual([]);
      const chosen = createBlankProject() as Project;
      chosen.maps[chosen.startMapId]!.events.push(structuredClone(map.events.at(-1)!));
      chosen.system.battleLook = { enemyHp: false, enemyNames: false };
      expect(fillEnemyHpLook(chosen)).toEqual([]);
      expect(chosen.system.battleLook).toEqual({ enemyHp: false, enemyNames: false });
    });

    it("주인공을 알아채고 다가와 싸움을 거는 보이는 적은 «숨어서 피할 추격자» 가 아니다", () => {
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      const chasePage = (commands: unknown[]) => ({ id: "p", name: "p", conditions: [], trigger: { kind: "eventTouch" }, movement: { type: "chase", speed: 3, frequency: 3, sightRange: 3 }, commands });
      const foe = { id: "ev_foe", name: "", x: 3, y: 3, pages: [chasePage([{ kind: "battleProcessing", troopId: project.database.troops[0]!.id, canEscape: true, canLose: false }])] } as unknown as GameEvent;
      const stalker = { id: "ev_stalker", name: "", x: 5, y: 5, pages: [chasePage([{ kind: "gameOver" }])] } as unknown as GameEvent;
      const punisher = { id: "ev_punisher", name: "", x: 7, y: 7, pages: [chasePage([{ kind: "battleProcessing", troopId: project.database.troops[0]!.id, canEscape: false, canLose: true }])] } as unknown as GameEvent;
      map.events = [foe];
      expect(chaserEvents(map)).toEqual([]);
      expect(chaserMapsWithoutHiding(project)).toEqual([]);
      map.events = [foe, stalker, punisher];
      expect(chaserEvents(map).map((ev) => ev.id)).toEqual(["ev_stalker", "ev_punisher"]);
    });
  });
  // 2026-11-13 둘째 교정: 보스는 «쉬고 온 풀 HP» 의 기준 파티(곧장 온 판 — 도착 레벨의 낮은 쪽)와 여느 플레이(기술·공격, HP 45% 아래에서 약)로 맞춘다 — 여기서는 Lv1~2 의 Lv1.
  describe("보스는 «공격» 만으로는 못 이긴다", () => {
    it("길 위 전투 수 + 보스전 몫의 회복약을 들고 시작하고, 보스 사본은 약·기술로는 이기고 공격만으로는 진다 — 다시 돌려도 그대로", () => {
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      const boss = fitTroopCopy(project, "troop_slime", "boss")!;
      const page = (troopId: string, canEscape: boolean, kind: string) => ({ id: "p0", name: "p0", conditions: [], trigger: { kind }, commands: [{ kind: "battleProcessing", troopId, canEscape, canLose: false }] });
      map.events = [...(map.events ?? []),
        { id: "ev_foe", name: "", x: 3, y: 3, trigger: { kind: "eventTouch" }, pages: [page("troop_slime", true, "eventTouch")] },
        { id: "ev_boss", name: "문지기", x: 6, y: 3, trigger: { kind: "action" }, pages: [page(boss, false, "action")] }] as never;
      project.gameBlueprint = { request: "게임", title: "t", genre: "g", premise: "p", playerGoal: "g", ending: { name: "끝", how: "z", feeling: "w" },
        steps: [{ id: "s1", place: map.name ?? map.id, event: "ev_foe", label: "l" }, { id: "s2", place: map.name ?? map.id, event: "문지기", label: "l" }] } as never;
      const ids = project.system.startActorIds!;
      const notes = fitPathBattlesIn(project);
      expect(notes.some((line) => line.includes("보스전 2"))).toBe(true);
      const bossTroop = () => ((map.events.find((e) => e.id === "ev_boss")!.pages![0]!.commands![0]) as unknown as { troopId: string }).troopId;
      const troopId = bossTroop();
      expect(troopId.startsWith(PATH_TROOP_PREFIX)).toBe(true);
      const potion = Object.keys(project.session.inventory ?? {}).find((id) => (project.session.inventory?.[id] ?? 0) >= 3)!;
      expect(potion).toBeDefined();
      const attackOnly = simulateBattle({ project, troopId, heroLevel: 1, partyActorIds: ids, n: 24, seed: 11 });
      const sensible = simulateBattle({ project, troopId, heroLevel: 1, partyActorIds: ids, n: 24, seed: 11, useSkills: true, potionHpRatio: SENSIBLE_POTION_HP_RATIO, inventory: { [potion]: project.session.inventory![potion]! }, potionItemId: potion });
      expect(attackOnly.winRate).toBeLessThanOrEqual(0.15);
      expect(sensible.winRate).toBeGreaterThanOrEqual(0.95);
      expect(sensible.avgPotionsUsed).toBeGreaterThan(1);
      // 다시 돌려도 보스는 더 오르지 않고, «못 이기는 전투 맞추기» 가 맨몸으로 다시 재 사본을 또 만들지 않는다.
      const stats = JSON.stringify(project.database.enemies.map((e) => [e.id, e.stats]));
      expect(fitPathBattlesIn(project).filter((line) => line.includes("(보스)"))).toEqual([]);
      expect(fitUnwinnableStepBattlesIn(project)).toEqual([]);
      expect(bossTroop()).toBe(troopId);
      expect(JSON.stringify(project.database.enemies.map((e) => [e.id, e.stats]))).toBe(stats);
    }, 180_000);
  });
  // 2026-11-13 명세 은행 전/후(49게임): 길 적을 평타 세 대로 올리자 던전 빌더의 무리(동굴 박쥐 둘)가 한 판 52% 를 깎아 «전투 세기» 관문이 섰고,
  // 제 기술을 든 길 적이 같은 종의 단계 상대와 기술이 같아 «적 개성» 관문이 섰다. 둘 다 고르는 곳·맞추는 곳에서 막는다.
  describe("길 적은 관문이 재는 값 안에서 선다", () => {
    it("혼자 선 적도 무리도 한 판 손실이 8~15% 안이다 — 한 맵의 적 셋을 이어 싸워도 예산(60%)을 넘지 않는다", () => {
      const project = createBlankProject() as Project;
      for (const [id, count] of [["enemy_hound_hell", 1], ["enemy_bat_cave", 1], ["enemy_bat_cave", 2], ["enemy_snake_viper", 1], ["enemy_goblin_scout", 2]] as const) {
        const enemy = project.database.enemies.find((e) => e.id === id)!;
        const fit = fitEnemyToStartParty(project, enemy, "field", count)!;
        expect(fitWithinTarget(fit, "field"), `${id}×${count} 손실 ${fit.loss}`).toBe(true);
        expect(fit.winRate).toBe(1);
        expect(fit.loss).toBeLessThanOrEqual(0.15);
      }
    }, 180_000);

    it("그 맵의 단계 상대와 같은 종은 길 적으로 서지 않는다 — «적 개성» 검사가 서지 않는다", async () => {
      await preloadCurrentMonsterArt();
      const { project, mapId } = world("prehistoric", "prehistoric", [{ name: "갈대 늪", kind: "swamp" }]);
      const map = project.maps[mapId]!;
      const names = (ids: readonly string[]) => ids.map((id) => project.database.troops.find((t) => t.id === id)?.name);
      expect(names(themeFieldTroops(project, mapId).troopIds)).toContain("송곳니 멧돼지");
      const boss = themeBossTroop(project, mapId, "늪의 송곳니", false, 0).troopId!;
      expect(project.database.troops.find((t) => t.id === boss)?.name).toBe("송곳니 멧돼지");
      map.events.push({ id: "ev_step", name: "늪의 송곳니", x: 4, y: 4, pages: [{ conditions: [], trigger: { kind: "action" }, commands: [{ kind: "battleProcessing", troopId: boss, canEscape: false, canLose: false }] }] } as never);
      const field = themeFieldTroops(project, mapId).troopIds;
      expect(names(field)).not.toContain("송곳니 멧돼지");
      expect(field.length).toBeGreaterThanOrEqual(2);
      field.forEach((troopId, n) => map.events.push({ id: `ev_${mapId}_wfoe${n + 1}`, name: "", x: 6 + n, y: 6, pages: [{ conditions: [], trigger: { kind: "eventTouch" }, commands: [{ kind: "battleProcessing", troopId, canEscape: true, canLose: false }] }] } as never));
      expect(enemyIdentityProblems(project)).toEqual([]);
    }, 180_000);
  });
});

describe("aiV2BlueprintCarry", () => {
  isolateTimers();
  // 2026-11-12 Terra 측정 r1(저장된 판 13개 중 6개): 모델이 청사진을 다시 쓰면(단계 수·장소는 그대로, 사람 이름만 바뀜) 경로 빌더가 새 사람을 세우고
  // 앞 경로의 사람은 남았다 — 이야기 줄이 두 벌이 되고, 문·길은 앞 사람의 스위치를 기다렸다.
  // 이제 단계가 지어 둔 것(built)을 새 청사진의 같은 단계가 물려받는다. 재는 법(모델 없음): 탐침 carry.mts 와 같은 호출 · 명세 은행의 r1-fun 재생.
  // 문서 openwiki/assistant-v2.md 「청사진을 다시 쓰면 지어 둔 것을 물려받는다」.

  const CHAIN = "달샘과 잠든 태양";
  const blueprint = (place: string, names: readonly string[], gives: readonly string[]): GameBlueprint => normalizeGameBlueprint({
    title: CHAIN, genre: "모험", playerGoal: "샘을 되살리자.", ending: { name: CHAIN, how: "물이 돌아왔다.", feeling: "안도" },
    steps: names.map((name, i) => ({ id: `s${i + 1}`, kind: "talk", who: name, place, event: name, action: `${name}에게 말을 건다`, ...(i ? { needs: gives[i - 1] } : {}), gives: gives[i], feeling: "설렘" })),
  });
  /** 네 단계 경로를 지어 둔 프로젝트: 나디아(깃발) → 자히르(깃발, 잠김 글이 나디아를 부른다) → 라일라(물건) → 수호자(엔딩). */
  function built() {
    const project = createBlankProject();
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const build = (links: ChainLink[]) => buildPuzzleChain(createBuildRun(ctx), { mapId: ctx.project.startMapId, name: CHAIN, links });
    const first = build([
      { role: "pickup", name: "나디아", person: "마을 사람", at: { x: 3, y: 3 }, lines: ["샘지기를 찾아가 보렴."], reward: { flag: "샘의 부탁" } },
      { role: "pickup", name: "자히르", person: "상인", at: { x: 6, y: 3 }, lines: ["찻집으로 가 봐."], needs: "샘의 부탁", lockedLines: ["먼저 「나디아」에게 말을 걸어 보자.", "「나디아」를 찾자."], reward: { flag: "상인의 단서" } },
      { role: "pickup", name: "라일라", person: "찻집 주인", at: { x: 9, y: 3 }, lines: ["약속할게요."], needs: "상인의 단서", reward: { item: "라일라의 약속" } },
      { role: "ending", name: "수호자", at: { x: 12, y: 3 }, lines: ["끝."], needs: "라일라의 약속" },
    ]);
    expect(first.ok).toBe(true);
    const place = ctx.project.maps[ctx.project.startMapId]!.name || ctx.project.startMapId;
    const prior = blueprint(place, ["나디아", "자히르", "라일라", "수호자"], ["샘의 부탁", "상인의 단서", "라일라의 약속", "엔딩"]);
    prior.steps.forEach((step, i) => { step.built = { mapId: first.eventIds![i]!.mapId, eventId: first.eventIds![i]!.eventId, ...(first.gives?.[i] ?? {}) }; });
    const events = (): GameEvent[] => ctx.project.maps[ctx.project.startMapId]!.events;
    return { ctx, build, prior, place, events };
  }
  const setSwitches = (ev: GameEvent | undefined): string[] => [...new Set([...JSON.stringify(ev?.pages ?? []).matchAll(/"kind":"setSwitch","switchId":"([^"]+)"/gu)].map((hit) => hit[1]!))];
  describe("사슬 빌더는 고리마다 넘기는 것을 알려 준다", () => {
    it("깃발을 주는 고리는 스위치, 물건을 주는 고리는 물건 id, 엔딩 고리는 없음", () => {
      const { prior } = built();
      expect(prior.steps.map((s) => Object.keys(s.built ?? {}).sort().join(","))).toEqual(["eventId,mapId,switchId", "eventId,mapId,switchId", "eventId,itemId,mapId", "eventId,mapId"]);
    });
  });
  describe("carryBuilt — 새 청사진의 단계가 앞 단계의 지어 둔 것을 물려받는다", () => {
    it("이름만 바꾼 단계는 같은 자리(id)의 것을, 순서가 당겨진 단계는 같은 이름의 것을 받고, 받을 단계가 없는 것은 retired 로 간다", () => {
      const { prior, place } = built();
      const next = carryBuilt(prior, blueprint(place, ["샘지기 아말", "라일라", "수호자"], ["샘의 위기", "라일라의 약속", "엔딩"]));
      expect(next.steps.map((s) => s.built?.eventId)).toEqual([prior.steps[0]!.built!.eventId, prior.steps[2]!.built!.eventId, prior.steps[3]!.built!.eventId]);
      expect(next.steps[0]!.built!.switchId).toBe(prior.steps[0]!.built!.switchId);
      expect(next.retired).toEqual([prior.steps[1]!.built]);
    });

    it("모델이 보낸 built · retired 는 버린다 — 앞 청사진이 없으면 아무것도 물려받지 않는다", () => {
      const { place } = built();
      const forged = blueprint(place, ["가", "나"], ["하나", "엔딩"]);
      forged.steps[0]!.built = { mapId: "map_x", eventId: "ev_x", switchId: "sw_x" };
      forged.retired = [{ mapId: "map_x", eventId: "ev_y" }];
      const next = carryBuilt(undefined, forged);
      expect(next.steps.some((s) => s.built)).toBe(false);
      expect(next.retired).toBeUndefined();
    });

    it("같은 내용을 다시 쓰면 built 까지 같다(「이미 같은 내용」 판정이 그대로 선다)", () => {
      const { prior, place } = built();
      const again = carryBuilt(prior, blueprint(place, ["나디아", "자히르", "라일라", "수호자"], ["샘의 부탁", "상인의 단서", "라일라의 약속", "엔딩"]));
      expect(JSON.stringify(again.steps)).toBe(JSON.stringify(prior.steps));
      expect(again.retired).toBeUndefined();
    });
  });
  describe("settleCarriedSteps — 경로를 짓기 직전에 물려받은 것을 새 청사진에 맞춘다", () => {
    it("이름을 바꾼 단계: 같은 이벤트가 새 이름이 되고(사람이 늘지 않는다) 그 이름을 부르던 글도 새 이름으로, 빠진 단계의 이벤트는 걷고 그 스위치를 기다리던 조건을 푼다", () => {
      const { ctx, prior, place, events } = built();
      // 자히르(빠질 단계)의 스위치로 잠긴 문 하나.
      const gone = prior.steps[1]!.built!;
      const door = { id: "ev_door", name: "찻집 문", x: 1, y: 1, pages: [{ conditions: [], commands: [{ kind: "text", body: "닫혀 있다." }] }, { conditions: [{ kind: "switch", switchId: gone.switchId, value: true }], commands: [{ kind: "text", body: "열렸다." }] }] } as unknown as GameEvent;
      ctx.project.maps[ctx.project.startMapId]!.events.push(door);
      ctx.project.gameBlueprint = carryBuilt(prior, blueprint(place, ["샘지기 아말", "라일라", "수호자"], ["샘의 위기", "라일라의 약속", "엔딩"]));
      const settled = settleCarriedSteps(ctx.project);
      expect([...settled.renamed]).toEqual([prior.steps[0]!.built!.eventId]);
      expect(events().map((e) => (e as { name?: string }).name)).toEqual(["샘지기 아말", "라일라", "수호자", "찻집 문"]);
      expect((events().find((e) => e.id === "ev_door")!.pages ?? []).map((p) => (p.conditions ?? []).length)).toEqual([0, 0]);
      expect(ctx.project.gameBlueprint!.retired).toBeUndefined();
      // 다시 불러도 같다.
      expect([...settleCarriedSteps(ctx.project).renamed]).toEqual([]);
      expect(events()).toHaveLength(4);
    });

    it("「옛 이름」을 부르던 잠김 글은 새 이름으로 — 조사는 새 이름의 받침에 맞춘다", () => {
      const { ctx, prior, place, events } = built();
      ctx.project.gameBlueprint = carryBuilt(prior, blueprint(place, ["샘지기 아말", "자히르", "라일라", "수호자"], ["샘의 위기", "상인의 단서", "라일라의 약속", "엔딩"]));
      settleCarriedSteps(ctx.project);
      const text = JSON.stringify(events().find((e) => (e as { name?: string }).name === "자히르")!.pages);
      expect(text).toContain("먼저 「샘지기 아말」에게 말을 걸어 보자.");
      expect(text).toContain("「샘지기 아말」을 찾자.");
      expect(text).not.toContain("나디아");
    });

    it("다시 지으면 같은 이벤트가 전에 켜던 스위치를 그대로 켠다 — 깃발 이름이 바뀌어도", () => {
      const { ctx, build, prior, place, events } = built();
      ctx.project.gameBlueprint = carryBuilt(prior, blueprint(place, ["샘지기 아말", "자히르", "라일라", "수호자"], ["샘의 위기", "상인의 단서", "라일라의 약속", "엔딩"]));
      settleCarriedSteps(ctx.project);
      const s1 = ctx.project.gameBlueprint.steps[0]!;
      const again = build([{ role: "pickup", eventId: s1.built!.eventId, person: "샘지기", relook: true, lines: ["샘이 말라 가요."], reward: { flag: "샘의 위기", switchId: s1.built!.switchId } }]);
      expect(again.ok).toBe(true);
      expect(again.gives).toEqual([{ switchId: prior.steps[0]!.built!.switchId }]);
      expect(setSwitches(events().find((e) => e.id === s1.built!.eventId))).toContain(prior.steps[0]!.built!.switchId);
      expect(events()).toHaveLength(4);
    });

    it("모델·사람이 지은 이벤트(ev_chain_ 이 아닌 것)는 이름을 바꾸지도 걷지도 않는다", () => {
      const { ctx, prior, place, events } = built();
      const map = ctx.project.maps[ctx.project.startMapId]!;
      map.events = map.events.map((e) => (e.id === prior.steps[0]!.built!.eventId ? { ...e, id: "ev_hand_nadia" } : e));
      prior.steps[0]!.built = { ...prior.steps[0]!.built!, eventId: "ev_hand_nadia" };
      ctx.project.gameBlueprint = carryBuilt(prior, blueprint(place, ["샘지기 아말", "라일라", "수호자"], ["샘의 위기", "라일라의 약속", "엔딩"]));
      const settled = settleCarriedSteps(ctx.project);
      expect([...settled.renamed]).toEqual([]);
      expect(events().find((e) => e.id === "ev_hand_nadia")).toBeTruthy();
      expect((events().find((e) => e.id === "ev_hand_nadia") as { name?: string }).name).toBe("나디아");
    });
  });
});

// 풀 칩셋 마을 뒤의 실내 · 비평가가 본 그림 — 2026-11-12 map-vqa 깔기 24요청을 실제 입력창으로 다시 돌린 판(Terra high)에서 본 것:
//  - village-chief-house: «촌장 집»이 해적 군도 오두막으로 서긴 했지만 마을과 이어지지 않았고(결과 글은 «create_transfer_pair 로 이어라» — 그 요청의 도구 목록에 없던 동사),
//    모델이 그 방에 걸어 둔 칸 배치·자기 검토·방 그래프 항목은 아무도 할 수 없어 할 일 여덟이 막힘으로 끝났다. edit_place 거절 한 번이 다른 항목 다섯의 막힘을 되돌렸다.
//  - village: 비평가가 «우물이 안 보인다» 고 한 뒤 모델이 우물을 stamp_object 로 놓았는데, 끝맺음 관문은 짓기 때의 비평을 다시 읽어 같은 항목을 두 번 더 열었다.
//  - 미완료 18요청 중 11요청: 관문 항목이 «고치는 도구(set_field_hud)가 이 실행의 도구 목록에 없다» 로 막혔다 — 그 요청의 묶음에 없을 뿐 조수 v2 에는 있는 도구다.
//  - weapon-shop: 자기 검토 두 바퀴가 고치기 상한 3을 먹어, 비평 항목이 한 번 고친 뒤 «상한»으로 막혔다(도구는 «남은 바퀴 9» 라고 했다).
describe("aiV2BuilderCover", () => {
  isolateTimers();
  const SLOW = 120_000;
  /** 맵 타일이 바뀌면 글자가 바뀌는 가짜 1배 그림(PNG 머리 24바이트 + 맵 지문). */
  function fakePicture(map: { width: number; height: number; lowerTiles?: unknown; upperTiles?: unknown; events?: unknown }): string {
    const head = Buffer.alloc(24);
    head.writeUInt32BE(map.width * 16, 16); head.writeUInt32BE(map.height * 16, 20);
    let h = 0;
    for (const ch of JSON.stringify([map.lowerTiles, map.upperTiles, map.events])) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `data:image/png;base64,${head.toString("base64")}${Buffer.from(String(h)).toString("base64")}`;
  }
  function turn(task: string, critic: (calls: number) => unknown = () => ({ imagesSeen: 1, score: 7, majors: [] }), projectKey?: string) {
    const project = createBlankProject();
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    let criticCalls = 0;
    const env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project, ...(projectKey ? { projectKey } : {}) } as never, emit: () => {}, record: () => {}, checkpoint: async () => {},
      sideChat: async () => JSON.stringify(critic(++criticCalls)),
      render: async (mapId: string) => fakePicture(ctx.project.maps[mapId]!),
      preferToolNextTurn: () => {}, clearToolPreference: () => {} } as unknown as PiAssistantV2Env;
    const session = new V2Session();
    const tools = withTodoLoop(env, session.todo, session.loop, createV2Tools(env, session), session.hooks);
    const call = async (name: string, args: unknown): Promise<{ ok: boolean; body: string }> => {
      const body = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args)
        .then((r) => (r.content as { type: string; text?: string }[]).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n"), (e: Error) => JSON.stringify({ ok: false, summary: e.message }));
      let ok = !/^Rejected:/u.test(body);
      try { const j = JSON.parse(body.split("\n")[0]!) as { ok?: boolean; notFailure?: boolean }; ok = j.ok !== false || j.notFailure === true; } catch { /* 거절 글은 JSON 이 아니다 */ }
      return { ok, body };
    };
    return { ctx, env, session, call, criticCalls: () => criticCalls };
  }
  const goes = (project: ToolContext["project"], from: string, to: string) => JSON.stringify(project.maps[from]?.events ?? []).includes(`"mapId":"${to}"`);
  describe("풀 칩셋 마을 뒤의 실내는 make_place 가 집 문에 잇고, 그 방의 방 검사는 빌더가 덮는다", () => {
    it("해적 군도 마을 뒤의 «촌장 집»: 양쪽으로 이어지고 칸 배치·자기 검토·방 그래프 항목이 닫힌다", async () => {
      const t = turn("작은 마을이랑 촌장 집 안을 만들어 줘.");
      const room = (kind: string) => ({ kind, map: "촌장 집", fresh: true });
      await t.call("todo", { op: "init", list: [{ phase: "장소", items: [
        { content: "마을 만들기", id: "v", check: { kind: "place", name: "새벽 마을", placeKind: "village", fresh: true } },
        { content: "촌장 집 만들기", id: "house", check: { kind: "place", name: "촌장 집", placeKind: "interior", fresh: true } },
        { content: "촌장 집 배치", id: "layout", check: room("layout_built") }, { content: "촌장 집 검토", id: "review", check: room("layout_review") }, { content: "촌장 집 방 구조", id: "graph", check: room("room_graph") },
        { content: "마을에서 집으로", id: "in", check: { kind: "link", from: "새벽 마을", to: "촌장 집" } }, { content: "집에서 마을로", id: "out", check: { kind: "link", from: "촌장 집", to: "새벽 마을" } },
        { content: "광장 꾸미기", id: "deco" }] }] });
      const made = await t.call("make_place", { type: "village", name: "새벽 마을", style: "pool:pirate_isles", size: "small" });
      expect(made.ok, made.body.slice(0, 600)).toBe(true);
      const village = Object.values(t.ctx.project.maps).find((m) => m.name === "새벽 마을")!;
      const home = await t.call("make_place", { type: "interior", name: "촌장 집", mapId: "" });
      expect(home.ok, home.body.slice(0, 600)).toBe(true);
      const house = Object.values(t.ctx.project.maps).find((m) => m.name === "촌장 집")!;
      // 이어짐: 두 맵의 이동 이벤트가 서로를 가리키고, 결과 글은 두 문의 칸을 말한다 — 잇는 동사 이름은 없다.
      expect(goes(t.ctx.project, village.id, house.id)).toBe(true);
      expect(goes(t.ctx.project, house.id, village.id)).toBe(true);
      expect(home.body).toMatch(/linked both ways with «새벽 마을»/u);
      expect(home.body).not.toContain("create_transfer_pair");
      // 빌더가 덮은 항목은 모델의 done 없이 닫힌다.
      expect(home.body).toContain("[Covered by the builder ✓]");
      for (const id of ["layout", "review", "graph"]) expect(t.session.todo.get(id)?.status, id).toBe("completed");
      for (const id of ["in", "out"]) expect((await t.call("todo", { op: "done", task: id })).ok, id).toBe(true);
      // 구성기 방에 온 칸 배치: 다음 호출은 실제 값이 찬 호출 하나(뼈대 place_object({"mapId":…}) 가 아니다).
      const refused = await t.call("edit_place", { patch: { mapId: house.id, addAnchors: [{ what: "촌장의 책상", near: { x: 4, y: 5 } }] }, todoId: "house" });
      expect(refused.ok).toBe(false);
      expect(refused.body).toContain(`draw_object({"object":{"what":"촌장의 책상","mapId":"${house.id}","at":{"x":4,"y":5}}})`);
      expect(refused.body).not.toContain("[Next call]");
      // 그 거절은 house 항목의 것이다 — 다른 항목(deco)의 막힘을 되돌리지 않는다.
      const blocked = await t.call("todo", { op: "block", task: "deco", reason: "광장에 놓을 그림이 없다" });
      expect(blocked.ok, blocked.body.slice(0, 300)).toBe(true);
    }, SLOW);

    it("이어지지 않은 구성기 방은 덮였다고 하지 않는다 — 걸린 사실을 적는다", async () => {
      const t = turn("작은 마을이랑 촌장 집 안을 만들어 줘.");
      await t.call("todo", { op: "init", list: [{ phase: "장소", items: [{ content: "마을 만들기", id: "v", check: { kind: "place", name: "새벽 마을", placeKind: "village", fresh: true } }] }] });
      await t.call("make_place", { type: "village", name: "새벽 마을", style: "pool:pirate_isles", size: "small" });
      await t.call("make_place", { type: "interior", name: "촌장 집", mapId: "" });
      const house = Object.values(t.ctx.project.maps).find((m) => m.name === "촌장 집")!;
      const linked = runTodoCheck(t.ctx.project, { kind: "layout_built", map: "촌장 집" });
      expect(linked.pass, linked.detail).toBe(true);
      expect(linked.covered).toBe(true);
      // 두 맵의 이동 이벤트를 걷어 내면 ✗ — 들어오는 이동이 없다고 적는다.
      const maps = Object.fromEntries(Object.entries(t.ctx.project.maps).map(([id, m]) => [id, { ...m, events: (m.events ?? []).filter((e) => !JSON.stringify(e).includes('"kind":"transfer"')) }]));
      const cut = runTodoCheck({ ...t.ctx.project, maps } as typeof t.ctx.project, { kind: "layout_built", map: "촌장 집" });
      expect(cut.pass).toBe(false);
      expect(cut.covered).toBeUndefined();
      expect(cut.detail).toMatch(/들어오는 이동이 어느 맵에도 없다|들어오는 칸·시작점이 없어/u);
      expect(cut.evidence?.mapId).toBe(house.id);
    }, SLOW);
  });
  describe("실내 종류가 없는 세계의 실내 요청은 바깥 종류로 짓지 않는다", () => {
    it("황무지 정착지 뒤의 «촌장 집»: 짓지 않고 까닭과 없는 그림 기록을 남긴다(정착지 한 장이 «촌장 집» 으로 서지 않는다)", async () => {
      // 황무지는 실내 그림이 아직 없는 세계다(전국·에도는 2026-11-12 에 방 구성 여섯을 실내 종류로 받았다 — test/aiV2SengokuRooms.test.ts).
      const t = turn("황무지 생존자 정착지랑 촌장 집 안을 만들어 줘.");
      await t.call("todo", { op: "init", list: [{ phase: "장소", items: [
        { content: "정착지 만들기", id: "v", check: { kind: "place", name: "새벽 정착지", placeKind: "village", fresh: true } },
        { content: "촌장 집 만들기", id: "house", check: { kind: "place", name: "촌장 집", placeKind: "interior", fresh: true } }] }] });
      const made = await t.call("make_place", { type: "village", name: "새벽 정착지", style: "world:wasteland:settlement" });
      expect(Object.values(t.ctx.project.maps).find((m) => m.name === "새벽 정착지")?.tilesetId).toBe("wasteland_ruins");
      expect(made.ok, made.body.slice(0, 600)).toBe(true);
      const before = Object.keys(t.ctx.project.maps).length;
      const home = await t.call("make_place", { type: "interior", name: "촌장 집", mapId: "" });
      expect(home.ok).toBe(false);
      expect(home.body).toMatch(/has no indoor place kind/u);
      // 다음 호출은 지금 하던 항목을 막는 호출이다(정착지 항목이 아직 열려 있으면 그 항목 — 황무지 정착지는 «마을» 장소 확인을 아직 못 넘는다).
      expect(home.body).toMatch(/Next call: todo\(\{"op":"block","task":"(v|house)","reason":"Wasteland has no indoor place kind/u);
      expect(Object.keys(t.ctx.project.maps).length).toBe(before);
      expect([...t.session.missingArt].some((line) => line.includes("indoor-kind") && line.includes("wasteland_ruins"))).toBe(true);
      const blocked = await t.call("todo", { op: "block", task: "house", reason: "Wasteland has no indoor place kind" });
      expect(blocked.ok, blocked.body.slice(0, 300)).toBe(true);
    }, SLOW);
  });
  describe("거절 글이 준 호출을 그대로 꺼낸다", () => {
    it("인자가 다 찬 호출은 그대로, 자리표시가 섞인 호출은 건너뛴다", () => {
      const text = 'Not drawn — this chipset already has an object. Next call: place_object({"mapId":"map_a","objectId":"bd-garden-gate","at":{"x":21,"y":13}}) — it stamps that object.';
      expect(callInText(text, ["place_object"])).toMatchObject({ verb: "place_object", args: { mapId: "map_a", objectId: "bd-garden-gate", at: { x: 21, y: 13 } }, exact: true });
      // JSON 글 속(따옴표가 \" 로 적힌 도구 결과)에서도 읽는다.
      expect(callInText(JSON.stringify({ ok: false, summary: text }), ["place_object"])?.args).toMatchObject({ objectId: "bd-garden-gate" });
      expect(callInText(text, ["make_place"])).toBeUndefined();
      expect(callInText('Next call: place_object({"mapId":"map_a","objectId":<that id>})', ["place_object"])).toBeUndefined();
    });
  });
  describe("비평가가 본 그림이 낡았으면 다시 본다", () => {
    it("비평 뒤에 맵에 물건을 놓으면 끝맺음 관문 전에 비평가가 지금 그림을 다시 보고, 지적이 사라지면 장소 고치기 항목이 없다", async () => {
      // 첫 비평(짓기 때)은 «우물이 안 보인다», 그 뒤의 비평은 지적 없음.
      const t = turn("작은 시골 마을 맵을 만들어 줘. 우물이 있게 해 줘.", (n) => (n === 1
        ? { imagesSeen: 1, score: 7, majors: [{ axis: 1, x: 0, y: 0, w: 10, h: 10, what: "요청한 우물로 읽히는 시설이 보이지 않는다.", fix: "우물을 놓는다." }] }
        : { imagesSeen: 1, score: 8, majors: [] }));
      await t.call("todo", { op: "init", list: [{ phase: "p", items: [{ content: "마을 만들기", id: "v", check: { kind: "place", name: "새벽 마을", placeKind: "village", fresh: true } }] }] });
      const made = await t.call("make_place", { type: "village", name: "새벽 마을", style: "pool:pirate_isles", size: "small" });
      expect(made.ok, made.body.slice(0, 400)).toBe(true);
      const mapId = t.ctx.project.startMapId;
      expect(t.session.unresolved().map((o) => o.mapId)).toEqual([mapId]);
      // 그림이 그대로면 다시 보지 않는다.
      expect(await relookChangedPlaces(t.env, t.session)).toEqual([]);
      expect(t.criticCalls()).toBe(1);
      // 다시 짓지 않는 도구로 맵을 바꾼다(사람 하나) — 그림이 달라진다.
      const person = await t.call("add_people", { mapId, people: [{ role: "주민", name: "주민", where: "광장", firstTalk: ["안녕하세요."] }] });
      expect(person.ok, person.body.slice(0, 300)).toBe(true);
      const notes = await relookChangedPlaces(t.env, t.session);
      expect(notes).toHaveLength(1);
      expect(notes[0]).toMatch(/major 1 → 0/u);
      expect(t.criticCalls()).toBe(2);
      expect(t.session.unresolved()).toEqual([]);
      expect(v2GateProblems(t.session, t.env).problems.filter((p) => p.key.startsWith("place:"))).toEqual([]);
    }, SLOW);
  });
  describe("고치기 상한은 도구와 끝맺음 관문이 같은 수를 쓴다", () => {
    it("칸 배치 장소는 자기 검토 바퀴가 상한을 먹지 않는다", () => {
      const layout = { regions: [{ id: "hall", x: 1, y: 1, w: 8, h: 8 }], objects: [], entrance: { x: 4, y: 9 } };
      expect(repairCapOf({ type: "interior", name: "가게", layout } as unknown as PlaceSpec)).toBeGreaterThan(V2_MAX_REPAIR_ROUNDS + 2);
      expect(repairCapOf({ type: "village", name: "마을" } as PlaceSpec)).toBe(V2_MAX_REPAIR_ROUNDS);
      // 엄격 스키마가 채운 빈 배치는 칸 배치가 아니다.
      expect(repairCapOf({ type: "village", name: "마을", layout: { regions: [], objects: [], rooms: [] } } as unknown as PlaceSpec)).toBe(V2_MAX_REPAIR_ROUNDS);
    });
  });
  describe("끝맺음 관문이 고치는 법으로 이른 도구는 고치기 차례에 싣는다", () => {
    const hud = "[게임 검사 HUD] 필드 HUD(minimal)가 체력을 늘 보인다 — set_field_hud{theme:'minimal', vitals:false} 로 끈다.";

    it("이 요청의 묶음에 없는 도구: 싣고 항목은 열린 채로 건넨다(막지 않는다)", () => {
      const store = new TodoStore();
      const available = new Set(["inspect"]);
      const sync = syncGateItems(store, [{ key: "game:HUD", text: hud, source: "gate" }], new Set(), available, (name) => { if (name !== "set_field_hud") return undefined; available.add(name); return "loaded"; });
      expect(sync.loaded).toEqual(["set_field_hud"]);
      expect(sync.unfixable).toEqual([]);
      expect(sync.opened).toHaveLength(1);
      expect(store.items[0]!.status).not.toBe("blocked");
    });

    it("조수 v2 에 없는 도구: 막힘이 아니라 뺀 채 보고한다 — 완료를 막지 않는다", () => {
      const store = new TodoStore();
      const sync = syncGateItems(store, [{ key: "game:x", text: "[게임 검사 x] 무언가 어긋났다 — no_such_tool{fix:true} 로 고친다.", source: "gate" }], new Set(), new Set(["inspect"]), () => undefined);
      expect(sync.opened).toEqual([]);
      expect(sync.unfixable).toHaveLength(1);
      expect(store.items[0]!.status).toBe("dropped");
      expect(store.items[0]!.blockedReason).toContain("조수 v2 에 없다");
      expect(todoReport({ store, draft: "" }).complete).toBe(true);
    });

    it("이미 목록에 있는 도구는 다시 싣지 않고, 묶음에 있지만 아직 안 실은 도구는 올린다", () => {
      const text = "[게임 검사 이동] 새 맵으로 들어가는 문이 없다 — create_transfer_pair{a:{mapId:'m1'}} 로 잇는다.";
      const ready = syncGateItems(new TodoStore(), [{ key: "game:link", text, source: "gate" }], new Set(), new Set(["create_transfer_pair"]), () => "ready");
      expect(ready.loaded).toEqual([]);
      expect(ready.opened).toHaveLength(1);
      const lazy = syncGateItems(new TodoStore(), [{ key: "game:link", text, source: "gate" }], new Set(), new Set(["create_transfer_pair"]), () => "loaded");
      expect(lazy.loaded).toEqual(["create_transfer_pair"]);
      expect(lazy.unfixable).toEqual([]);
    });

    it("호출 모양이 아니라 이름만 이른 도구도 싣는다 — «create_transfer_pair 로 잇는다» (Haiku village-chief-house)", () => {
      const text = "[게임 검사 이동] 새 맵 「촌장 집」(map_chief_house) 로 들어가는 문·이동이 어느 맵에도 없다 — 플레이어가 갈 수 없다. create_transfer_pair 로 문(집 문·마을 가장자리)과 잇는다.";
      const asked: string[] = [];
      const sync = syncGateItems(new TodoStore(), [{ key: "game:link", text, source: "gate" }], new Set(), new Set(["inspect"]), (name) => { asked.push(name); return name === "create_transfer_pair" ? "loaded" : undefined; });
      expect(sync.loaded).toEqual(["create_transfer_pair"]);
      expect(sync.opened).toHaveLength(1);
      // 맵 id(map_…)는 도구 후보가 아니다.
      expect(asked).toEqual(["create_transfer_pair"]);
    });

    it("이름만 나온 낱말이 도구가 아니어도 항목을 빼지 않는다 — 빼는 것은 호출 모양으로 이른 도구가 없을 때뿐", () => {
      const store = new TodoStore();
      const sync = syncGateItems(store, [{ key: "game:x", text: "[게임 검사 x] 칩셋 atlas_biome_interior 의 문 그림이 없다.", source: "gate" }], new Set(), new Set(["inspect"]), () => undefined);
      expect(sync.unfixable).toEqual([]);
      expect(sync.opened).toHaveLength(1);
      expect(store.items[0]!.status).not.toBe("dropped");
    });

    // 2026-11-16 db-review B #2: 막는 것은 읽기 전용 요청(readOnly)뿐이다 — 질문으로 갈린 글(「…정리해서 지워 줘」)도 쓰기 도구에 닿는다.
    it("실제 턴: 장소만 짓는 요청에서 이름으로 부른 create_transfer_pair 를 그 자리에서 지어 싣는다 — 읽기 전용 요청·없는 이름은 싣지 않는다", () => {
      const t = turn("촌장 집 맵을 만들어 줘.");
      const exposure = { tools: [], lazy: new Map(), offered: [] };
      const toolNames = new Set<string>();
      const { lateTool } = turnLateTools({ session: t.session, state: { exposure }, toolNames, request: { readOnly: false } } as never);
      expect(lateTool("create_transfer_pair")?.name).toBe("create_transfer_pair");
      expect(exposure.lazy.has("create_transfer_pair")).toBe(true);
      expect(toolNames.has("create_transfer_pair")).toBe(true);
      expect(lateTool("create_transfer_pair")).toBe(exposure.lazy.get("create_transfer_pair"));
      expect(lateTool("no_such_tool")).toBeUndefined();
      const readOnly = turnLateTools({ session: t.session, state: { exposure: { tools: [], lazy: new Map(), offered: [] } }, toolNames: new Set(), request: { readOnly: true } } as never);
      expect(readOnly.lateTool("create_transfer_pair")).toBeUndefined();
      const guessedQuestion = turnLateTools({ session: t.session, state: { exposure: { tools: [], lazy: new Map(), offered: [] } }, toolNames: new Set(), request: { task: "안 쓰는 스킬이랑 아이템 정리해서 지워 줘" } } as never);
      expect(guessedQuestion.lateTool("create_transfer_pair")?.name).toBe("create_transfer_pair");
    }, SLOW);

    it("턴 조립: 장소만 까는 요청의 목록에는 create_transfer_pair·load_tools 가 없고, 이름으로 부르면 실리며, 없는 이름의 거절 글은 load_tools 를 권하지 않는다", () => {
      const project = createBlankProject();
      const request = { task: "촌장 집 맵을 만들어 줘.", provider: "local-cli:claude", mapIds: [], project, currentMapId: project.startMapId } as never;
      const v2 = createV2Turn(request, {}, { captureVqaShots: async () => ({ shots: [], failed: [] }) });
      const env = { ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request, emit: () => {}, record: () => {}, checkpoint: async () => {}, sideChat: async () => "{}",
        preferToolNextTurn: () => {}, clearToolPreference: () => {}, lazyToolsVia: "call_tool" } as unknown as PiAssistantV2Env;
      const listed = v2.hooks.tools(env).map((t) => t.name);
      expect(listed).not.toContain("create_transfer_pair");
      expect(listed).not.toContain("load_tools");
      expect(v2.hooks.lazyTool!("create_transfer_pair")?.name).toBe("create_transfer_pair");
      expect(v2.hooks.lazyTool!("make_place")).toBeUndefined();
      const text = v2.hooks.unknownToolText!("no_such_tool");
      expect(text).toContain("no tool named");
      expect(text).not.toContain("load_tools");
    }, SLOW);

    it("실제 턴: 장소만 짓는 요청의 도구 묶음에 없는 set_field_hud 를 고리로 감싸 만들어 준다", async () => {
      const t = turn("왕궁 맵을 만들어 줘.");
      expect(t.session.repairTool).toBeTypeOf("function");
      const made = t.session.repairTool!("set_field_hud");
      expect(made?.name).toBe("set_field_hud");
      expect(t.session.repairTool!("no_such_tool")).toBeUndefined();
      const wrapped = t.session.loop.wrapLate!(made!);
      await t.call("todo", { op: "init", list: [{ phase: "p", items: [{ content: "HUD 끄기", id: "hud" }] }] });
      const r = await wrapped.execute("c-hud", { off: true });
      const body = (r.content as { type: string; text?: string }[]).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
      expect(body).toMatch(/"ok":true/u);
      expect(t.ctx.project.system.fieldHud).toBeDefined();
    }, SLOW);
  });
});

describe("aiV2CityInteriorSeed", () => {
  isolateTimers();
  const house: PlaceSpec = { type: "house", name: "역 앞 카페", style: "kr-modern", variety: "game-a" };
  describe("modern interior seeds", () => {
    it("keeps the same floor plan for a game and room when a fresh tool call has a new salt", () => {
      expect(cityInteriorSeed({ ...house, salt: 17 })).toEqual(cityInteriorSeed({ ...house, salt: 9001 }));
      expect(cityInteriorSeed({ ...house, variety: "game-b" })).not.toEqual(cityInteriorSeed(house));
      expect(cityInteriorSeed({ ...house, name: "항구 카페" })).not.toEqual(cityInteriorSeed(house));
    });

    it("reuses saved seeds, respects explicit seeds and never compounds a variant on rebuild", () => {
      const changed = { ...house, hints: { variant: 2 } };
      expect(cityInteriorSeed(changed, 11)).toEqual({ baseSeed: 11, seed: 213 });
      expect(cityInteriorSeed({ ...changed, hints: { variant: 2, seed: 5 } }, 11)).toEqual({ baseSeed: 5, seed: 207 });
      expect(cityInteriorSeed({ ...house, variety: undefined, salt: 17 })).toEqual({ baseSeed: 18, seed: 18 });
    });

    it("keeps a legacy Korean room's actual layout until a different variant is requested", () => {
      const project = createBlankProject();
      const run = () => createBuildRun({ project, currentMapId: project.startMapId });
      const build = MODERN_KR_BUILDER.build;
      const original = build(run(), { ...house, hints: { seed: 1497 } });
      const oldSpec = { ...house, hints: { variant: 2 } };
      const saved = { builder: MODERN_KR_BUILDER.id, spec: oldSpec, result: { ...original, state: { seed: 1497, program: "cafe" } }, rounds: 1 };
      const renamed = { ...oldSpec, name: "서울 카페 별관" };
      const rebuilt = build(run(), renamed, saved);
      expect(rebuilt.ok).toBe(true);
      expect(rebuilt.mapIds).toEqual(original.mapIds);
      expect(rebuilt.entrance).toEqual(original.entrance);
      expect(rebuilt.state).toMatchObject({ seed: 1497, baseSeed: 1497 });
      const changed = build(run(), { ...renamed, hints: { variant: 3 } }, { ...saved, spec: renamed, result: rebuilt });
      expect(changed.state).toMatchObject({ seed: 1800, baseSeed: 1497 });
    });

    it("retains fractional layout selectors accepted by saved Japanese houses", () => {
      const spec = { ...house, style: "jp-modern", hints: { variant: 0.5 } };
      expect(cityInteriorSeed(spec, 1497)).toEqual({ baseSeed: 1497, seed: 1547.5 });
    });
  });
  describe("new Korean convenience stores", () => {
    const store: PlaceSpec = { type: "house", name: "편의점", style: "kr-modern" };
    const task = "편의점 실내 맵을 만들어 줘. 진열대랑 계산대, 음료 냉장고가 있게 해 줘.";

    it("stocks compact walkable aisles while different games can mirror the plan", () => {
      const entrances = [];
      for (const key of ["neighborhood-a", "neighborhood-b"]) {
        const project = createBlankProject();
        const ctx = { project, currentMapId: project.startMapId };
        const result = MODERN_KR_BUILDER.build(createBuildRun(ctx), { ...store, variety: `${key}|${task}` });
        expect(result.ok, result.summary).toBe(true);
        expect(result.state).toMatchObject({ program: NEIGHBORHOOD_KONBINI });
        const map = ctx.project.maps[result.mapIds[0]!]!;
        const entry = result.entrance!;
        expect(measureInteriorBareFloor(ctx.project, map)!.pct).toBeLessThanOrEqual(INTERIOR_BARE_FLOOR_LIMIT + 5);
        const reachable = computeReachableCells(ctx.project, map, entry.x, entry.y);
        const walkable = map.lowerTiles.filter((_, index) =>
          isPassable(ctx.project, map, index % map.width, Math.floor(index / map.width)));
        expect(reachable.size).toBe(walkable.length);
        entrances.push(entry.x);
      }
      expect(entrances[0]).not.toBe(entrances[1]);
    });

    it("keeps the classic program and floor when an older saved store is rebuilt", () => {
      const project = createBlankProject();
      const ctx = { project, currentMapId: project.startMapId };
      const build = MODERN_KR_BUILDER.build;
      const original = build(createBuildRun(ctx), { ...store, hints: { program: "konbini", seed: 382 } });
      expect(original.ok, original.summary).toBe(true);
      expect(original.state).toMatchObject({ program: "konbini", seed: 382 });
      const originalMap = ctx.project.maps[original.mapIds[0]!]!;
      const legacy = {
        builder: MODERN_KR_BUILDER.id, spec: store, rounds: 0,
        result: { ...original, state: { seed: 382, program: "konbini" } },
      };
      const renamed = build(createBuildRun(ctx), { ...store, name: "편의점 별관" }, legacy);
      expect(renamed.ok, renamed.summary).toBe(true);
      expect(renamed.state).toMatchObject({ program: "konbini", seed: 382 });
      expect(renamed.mapIds).toEqual(original.mapIds);
      expect(renamed.entrance).toEqual(original.entrance);
      expect(ctx.project.maps[renamed.mapIds[0]!]!.lowerTiles).toEqual(originalMap.lowerTiles);
      expect(ctx.project.maps[renamed.mapIds[0]!]!.upperTiles).toEqual(originalMap.upperTiles);
    });

    it("keeps the stocked program on rebuild and applies an explicit variant to the saved base seed", () => {
      const project = createBlankProject();
      const ctx = { project, currentMapId: project.startMapId };
      const spec = { ...store, variety: "neighborhood-a" };
      const original = MODERN_KR_BUILDER.build(createBuildRun(ctx), spec);
      expect(original.ok, original.summary).toBe(true);
      const { baseSeed } = cityInteriorSeed(spec);
      const edited = MODERN_KR_BUILDER.build(createBuildRun(ctx), { ...spec, name: "새 간판", hints: { variant: 2 } }, {
        builder: MODERN_KR_BUILDER.id, spec, rounds: 0, result: original,
      });
      expect(edited.ok, edited.summary).toBe(true);
      expect(edited.mapIds).toEqual(original.mapIds);
      expect(edited.state).toMatchObject({ program: NEIGHBORHOOD_KONBINI, baseSeed, seed: baseSeed + 202 });
    });
  });
});

describe("aiV2CombatChecks", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const weakPaidLines = (...args: Parameters<typeof weakPaidSkills>): string[] => weakPaidSkills(...args).map(findingLine);
  const combatLines = (...args: Parameters<typeof combatProblems>): string[] => combatProblems(...args).map(findingLine);
  const WHOLE = "견습 기사가 세 가지 시험을 통과해 기사가 되는 RPG 만들어 줘. 서임식이 엔딩.";
  function battleGame(): { before: Project; after: Project } {
    const before = createBlankProject() as Project;
    const after = structuredClone(before);
    const map = after.maps[after.startMapId]!;
    map.events.push({
      id: "ev_trial", name: "검술 시험관", x: 3, y: 3,
      pages: [{ ...structuredClone(map.events[0]?.pages?.[0] ?? {}), conditions: [], trigger: { kind: "action" }, commands: [{ kind: "battleProcessing", troopId: "troop_slime", canEscape: false, canLose: false }] }],
    } as never);
    return { before, after };
  }
  describe("v2 combat finish checks (J55 no healing, J4 first-area attrition)", () => {
    it("blocks a battle game with no way to recover HP, and clears once an inn exists", () => {
      const { before, after } = battleGame();
      expect(healingSources(after)).toEqual([]);
      const blocked = combatLines(before, after, WHOLE);
      expect(blocked.some((p) => p.startsWith("[출하 차단 no-healing]"))).toBe(true);

      after.maps[after.startMapId]!.events.push({
        id: "ev_inn", name: "여관 주인", x: 5, y: 3,
        pages: [{ ...structuredClone(after.maps[after.startMapId]!.events[0]!.pages[0]!), commands: [{ kind: "recoverAll" }] }],
      } as never);
      expect(healingSources(after).length).toBeGreaterThan(0);
      expect(combatLines(before, after, WHOLE).some((p) => p.includes("no-healing"))).toBe(false);
    });

    it("flags random encounters the request never asked for, not ones it did", () => {
      const { before, after } = battleGame();
      const map = after.maps[after.startMapId]!;
      map.encounterTable = [{ troopId: "troop_slime", weight: 1 }];
      map.encounterRate = 25;
      expect(combatLines(before, after, WHOLE).some((p) => p.startsWith("[게임 검사 조우]"))).toBe(true);
      expect(combatLines(before, after, `${WHOLE} 숲에서는 랜덤으로 몬스터가 나와.`).some((p) => p.startsWith("[게임 검사 조우]"))).toBe(false);
    });

    it("leaves small non-combat edits alone", () => {
      const { after } = battleGame();
      expect(combatLines(after, structuredClone(after), "촌장 대사를 바꿔 줘")).toEqual([]);
    });

    it("set_encounter_table defaults to off when the request has no encounter words", async () => {
      const seen: unknown[] = [];
      const tool: PiToolShape = { name: "set_encounter_table", label: "", description: "", parameters: {}, async execute(_id, params) { seen.push(params); return { content: [{ type: "text", text: "{}" }] }; } };
      const [quiet] = withEncountersOnlyWhenAsked([tool], WHOLE);
      await quiet!.execute("1", { mapId: "m", entries: [] });
      expect((seen[0] as { encounterRate?: number }).encounterRate).toBe(0);
      await quiet!.execute("2", { mapId: "m", entries: [], encounterRate: 8 });
      expect((seen[1] as { encounterRate?: number }).encounterRate).toBe(8);
      const [asked] = withEncountersOnlyWhenAsked([tool], "동굴에서 랜덤 인카운터가 나오게");
      await asked!.execute("3", { mapId: "m", entries: [] });
      expect((seen[2] as { encounterRate?: number }).encounterRate).toBeUndefined();
    });

    it("steps per encounter follows the runtime accumulator", () => {
      expect(stepsPerEncounter(8)).toBe(14);
      expect(stepsPerEncounter(25)).toBe(8);
      expect(stepsPerEncounter(0)).toBe(Infinity);
    });

    it("flags an MP skill weaker than a free one the same actor knows (J8), and the default seed is fixed", () => {
      const p = createBlankProject() as Project;
      const hero = p.database.actors.find((a) => a.id === "actor_hero")!;
      hero.learnedSkills = [...hero.learnedSkills, { level: 1, skillId: "skill_sword_slash" }, { level: 1, skillId: "skill_hero_cross_slash" }];
      expect(weakPaidLines(p)).toEqual([]);
      p.database.skills.find((s) => s.id === "skill_hero_cross_slash")!.power = 62;
      expect(weakPaidLines(p).some((m) => m.includes("skill_hero_cross_slash"))).toBe(true);
    });
  });
});

// 편집기의 명령 모양 거절은 event_command_assist 를 권하는데 조수 v2 에는 그 도구가 없다 —
// 2026-11-12 Haiku 깔기 prison: patch_event_page 거절 글대로 불렀다가 «there is no tool named "event_command_assist"» 를 받고 항목을 막았다.
// v2 가 모델에게 싣는 사본(loop/failureText.ts)은 v2 에 있는 길(get_event · add_event)을 이른다.
describe("aiV2CommandShapeRefusal", () => {
  isolateTimers();
  describe("명령 모양 거절의 v2 사본", () => {
    const cases = [
      `커맨드 형식 오류:\n- ev_pit_1.ev_pit_1_p.commands[0].kind: 기대 형식 string, 실제 타입 undefined\n${LOW_LEVEL_COMMAND_SHAPE_HINT}`,
      `커맨드 형식 오류: command ev_foe1.ev_foe1_fight.commands[0]: 알 수 없는 kind: battle — did you mean: tacticsBattle, battleProcessing, wait? (full list and shapes: event_command_assist). ${LOW_LEVEL_COMMAND_SHAPE_HINT}`,
      `커맨드 형식 오류: ev_cart_b.ev_cart_b_p.commands[0].options가 배열이 아닙니다.. ${LOW_LEVEL_COMMAND_SHAPE_HINT}`,
      `커맨드 형식 오류: ev_cart_b.ev_cart_b_p.commands[1].options[0].text가 문자열이 아닙니다.. ${LOW_LEVEL_COMMAND_SHAPE_HINT}`,
    ];

    it("v2 에 없는 도구를 이르지 않고, 지금 명령을 읽는 길과 예시를 준다", () => {
      for (const message of cases) {
        const en = englishToolMessage(message);
        expect(en).not.toContain("event_command_assist");
        expect(en.startsWith("Command shape error: ")).toBe(true);
        expect(en).toContain("get_event(");
        expect(en).toContain("add_event");
        expect(en).toContain('{"commands":[{"kind":"text"');
      }
    });

    it("무엇이 틀렸는지는 영어로 남긴다", () => {
      expect(englishToolMessage(cases[0]!)).toContain("commands[0].kind: expected string, got undefined");
      expect(englishToolMessage(cases[1]!)).toContain("unknown kind: battle — did you mean: tacticsBattle, battleProcessing, wait?");
      expect(englishToolMessage(cases[2]!)).toContain("commands[0].options must be an array");
      expect(englishToolMessage(cases[3]!)).toContain("options[0].text must be a string");
    });

    it("다른 거절 글은 그대로다", () => {
      expect(englishToolMessage("트룹에는 최소 1마리의 적이 있어야 합니다")).toContain("A troop needs at least one enemy");
      expect(englishToolMessage("알 수 없는 무언가가 잘못됐다")).toBe("Tool said (Korean): 알 수 없는 무언가가 잘못됐다");
    });
  });
});

describe("aiV2CriticalReachAndChaserSpeed", () => {
  isolateTimers();
  const chaserProject = (movement: Record<string, unknown>): Project => ({
    maps: { m: { id: "m", name: "복도", width: 10, height: 10, events: [{ id: "ev_c", name: "그림자", x: 1, y: 1, pages: [{ movement, commands: [{ kind: "gameOver" }] }] }] },
  } } as unknown as Project);
  describe("slow chasers (J77)", () => {
    it("flags a chaser that rests 240ms between steps", () => {
      expect(slowChasers(chaserProject({ type: "chase", speed: 6, frequency: 5 }))).toHaveLength(1);
    });
    it("passes the make_chase_scene default (speed 6, frequency 8)", () => {
      expect(slowChasers(chaserProject({ type: "chase", speed: 6, frequency: 8 }))).toHaveLength(0);
    });
    it("ignores field enemies that start a battle", () => {
      const p = chaserProject({ type: "chase", speed: 3, frequency: 3 });
      (p.maps.m!.events[0]!.pages[0] as unknown as { commands: unknown[] }).commands = [{ kind: "battleProcessing" }];
      expect(slowChasers(p)).toHaveLength(0);
    });
  });
  describe("slow chasers — exemptions", () => {
    it("skips a chaser with an explicit approach style", () => {
      expect(slowChasers(chaserProject({ type: "chase", speed: 3, frequency: 3, approachStyle: "lumber" }))).toHaveLength(0);
    });
  });
});

// 문·계단·굴 입구는 칩셋이 적어 둔 것으로 읽는다 — 이름표의 「…문」「계단」「굴 입구」 글자가 아니다.
// 2026-11-11 단계×테마 표: 문 이름 이벤트가 걸어서 지나는 성문·목책 문 10곳에 앉았고(에도 성문·무가 대문·산문, 사막 성문, 설원 목책 문),
// 위·아래층 잇기 자리는 「계단탑 옥상」 지붕 칸이었고, 구성기 칩셋의 굴 입구(얼음 동굴·선사 동굴·피라미드 입구) 앞에는 「…입구」 단계가 한 번도 앉지 않았다.
describe("aiV2DeclaredSpots", () => {
  isolateTimers();
  type Ctx = { project: Project };
  const runOf = (ctx: Ctx): BuildRun => ({ ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args) }) as unknown as BuildRun;
  const at = (cells: readonly { x: number; y: number }[], c: { x: number; y: number }) => cells.some((d) => d.x === c.x && d.y === c.y);
  const event = (id: string, name: string, x: number, y: number, page: Record<string, unknown>): GameEvent => ({
    id, name, x, y, trigger: page.trigger ?? { kind: "action" }, commands: [],
    pages: [{ id: `${id}_p0`, name, conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 }, ...page }],
  }) as unknown as GameEvent;
  function desert(kind: string, id: string, name: string): Ctx {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id, name, width: 48, height: 40, tilesetId: "desert_east" }).ok).toBe(true);
    expect(runTool(ctx, "compose_desert_east_map", { mapId: id, kind, seed: 1 }).ok).toBe(true);
    const map = ctx.project.maps[id]!;
    let start = { x: 0, y: 0 };
    for (let x = 0; x < map.width; x++) if (isPassable(ctx.project, map, x, map.height - 1)) { start = { x, y: map.height - 1 }; break; }
    ctx.project = { ...ctx.project, startMapId: id, startPos: start } as Project;
    return ctx;
  }
  /** 이름표가 「…문」으로 끝나는 그림 칸 — 궁전 맵에서는 걸어서 지나는 성문 기둥뿐이다. */
  function gatePostCells(project: Project, map: GameMap): { x: number; y: number }[] {
    const meta = (project.tilesets[map.tilesetId]?.tileMeta ?? []) as unknown as ({ label?: string } | undefined)[];
    const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      if (["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"].some((k) => { const t = m[k]?.[y * map.width + x]; return typeof t === "number" && t >= 0 && /문$/u.test(String(meta[t]?.label ?? "").replace(/\s*\([^)]*\)/gu, "").trim()); })) out.push({ x, y });
    }
    return out;
  }
  describe("stairs are what the chipset declares", () => {
    const blank = createBlankProject() as Project;
    const labels = (id: string) => [...tilesetSurface(blank.tilesets[id]).stairs].map((t) => String((blank.tilesets[id]!.tileMeta as unknown as ({ label?: string } | undefined)[])[t]?.label ?? ""));

    it("reads the baker's role and tags, not the word in a label", () => {
      // 「지구라트(계단 신전)」 은 건물이다. 사막의 계단 칸은 내려가는 돌계단 입구 2×2 하나뿐이다(2026-11-13 첫 판 늘리기 — 꼬리표 «계단»).
      expect(labels("desert_east")).toHaveLength(4);
      expect(labels("desert_east").every((l) => l.includes("돌계단 입구") && !l.includes("지구라트"))).toBe(true);
      expect(labels("modern_city").some((l) => l.includes("비상계단 아파트"))).toBe(false);
      // 실내 계단 둘(오르는·내려가는 2×2) + 거리의 지하 입구 해치 2×2(2026-11-13 이야기 기물 — 역할 terrain·꼬리표 «계단»).
      expect(labels("steampunk_city")).toHaveLength(12);
      expect(labels("steampunk_city").every((l) => l.includes("계단"))).toBe(true);
      // 제 꼬리표를 쓰는 번들은 표면 계약에 적는다.
      expect(tilesetSurface(blank.tilesets.joseon_baram).stairs.size).toBeGreaterThan(20);
      expect(tilesetSurface(blank.tilesets.atlas_biome_interior).stairs.size).toBeGreaterThan(0);
    });

    it("finds room-kit doors and stairs laid on a map by the kit's own object kinds", () => {
      const ctx = { project: createBlankProject() };
      expect(runTool(ctx, "create_map", { id: "map_r", name: "방", width: 14, height: 12, tilesetId: "jp_city" }).ok).toBe(true);
      const spec = roomSpecOf(ctx.project.tilesets.jp_city)!;
      const map = structuredClone(ctx.project.maps.map_r!);
      const put = (objectId: string, x: number, y: number) => { for (const [dx, dy, tile] of spec.objects[objectId]!.cells) (map.upperTiles as number[])[(y + dy!) * map.width + x + dx!] = tile!; };
      expect(spec.objects["door-open-western"]!.kind).toBe("door");
      expect(spec.objects["stairs-up-wood"]!.stairs).toBe("up");
      put("door-open-western", 5, 2);
      put("stairs-up-wood", 9, 4);
      // 세로로 이어진 그림은 맨 아래 칸(사람이 서서 여는·오르는 쪽) 하나.
      expect(declaredDoorCells(ctx.project, map)).toEqual([{ x: 5, y: 4 }]);
      expect(declaredStairCells(ctx.project, map)).toEqual([{ x: 9, y: 4 }]);
    });
  });
  describe("a door-named event sits on a declared door", () => {
    it("goes to a building entrance, never to a walk-through gate", () => {
      const ctx = desert("palace", "map_p", "사막 궁전");
      const map0 = ctx.project.maps.map_p!;
      const posts = gatePostCells(ctx.project, map0);
      const doors = declaredDoorCells(ctx.project, map0);
      expect(posts.length).toBeGreaterThan(0);
      expect(doors).toHaveLength(buildingEntrances(ctx.project, map0).length);
      expect(posts.some((g) => at(doors, g))).toBe(false);
      // 걸어 닿지 못하는 칸(둘레가 모두 막힌 벽 속)에 문 이름 이벤트.
      const reach = reachableCells(ctx.project, map0)!;
      let pit: { x: number; y: number } | undefined;
      for (let y = 2; y < map0.height - 2 && !pit; y++) for (let x = 2; x < map0.width - 2 && !pit; x++) {
        if (!isPassable(ctx.project, map0, x, y) && [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => !reach[(y + dy!) * map0.width + x + dx!])) pit = { x, y };
      }
      expect(pit).toBeDefined();
      ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, map_p: { ...map0, events: [...map0.events, event("ev_door", "굳게 닫힌 문", pit!.x, pit!.y, { commands: [{ kind: "text", body: "…" }, { kind: "setSwitch", switchId: "sw_l", value: true }] })] } } } as Project;
      const fixed = repairEventReach(runOf(ctx), "map_p", ["ev_door"]);
      const map = ctx.project.maps.map_p!;
      const now = map.events.find((e) => e.id === "ev_door")!;
      expect(fixed.moved.join(" ")).toContain("문 그림 칸");
      expect(at(posts, now)).toBe(false);
      expect(at(declaredDoorCells(ctx.project, map), now)).toBe(true);
      expect(unreachableEvents(ctx.project, "map_p")).not.toContain("ev_door");
    }, 60_000);
  });
  describe("an «…입구» step sits in front of the entrance that leads into the dungeon", () => {
    function pyramid(withTransfer: boolean) {
      const ctx = desert("pyramid", "map_y", "피라미드");
      expect(runTool(ctx, "create_map", { id: "map_dg", name: "묘실", width: 20, height: 15, tilesetId: "desert_east" }).ok).toBe(true);
      expect(runTool(ctx, "set_map_properties", { mapId: "map_dg", mapRole: "dungeon" }).ok).toBe(true);
      const map0 = ctx.project.maps.map_y!;
      const mouth = buildingEntrances(ctx.project, map0).find((e) => e.kit.includes("피라미드"))!;
      expect(mouth).toBeDefined();
      const reach = reachableCells(ctx.project, map0)!;
      // 단계: 문 앞에서 5~9걸음 떨어진, 그림이 덮이지 않은 걸어 닿는 칸.
      let spot: { x: number; y: number } | undefined;
      for (let r = 5; r <= 9 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (const dx of [r - Math.abs(dy), Math.abs(dy) - r]) {
        const x = mouth.front.x + dx, y = mouth.front.y + dy;
        if (x > 1 && y > 1 && x < map0.width - 2 && y < map0.height - 2 && reach[y * map0.width + x] && (map0.upperTiles[y * map0.width + x] ?? -1) < 0 && !map0.events.some((e) => e.x === x && e.y === y)) { spot = { x, y }; break; }
      }
      expect(spot).toBeDefined();
      const events = [...map0.events, event("ev_step", "피라미드 입구", spot!.x, spot!.y, { commands: [{ kind: "text", body: "안에서 바람이 분다." }, { kind: "setSwitch", switchId: "sw_e", value: true }] })];
      if (withTransfer) events.push(event("ev_in", "", mouth.x, mouth.y, { trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false, commands: [{ kind: "transfer", mapId: "map_dg", x: 2, y: 2, direction: "down" }] }));
      ctx.project = {
        ...ctx.project, maps: { ...ctx.project.maps, map_y: { ...map0, events } },
        gameBlueprint: { title: "시험", genre: "모험", request: "모험 게임 하나 만들어 줘.", playerGoal: "끝까지 간다.", steps: [{ id: "s1", place: map0.name, event: "피라미드 입구", action: "입구를 살핀다", needs: [], gives: ["바람"] }], ending: { title: "끝", trigger: "바람" } },
      } as unknown as Project;
      const notes = seatEntranceSteps(runOf(ctx), "map_y");
      return { mouth, spot: spot!, notes, step: ctx.project.maps.map_y!.events.find((e) => e.id === "ev_step")!, project: ctx.project };
    }

    it("moves the step to the mouth's front row and keeps the way in open", () => {
      const { mouth, step, project } = pyramid(true);
      expect(step.y).toBe(mouth.front.y);
      expect(Math.abs(step.x - mouth.front.x)).toBeLessThanOrEqual(1);
      expect(unreachableEvents(project, "map_y")).not.toContain("ev_in");
    }, 60_000);

    it("leaves the step alone when no entrance on the map leads into a dungeon", () => {
      const { spot, step, notes } = pyramid(false);
      expect({ x: step.x, y: step.y }).toEqual(spot);
      expect(notes).toEqual([]);
    }, 60_000);
  });
  describe("an event moved to reachable ground is not parked under a picture", () => {
    it("skips walkable cells covered by a roof edge or canopy", () => {
      // 폐허 정착지: 벽 속 이벤트를 옮긴 자리가 「고철 판잣집」 지붕 밑 칸이었다 — 걸을 수는 있지만 그림에 가려 안 보인다.
      const world = WORLDS.find((w) => w.id === "wasteland")!, kind = world.kinds.find((k) => k.id === "settlement")!;
      const spec = { ...worldPlaceSpec(world, kind, kind.ko), salt: 7 };
      const ctx: Ctx = { project: createBlankProject() };
      const run = runOf(ctx);
      const built = builderFor(spec)!.build(run, spec);
      expect(built.ok, built.summary).toBe(true);
      const mapId = built.entrance?.mapId ?? built.mapIds[0]!;
      const map0 = ctx.project.maps[mapId]!;
      if (ctx.project.startMapId !== mapId && built.entrance) ctx.project = { ...ctx.project, startMapId: mapId, startPos: { x: built.entrance.x, y: built.entrance.y } } as Project;
      const reach = reachableCells(ctx.project, map0)!;
      let pit: { x: number; y: number } | undefined;
      for (let y = 2; y < map0.height - 2 && !pit; y++) for (let x = 2; x < map0.width - 2 && !pit; x++) {
        if (!isPassable(ctx.project, map0, x, y) && !map0.events.some((e) => e.x === x && e.y === y) && [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => !reach[(y + dy!) * map0.width + x + dx!])) pit = { x, y };
      }
      expect(pit).toBeDefined();
      ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, [mapId]: { ...map0, events: [...map0.events, event("ev_lost", "잠든 장치", pit!.x, pit!.y, { commands: [{ kind: "text", body: "…" }, { kind: "setSwitch", switchId: "sw_l", value: true }] })] } } } as Project;
      repairEventReach(run, mapId, ["ev_lost"]);
      const map = ctx.project.maps[mapId]!;
      const now = map.events.find((e) => e.id === "ev_lost")!;
      expect(unreachableEvents(ctx.project, mapId)).not.toContain("ev_lost");
      expect(objectAt(map, now)).toBe(false);
    }, 60_000);
  });
});

// 「이 칸이 문·계단 그림인가」는 칩셋이 적어 둔 것으로 읽는다(place/entrances.ts isEntranceArt) — 건물 키트의 입구 부품 · 방 키트의 문·계단 기물 ·
// 표면 계약의 계단과 낱장 문(꼬리표 door·문). 이름표 낱말로 읽던 때는 create_transfer_pair 가 「가문비」 밑 칸에 이은 출구의 트리거를 나무 위로 올렸다
// (2026-11-12 문 그림 읽기 × 테마 표: 86장에서 낱말로만 문인 그림 밑 걷는 칸 663칸, 심은 99건 모두 그림 위로 올라갔다).
describe("aiV2DoorArtDeclared", () => {
  isolateTimers();
  type Ctx = { project: Project };
  type Meta = { label?: string; role?: string } | undefined;
  const SLOW = 60_000;
  const metaOf = (project: Project, tilesetId: string) => project.tilesets[tilesetId]!.tileMeta as unknown as Meta[];
  function tileOf(project: Project, tilesetId: string, label: RegExp, pass?: boolean): number {
    const tileset = project.tilesets[tilesetId]!;
    const tile = metaOf(project, tilesetId).findIndex((m, t) => !!m?.label && label.test(m.label) && (pass === undefined || Object.values(tileset.passability[t] ?? {}).some(Boolean) === pass));
    expect(tile, `${tilesetId} ${label}`).toBeGreaterThanOrEqual(0);
    return tile;
  }
  /** 한 가지 바닥을 깐 12×8 맵 두 장(map_t · map_other)에 윗층 그림 타일을 놓는다. */
  function flat(tilesetId: string, ground: RegExp, upper: readonly (readonly [number, number, RegExp])[]): Ctx {
    const ctx: Ctx = { project: createBlankProject() };
    for (const id of ["map_t", "map_other"]) expect(runTool(ctx, "create_map", { id, name: id, width: 12, height: 8, tilesetId }).ok).toBe(true);
    const floor = tileOf(ctx.project, tilesetId, ground, true);
    const maps = { ...ctx.project.maps };
    for (const id of ["map_t", "map_other"]) {
      const map = structuredClone(maps[id]!);
      for (let i = 0; i < map.width * map.height; i++) { (map.lowerTiles as number[])[i] = floor; (map.upperTiles as number[])[i] = -1; }
      if (id === "map_t") for (const [x, y, label] of upper) (map.upperTiles as number[])[y * map.width + x] = tileOf(ctx.project, tilesetId, label);
      maps[id] = map;
    }
    ctx.project = { ...ctx.project, maps, startMapId: "map_t", startPos: { x: 1, y: 6 } } as Project;
    return ctx;
  }
  const added = (before: GameMap, after: GameMap) => after.events.filter((e) => !before.events.some((b) => b.id === e.id));
  describe("door art is what the chipset declares", () => {
    it("reads a loose door tile by the baker's tag, not by a 「문」 in a label", () => {
      const project = createBlankProject();
      const doors = tilesetSurface(project.tilesets.beodeul_city).doors;
      expect(doors.has(tileOf(project, "beodeul_city", /집 문$/u))).toBe(true);
      // 건물 타일은 꼬리표가 문이어도 낱장 문이 아니다 — 건물의 문은 그 키트가 입구 부품으로 적는다(설원 「목책 문」은 기둥·지붕까지 한 덩이다).
      const snow = tilesetSurface(project.tilesets.snow_north).doors;
      expect(snow.has(tileOf(project, "snow_north", /^목책 문/u))).toBe(false);
      expect(snow.has(tileOf(project, "snow_north", /가문비/u))).toBe(false);
    });

    it("a spruce, a steam vent and a gun port are not door art; a kit's stairs are", () => {
      const { project } = flat("snow_north", /^눈밭/u, [[5, 3, /^큰 가문비/u]]);
      expect(isDoorArtCell(project, project.maps.map_t!, 5, 3)).toBe(true);   // 이름표 낱말로는 문
      expect(isEntranceArt(project, project.maps.map_t!, 5, 3)).toBe(false);
      const one = (tilesetId: string, label: RegExp): boolean => {
        const tile = tileOf(project, tilesetId, label);
        const map = { ...project.maps.map_t!, tilesetId, width: 1, height: 1, lowerTiles: [0], upperTiles: [tile], lowerOverlayTiles: [-1], upperOverlayTiles: [-1] } as unknown as GameMap;
        return isEntranceArt(project, map, 0, 0);
      };
      expect(one("atlas_biome_interior", /^증기 구멍/u)).toBe(false);
      expect(one("atlas_biome_interior", /^포문\(열림\)/u)).toBe(false);
      expect(one("atlas_biome_interior", /^서고 사다리/u)).toBe(false);
      expect(one("atlas_biome_interior", /^순간이동 진/u)).toBe(true);   // 방 키트가 드나드는 것(쓰임 travel)이라 적은 기물 — 이름표에는 문 낱말이 없다
    });

    it("a chipset that declares nothing (an uploaded sheet) is still read by its labels", () => {
      const base = createBlankProject();
      const tileset = { ...base.tilesets.snow_north!, id: "uploaded_sheet", structureKits: [], roomKit: undefined, tileMeta: [{ label: "풀밭" }, { label: "나무 문" }] } as unknown as Project["tilesets"][string];
      const project = { ...base, tilesets: { ...base.tilesets, uploaded_sheet: tileset } } as Project;
      const map = { ...base.maps[base.startMapId]!, tilesetId: "uploaded_sheet", width: 2, height: 1, lowerTiles: [0, 0], upperTiles: [1, -1], lowerOverlayTiles: [-1, -1], upperOverlayTiles: [-1, -1] } as unknown as GameMap;
      expect(isEntranceArt(project, map, 0, 0)).toBe(true);
      expect(isEntranceArt(project, map, 1, 0)).toBe(false);
    });
  });
  describe("create_transfer_pair puts the trigger on declared door art only", () => {
    it("an exit linked on the cell under a spruce stays on that cell", () => {
      const ctx = flat("snow_north", /^눈밭/u, [[5, 3, /^큰 가문비/u]]);
      const before = ctx.project.maps.map_t!;
      const r = runTool(ctx, "create_transfer_pair", { a: { mapId: "map_t", x: 5, y: 4 }, b: { mapId: "map_other", x: 6, y: 6 } });
      expect(r.ok, r.summary).toBe(true);
      const gate = added(before, ctx.project.maps.map_t!)[0]!;
      // 전에는 (5,3) — 나무 칸에 부딪혀야 넘어갔다.
      expect({ x: gate.x, y: gate.y }).toEqual({ x: 5, y: 4 });
    });

    it("an entrance linked on the cell in front of a building's door goes onto the door", () => {
      const ctx: Ctx = { project: createBlankProject() };
      expect(runTool(ctx, "create_map", { id: "map_d", name: "바자르", width: 48, height: 40, tilesetId: "desert_east" }).ok).toBe(true);
      expect(runTool(ctx, "create_map", { id: "map_in", name: "집 안", width: 12, height: 10, tilesetId: "desert_east" }).ok).toBe(true);
      expect(runTool(ctx, "compose_desert_east_map", { mapId: "map_d", kind: "bazaar", seed: 1 }).ok).toBe(true);
      const built = ctx.project.maps.map_d!;
      const door = buildingEntrances(ctx.project, built).find((d) => !built.events.some((e) => Math.abs(e.x - d.x) <= 1 && Math.abs(e.y - d.y) <= 2))!;
      expect(door).toBeDefined();
      const inside = ctx.project.maps.map_in!;
      let spot = { x: 1, y: 1 };
      for (let y = inside.height - 2; y > 0; y--) for (let x = 1; x < inside.width - 1; x++) if (isPassable(ctx.project, inside, x, y)) { spot = { x, y }; y = 0; break; }
      const r = runTool(ctx, "create_transfer_pair", { a: { mapId: "map_d", x: door.front.x, y: door.front.y }, b: { mapId: "map_in", x: spot.x, y: spot.y } });
      expect(r.ok, r.summary).toBe(true);
      expect(added(built, ctx.project.maps.map_d!).some((e) => e.x === door.x && e.y === door.y)).toBe(true);
    }, SLOW);
  });
});

// 문 사각형의 폭은 건물 키트가 적어 둔 입구 열까지다 — 문 옆 벽·창 칸은 이름표에 「양개문」이 들어 있어도 문이 아니다.
// 낱말로 넓히던 때(2026-11-12 명세 은행 fun-w3 「눈보라 마을」 선술집 · jrpg-w1 「서리울 마을」 긴집): 문이 4칸으로 적혀 벽 두세 칸이 문짝처럼 열리고,
// 이동 발판이 벽 칸마다 복제됐다(ev_gate_…_r2 · _r3 — 막힌 벽 칸의 부딪힘 이동). 작은 집(4×4 이하)은 이름에 「문」이 있으면 집 한 채가 문 키트로 읽혔다.
describe("aiV2DoorWidthDeclared", () => {
  isolateTimers();
  type Ctx = { project: Project };
  type Kit = { id?: string; name?: string; rows: { tiles?: number[]; upperTiles?: number[] }[]; parts?: { kind?: string; dx: number; dy: number; w?: number; h?: number }[] };
  const OX = 3, OY = 2;
  /** 걷는 바닥만 깐 맵 두 장 — map_t 에 그 키트 한 채를 (3,2) 부터 찍는다. door = 입구 부품의 맨 아래 왼쪽 칸. */
  function stage(tilesetId: string, kitId: string): { ctx: Ctx; door: { x: number; y: number }; width: number } {
    const ctx: Ctx = { project: createBlankProject() };
    const tileset = ctx.project.tilesets[tilesetId]!;
    const kit = (tileset as unknown as { structureKits: Kit[] }).structureKits.find((k) => k.id === kitId)!;
    expect(kit, kitId).toBeDefined();
    const part = kit.parts!.find((p) => p.kind === "entrance")!;
    const w = Math.max(12, kit.rows[0]!.tiles!.length + 6), h = Math.max(10, kit.rows.length + 6);
    for (const id of ["map_t", "map_in"]) expect(runTool(ctx, "create_map", { id, name: id, width: w, height: h, tilesetId }).ok).toBe(true);
    // 바닥: 사방으로 걷는 칸이고 건물 그림이 아니며 이름표가 문으로 읽히지 않는 첫 타일(sf_station 1번은 걷는 돔 지붕 칸 「거주 돔(… + 문)」 이다).
    const meta = tileset.tileMeta as unknown as ({ label?: string; role?: string } | undefined)[];
    const floor = tileset.passability.findIndex((p, t) => !!p && p.up && p.down && p.left && p.right && !!meta[t]?.label && !["wall", "building", "roof"].includes(meta[t]!.role ?? "") && !classifyDoorLabel(meta[t]!.label!));
    expect(floor).toBeGreaterThanOrEqual(0);
    const maps = { ...ctx.project.maps };
    for (const id of ["map_t", "map_in"]) {
      const map = structuredClone(maps[id]!) as GameMap;
      const lower = map.lowerTiles as number[], upper = map.upperTiles as number[];
      for (let i = 0; i < map.width * map.height; i++) { lower[i] = floor; upper[i] = -1; }
      if (id === "map_t") kit.rows.forEach((row, y) => {
        (row.tiles ?? []).forEach((t, x) => { if (t >= 0) lower[(y + OY) * map.width + x + OX] = t; });
        (row.upperTiles ?? []).forEach((t, x) => { if (t >= 0) upper[(y + OY) * map.width + x + OX] = t; });
      });
      maps[id] = map;
    }
    ctx.project = { ...ctx.project, maps, startMapId: "map_t", startPos: { x: 1, y: h - 2 } } as Project;
    return { ctx, door: { x: part.dx + OX, y: part.dy + (part.h ?? 1) - 1 + OY }, width: part.w ?? 1 };
  }
  /** 문 앞 칸에서 다른 맵으로 잇고, map_t 에 생긴 이동 이벤트 칸과 적힌 문을 돌려준다. */
  function link(s: { ctx: Ctx; door: { x: number; y: number } }): { gates: { x: number; y: number }[]; doors: { x: number; w: number }[] } {
    const r = runTool(s.ctx, "create_transfer_pair", { a: { mapId: "map_t", x: s.door.x, y: s.door.y + 1 }, b: { mapId: "map_in", x: 5, y: 7 } });
    expect(r.ok, r.summary).toBe(true);
    const map = s.ctx.project.maps.map_t!;
    return { gates: map.events.map((e) => ({ x: e.x, y: e.y })), doors: (map.doors ?? []).map((d) => ({ x: d.x, w: d.w })) };
  }
  describe("a door is as wide as the entrance its building kit declares", () => {
    it("snow tavern (two-leaf door, 2 cells): the door rect and the triggers stay on the two door cells", () => {
      const s = stage("snow_north", "sn-meadhall");
      const project = s.ctx.project, map = project.maps.map_t!;
      expect(s.width).toBe(2);
      const door = inferMapDoor(project, map, s.door)!;
      expect({ kind: door.kind, x: door.rect.x, w: door.rect.w }).toEqual({ kind: "double", x: s.door.x, w: 2 });
      // 문 옆 벽·창 칸: 같은 이름표(「회관 선술집(…양개문…)」)지만 문이 아니다.
      expect(inferMapDoor(project, map, { x: s.door.x - 1, y: s.door.y })).toBeNull();
      expect(inferMapDoor(project, map, { x: s.door.x + 2, y: s.door.y })).toBeNull();
      const { gates, doors } = link(s);
      expect(gates.map((g) => g.x).sort()).toEqual([s.door.x, s.door.x + 1]);
      for (const g of gates) expect(isEntranceArt(s.ctx.project, s.ctx.project.maps.map_t!, g.x, g.y), `(${g.x},${g.y})`).toBe(true);
      expect(doors).toEqual([{ x: s.door.x, w: 2 }]);
    });

    it("snow longhouse (one door cell in a 7-wide front): one trigger, no clones on the wall", () => {
      const s = stage("snow_north", "sn-longhouse");
      const door = inferMapDoor(s.ctx.project, s.ctx.project.maps.map_t!, s.door)!;
      expect({ kind: door.kind, w: door.rect.w }).toEqual({ kind: "swing", w: 1 });
      const { gates } = link(s);
      expect(gates).toEqual([{ x: s.door.x, y: s.door.y }]);
      expect(isPassable(s.ctx.project, s.ctx.project.maps.map_t!, s.door.x, s.door.y)).toBe(false);
    });

    it("a small house is not a door kit: the cabin's door is its one declared cell, not the whole 4×4 house", () => {
      const s = stage("snow_north", "sn-cabin-m");
      const door = inferMapDoor(s.ctx.project, s.ctx.project.maps.map_t!, s.door)!;
      expect({ kind: door.kind, x: door.rect.x, w: door.rect.w, h: door.rect.h }).toEqual({ kind: "swing", x: s.door.x, w: 1, h: 2 });
      const { gates, doors } = link(s);
      expect(gates).toEqual([{ x: s.door.x, y: s.door.y }]);
      expect(doors).toEqual([]);
    });

    it("a kit that is the door itself keeps its size (elevator door 2×2 with one declared cell, lattice door 2×3)", () => {
      const lift = stage("sf_station", "sf-elevator-door");
      const a = inferMapDoor(lift.ctx.project, lift.ctx.project.maps.map_t!, lift.door)!;
      expect({ kind: a.kind, w: a.rect.w, h: a.rect.h }).toEqual({ kind: "auto", w: 2, h: 2 });
      const lattice = stage("jp_city", "jp-door-lattice");
      const b = inferMapDoor(lattice.ctx.project, lattice.ctx.project.maps.map_t!, lattice.door)!;
      expect({ kind: b.kind, w: b.rect.w, h: b.rect.h }).toEqual({ kind: "slide", w: 2, h: 3 });
    });

    it("a shutter drawn with one repeated tile keeps its full width (the same picture is the same door)", () => {
      const s = stage("sf_station", "sf-airlock-wide");
      const door = inferMapDoor(s.ctx.project, s.ctx.project.maps.map_t!, s.door)!;
      expect({ kind: door.kind, x: door.rect.x, w: door.rect.w }).toEqual({ kind: "shutter", x: s.door.x - 1, w: 3 });
    });

    it("kits whose entrance is a walkable doorstep are read as before (the door picture surrounds the step)", () => {
      const s = stage("monster_rooms", "mk-monster-rooms-lg_door");
      const door = inferMapDoor(s.ctx.project, s.ctx.project.maps.map_t!, s.door)!;
      expect({ kind: door.kind, x: door.rect.x, w: door.rect.w }).toEqual({ kind: "double", x: s.door.x - 1, w: 3 });
    });
  });
});

describe("aiV2DualDayCount", () => {
  isolateTimers();
  // 판정 J18(서울 연애): HUD 달력 「봄 4일」과 대사의 「1일차」 변수가 따로 셌다.
  function project(sleepCommands: unknown[], commonEvents: unknown[] = []): Project {
    return {
      variables: [{ id: "var_day_count", name: "서울에서 보낸 일수" }, { id: "var_love", name: "호감도" }],
      maps: { m: { id: "m", name: "방", width: 3, height: 3, events: [{ id: "ev_bed", name: "침대", x: 1, y: 1, pages: [{ conditions: [], trigger: { kind: "action" }, commands: sleepCommands }] }] } },
      commonEvents,
    } as unknown as Project;
  }
  describe("dayCounterVariables (J18 two day systems)", () => {
    it("finds a variable bumped next to sleepUntilMorning", () => {
      const found = dayCounterVariables(project([{ kind: "sleepUntilMorning" }, { kind: "setVariable", variableId: "var_day_count", op: "+=", value: 1 }]));
      expect(found.map((v) => v.id)).toEqual(["var_day_count"]);
    });
    it("ignores affection bumps and the onDayEnd counter", () => {
      expect(dayCounterVariables(project([{ kind: "setVariable", variableId: "var_love", op: "+=", value: 2 }]))).toEqual([]);
      const ce = [{ id: "ce_deadline_ending", name: "기한", commands: [{ kind: "setVariable", variableId: "var_day_count", op: "+=", value: 1 }] }];
      expect(dayCounterVariables(project([], ce), "ce_deadline_ending")).toEqual([]);
    });
  });
});

// 조수 v2 던전 종류 고르기(2026-11-15 감독): 닫힌 집합의 값(spec.theme · hints.type)과 게임 열쇠·이야기 역할로 정한다.
// 모델이 쓴 자유 낱말·이름을 정규식 표로 읽지 않는다 — 한 게임은 늘 같은 종류, 게임끼리는 다르다.
describe("aiV2DungeonKind", () => {
  isolateTimers();
  const spec = (over: Partial<PlaceSpec>): PlaceSpec => ({ type: "dungeon", name: "던전", ...over }) as PlaceSpec;
  describe("조수 v2 던전 종류 — 닫힌 집합 + 게임 열쇠", () => {
    it("닫힌 값은 그대로: theme · hints.type, 깃발 붙은 둘은 종류 + 깃발", () => {
      for (const t of DUNGEON_TYPES) expect(dungeonArgs(spec({ theme: t })).type).toBe(t);
      expect(dungeonArgs(spec({ theme: " Ice " })).type).toBe("ice");
      expect(dungeonArgs(spec({ theme: "cave", hints: { type: "mine" } })).type).toBe("mine");
      const sunken = dungeonArgs(spec({ theme: "sunken" }));
      expect([sunken.type, sunken.args.flooded]).toEqual(["temple", true]);
      const hideout = dungeonArgs(spec({ theme: "hideout" }));
      expect([hideout.type, hideout.args.lair]).toEqual(["cave", true]);
    });

    it("카드가 닫힌 집합을 빠짐없이 적는다", () => {
      for (const k of DUNGEON_KINDS) expect(DUNGEON_CARD).toContain(k);
    });

    it("자유 낱말·이름은 읽지 않는다 — 열쇠가 고른다(무너지지 않는다)", () => {
      const key = "game-a|던전 하나 만들어 줘";
      const plain = pickDungeonKind(spec({ variety: key }));
      // 옛 명세의 자유 theme, 이름에 든 종류 낱말 모두 같은 열쇠면 같은 종류
      expect(pickDungeonKind(spec({ variety: key, theme: "얼음 동굴 같은 곳" }))).toBe(plain);
      expect(pickDungeonKind(spec({ variety: key, theme: "frozen lava pyramid" }))).toBe(plain);
      expect(() => dungeonArgs(spec({ variety: key, theme: "???", features: ["함정", "레버가 있는 방"] }))).not.toThrow();
      expect(dungeonArgs(spec({ variety: key, theme: "cave", name: "레버 동굴" })).args.gimmick).toBeUndefined();
    });

    it("한 게임은 늘 같은 종류, 게임끼리는 갈린다", () => {
      const pick = (game: string) => pickDungeonKind(spec({ variety: `${game}|던전 만들어 줘`, name: "깊은 곳" }));
      expect(pick("game-a")).toBe(pick("game-a"));
      const seen = new Set(Array.from({ length: 40 }, (_, i) => pick(`game-${i}`)));
      expect(seen.size).toBeGreaterThanOrEqual(4);
      for (const k of seen) expect(DUNGEON_KINDS).toContain(k);
    });

    it("이야기 역할: 보스가 있는 끝 던전과 곁 던전은 후보가 다르다", () => {
      expect(dungeonRole(spec({ features: ["boss", "chests"] }))).toBe("final");
      expect(dungeonRole(spec({ floors: 3 }))).toBe("final");
      expect(dungeonRole(spec({ features: ["chests"] }))).toBe("side");
      const finals = new Set(Array.from({ length: 60 }, (_, i) => pickDungeonKind(spec({ variety: `g${i}`, features: ["boss"] }))));
      const sides = new Set(Array.from({ length: 60 }, (_, i) => pickDungeonKind(spec({ variety: `g${i}` }))));
      expect(finals.has("sewer")).toBe(false);
      expect(sides.has("volcano")).toBe(false);
      expect(finals.has("castle") && sides.has("sewer")).toBe(true);
    });

    it("cave 장소는 동굴, 다시 지을 때는 앞 종류를 지킨다", () => {
      expect(pickDungeonKind({ type: "cave", name: "굴", variety: "k" } as PlaceSpec)).toBe("cave");
      expect(pickDungeonKind(spec({ variety: "k" }), "pyramid")).toBe("pyramid");
      expect(pickDungeonKind(spec({ variety: "k", theme: "ice" }), "pyramid")).toBe("ice");
    });

    it("장소 이름과 방 설계는 적의 종을 고르지 않는다", () => {
      const dungeonDesign = { rooms: [{ id: "입구", role: "entrance" }, { id: "늑대 왕좌", role: "boss" }] };
      const place = spec({ name: "마왕성 가는 길의 던전", theme: "castle", features: ["boss", "enemies"], dungeonDesign });
      const defaults = dungeonArgs(place);
      expect(defaults.type).toBe("castle");
      expect(defaults.args.design).toBe(dungeonDesign);
      expect(defaults.boss).toBeUndefined();
      expect(defaults.foes).toEqual([]);
      expect(dungeonArgs({ ...place, name: "늑대 마을에서 마왕성 가는 길" }).foes).toEqual([]);

      const named = dungeonArgs({ ...place, features: ["boss", "리치", "해골 순찰"] });
      expect(named.boss).toEqual(["enemy_lich_frost", "리치"]);
      expect(named.foes).toEqual(["enemy_skeleton_bone"]);
    });

    it("장치·깃발은 features 의 닫힌 값으로만", () => {
      expect(dungeonArgs(spec({ theme: "catacomb", features: ["Lever"] })).args.gimmick).toBe("lever");
      expect(dungeonArgs(spec({ theme: "mine", features: ["minecart"] })).args.gimmick).toBe("minecart");
      expect(dungeonArgs(spec({ theme: "temple", features: ["flooded"] })).args.flooded).toBe(true);
      expect(dungeonArgs(spec({ theme: "cave", features: ["goblin lair"] })).args.lair).toBe(true);
      // 종류 기본 장치는 그대로
      expect(dungeonArgs(spec({ theme: "volcano" })).args.gimmick).toBe("bridge");
      expect(dungeonArgs(spec({ theme: "pyramid" })).args.gimmick).toBe("sandpit");
    });
  });
});

describe("aiV2EnemyChecks", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const enemyLines = (...args: Parameters<typeof enemyIdentityProblems>): string[] => enemyIdentityProblems(...args).map(findingLine);
  const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);
  const WHOLE = "용사가 마왕을 잡으러 가는 짧은 RPG 만들어줘";
  /** 이벤트 전투로 쓰이는 적 무리를 만든다 — foes: 이름 → 기술 이름들(기본 공격은 늘 있다). */
  function battleProject(foes: Record<string, string[]>, boss?: { name: string; skills: string[] }): Project {
    const p = createBlankProject() as Project;
    const base = structuredClone(p.database.enemies[0]!) as unknown as Record<string, unknown>;
    const skillTemplate = structuredClone(p.database.skills[0]!) as unknown as Record<string, unknown>;
    const mkSkill = (id: string, name: string) => { if (!p.database.skills.some((s) => s.id === id)) p.database.skills.push({ ...skillTemplate, id, name } as never); };
    const all: [string, string[], boolean][] = [...Object.entries(foes).map(([n, s]) => [n, s, false] as [string, string[], boolean]), ...(boss ? [[boss.name, boss.skills, true] as [string, string[], boolean]] : [])];
    const map = p.maps[p.startMapId]!;
    all.forEach(([name, skills, isBoss], i) => {
      const skillIds = ["skill_attack", ...skills.map((s) => { mkSkill(`skill_x_${s}`, s); return `skill_x_${s}`; })];
      const enemyId = isBoss ? `enemy_boss_${i}` : `enemy_foe_${i}`;
      p.database.enemies.push({ ...base, id: enemyId, name, skillIds, actions: skillIds.map((skillId) => ({ skillId, priority: 5, condition: { kind: "always" } })) } as never);
      p.database.troops.push({ id: `troop_${i}`, name: isBoss ? `${name} 보스` : name, enemyIds: [enemyId], autoAlign: true, battleEventPages: [] } as never);
      map.events.push({ id: `ev_fight_${i}`, name: `전투 ${i}`, x: 2 + i, y: 3, pages: [{ ...structuredClone(map.events[0]?.pages?.[0] ?? {}), conditions: [], trigger: { kind: "action" }, commands: [{ kind: "battleProcessing", troopId: `troop_${i}`, canEscape: true, canLose: false }] }] } as never);
    });
    return p;
  }
  describe("v2 enemy identity check (fs-use-tools E1)", () => {
    it("passes a game with no battles at all", () => {
      expect(enemyLines(createBlankProject() as Project)).toEqual([]);
    });

    it("flags several ordinary foes whose skills are all the same, and clears once one differs", () => {
      const flat = battleProject({ 해골: ["맹독 이빨", "뼈 저주"], 갑옷: ["맹독 이빨", "뼈 저주"] });
      expect(enemyLines(flat).filter((m) => m.includes("자기 기술이 없다"))).toHaveLength(1);
      const varied = battleProject({ 해골: ["맹독 이빨", "뼈 저주"], 갑옷: ["방패 밀치기"] });
      expect(enemyLines(varied)).toEqual([]);
    });

    it("does not fire in a monster-collect game, whose foes are species copies", () => {
      const flat = battleProject({ 해골: ["맹독 이빨", "뼈 저주"], 갑옷: ["맹독 이빨", "뼈 저주"] });
      flat.system = { ...flat.system, battleParty: "monsters" } as Project["system"];
      expect(enemyLines(flat)).toEqual([]);
    });

    it("does not fire for a single ordinary foe kind", () => {
      expect(enemyLines(battleProject({ 슬라임: [] }))).toEqual([]);
    });

    it("flags a boss that only has the basic attack, and clears once it has its own skill", () => {
      const flat = battleProject({}, { name: "마왕", skills: [] });
      expect(enemyLines(flat).filter((m) => m.includes("자기 기술이 없다"))).toHaveLength(1);
      expect(enemyLines(battleProject({}, { name: "마왕", skills: ["암흑 파동"] }))).toEqual([]);
    });

    it("checks each map on its own: a varied forest does not hide a demon castle whose foes share one skill set", () => {
      const p = battleProject({ 늑대: ["맹독 이빨"], 식물: ["수면 포자"], 임프: ["검격", "약화"], 기사: ["검격", "약화"] });
      const [forestA, forestB, demonA, demonB] = [0, 1, 2, 3].map((i) => p.maps[p.startMapId]!.events.find((e) => e.id === `ev_fight_${i}`)!);
      const castle = structuredClone(p.maps[p.startMapId]!) as typeof p.maps[string];
      castle.id = "map_castle"; castle.name = "마왕성"; castle.events = [demonA!, demonB!];
      p.maps[p.startMapId]!.events = p.maps[p.startMapId]!.events.filter((e) => [forestA, forestB].includes(e));
      p.maps.map_castle = castle;
      const msgs = enemyLines(p);
      expect(msgs).toHaveLength(1);
      expect(msgs[0]).toContain("마왕성");
      expect(msgs[0]).toContain("임프");
    });

    it("flags a boss whose skills are all shared with the foes of its map, and clears once it owns one", () => {
      expect(enemyLines(battleProject({ 해골: ["검격"], 갑옷: ["방패 밀치기"] }, { name: "마왕", skills: ["검격"] })).some((m) => m.includes("보스"))).toBe(true);
      expect(enemyLines(battleProject({ 해골: ["검격"], 갑옷: ["방패 밀치기"] }, { name: "마왕", skills: ["검격", "암흑 파동"] }))).toEqual([]);
    });

    it("tells the model to fix it with upsert_enemy and names unused skills as candidates", () => {
      const p = battleProject({ 해골: ["맹독 이빨"], 갑옷: ["맹독 이빨"] });
      // 후보는 자료집 차례로 셋까지다 — 기본 자료집에도 안 쓰인 피해 기술(마법탄·빙결·잎날…)이 있어, 끝에 붙인 기술은 셋 안에 들지 못한다.
      // 그래서 맨 앞에 넣고, 이미 적이 쓰는 기술(맹독 이빨)은 후보에 없는지도 본다.
      p.database.skills.unshift({ ...structuredClone(p.database.skills[0]!), id: "skill_spare_bolt", name: "여분 마법탄", scope: "enemy", power: 40 } as never);
      const msg = enemyLines(p)[0] ?? "";
      expect(msg).toContain("upsert_enemy");
      expect(msg).toContain("skill_spare_bolt");
      expect(msg.split("기존 기술 후보:")[1] ?? "").not.toContain("맹독 이빨");
    });

    it("reaches the finish gate only for a whole-game request", () => {
      const after = battleProject({}, { name: "마왕", skills: [] });
      const before = createBlankProject() as Project;
      expect(gameLines(before, after, WHOLE).some((m) => m.startsWith("[게임 검사 적 개성]"))).toBe(true);
      expect(gameLines(before, after, "촌장 대사를 바꿔 줘").some((m) => m.startsWith("[게임 검사 적 개성]"))).toBe(false);
    });
  });
  describe("v2 whole-game tool exposure (fs-use-tools E1)", () => {
    it("offers the enemy and skill tools for an exploration game request that names no battle words", () => {
      const names = v2ExtraToolNames("귀여운 고양이가 주인공인 탐험 게임 만들어줘");
      for (const tool of ["upsert_enemy", "upsert_skill", "upsert_equipment"]) expect(names).toContain(tool);
    });
    it("does not offer them for a small map-only edit", () => {
      expect(v2ExtraToolNames("마을 지도 길을 넓혀줘")).not.toContain("upsert_enemy");
    });
  });
});

// 완료 판정(2026-11-11 J-B2): 화면 검수의 다듬기·모델이 받아 보지 못한 항목·장부는 완료를 막지 않는다. 그 밖의 막힘은 막는다.
describe("aiV2FinalReport", () => {
  isolateTimers();
  function storeWith(vqa: { severity?: "polish"; offered?: boolean; by?: "model" | "auto" }[], extra?: "gate-blocked"): TodoStore {
    const store = new TodoStore();
    store.init([{ phase: "짓기", items: [{ content: "마을을 짓는다" }] }]);
    store.done(store.items[0]!, undefined);
    const opened = store.append("화면 검수 1판", vqa.map((v, i) => ({ content: `결함 ${i}`, key: `vqa:map:m:${i}`, ...(v.severity ? { severity: v.severity } : {}) })), "vqa");
    vqa.forEach((v, i) => {
      if (v.offered !== false) { store.start(opened[i]!); store.markOffered(); }
      store.block(opened[i]!, "남음", v.by ?? "auto");
    });
    if (extra === "gate-blocked") { const [g] = store.append("함수 검사", [{ content: "엔딩을 부르는 이벤트가 없다", key: "game:ending" }], "gate"); store.block(g!, "고치는 도구가 없다", "auto"); }
    return store;
  }
  describe("todoReport completion", () => {
    it.each([
      ["polish left after one hand-off", [{ severity: "polish" as const }], undefined, true],
      ["polish the model blocked itself", [{ severity: "polish" as const, by: "model" as const }], undefined, true],
      ["blocker still there after the model had it", [{}], undefined, false],
      ["blocker the model blocked", [{ by: "model" as const }], undefined, false],
      ["blocker closed by code before the model ever received it", [{ offered: false }], undefined, true],
      ["polish only, but a function-check item is blocked", [{ severity: "polish" as const }], "gate-blocked" as const, false],
    ])("%s → complete %s", (_name, vqa, extra, complete) => {
      const report = todoReport({ store: storeWith(vqa, extra), draft: "마을을 지었습니다." });
      expect(report.complete).toBe(complete);
    });

    it("shows remaining polish and the ledger without calling them blocked", () => {
      const report = todoReport({ store: storeWith([{ severity: "polish" }]), draft: "마을을 지었습니다.", vqaLedger: ["[다듬기] 맵 «호수» — 배가 눈밭에 놓여 있다"] });
      expect(report.complete).toBe(true);
      expect(report.text).toContain("| 다듬기 남음 |");
      expect(report.text).not.toContain("| 막힘 |");
      expect(report.text).toContain("다듬기 남음 1(완료를 막지 않음)");
      expect(report.text).toContain("화면 검수 장부");
      expect(report.text).toContain("배가 눈밭에 놓여 있다");
    });

    it("a known model-fixable blocker that could not be handed over keeps the turn incomplete", () => {
      const store = storeWith([{ severity: "polish" }]);
      const line = "맵 «왕의 묘실» (20×15칸) · 오른쪽 — 보물상자가 벽에 묻혀 다가갈 수 없다";
      expect(todoReport({ store, draft: "", vqaUnoffered: [] }).complete).toBe(true);
      const report = todoReport({ store, draft: "", vqaUnoffered: [line], vqaLedger: ["[다듬기] 맵 «호수» — 배가 눈밭에 놓여 있다"] });
      expect(report.complete).toBe(false);
      expect(report.text).toContain("건네지 못한 화면 검수 막음 1");
      expect(report.text).toContain("다음 턴에 할 일로 건넨다");
      expect(report.text).toContain("보물상자가 벽에 묻혀");
    });

    it("counts only holding items as 막힘 in the head line", () => {
      const report = todoReport({ store: storeWith([{ severity: "polish" }, {}]), draft: "" });
      expect(report.complete).toBe(false);
      expect(report.text).toContain("막힘 1");
      expect(report.text).toContain("다듬기 남음 1");
    });
  });
});
