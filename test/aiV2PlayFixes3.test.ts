// 2026-11-14 r4d-fun(사막) · r4c-fun(버들항) 네 번째 확인 빌드 두 편을 타이틀에서 엔딩까지 해 보고 찾은 결함의 고친 자리.
// 명세는 harness-data/assistant-capability/spec-bank/r4d-fun.json · r4c-fun.json 에 있고(명세 은행이 통째로 다시 짓는다), 여기서는 고친 규칙만 작은 값으로 본다.
// 문서 openwiki/assistant-v2.md 「직접 플레이 셋째 판에서 찾은 결함」. 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import type { GameEvent, Project } from "@/project/types";
import { store } from "@/project/store";
import { startSession } from "@/project/session";
import { SENSIBLE_POTION_HP_RATIO, simulateBattle } from "@/battle/simulate";
import { fitTroopCopy } from "@/editor/tools/bossThreatScaling";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { bossDefeatReturns } from "@/ai/v2/story/bossTalkBattles";
import { chaserEvents, chaserMapsWithoutHiding } from "@/project/chaserHiding";
import { foeOnStoryWay, isBossRoom, isStoryRoom } from "@/ai/v2/place/storyWays";
import { clearFoesFromStoryWays } from "@/ai/v2/place/worldPopulate";
import { fitPathBattlesIn, pathBattles } from "@/ai/v2/story/pathBattleBudget";
import { BOSS_BAND } from "@/ai/v2/story/pathBattleTension";
import { settleQuestStepPages } from "@/project/quest/questHost";
import { resolveEventPage } from "@/project/io/pageResolution";
import { codeReadable } from "@/project/codeReading";
import { pickPersonGraphic } from "@/ai/v2/place/people";
import { redressHeroTwins } from "@/ai/v2/story/heroTwins";
import { settleSpeakerBustsIn } from "@/ai/v2/story/speakerBust";
import { lockStepOrderDoorsIn, pointLockedPagesIn } from "@/ai/v2/story/blueprintPathGates";
import { stepObjectives } from "@/ai/v2/story/blueprintPathText";
import { ensureStartingGold } from "@/ai/v2/story/healingAccess";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { applyUiLook, shopSurfaceForMenu, UI_LOOKS } from "@/project/uiLook";
import { createShopOverlay } from "@/player/playSceneShopDom";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { interactionPromptLabel } from "@/player/zoneFeedback";
import { installFakeDom } from "./fakeDom";

type Obj = Record<string, unknown>;
const page = (conditions: unknown[], commands: unknown[], kind = "action", more: Obj = {}) =>
  ({ id: "p", name: "p", conditions, trigger: { kind }, priority: "same", graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 }, commands, ...more });
const event = (id: string, name: string, x: number, y: number, pages: unknown[], kind = "action") => ({ id, name, x, y, trigger: { kind }, commands: [], pages });
const blueprint = (steps: unknown[], more: Obj = {}) => ({ request: "게임", title: "t", genre: "g", premise: "p", playerGoal: "g", ending: { name: "끝", how: "z", feeling: "w" }, steps, ...more }) as never;
const chip = (sheet: string, index: number, direction = "down") => ({ sprite: { type: "bundled", id: `tex_easyrpg_charset_${sheet}` }, direction, pattern: charsetFrameIndex({ characterIndex: index, direction: direction as "down", pattern: 1 }) });
const runOf = (project: Project) => createBuildRun({ project, currentMapId: project.startMapId, assistantRun: true } as never);
/** 시작 맵 「마을」과 그 사본 「잠든 왕의 묘실」(map_cave) — 마을의 문이 묘실 (3,9) 로 잇는다. */
function twoPlaces(): { project: Project; start: Project["maps"][string]; cave: Project["maps"][string] } {
  const project = createBlankProject() as Project;
  const start = project.maps[project.startMapId]!;
  start.name = "마을";
  const cave = { ...structuredClone(start), id: "map_cave", name: "잠든 왕의 묘실", events: [] } as typeof start;
  project.maps[cave.id] = cave;
  start.events = [event("ev_door", "", 8, 8, [page([], [{ kind: "transfer", mapId: "map_cave", x: 3, y: 9 }], "playerTouch")], "playerTouch")] as never;
  return { project, start, cave };
}
const commandsOf = (ev: GameEvent | undefined, pageIndex = 0) => (ev?.pages?.[pageIndex]?.commands ?? []) as unknown as Obj[];

