// 2026-11-13 r3s-fun(증기 도시) · r3b-fun(버들항) 세 번째 확인 빌드 두 편을 타이틀에서 엔딩까지 해 보고 찾은 아홉 결함의 고친 자리.
// 명세는 harness-data/assistant-capability/spec-bank/r3s-fun.json · r3b-fun.json 에 있고(명세 은행이 통째로 다시 짓는다), 여기서는 고친 규칙만 작은 값으로 본다.
// 문서 openwiki/assistant-v2.md 「직접 플레이 둘째 판에서 찾은 아홉 결함」. 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import type { GameEvent, Project } from "@/project/types";
import { SENSIBLE_POTION_HP_RATIO, simulateBattle } from "@/battle/simulate";
import { fitTroopCopy } from "@/editor/tools/bossThreatScaling";
import { fitPathBattlesIn, pathBattles, ROAD_BAND } from "@/ai/v2/story/pathBattleBudget";
import { BOSS_BAND } from "@/ai/v2/story/pathBattleTension";
import { choiceAtThing, joinPersonPages, samePersonStep } from "@/ai/v2/story/samePerson";
import { hideLockCodes } from "@/ai/v2/story/codeLeaks";
import { bigFigureCell, bigFigureCells } from "@/ai/v2/story/bigFigure";
import { roadFoeSpecies } from "@/ai/v2/story/stepFoeTroop";
import { lockStepOrderDoorsIn } from "@/ai/v2/story/blueprintPathGates";
import { pickPersonGraphic } from "@/ai/v2/place/people";
import { redressHeroTwins } from "@/ai/v2/story/heroTwins";
import { bustOfChip, lookOfChip } from "@/ai/v2/story/speakerBust";
import { charsetFrameIndex, decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { promptTargetName } from "@/player/objectiveTarget";
import { resolveEventPage } from "@/project/io/pageResolution";

const hpOf = (project: Project, troopId: string) => project.database.troops.find((t) => t.id === troopId)!.enemyIds.reduce((sum, id) => sum + project.database.enemies.find((e) => e.id === id)!.stats.maxHp, 0);
const battlePage = (troopId: string, canEscape: boolean, kind: string) => ({ id: "p0", name: "p0", conditions: [], trigger: { kind }, commands: [{ kind: "battleProcessing", troopId, canEscape, canLose: false }] });
const blueprint = (steps: unknown[]) => ({ request: "게임", title: "t", genre: "g", premise: "p", playerGoal: "g", ending: { name: "끝", how: "z", feeling: "w" }, steps }) as never;

// 1) 쉬고 온 풀 HP 가 여느 도착이다 — 보스는 그 파티로 맞춘다(쉬지 않고 낮게 도착한 판에 맞추면 쉬고 온 판이 «공격» 만 눌러 이긴다).
describe("보스 밴드는 쉬고 온 기준 파티로 잰다", () => {
  it("여느 플레이는 HP 45% 아래에서 약을 쓴다 — 모의전이 그 문턱을 받는다", () => {
    expect(SENSIBLE_POTION_HP_RATIO).toBe(0.45);
    expect(BOSS_BAND.potionAt).toBe(SENSIBLE_POTION_HP_RATIO);
    const project = createBlankProject() as Project;
    const ids = project.system.startActorIds!;
    const boss = fitTroopCopy(project, "troop_slime", "boss")!;
    const stock = { inventory: { item_hi_potion: 6 }, potionItemId: "item_hi_potion" };
    const late = simulateBattle({ project, troopId: boss, heroLevel: 1, partyActorIds: ids, n: 8, seed: 11, ...stock });
    const early = simulateBattle({ project, troopId: boss, heroLevel: 1, partyActorIds: ids, n: 8, seed: 11, potionHpRatio: 0.45, ...stock });
    expect(early.avgPotionsUsed).toBeGreaterThanOrEqual(late.avgPotionsUsed);
  });

  it("마지막 보스: 쉬고 온 기준 레벨의 «공격만» 은 지고, 기술·약(45%)으로는 약 2~4개로 이긴다 — HP 는 올리지 않는다", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    const boss = fitTroopCopy(project, "troop_slime", "boss")!;
    const hpBefore = hpOf(project, boss);
    map.events = [...(map.events ?? []),
      { id: "ev_foe", name: "", x: 3, y: 3, trigger: { kind: "eventTouch" }, pages: [battlePage("troop_slime", true, "eventTouch")] },
      { id: "ev_boss", name: "문지기", x: 6, y: 3, trigger: { kind: "action" }, pages: [battlePage(boss, false, "action")] }] as never;
    project.gameBlueprint = blueprint([{ id: "s1", place: map.name ?? map.id, event: "ev_foe", label: "l" }, { id: "s2", place: map.name ?? map.id, event: "문지기", label: "l" }]);
    const ids = project.system.startActorIds!;
    const notes = fitPathBattlesIn(project);
    const line = notes.find((note) => note.startsWith("보스 밴드"))!;
    // 길 위 전투 하나를 이기면 Lv2 — 기준은 곧장 온 판(도착 Lv1~2 의 낮은 쪽)이다.
    expect(line).toContain("쉬고 온 Lv1(도착 Lv1~2)");
    const troopId = pathBattles(project).find((b) => b.role === "boss")!.troopId;
    expect(hpOf(project, troopId)).toBeLessThanOrEqual(hpBefore);
    const potions = project.session.inventory!.item_hi_potion!;
    expect(potions).toBe(3);
    const attackOnly = simulateBattle({ project, troopId, heroLevel: 1, partyActorIds: ids, n: 24, seed: 11 });
    const normal = simulateBattle({ project, troopId, heroLevel: 1, partyActorIds: ids, n: 24, seed: 11, useSkills: true, potionHpRatio: SENSIBLE_POTION_HP_RATIO, inventory: { item_hi_potion: potions }, potionItemId: "item_hi_potion" });
    expect(attackOnly.winRate).toBeLessThanOrEqual(BOSS_BAND.attackOnlyMaxWin);
    expect(normal.winRate).toBeGreaterThanOrEqual(BOSS_BAND.minWin);
    expect(normal.avgPotionsUsed).toBeGreaterThanOrEqual(BOSS_BAND.finalPotions[0] - 0.05);
    expect(normal.avgPotionsUsed).toBeLessThanOrEqual(BOSS_BAND.finalPotions[1] + 0.05);
    expect(normal.avgTurns).toBeLessThanOrEqual(BOSS_BAND.turns);
    expect(fitPathBattlesIn(project).filter((note) => note.includes("(보스)"))).toEqual([]);
  }, 180_000);
});