// 1) 길에서 만난 적에게 져도 게임 시작점이 아니라 그 장소의 입구에서 깨어난다(r4d-fun: 묘실의 박쥐에게 지면 오아시스 광장 — 문 셋과 번호 자물쇠를 다시 지났다).
describe("길 적에게 져도 그 장소에서 깨어난다", () => {
  const withFoe = (blueprinted: boolean) => {
    const { project, cave } = twoPlaces();
    cave.events = [event("ev_bat", "박쥐", 5, 5, [page([], [{ kind: "battleProcessing", troopId: "troop_slime", canEscape: true, canLose: false }, { kind: "text", body: "박쥐를 쫓아냈다." }], "eventTouch")], "eventTouch")] as never;
    (project.system as unknown as Obj).gameOver = { outcome: "recover", message: "눈앞이 캄캄해졌다. 마을 광장에서 눈을 떴다." };
    if (blueprinted) project.gameBlueprint = blueprint([{ id: "s1", place: "마을", event: "x", label: "l" }]);
    return project;
  };

  it("도망칠 수 있는 이벤트 전투도 지는 갈래가 그 맵의 들어온 칸으로 돌아오고, 글은 깨어나는 곳을 말한다 — 다시 돌려도 그대로", () => {
    const run = runOf(withFoe(true));
    expect(bossDefeatReturns(run)).toHaveLength(1);
    const project = run.ctx.project;
    const battle = commandsOf(project.maps.map_cave!.events[0])[0]!;
    expect(battle.canLose).toBe(true);
    expect(battle.defeatBranch).toEqual([{ kind: "gameOver", gameOverId: "go_back_map_cave" }]);
    // 이긴 뒤의 글은 이긴 갈래로 — 진 플레이어에게 «쫓아냈다» 가 나오지 않는다.
    expect(JSON.stringify(battle.victoryBranch)).toContain("박쥐를 쫓아냈다.");
    expect(commandsOf(project.maps.map_cave!.events[0])).toHaveLength(1);
    const def = (project.system as unknown as { gameOvers: { id: string; settings: { recovery: Obj; message: string } }[] }).gameOvers.find((g) => g.id === "go_back_map_cave")!;
    expect(def.settings.recovery).toEqual({ mapId: "map_cave", x: 3, y: 9 });
    expect(def.settings.message).toContain("정신을 차리니 「잠든 왕의 묘실」 입구다.");
    expect(def.settings.message).not.toContain("마을 광장");
    expect(bossDefeatReturns(run)).toEqual([]);
  });

  it("돌아올 자리를 받은 쫓는 길 적은 여전히 «싸우는 적» 이다 — 숨을 곳을 요구하는 추격자로 읽히지 않는다", () => {
    // 지는 갈래가 생기면 canLose 가 켜진다. 그것만 보고 «져도 되는 벌 전투의 추격자» 로 읽으면 그 맵에 «숨을 곳 없음» 출하 차단이 선다(r4d-fun 태양 피라미드).
    const project = withFoe(true);
    const chase = { type: "chase", speed: 3, frequency: 3, sightRange: 3 };
    const cave = project.maps.map_cave!;
    (cave.events[0]!.pages![0] as unknown as Obj).movement = chase;
    cave.events.push(event("ev_punisher", "", 14, 9, [page([], [{ kind: "battleProcessing", troopId: "troop_slime", canEscape: false, canLose: true, defeatBranch: [{ kind: "text", body: "붙잡혔다." }] }], "eventTouch", { movement: chase })], "eventTouch") as unknown as GameEvent);
    expect(chaserEvents(cave).map((ev) => ev.id)).toEqual(["ev_punisher"]);
    const run = runOf(project);
    expect(bossDefeatReturns(run)).toHaveLength(1);
    const built = run.ctx.project.maps.map_cave!;
    expect(commandsOf(built.events[0])[0]!.canLose).toBe(true);
    expect(chaserEvents(built).map((ev) => ev.id)).toEqual(["ev_punisher"]);
    built.events = built.events.filter((ev) => ev.id !== "ev_punisher");
    expect(chaserMapsWithoutHiding(run.ctx.project)).toEqual([]);
  });

  it("청사진이 없는 일(장면 하나 고치기)에서는 저장본의 필드 적을 다시 쓰지 않는다", () => {
    const run = runOf(withFoe(false));
    expect(bossDefeatReturns(run)).toEqual([]);
    expect(commandsOf(run.ctx.project.maps.map_cave!.events[0])[0]!.canLose).toBe(false);
  });
});

// 2) 보스 방(도망 못 치는 싸움·쉼터가 선 방)과 단계로 가는 길에는 돌아다니는 적이 없다(r4d-fun: 가로 13칸 묘실에 쫓는 박쥐 — 스무 판 모두 잡혔다).
describe("이야기가 지나는 방과 길의 돌아다니는 적", () => {
  const foe = (mapId: string, x: number, y: number) => event(`ev_${mapId}_wfoe1`, "박쥐", x, y, [page([], [{ kind: "battleProcessing", troopId: "troop_slime", canEscape: true }], "eventTouch")], "eventTouch");
  const boss = (x: number, y: number) => event("ev_boss", "수호자", x, y, [page([], [{ kind: "battleProcessing", troopId: "troop_slime", canEscape: false }])]);

  it("방 한 칸(13×11)에 보스가 서면 그 방의 돌아다니는 적은 걷는다", () => {
    const { project, start } = twoPlaces();
    const room = { ...createBlankMap("묘실", 13, 11, start.tilesetId), id: "map_room" };
    project.maps[room.id] = room;
    start.events = [event("ev_door", "", 8, 8, [page([], [{ kind: "transfer", mapId: "map_room", x: 6, y: 9 }], "playerTouch")], "playerTouch")] as never;
    room.events = [foe("map_room", 3, 5), boss(6, 2)] as never;
    expect(isStoryRoom(project, "map_room")).toBe(true);
    expect(isBossRoom(project, "map_room")).toBe(true);
    expect(foeOnStoryWay(project, "map_room", room.events[0]!)).toBe(true);
    const run = runOf(project);
    expect(clearFoesFromStoryWays(run)).toHaveLength(1);
    expect(run.ctx.project.maps.map_room!.events.map((e) => e.id)).toEqual(["ev_boss"]);
    expect(clearFoesFromStoryWays(run)).toEqual([]);
  });

  it("사람 단계만 있는 방은 보스 방이 아니다 — 그 장소의 적은 그대로 서고(밴드는 피할 수 없는 싸움으로 센다), 싸우는 단계의 방이면 걷는다", () => {
    // 위험한 장소의 작은 동굴(test/aiV2World 의 얼음 동굴)에는 적이 선다 — 방이라는 까닭만으로 걷지 않는다.
    const build = (kind: string) => {
      const { project, start } = twoPlaces();
      const room = { ...createBlankMap("얼음 굴", 13, 11, start.tilesetId), id: "map_room" };
      project.maps[room.id] = room;
      start.events = [event("ev_door", "", 8, 8, [page([], [{ kind: "transfer", mapId: "map_room", x: 6, y: 9 }], "playerTouch")], "playerTouch")] as never;
      room.events = [foe("map_room", 3, 5), event("ev_hermit", "은자", 6, 2, [page([], [{ kind: "text", speaker: "은자", body: "어서 오게." }])])] as never;
      project.gameBlueprint = blueprint([{ id: "s1", kind, who: "은자", place: "얼음 굴", event: "은자", label: "l", built: { mapId: "map_room", eventId: "ev_hermit" } }]);
      return project;
    };
    const calm = build("talk");
    expect(isBossRoom(calm, "map_room")).toBe(false);
    expect(foeOnStoryWay(calm, "map_room", calm.maps.map_room!.events[0]!)).toBe(true);
    const calmRun = runOf(calm);
    expect(clearFoesFromStoryWays(calmRun)).toEqual([]);
    expect(calmRun.ctx.project.maps.map_room!.events.map((e) => e.id)).toEqual(["ev_map_room_wfoe1", "ev_hermit"]);
    const fight = build("battle");
    expect(isBossRoom(fight, "map_room")).toBe(true);
    const fightRun = runOf(fight);
    expect(clearFoesFromStoryWays(fightRun)).toHaveLength(1);
    expect(fightRun.ctx.project.maps.map_room!.events.map((e) => e.id)).toEqual(["ev_hermit"]);
  });

  it("넓은 맵에서는 들어오는 칸과 보스 사이의 길을 지켜보는 적만 다른 자리로 옮긴다 — 보스가 없는 맵의 적은 그대로", () => {
    const { project, cave } = twoPlaces();
    cave.events = [foe("map_cave", 5, 5), boss(6, 3)] as never;
    expect(isStoryRoom(project, "map_cave")).toBe(false);
    expect(foeOnStoryWay(project, "map_cave", cave.events[0]!)).toBe(true);
    const plain = structuredClone(project);
    plain.maps.map_cave!.events = [structuredClone(cave.events[0]!)];
    expect(foeOnStoryWay(plain, "map_cave", plain.maps.map_cave!.events[0]!)).toBe(false);
    expect(clearFoesFromStoryWays(runOf(plain))).toEqual([]);
    const run = runOf(project);
    expect(clearFoesFromStoryWays(run)).toHaveLength(1);
    const moved = run.ctx.project.maps.map_cave!.events.find((e) => e.id === "ev_map_cave_wfoe1")!;
    expect([moved.x, moved.y]).not.toEqual([5, 5]);
    expect(foeOnStoryWay(run.ctx.project, "map_cave", moved)).toBe(false);
    expect(clearFoesFromStoryWays(run)).toEqual([]);
  });
});

// 3) 길 적을 잡고 한 레벨 높게 와도 «공격» 만으로는 못 이긴다(r4d-fun: 쉬고 온 Lv2 가 약 0개로 7판 5승 — 밴드는 Lv1 로만 쟀다).
describe("보스 밴드는 도착할 수 있는 높은 레벨까지 «공격만» 을 막는다", () => {
  it("도착 Lv1~2 의 마지막 보스: Lv2 로 쉬고 와도 공격만으로는 지고, 기술·약으로는 밴드 안에서 이긴다", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    const boss = fitTroopCopy(project, "troop_slime", "boss")!;
    const battlePage = (troopId: string, canEscape: boolean, kind: string) => ({ id: "p0", name: "p0", conditions: [], trigger: { kind }, commands: [{ kind: "battleProcessing", troopId, canEscape, canLose: false }] });
    map.events = [...(map.events ?? []),
      { id: "ev_foe", name: "", x: 3, y: 3, trigger: { kind: "eventTouch" }, commands: [], pages: [battlePage("troop_slime", true, "eventTouch")] },
      { id: "ev_boss", name: "문지기", x: 6, y: 3, trigger: { kind: "action" }, commands: [], pages: [battlePage(boss, false, "action")] }] as never;
    project.gameBlueprint = blueprint([{ id: "s1", place: map.name ?? map.id, event: "ev_foe", label: "l" }, { id: "s2", place: map.name ?? map.id, event: "문지기", label: "l" }]);
    const line = fitPathBattlesIn(project).find((note) => note.startsWith("보스 밴드"))!;
    expect(line).toContain("쉬고 온 Lv1(도착 Lv1~2)");
    expect(line).toContain("공격만·회복 없음(쉬고 온 Lv2 까지)");
    const ids = project.system.startActorIds!;
    const troopId = pathBattles(project).find((b) => b.role === "boss")!.troopId;
    const potions = project.session.inventory!.item_hi_potion!;
    for (const heroLevel of [1, 2]) {
      const attackOnly = simulateBattle({ project, troopId, heroLevel, partyActorIds: ids, n: 24, seed: 11 });
      const normal = simulateBattle({ project, troopId, heroLevel, partyActorIds: ids, n: 24, seed: 11, useSkills: true, potionHpRatio: SENSIBLE_POTION_HP_RATIO, inventory: { item_hi_potion: potions }, potionItemId: "item_hi_potion" });
      expect(attackOnly.winRate, `Lv${heroLevel} 공격만`).toBeLessThanOrEqual(BOSS_BAND.attackOnlyMaxWin);
      expect(normal.winRate, `Lv${heroLevel} 여느 플레이`).toBeGreaterThanOrEqual(BOSS_BAND.minWin);
      expect(normal.avgTurns, `Lv${heroLevel} 턴`).toBeLessThanOrEqual(BOSS_BAND.turns);
    }
    // 껍질은 «공격만» 을 막는 가장 작은 값이라 여느 플레이도 아슬아슬한 값이 뽑힌다 — 기준 파티의 여느 플레이를 많은 판(96)으로도 지킨다
    // (은행 jrpg-w3: 24판 100% 로 받은 껍질이 300판에서 92% 였고, 자동 플레이가 기준 파티 그대로 서서 졌다).
    const sure = simulateBattle({ project, troopId, heroLevel: 1, partyActorIds: ids, n: 96, seed: 11, useSkills: true, potionHpRatio: SENSIBLE_POTION_HP_RATIO, inventory: { item_hi_potion: potions }, potionItemId: "item_hi_potion" });
    expect(sure.winRate, "기준 파티의 여느 플레이(96판)").toBeGreaterThanOrEqual(BOSS_BAND.minWin);
    expect(line.startsWith("보스 밴드 안")).toBe(true);
  }, 240_000);
});