// 2) 돌아다니는 적이 보스보다 무겁지 않다(r3b-fun: HP 580 의 «돌 골렘»·«베히모스» 가 보스 390·473 보다 무거워 28·33번을 주고받았다).
describe("길 위 전투는 짧다", () => {
  it("도망 못 치는 길목 적도 5턴 안 · 그 장소 보스의 HP 안으로 내려온다", () => {
    expect(ROAD_BAND.turns).toBe(5);
    expect(ROAD_BAND.loss).toBe(0.2);
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    const boss = fitTroopCopy(project, "troop_slime", "boss")!;
    const slime = project.database.enemies.find((e) => e.id === project.database.troops.find((t) => t.id === "troop_slime")!.enemyIds[0])!;
    project.database.enemies.push({ ...structuredClone(slime), id: "enemy_heavy", name: "돌 골렘", stats: { ...slime.stats, maxHp: 1400 }, skillIds: [], actions: [] } as never);
    project.database.troops.push({ ...structuredClone(project.database.troops.find((t) => t.id === "troop_slime")!), id: "troop_heavy", name: "돌 골렘", enemyIds: ["enemy_heavy"], members: undefined } as never);
    map.events = [...(map.events ?? []),
      { id: "ev_heavy", name: "돌 골렘", x: 3, y: 3, trigger: { kind: "eventTouch" }, pages: [battlePage("troop_heavy", false, "eventTouch")] },
      { id: "ev_boss", name: "수호자", x: 6, y: 3, trigger: { kind: "action" }, pages: [battlePage(boss, false, "action")] }] as never;
    const place = map.name ?? map.id;
    project.gameBlueprint = blueprint([{ id: "s1", kind: "battle", place, event: "수호자", who: "수호자", label: "l" }, { id: "s2", kind: "talk", place, event: "촌장", who: "촌장", label: "l" }]);
    fitPathBattlesIn(project);
    const battles = pathBattles(project);
    const road = battles.find((b) => b.eventId === "ev_heavy")!;
    expect(road.role).toBe("gate");
    expect(hpOf(project, road.troopId)).toBeLessThanOrEqual(hpOf(project, battles.find((b) => b.role === "boss")!.troopId));
    const play = simulateBattle({ project, troopId: road.troopId, heroLevel: 1, partyActorIds: project.system.startActorIds!, n: 24, seed: 11, useSkills: true });
    expect(play.winRate).toBe(1);
    expect(play.avgTurns).toBeLessThanOrEqual(ROAD_BAND.turns);
  }, 180_000);
});