// 4) 들를 곳인 사람이 제 의뢰의 주인이기도 해도 들를 곳 페이지가 열린다(r4d-fun «누르의 물동이» · r4c-fun «사라진 비둘기» 가 영영 안 끝났다).
describe("한 사람에게 얹힌 의뢰 페이지의 차례", () => {
  it("단계가 열려 있는 동안은 그 단계 페이지가 뒤에 선 제안·진행 페이지보다 먼저다 — 페이지는 옮기지 않는다, 다시 돌려도 그대로", () => {
    const { project, start } = twoPlaces();
    (project as unknown as Obj).quests = [
      { key: "q_a", title: "A", summary: "", steps: [], giver: { mapId: start.id, eventId: "ev_x" } },
      { key: "q_b", title: "B", summary: "", steps: [], giver: { mapId: start.id, eventId: "ev_nur" } }];
    const sw = (switchId: string, value: boolean) => ({ kind: "switch", switchId, value });
    const say = (body: string) => [{ kind: "text", speaker: "누르", body }];
    const nur = event("ev_nur", "누르", 2, 2, [
      { ...page([], say("안녕.")), id: "ev_nur_p0" },
      { ...page([sw("sw_q_a_started", true), sw("sw_q_a_step0", false)], say("물값 소문? 들었어.")), id: "ev_nur_q_a_talk0" },
      { ...page([sw("sw_q_b_started", false)], say("부탁이 있어.")), id: "ev_nur_q_b_offer" },
      { ...page([sw("sw_q_b_started", true), sw("sw_q_b_done", false)], say("아직이야?")), id: "ev_nur_q_b_active" },
      { ...page([sw("sw_q_b_done", true)], say("고마워.")), id: "ev_nur_q_b_done" }]) as unknown as GameEvent;
    start.events = [nur];
    const body = (switches: Record<string, boolean>) => (resolveEventPage(nur, { switches, variables: {}, selfSwitches: {}, inventory: {} } as never)!.commands[0] as unknown as { body: string }).body;
    // 앞: 남의 의뢰(A)의 들를 곳인데 제 의뢰(B)의 제안이 늘 이긴다.
    expect(body({ sw_q_a_started: true })).toBe("부탁이 있어.");
    expect(settleQuestStepPages(project)).toBe(3);
    expect(body({ sw_q_a_started: true })).toBe("물값 소문? 들었어.");
    expect(body({ sw_q_a_started: true, sw_q_b_started: true })).toBe("물값 소문? 들었어.");
    // 그 단계를 마치면(또는 A 를 안 받았으면) 제 의뢰의 페이지가 전처럼 돈다.
    expect(body({})).toBe("부탁이 있어.");
    expect(body({ sw_q_a_started: true, sw_q_a_step0: true })).toBe("부탁이 있어.");
    expect(body({ sw_q_a_started: true, sw_q_a_step0: true, sw_q_b_started: true })).toBe("아직이야?");
    expect(body({ sw_q_b_started: true, sw_q_b_done: true })).toBe("고마워.");
    expect(nur.pages!.map((p) => p.id)).toEqual(["ev_nur_p0", "ev_nur_q_a_talk0", "ev_nur_q_b_offer", "ev_nur_q_b_active", "ev_nur_q_b_done"]);
    expect(settleQuestStepPages(project)).toBe(0);
  });
});

// 5) 이름 있는 사람은 저마다 제 얼굴로 선다(r4d-fun: 술탄 = 대신, 라일라 = 사미르 = 오마르, 카림이 젊은 여성, 가게 주인이 장로의 얼굴).
describe("이름 있는 사람의 칩", () => {
  const stand = (project: Project, people: readonly (readonly [string, string | undefined])[]) => {
    const map = project.maps[project.startMapId]!;
    return people.map(([who, looks], i) => {
      const pick = pickPersonGraphic(project, map, who, looks, true)!;
      map.events = [...(map.events ?? []), event(`ev_p${i}`, who, i, 0, [page([], [], "action", { graphic: chip(pick.textureKey.replace("tex_easyrpg_charset_", ""), pick.characterIndex) })]) as unknown as GameEvent];
      return pick;
    });
  };
  const CAST = [["장로 하산", undefined], ["향신료 상인 라일라", undefined], ["찻집 주인 사미르", undefined], ["대상 우두머리 카림", undefined], ["대신 자파르", undefined], ["술탄 하룬", undefined],
    ["낙타꾼", "남자 상인"], ["상인", "여자 상인"], ["상인", "중년 남성 주민"], ["여관 주인", "중년 여성 주민"]] as const;

  it("사막 게임의 열 사람이 서로 다른 칩으로 선다 — 직함은 그 사람의 성별과 차림으로 읽힌다", () => {
    const project = createBlankProject() as Project;
    project.gameBlueprint = blueprint([], { setting: "desert_east" });
    project.maps[project.startMapId]!.tilesetId = "desert_east";
    const picks = stand(project, CAST);
    expect(new Set(picks.map((p) => `${p.textureKey}#${p.characterIndex}`)).size).toBe(CAST.length);
    expect(picks.some((p) => p.shared)).toBe(false);
    const label = (who: string) => picks[CAST.findIndex(([name]) => name === who)]!.label;
    expect(label("대신 자파르")).toBe("귀족 남성");
    expect(label("술탄 하룬")).toBe("왕");
    expect(label("대상 우두머리 카림")).toBe("중년 남성 주민(흑인)");
    expect(label("장로 하산")).toBe("대머리 남성 주민");
  });

  it("칩이 데려오는 흉상의 나이도 잰다 — 노인 칩이 다 섰어도 «노인» 이 젊은 얼굴의 칩으로 서지 않는다", () => {
    // 은행 r2t-fun: 노인 칩 둘이 이미 선 주점에 «노인» 요른이 «중년 여성 주민» 칩으로 섰다 — 그 칩의 흉상은 «젊은 여성» 이라 게임 검사가 «나이 든 인물인데 젊은 얼굴» 을 짚었다.
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    const taken = [["people1", 4], ["people5", 0], ["people1", 1], ["people1", 7], ["people5", 6], ["people1", 6], ["people1", 3], ["actor4", 1]] as const;
    map.events = taken.map(([sheet, index], n) => event(`ev_t${n}`, `사람${n}`, n, 6, [page([], [], "action", { graphic: chip(sheet, index) })])) as never;
    const pick = pickPersonGraphic(project, map, "주점 손님", "노인", true)!;
    expect(pick.label).toBe("대머리 남성 주민");
    expect(pick.shared).toBe(true);
  });

  it("모델이 말한 성별·나이를 지킨다 — «왕» 은 «여왕» 에 걸리지 않는다", () => {
    const fresh = () => { const project = createBlankProject() as Project; return [project, project.maps[project.startMapId]!] as const; };
    const pick = (who: string, looks?: string) => { const [project, map] = fresh(); return pickPersonGraphic(project, map, who, looks, true)!.label; };
    expect(pick("농부", "농부 청년")).toBe("청년 남성");
    expect(pick("향신료 상인 라일라", "young woman")).toBe("젊은 여성");
    expect(pick("여관 주인 미라", "woman")).toBe("젊은 여성");
    expect(pick("여관 주인 미라")).toBe("여관 주인");
    expect(pick("여왕")).toBe("여왕");
    expect(pick("왕비")).toBe("여왕");
    expect(pick("왕")).toBe("왕");
  });

  it("주인공의 쌍둥이를 다시 입힐 칩이 이 게임의 다른 사람과 겹치면 입히지 않는다", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    const hero = project.database.actors.find((a) => a.id === project.system.startActorIds![0])! as { characterResourceId?: string; characterIndex?: number };
    hero.characterResourceId = "easyrpg-charset-actor4";
    hero.characterIndex = 0;
    // 청년·중년 남자 칩이 모두 선 게임 — 대장장이(people1 2번 = 주인공과 같은 모습)에게 남은 맞는 칩이 없다.
    const taken = [["people1", 4], ["people1", 6], ["actor4", 1], ["actor4", 2], ["people4", 2], ["people5", 0], ["people5", 2], ["actor1", 0], ["actor1", 4], ["actor2", 7], ["people3", 2]] as const;
    map.events = [
      event("ev_smith", "대장장이", 3, 3, [page([], [{ kind: "text", speaker: "대장장이", body: "어서 오게." }], "action", { graphic: chip("people1", 2) })]),
      ...taken.map(([sheet, index], n) => event(`ev_t${n}`, `사람${n}`, n, 6, [page([], [], "action", { graphic: chip(sheet, index) })]))] as never;
    const notes = redressHeroTwins(project);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("그대로 둔다");
    const g = map.events.find((e) => e.id === "ev_smith")!.pages![0]!.graphic as unknown as { sprite: { id: string }; pattern: number };
    expect([g.sprite.id, decodeCharsetFrameIndex(g.pattern).characterIndex]).toEqual(["tex_easyrpg_charset_people1", 2]);
  });
});