// 3·4) 같은 장소의 같은 who 는 한 사람이고, who 가 물건인 고르기는 사람이 아니다.
describe("단계의 «누구»", () => {
  const steps = [{ kind: "talk", who: "촌장" }, { kind: "talk", who: "대장장이" }, { kind: "battle", who: "촌장" }, { kind: "talk", who: " 촌장 " }] as const;
  it("같은 사람이 다시 나오는 말 단계는 앞 단계의 그 사람이다 — 싸우는 단계와 다른 장소의 단계는 아니다", () => {
    expect(samePersonStep(steps, 3, () => true)).toBe(0);
    expect(samePersonStep(steps, 3, (i) => i !== 0)).toBe(-1);
    expect(samePersonStep(steps, 1, () => true)).toBe(-1);
    expect(samePersonStep([{ kind: "battle", who: "촌장" }, { kind: "talk", who: "촌장" }], 1, () => true)).toBe(-1);
  });

  it("뒤 단계의 페이지는 앞 이벤트의 페이지 뒤에 잇는다 — 뒤 단계의 «아직» 안내는 버리고, 조건이 차면 뒤 단계가 이긴다", () => {
    const say = (body: string, conditions: unknown[] = []) => ({ trigger: { kind: "action" }, conditions, commands: [{ kind: "text", speaker: "촌장", body }] });
    const first = [say("종이 사라졌네."), say("그라함은 만났나?", [{ kind: "switch", switchId: "sw_taken_1", value: true }])];
    const later = [say("아직 못 찾았나?"), say("해냈구먼!", [{ kind: "switch", switchId: "sw_heart", value: true }])];
    const pages = joinPersonPages(first, later, true);
    expect(pages.map((p) => (p.commands as { body: string }[])[0]!.body)).toEqual(["종이 사라졌네.", "그라함은 만났나?", "해냈구먼!"]);
    const event = { id: "ev", name: "촌장", x: 1, y: 1, pages } as unknown as GameEvent;
    const body = (switches: Record<string, boolean>) => ((resolveEventPage(event, { switches, variables: {}, selfSwitches: {}, inventory: {} } as never)!.commands[0]) as unknown as { body: string }).body;
    expect(body({})).toBe("종이 사라졌네.");
    expect(body({ sw_taken_1: true })).toBe("그라함은 만났나?");
    expect(body({ sw_taken_1: true, sw_heart: true })).toBe("해냈구먼!");
    // 조건 없는 뒤 페이지는 앞 단계가 끝난 뒤에만.
    const open = joinPersonPages(first, [say("다시 왔군.")], false);
    expect((open[2]!.conditions as { switchId: string }[])[0]!.switchId).toBe("sw_taken_1");
  });

  it("고르기 단계의 글이 who 를 이름으로 부르면 그것은 물건이다 — 직함이 든 이름은 사람", () => {
    expect(choiceAtThing({ who: "제어대", event: "기관 제어대" }, { lines: ["제어대 앞에 섰다. 압력 코어를 끼우면 기관은 다시 돈다."] })).toBe(true);
    expect(choiceAtThing({ who: "제단", event: "달의 제단" }, { on: "돌 제단", lines: ["어느 쪽에 올릴까."] })).toBe(true);
    expect(choiceAtThing({ who: "브라스", event: "선장 브라스" }, { lines: ["브라스가 웃는다. \"값을 치르든가, 진심을 보이든가.\""] })).toBe(false);
    expect(choiceAtThing({ who: "브라스", event: "브라스" }, { lines: ["\"값을 치르든가, 진심을 보이든가.\""] })).toBe(false);
  });

  it("사람 앞의 안내는 그 사람의 이름이다 — 이벤트 이름(단계의 이름표)이 아니다", () => {
    const project = { maps: {}, database: { actors: [{ name: "이안" }] } };
    const view = (commands: unknown[]) => ({ event: { name: "촌장 귀환" }, page: { commands } }) as never;
    expect(promptTargetName(project, view([{ kind: "text", speaker: "촌장", body: "해냈구먼!" }]), "Z 대화")).toBe("촌장");
    expect(promptTargetName(project, view([{ kind: "text", speaker: "이안", body: "촌장님!" }, { kind: "text", speaker: "촌장", body: "오." }]), "Z 대화")).toBe("촌장");
    expect(promptTargetName(project, view([{ kind: "text", body: "낡은 종이다." }]), "Z 조사")).toBe("촌장 귀환");
  });
});