// 6) 모델의 노래가 번호를 정하면 답을 적은 쪽지를 덧붙이지 않는다(r4d-fun: 노래 퍼즐 옆에 「4172」 를 적은 «번호 쪽지»).
describe("글에서 번호가 읽히는가", () => {
  it("한 사람의 말에 차례로 나오는 수 낱말이 답과 같으면 읽힌다 — 차례가 다르거나 수를 세는 말이 아니면 아니다", () => {
    const song = ["옛 왕은 문을 이 노래로 잠갔다네. '낙타 네 마리가 길을 열고, 달 하나가 길을 비추네. 별 일곱이 따라오고, 모래시계 둘이 끝을 맺네.'"];
    expect(codeReadable("4172", [song])).toBe(true);
    expect(codeReadable("4172", [["허허, 차 한 잔 하게나."], song])).toBe(true);
    expect(codeReadable("4271", [song])).toBe(false);
    expect(codeReadable("4172", [["네, 알겠습니다.", "문은 하나뿐이다."]])).toBe(false);
    expect(codeReadable("3862", [["번호를 알아야 열 수 있다.", "1층에서 2명이 기다린다."]])).toBe(false);
    expect(codeReadable("3862", [["조상의 숫자는 3862다."]])).toBe(true);
  });
});

// 7) 상태 쪽의 HP 줄이 밝은 메뉴에서도 읽힌다(r4d-fun: 크림 바탕 위 흰 글자 — 대비 1.06).
describe("메뉴 설명 줄의 글자색", () => {
  it("설명 줄은 유리 창의 흰 글자가 아니라 그 메뉴 스킨의 글자색을 쓴다", () => {
    const css = readFileSync("src/styles/database/tabs-b-status-menu-main.css", "utf8");
    const rule = /\.status-menu-detail-row\.has-description \.status-menu-detail-description \{[^}]*\}/u.exec(css)![0];
    expect(rule).toMatch(/color: var\(--status-edge-ivory, var\(--runtime-glass-text\)\);/u);
  });
});

// 8) 상점이 그 게임의 메뉴와 같은 판으로 뜨고(게임마다 UI 모습 한 벌), 첫 상점의 가장 싼 회복약 하나는 시작 돈으로 살 수 있다.
describe("상점의 겉판과 시작 돈", () => {
  let restoreDom: (() => void) | undefined;
  beforeEach(() => { restoreDom = installFakeDom(); store.replace(createBlankProject()); });
  afterEach(() => { restoreDom?.(); restoreDom = undefined; });

  it("세트 열셋: 청색 창 계열과 윈도스킨 게임은 그대로, 나머지는 메뉴의 판을 쓴다", () => {
    expect(createShopOverlay().dataset.shopSurface).toBeUndefined();
    const got = Object.fromEntries(UI_LOOKS.map((look) => {
      store.replace(createBlankProject());
      store.update((draft) => { applyUiLook(draft, look.id, { force: true }); });
      const data = createShopOverlay().dataset;
      return [look.id, data.windowSkin ?? data.shopSurface ?? "blue"];
    }));
    expect(got).toEqual({ kingdom: "blue", storybook: "paper", gilded: "navy", rm2003: "classic", hanji: "paper", "ink-night": "navy", handheld: "cream", terminal: "glass", haunted: "glass", soft: "cream", cozy: "paper", cinematic: "glass", glass: "glass" });
    for (const menu of [undefined, "pixel", "classic", "retro-2003", "hub"]) expect(shopSurfaceForMenu(menu)).toBe("blue");
    // 표식마다 색 변수 한 벌이 있다 — 표식만 달고 칠이 없으면 청색 창 그대로다.
    const css = readFileSync("src/styles/runtime/shop.css", "utf8");
    for (const surface of new Set(UI_LOOKS.map((look) => shopSurfaceForMenu(look.menu)))) {
      if (surface !== "blue") expect(css, surface).toMatch(new RegExp(`\\.runtime-shop-preset-pixel\\[data-shop-surface="${surface}"\\] \\{[^}]*--shop-ink:`, "u"));
    }
  });

  it("첫 상점의 가장 싼 회복약을 못 사는 시작 돈이면 그 약 둘 값으로 올린다 — 살 수 있으면 그대로", () => {
    const gold = (had: number, price: number) => {
      const { project, start } = twoPlaces();
      const potion = project.database.items.find((i) => i.id === "item_hi_potion")!;
      potion.price = price;
      project.database.items.find((i) => i.id === "item_antidote")!.price = 40;
      start.events = [event("ev_shop", "상인", 3, 3, [page([], [{ kind: "shop", shopType: "normal", itemIds: [potion.id, "item_antidote"], allowSell: true }])])] as never;
      project.session.gold = had;
      const run = runOf(project);
      const notes = ensureStartingGold(run);
      expect(ensureStartingGold(run)).toEqual([]);
      return [run.ctx.project.session.gold, notes.length] as const;
    };
    // r4d-fun: 100G 에 회복약 105G — 해독초(40G)로 재면 «살 수 있다» 였다.
    expect(gold(100, 105)).toEqual([210, 1]);
    expect(gold(100, 60)).toEqual([100, 0]);
    expect(gold(0, 150)).toEqual([300, 1]);
    expect(gold(0, 30)).toEqual([100, 1]);
    expect(gold(100, 400)).toEqual([400, 1]);
  });
});

// 9) 갈래 뒤의 서술 줄이 앞사람의 얼굴 아래에 뜨지 않는다(r4d-fun: 엔딩 서술이 술탄의 흉상 아래에).
describe("갈래 뒤 서술 줄의 얼굴", () => {
  it("선택지 뒤의 서술 줄 앞에서 얼굴을 지운다", () => {
    const { project, start } = twoPlaces();
    start.events = [event("ev_sultan", "술탄", 4, 4, [page([], [
      { kind: "text", speaker: "술탄", body: "어찌하겠느냐?" },
      { kind: "choices", options: [{ text: "돌려준다", branch: [{ kind: "text", speaker: "술탄", body: "옳다." }] }, { text: "남긴다", branch: [{ kind: "text", speaker: "술탄", body: "그러냐." }] }] },
      { kind: "text", body: "샘에 맑은 물이 다시 솟았다." }], "action", { graphic: chip("people3", 0) })])] as never;
    expect(settleSpeakerBustsIn(project)).toHaveLength(1);
    const commands = commandsOf(start.events[0]);
    const shape = commands.map((c) => (c.kind === "changeFace" ? (c.resourceId ? "얼굴" : "지움") : String(c.kind)));
    expect(shape).toEqual(["얼굴", "text", "choices", "지움", "text"]);
  });
});

// 10) 잠긴 길의 안내가 아직 못 본 보스와 그 방의 이름을 미리 말하지 않는다(r4d-fun: «먼저 잠든 왕의 묘실의 「미라 수호자」에게 말을 걸어 보자»).
describe("앞 단계가 싸움인 길목의 안내", () => {
  const doorText = (kind: string) => {
    const { project, start, cave } = twoPlaces();
    const palace = { ...structuredClone(start), id: "map_palace", name: "궁전", events: [] } as typeof start;
    project.maps[palace.id] = palace;
    project.database.items.push({ ...structuredClone(project.database.items[0]!), id: "item_heart", name: "샘의 심장" } as never);
    cave.events = [
      event("ev_boss", "미라 수호자", 6, 3, [page([], [{ kind: "text", speaker: "미라 수호자", body: "물러가라." }, { kind: "battleProcessing", troopId: "troop_slime", canEscape: false }, { kind: "changeItem", itemId: "item_heart", op: "+=", amount: 1 }], "action", { graphic: chip("people3", 7) })]),
      event("ev_back", "", 3, 10, [page([], [{ kind: "transfer", mapId: start.id, x: 2, y: 7 }], "playerTouch")], "playerTouch")] as never;
    start.events = [
      event("ev_to_cave", "", 2, 8, [page([], [{ kind: "transfer", mapId: "map_cave", x: 3, y: 9 }], "playerTouch")], "playerTouch"),
      event("ev_to_palace", "", 8, 8, [page([], [{ kind: "transfer", mapId: "map_palace", x: 3, y: 3 }], "playerTouch")], "playerTouch")] as never;
    palace.events = [event("ev_vizier", "대신", 4, 4, [page([{ kind: "item", itemId: "item_heart", present: true }], [{ kind: "text", speaker: "대신", body: "그것은!" }])])] as never;
    project.gameBlueprint = blueprint([
      { id: "s1", kind, who: "미라 수호자", place: "잠든 왕의 묘실", event: "미라 수호자", label: "l", built: { mapId: "map_cave", eventId: "ev_boss", itemId: "item_heart" } },
      { id: "s2", kind: "talk", who: "대신", place: "궁전", event: "대신", label: "l", built: { mapId: "map_palace", eventId: "ev_vizier" } }]);
    expect(lockStepOrderDoorsIn(project)).toHaveLength(1);
    // 잠긴 글에 «먼저 …» 를 붙이는 끝맺음(pointLockedPagesIn)까지 돈 뒤의 글 — 그 단계가 뺀 줄을 다시 붙이지 않는다(은행: 둘째 줄로 돌아왔었다).
    pointLockedPagesIn(project);
    return commandsOf(project.maps[project.startMapId]!.events.find((e) => e.id === "ev_to_palace")).filter((c) => c.kind === "text").map((c) => String(c.body)).join(" / ");
  };

  it("싸움 단계 뒤의 문은 필요한 것만 말한다 — 말 단계 뒤의 문은 전처럼 그 사람을 가리킨다", () => {
    expect(doorText("battle")).toBe("샘의 심장이 있어야 이 길로 갈 수 있을 것 같다.");
    expect(doorText("talk")).toBe("샘의 심장이 있어야 이 길로 갈 수 있을 것 같다. 먼저 잠든 왕의 묘실의 「미라 수호자」에게 말을 걸어 보자.");
  });
});