// 5) 자물쇠의 답은 목표 줄·잠긴 안내에 싣지 않는다 — 낱말 표가 아니라 지어진 자물쇠의 실제 답과 견준다.
describe("목표 줄은 번호를 알려 주지 않는다", () => {
  it("답이 든 목표 줄·청사진 goal·잠긴 안내를 번호 없는 줄로 바꾼다 — 단서와 길 안내는 그대로, 다시 돌려도 그대로", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    const chip = (message: string) => ({ kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface: "objectiveChip", message, durationMs: 0 } });
    map.events = [...(map.events ?? []),
      { id: "ev_note", name: "선장", x: 2, y: 2, trigger: { kind: "action" }, pages: [{ id: "p0", name: "p0", conditions: [], trigger: { kind: "action" }, commands: [
        { kind: "text", speaker: "선장", body: "압력 수치는 4271 일세." }, chip("금고에 4271을 입력해 압력 코어를 얻는다 (증기 연구실 입구: 이 맵 남쪽 → 금고)")] }] },
      { id: "ev_safe", name: "압력 금고", x: 5, y: 2, trigger: { kind: "action" }, pages: [
        { id: "p0", name: "p0", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "text", body: "4271 을 알아야 열린다." }] },
        { id: "p1", name: "p1", conditions: [{ kind: "switch", switchId: "sw_a", value: true }], trigger: { kind: "action" }, commands: [
          { kind: "inputNumber", variableId: "var_safe", digits: 4 },
          { kind: "fork", condition: { kind: "variable", variableId: "var_safe", op: "==", value: 4271 }, then: [{ kind: "text", body: "금고가 열렸다." }] }] }] }] as never;
    project.gameBlueprint = blueprint([
      { id: "s1", kind: "talk", who: "선장", place: map.name ?? map.id, event: "선장", label: "l" },
      { id: "s2", kind: "puzzle", place: map.name ?? map.id, event: "압력 금고", label: "l", text: { goal: "금고에 4271을 입력해 압력 코어를 얻는다", code: "4271" }, built: { mapId: map.id, eventId: "ev_safe" } }]);
    const fixed = hideLockCodes(project);
    expect(fixed.notes).toHaveLength(1);
    const text = JSON.stringify(fixed.project.maps[map.id]!.events);
    expect(text).toContain("압력 금고의 번호를 맞히자 (증기 연구실 입구: 이 맵 남쪽 → 금고)");
    expect(text).not.toContain("4271을 입력해");
    expect(text).not.toContain("4271 을 알아야");
    expect(text).toContain("압력 수치는 4271 일세.");
    expect(fixed.project.gameBlueprint!.steps[1]!.text?.goal).toBeUndefined();
    expect(fixed.project.gameBlueprint!.steps[1]!.text?.code).toBe("4271");
    expect(hideLockCodes(fixed.project).notes).toEqual([]);
  });
});