// 11) 시작 목표는 첫 단계의 할 일 한 줄이다(r4d-fun: 게임의 목표 문장 113자가 목표 칸에서 잘렸다).
describe("시작 목표", () => {
  const startObjective = (goals: readonly string[]) => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    map.name = "마을";
    map.events = [
      event("ev_elder", "장로 하산", 4, 4, [page([], [{ kind: "text", speaker: "장로 하산", body: "샘이 말랐네." }])]),
      event("ev_merchant", "라일라", 8, 4, [page([], [{ kind: "text", speaker: "라일라", body: "어서 와." }])])] as never;
    project.gameBlueprint = blueprint([
      { id: "s1", kind: "talk", who: "장로 하산", place: "마을", event: "장로 하산", label: "l" },
      { id: "s2", kind: "talk", who: "라일라", place: "마을", event: "라일라", label: "l" }], { playerGoal: "말라가는 오아시스를 살리려면 도둑맞은 샘의 심장을 되찾아야 한다. 시장에서 단서를 모아라." });
    const run = runOf(project);
    expect(stepObjectives(run, goals, [{ step: 0, name: "장로 하산", made: { mapId: map.id, eventId: "ev_elder" } }, { step: 1, name: "라일라", made: { mapId: map.id, eventId: "ev_merchant" } }])).toContain("시작 목표");
    return JSON.stringify(run.ctx.project.maps[project.startMapId]!.events.find((e) => e.id === "ev_objective_start"));
  };

  it("첫 단계의 목표 줄을 쓴다 — 목표 줄이 없을 때만 게임의 목표 문장", () => {
    const text = startObjective(["장로 하산에게 샘이 마른 까닭을 듣자", "라일라에게 목격담을 듣자"]);
    expect(text).toContain("장로 하산에게 샘이 마른 까닭을 듣자");
    expect(text).not.toContain("되찾아야");
    expect(startObjective([])).toContain("되찾아야");
  });
});

// 12 · 13) 메뉴와 안내의 낱말.
describe("플레이어 화면의 낱말", () => {
  it("메뉴 스킬 쪽의 주인공 설명에 자리표시 별명 «없음» 을 내지 않는다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const hero = project.database.actors.find((a) => a.id === project.system.startActorIds![0])!;
    const row = () => createStatusMenuDetail({ project, session, slots: [], waitModeEnabled: true, selectedCommand: "skills" }).entries[0]!;
    expect(hero.nickname).toBe("없음");
    expect(row().description).toBe("스킬 목록을 봅니다");
    hero.nickname = "샘지기";
    expect(row().description).toBe("샘지기");
  });

  it("조건 갈래로 시작하는 의뢰 페이지의 사람 앞에서도 «Z 대화» 다 — 갈래 안에 이름 붙은 대사가 없으면 «Z 조사»", () => {
    const fork = { kind: "fork", condition: { kind: "switch", switchId: "s", value: true }, then: [{ kind: "text", speaker: "야스민", body: "고마워." }], else: [{ kind: "text", speaker: "야스민", body: "아직이야?" }] };
    const stone = { kind: "fork", condition: { kind: "switch", switchId: "s", value: true }, then: [{ kind: "text", body: "낡은 비석이다." }], else: [] };
    const label = (commands: unknown[], graphic: unknown = chip("people1", 3)) => interactionPromptLabel(page([], commands, "action", { graphic }) as never);
    expect(label([{ kind: "text", speaker: "야스민", body: "안녕." }])).toBe("Z 대화");
    expect(label([fork])).toBe("Z 대화");
    expect(label([stone])).toBe("Z 조사");
    expect(label([fork], {})).toBe("Z 조사");
    // 서술 한 줄만 남은 «끝난 뒤» 페이지 — 그 이벤트의 다른 페이지에서 말하는 사람이면 여전히 «Z 대화»(r4c-fun 여관 주인 미라). 말한 적 없는 물건은 «Z 조사».
    const done = page([], [{ kind: "text", body: "(야스민과는 이미 이야기를 마쳤다.)" }], "action", { graphic: chip("people1", 3) });
    const person = event("ev_yasmin", "야스민", 1, 1, [page([], [{ kind: "text", speaker: "야스민", body: "안녕." }], "action", { graphic: chip("people1", 3) }), done]);
    const thing = event("ev_stone", "비석", 1, 1, [page([], [stone], "action", { graphic: chip("people1", 3) }), done]);
    expect(interactionPromptLabel(done as never)).toBe("Z 조사");
    expect(interactionPromptLabel(done as never, person as never)).toBe("Z 대화");
    expect(interactionPromptLabel(done as never, thing as never)).toBe("Z 조사");
  });
});

// 15) 레트로 메뉴 첫 화면: 명령이 여덟이어도 명령 창 안에 들고, 돈·시간 칸은 그 아래로 내려간다(r4c-fun: «설정»·«타이틀로» 가 돈·시간 칸 위에 겹쳤다).
describe("레트로 메뉴의 명령 창 높이", () => {
  it("높이와 돈·시간 칸의 자리를 명령 수로 잡는다 — 일곱까지는 전과 같은 128px · 175px · 199px", () => {
    const css = readFileSync("src/styles/runtime/statusMenuLegacySkins.css", "utf8");
    expect(css).toContain("--legacy-dock-h: max(128px, calc(var(--status-menu-command-count, 6) * 16px + 8px));");
    expect(css.match(/\.status-menu-primary-dock \{ bottom: auto; gap: 1px; height: var\(--legacy-dock-h\); \}/gu)).toHaveLength(2);
    expect(css).toContain("top: max(175px, calc(40px + var(--legacy-dock-h) + 3px));");
    expect(css.match(/top: max\(199px, calc\(40px \+ var\(--legacy-dock-h\) \+ 23px\)\);/gu)).toHaveLength(2);
    // 일곱 명령: 7 × 16 + 8 = 120 < 128 — 창과 두 칸의 자리가 그대로다. 여덟: 136 — 돈 칸 179, 시간 칸 199.
    expect(Math.max(128, 7 * 16 + 8)).toBe(128);
    expect([Math.max(175, 40 + 136 + 3), Math.max(199, 40 + 136 + 23)]).toEqual([179, 199]);
  });
});