// 6) NPC 가 주인공의 쌍둥이로 서지 않는다(r3b-fun: 대장장이 = 주인공과 시트만 다른 «푸른 머리 청년»).
describe("사람 칩은 주인공과 다른 모습이다", () => {
  it("주인공과 성별·나이·머리가 같은 다른 시트의 칩도 고르지 않는다", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    const hero = project.database.actors.find((a) => a.id === project.system.startActorIds![0])! as { characterResourceId?: string; characterIndex?: number };
    const before = pickPersonGraphic(project, map, "청년", undefined)!;
    expect([before.textureKey, before.characterIndex]).toEqual(["tex_easyrpg_charset_people1", 2]);
    hero.characterResourceId = "easyrpg-charset-actor4";
    hero.characterIndex = 0;
    const after = pickPersonGraphic(project, map, "청년", undefined)!;
    expect([after.textureKey, after.characterIndex]).not.toEqual(["tex_easyrpg_charset_people1", 2]);
  });

  it("이름 있는 두 사람은 같은 얼굴로 서지 않는다 — 이름 없는 무리는 주민 칩을 다시 쓴다", () => {
    const stand = (ownFace: boolean): string[] => {
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      return ["촌장", "촌장 한켈"].map((who, i) => {
        const pick = pickPersonGraphic(project, map, who, undefined, ownFace)!;
        map.events = [...(map.events ?? []), { id: `ev_p${i}`, name: who, x: i, y: 0, pages: [{ id: "p1", conditions: [], trigger: { kind: "action" }, commands: [],
          graphic: { sprite: { type: "bundled", id: pick.textureKey }, direction: "down", pattern: charsetFrameIndex({ characterIndex: pick.characterIndex, direction: "down", pattern: 1 }) } }] } as unknown as GameEvent];
        return `${pick.textureKey}#${pick.characterIndex}`;
      });
    };
    const named = stand(true);
    expect(named[0]).not.toBe(named[1]);
    const crowd = stand(false);
    expect(crowd[0]).toBe(crowd[1]);
    expect(named[0]).toBe(crowd[0]);
  });

  it("주인공의 모습이 나중에 정해지면 먼저 선 쌍둥이를 다시 입힌다 — 걷는 그림과 대화창의 얼굴 둘 다, 성별은 그대로, 다시 돌려도 그대로", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    const twin = { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, direction: "left", pattern: charsetFrameIndex({ characterIndex: 2, direction: "left", pattern: 1 }) };
    const oldBust = bustOfChip("tex_easyrpg_charset_people1", 2)!;
    map.events = [...(map.events ?? []), { id: "ev_smith", name: "대장장이", x: 3, y: 3, trigger: { kind: "action" }, pages: [{ id: "p0", name: "p0", conditions: [], trigger: { kind: "action" }, graphic: twin,
      commands: [{ kind: "changeFace", resourceId: oldBust, position: "left", flipHorizontally: false }, { kind: "text", speaker: "대장장이", text: "어서 오게." }] }] }] as never;
    // 사람이 선 뒤에 주인공이 actor4 «파란 머리 청년» 이 된다(people1 2번 «푸른 머리 청년» 과 시트만 다른 같은 모습).
    expect(redressHeroTwins(project)).toEqual([]);
    const hero = project.database.actors.find((a) => a.id === project.system.startActorIds![0])! as { characterResourceId?: string; characterIndex?: number };
    hero.characterResourceId = "easyrpg-charset-actor4";
    hero.characterIndex = 0;
    expect(lookOfChip("tex_easyrpg_charset_people1", 2)).toBe(lookOfChip("easyrpg-charset-actor4", 0));
    const notes = redressHeroTwins(project);
    expect(notes).toHaveLength(1);
    const page = map.events!.find((e) => e.id === "ev_smith")!.pages![0]!;
    const g = page.graphic as { sprite: { id: string }; pattern: number; direction: string };
    const now = decodeCharsetFrameIndex(g.pattern);
    const look = lookOfChip(g.sprite.id, now.characterIndex);
    expect(look).not.toBe(lookOfChip("easyrpg-charset-actor4", 0));
    // 성별은 지킨다(나이는 이웃 나이까지 — 청년이 중년으로는 바뀔 수 있다).
    expect(look?.split("|")[0]).toBe(lookOfChip("easyrpg-charset-actor4", 0)!.split("|")[0]);
    expect(now.direction).toBe("left");
    const face = (page.commands![0] as { resourceId?: string }).resourceId;
    expect(face).not.toBe(oldBust);
    expect(face).toBe(bustOfChip(g.sprite.id, now.characterIndex) ?? face);
    expect(redressHeroTwins(project)).toEqual([]);
  });
});

// 7) 보스가 길 적과 같은 전투 그림으로 서지 않게 — 길 위에 선 적의 종을 «쓴 종» 에 넣는다.
describe("길 위에 선 적의 종", () => {
  it("맵 이벤트·조우표의 무리와 전투 그림이 같은 적 전부 — 단계의 상대 사본은 뺀다", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    expect(roadFoeSpecies(project)).toEqual([]);
    map.events = [...(map.events ?? []), { id: "ev_foe", name: "", x: 3, y: 3, trigger: { kind: "eventTouch" }, pages: [battlePage("troop_golem_guard", true, "eventTouch")] }] as never;
    const pictureOf = (id: string) => (project.database.enemies.find((e) => e.id === id) as { monsterResourceId?: string }).monsterResourceId;
    const members = project.database.troops.find((t) => t.id === "troop_golem_guard")!.enemyIds;
    const pictures = new Set(members.map(pictureOf));
    const taken = roadFoeSpecies(project);
    for (const id of members) expect(taken).toContain(id);
    expect(taken.every((id) => pictures.has(pictureOf(id)))).toBe(true);
    // 길에 서지 않은 종은 들어 있지 않다.
    expect(taken).not.toContain(project.database.troops.find((t) => t.id === "troop_dragon")!.enemyIds[0]!);
  });
});

// 8) 두 배로 서는 상대는 그림이 덮는 칸이 모두 트인 자리에 선다(r3s-fun: 방 구석의 «보일러 수호기» 가 벽과 보일러를 덮었다).
describe("큰 그림의 자리", () => {
  it("벽·가장자리에 붙은 자리는 가장 가까운 트인 자리로 옮기고, 트인 자리는 그대로 둔다", () => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    expect(bigFigureCell(project, map, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
    const moved = bigFigureCell(project, map, { x: 0, y: 5 });
    expect(moved).toEqual({ x: 1, y: 5 });
    for (const cell of bigFigureCells(map, moved)) expect(isPassable(project, map, cell.x, cell.y)).toBe(true);
    // 곁에 다른 이벤트가 서 있으면 그 칸을 덮지 않는 자리로.
    map.events = [...(map.events ?? []), { id: "ev_chest", name: "상자", x: 6, y: 5, trigger: { kind: "action" }, pages: [] }] as never;
    const beside = bigFigureCell(project, map, { x: 5, y: 5 });
    expect(bigFigureCells(map, beside).some((c) => c.x === 6 && c.y === 5)).toBe(false);
  });
});

// 9) 거짓 «끝까지 플레이 불가»: 곁가지 퀘스트의 스위치가 길의 문 조건이 됐다(r3b-fun: 여관 문이 여관 안에서 시작되는 퀘스트를 기다렸다).
describe("문의 순서 잠금은 단계가 넘기는 것만 본다", () => {
  it("앞 단계 이벤트가 켜는 다른 스위치(곁가지 퀘스트)는 문의 조건이 되지 않는다", () => {
    const project = createBlankProject() as Project;
    const start = project.maps[project.startMapId]!;
    const inn = { ...structuredClone(start), id: "map_inn", name: "여관", events: [] } as typeof start;
    project.maps[inn.id] = inn;
    project.database.items.push({ ...structuredClone(project.database.items[0]!), id: "item_key", name: "광산 열쇠" } as never);
    const page = (conditions: unknown[], commands: unknown[], kind = "action") => ({ id: "p", name: "p", conditions, trigger: { kind }, commands });
    start.name = "마을";
    start.events = [
      { id: "ev_smith", name: "대장장이", x: 2, y: 2, trigger: { kind: "action" }, pages: [page([], [
        { kind: "text", speaker: "대장장이", body: "열쇠를 가져가게." }, { kind: "changeItem", itemId: "item_key", op: "+=", amount: 1 }, { kind: "setSwitch", switchId: "sw_quest_step0", value: true }])] },
      { id: "ev_door", name: "", x: 8, y: 8, trigger: { kind: "playerTouch" }, pages: [page([], [{ kind: "transfer", mapId: "map_inn", x: 3, y: 3 }], "playerTouch")] }] as never;
    inn.events = [{ id: "ev_keeper", name: "여관 주인", x: 4, y: 4, trigger: { kind: "action" }, pages: [
      page([{ kind: "switch", switchId: "sw_quest_step0", value: true }], [{ kind: "text", speaker: "여관 주인", body: "노인의 이야기를 들었나?" }]),
      page([{ kind: "item", itemId: "item_key", present: true }], [{ kind: "text", speaker: "여관 주인", body: "어서 오게." }])] }] as never;
    project.gameBlueprint = blueprint([
      { id: "s1", kind: "talk", who: "대장장이", place: "마을", event: "대장장이", label: "l", built: { mapId: start.id, eventId: "ev_smith", itemId: "item_key" } },
      { id: "s2", kind: "talk", who: "여관 주인", place: "여관", event: "여관 주인", label: "l", built: { mapId: "map_inn", eventId: "ev_keeper" } }]);
    expect(lockStepOrderDoorsIn(project)).toHaveLength(1);
    const door = JSON.stringify(project.maps[project.startMapId]!.events.find((e) => e.id === "ev_door")!.pages);
    expect(door).toContain("item_key");
    expect(door).not.toContain("sw_quest_step0");
  });
});
