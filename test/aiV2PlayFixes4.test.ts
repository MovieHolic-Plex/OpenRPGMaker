// 확인 빌드 r6(실모델 두 편 — 포구 마을 «갈매나루» · 역 앞 상점가)과 그 브라우저 플레이에서 나온 조수 결함 — 조수가 다음 게임을 지을 때 다시 만들지 않게.
// 증거: ~/z-project/assistant-fable-runs/r6/DEFECTS.md(#6 · #7 · #8 · #11 · #14, 플레이 P2 · P4 · P5 · P6). 앞 판의 결함은 test/aiV2PlayFixes3R5.test.ts.
// 방향(오너 2026-11-16): 벽을 기본값으로 — 모델이 고른 것이 실제로 있으면 쓰고, 없으면 가장 가까운 것으로 넣고 알리고, 거절은 게임이 깨질 때만.
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 가 돌린다). 같은 값은 모델 없는 탐침으로 미리 보았다.
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { requestSkeleton } from "@/ai/v2/loop/requestSkeleton";
import { questPresetIssue } from "@/project/quest/questPresets";
import { validateQuestReferences } from "@/project/quest/questValidation";
import { depthNeed, mapsNeed, smallGame } from "@/ai/v2/judge/blueprintScale";
import { shipBlockers, sizeNotices } from "@/ai/v2/judge/shipChecks";
import { sizeNoticeOnce } from "@/ai/v2/judge/sizeNotice";
import { findBarSpot } from "@/ai/v2/place/barSpot";
import { anchorsOf, blockersOf, bodyReached, eventBlocks, reachFrom } from "@/ai/v2/judge/eventReach";
import { chainFightStepsIn, endAfterFinalFightIn } from "@/ai/v2/story/fightStepChain";
import { walkBlueprint } from "@/ai/v2/story/blueprint";
import { settleFoughtCopy } from "@/ai/v2/story/foughtCopy";
import { buildBossEncounter } from "@/ai/v2/story/sceneVerbs";
import { pickPersonGraphic } from "@/ai/v2/place/people";
import { charsetFamilyOf } from "@/project/charsetFamily";

type Obj = Record<string, unknown>;
const HARBOUR = "포구 마을 «갈매나루»에서 시작하는 짧은 JRPG 를 만들어 줘. 대성당 지하에서 옛 지하 묘지로 내려가는데, 내려가는 길목을 해골 병사가 막고 서 있어서 싸워 이겨야 지나갈 수 있어. 묘지 맨 안쪽에서 마지막 보스와 싸우면 끝나.";
const STREET = "현대 일본의 작은 역 앞 상점가에서 벌어지는 짧은 이야기 게임을 만들어 줘. 전학 온 주인공이 잃어버린 고양이를 찾아 거리 사람들에게 물어보다가 라멘집에서 고양이를 찾으면 끝나. 전투는 없어도 돼.";
const page = (conditions: unknown[], commands: unknown[], more: Obj = {}) =>
  ({ id: "p", name: "p", conditions, trigger: { kind: "action" }, priority: "same", graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 }, commands, ...more });
const event = (id: string, name: string, x: number, y: number, pages: unknown[]) => ({ id, name, x, y, trigger: { kind: "action" }, commands: [], pages }) as unknown as GameEvent;
const fightPage = (sw: string, troopId: string) => page([], [{ kind: "text", body: "덤벼라" }, { kind: "battleProcessing", troopSource: "fixed", troopId, canEscape: false, canLose: false, branchOnResult: true, victoryBranch: [{ kind: "setSwitch", switchId: sw, value: true }], defeatBranch: [], escapeBranch: [] }]);
const gonePage = (sw: string) => ({ ...page([{ kind: "switch", switchId: sw, value: true }], [], { priority: "below", graphic: { transparent: true } }), id: "gone" });

// #14: 「마지막 보스와 싸우면 끝나」 의 «마지막 보스» 를 사람 이름으로 읽어, 보스가 서고 엔딩이 돼도 「마지막 보스 두기」 가 끝까지 ✗ 였다.
describe("요청 뼈대의 보스 — 확인 빌드 r6", () => {
  it("역할만 말한 보스는 이름을 찾지 않는 보스 전투 하나다", () => {
    const els = requestSkeleton(HARBOUR).filter((e) => e.check?.kind === "battle" || e.check?.kind === "person");
    expect(els.map((e) => e.check)).toEqual([{ kind: "battle", boss: true, fresh: true }]);
  });
  it("«전투는 없어도 돼» 는 전투를 청한 것이 아니다", () => {
    expect(requestSkeleton(STREET).filter((e) => e.check?.kind === "battle")).toEqual([]);
  });
});

// #11: 「심부름: 목표 구조가 프리셋과 다릅니다 (talk).」 만 돌아와 같은 꼴로 여섯 번 거절됐다.
describe("create_quest 거절 글 — 확인 빌드 r6", () => {
  const project = createBlankProject() as Project;
  const mapId = project.startMapId;
  project.maps[mapId]!.events = [event("ev_giver", "해순", 3, 3, [page([], [{ kind: "text", body: "…" }])]), event("ev_other", "신부", 6, 3, [page([], [{ kind: "text", body: "…" }])])];
  const base = { key: "q_a", title: "소식 전하기", summary: "소식을 전한다", order: "sequence", giver: { mapId, eventId: "ev_giver" } };
  const talk = (label: string, eventId: string) => ({ kind: "talk", label, target: { mapId, eventId }, lines: ["…"] });
  const two = [talk("신부에게", "ev_other"), talk("다시 신부에게", "ev_other")];

  it("프리셋과 단계 수가 다르면 둘을 나란히 적고 고치는 호출을 적는다", () => {
    const issue = questPresetIssue(project, { ...base, presetId: "errand", steps: two } as never)!;
    expect(issue).toContain("is 1 step(s) (talk) but steps is 2 step(s) (talk → talk)");
    expect(issue).toContain('presetId:"custom" with blueprint:["talk","talk"]');
    expect(questPresetIssue(project, { ...base, presetId: "errand", steps: two.slice(0, 1) } as never)).toBeNull();
  });
  it("직접 조합에 blueprint 가 빠졌으면 그 값을 적어 준다", () => {
    expect(questPresetIssue(project, { ...base, presetId: "custom", steps: two } as never)).toContain('needs def.blueprint — list the kinds of steps in order: blueprint:["talk","talk"]');
  });
  it("의뢰인에게 돌아가는 단계는 어느 단계인지와 까닭을 적는다", () => {
    expect(() => validateQuestReferences(project, { ...base, steps: [two[0], talk("해순에게 돌아가기", "ev_giver")] } as never))
      .toThrow(/steps\[1\] \(talk «해순에게 돌아가기»\) targets the giver's own event \(ev_giver\) — reporting back to the giver is added by itself/u);
  });
});

// #8: «짧은 이야기 게임, 전투는 없어도 돼» 에 출하 관문이 맵 6장 · 퀘스트 3개를 요구했다.
describe("관문의 크기 — 청사진에 모델이 적은 값을 읽고, 모자라면 알린다(확인 빌드 r6)", () => {
  const steps = [["s1", "역 앞 상점가", "전단지 아주머니"], ["s2", "역 앞 상점가", "편의점 점원"], ["s3", "역 앞 상점가", "서점 주인"], ["s4", "라멘집", "라멘집 주인"]]
    .map(([id, place, who]) => ({ id, kind: "talk", who, place, event: who, action: "묻는다", gives: `${id} 단서`, feeling: "궁금" }));
  const withBlueprint = (more: Obj): Project => {
    const project = createBlankProject() as Project;
    project.gameBlueprint = normalizeGameBlueprint({ title: "미케", genre: "이야기", playerGoal: "고양이를 찾자", request: STREET, steps, ending: { name: "집으로", how: "찾았다", feeling: "안도" }, ...more });
    return project;
  };

  it("scale:small 청사진은 제 장소 수 · 제 단계 수를 센다", () => {
    const small = withBlueprint({ scale: "small", battles: false });
    expect(small.gameBlueprint?.scale).toBe("small");
    expect(small.gameBlueprint?.battles).toBe(false);
    expect(smallGame(small)).toBe(true);
    expect(mapsNeed(small, 6)).toBe(2);
    expect(depthNeed(small, 5)).toBe(3);
    const full = withBlueprint({});
    expect(mapsNeed(full, 6)).toBe(6);
    expect(depthNeed(full, 5)).toBe(5);
  });
  it("맵 · 퀘스트 · 진행 깊이의 모자람은 출하 차단이 아니라 알림이다", () => {
    const full = withBlueprint({});
    expect(shipBlockers(full, STREET).some((b) => /-min$/u.test(b.id))).toBe(false);
    expect(sizeNotices(full, STREET).map((b) => b.id)).toEqual(["maps-min", "quests-min", "act-depth-min"]);
    // 작은 게임에는 곁 퀘스트를 알리지도 않는다.
    expect(sizeNotices(withBlueprint({ scale: "small" }), STREET).map((b) => [b.id, b.evidence])).toEqual([["maps-min", "counted=0 need=2 uncounted=1"], ["act-depth-min", "small depth=0 need=3"]]);
    // 게임을 만드는 요청이 아니면 알릴 것도 없다.
    expect(sizeNotices(createBlankProject() as Project, "촌장을 광장으로 옮겨 줘")).toEqual([]);
  });
  it("알림은 실행 하나에 한 번, 영어로, 거절이 아니라고 적어 준다", () => {
    const full = withBlueprint({});
    const store = {};
    const first = sizeNoticeOnce(store, full, STREET);
    expect(first).toContain("[Size notice — not a requirement, nothing is blocked.");
    expect(first).toContain("[ship maps-min]");
    expect(sizeNoticeOnce(store, full, STREET)).toBe("");
    expect(sizeNoticeOnce({}, createBlankProject() as Project, "촌장을 광장으로 옮겨 줘")).toBe("");
  });
});

// #6 · 플레이 a3 · a5: «길목을 막고 선 해골 병사» 가 폭 8칸 홀에 서서 옆으로 지나 보스에게 갔다.
describe("길을 막는 적의 자리 — 확인 빌드 r6", () => {
  const cave = (): { project: Project; map: GameMap } => {
    const ctx: ToolContext = { project: createEmptyToolProject("굴") };
    const blank = createBlankProject() as Project;
    ctx.project.database = blank.database;
    ctx.project.system = { ...ctx.project.system, startActorIds: blank.system.startActorIds };
    expect(runTool(ctx, "author_dungeon", { type: "cave", size: "small", name: "굴", seed: 2 }, { dryRun: false }).ok).toBe(true);
    const map = Object.values(ctx.project.maps)[0]!;
    // 레버 관문은 걷고, 안쪽 방에 다음 맵으로 가는 계단(갈 곳)을 둔다.
    map.events = [...map.events.filter((e) => !/_lever/u.test(e.id)), event("ev_far_stairs", "내려가는 계단", 24, 9, [page([], [{ kind: "transfer", mapId: map.id, x: 14, y: 28 }])])];
    return { project: ctx.project, map };
  };
  const stairsReached = (project: Project, map: GameMap, extra: readonly { x: number; y: number }[] = []): boolean => {
    const blocked = blockersOf(map);
    for (const c of extra) blocked.add(c.y * map.width + c.x);
    return bodyReached(map, reachFrom(project, map, anchorsOf(project, map), blocked), map.events.find((e) => e.id === "ev_far_stairs")!);
  };

  it("가장 가까운, 막으면 갈 곳이 끊기는 3칸 이하의 길목을 찾는다 — 트인 곳에는 없다", () => {
    const { project, map } = cave();
    for (const from of [{ x: 20, y: 20 }, { x: 12, y: 30 }]) {
      const spot = findBarSpot(project, map, from)!;
      expect(spot, JSON.stringify(from)).toBeDefined();
      expect(spot.guards).toBe(true);
      expect(spot.cells.length).toBeLessThanOrEqual(3);
      expect(spot.footprint.width * spot.footprint.height).toBe(spot.cells.length);
      expect(stairsReached(project, map, spot.cells), JSON.stringify(from)).toBe(false);
    }
    expect(stairsReached(project, map)).toBe(true);
    const open = createBlankProject() as Project;
    expect(findBarSpot(open, open.maps[open.startMapId]!, { x: 8, y: 8 })).toBeUndefined();
  }, 60_000);

  it("boss.blocks 를 주면 그 길목으로 옮겨 세우고 몸으로 폭을 덮는다 — 거절하지 않고 어디에 세웠는지 알린다", () => {
    const { project, map } = cave();
    const run = createBuildRun({ project, currentMapId: map.id, assistantRun: true } as never);
    const res = buildBossEncounter(run, { mapId: map.id, boss: { name: "문지기 해골", at: { x: 20, y: 20 }, enemy: "해골", blocks: true }, lines: ["멈춰라."] } as never);
    expect(res.ok).toBe(true);
    expect(res.summary).toContain("It bars the way at (19,17) — moved from (20,20)");
    const now = run.ctx.project.maps[map.id]!;
    const foe = now.events.find((e) => e.name === "문지기 해골")!;
    expect([foe.x, foe.y]).toEqual([19, 17]);
    expect((foe.pages![0] as unknown as { footprint?: unknown }).footprint).toEqual({ width: 2, height: 1 });
    // 이긴 뒤에는 비켜선다 — 걸어 닿는 칸을 셀 때 그 너머는 «못 가는 곳» 이 아니라 이긴 뒤에 가는 곳이다.
    expect(eventBlocks(foe)).toBe(false);
    expect(stairsReached(run.ctx.project, now)).toBe(true);
    expect(stairsReached(run.ctx.project, now, [{ x: 19, y: 17 }, { x: 20, y: 17 }])).toBe(false);
  }, 60_000);

  it("blocks 를 주지 않은 적이 길목 곁에 비켜 서 있으면 옮기지 않고 그것만 알린다", () => {
    const { project, map } = cave();
    const run = createBuildRun({ project, currentMapId: map.id, assistantRun: true } as never);
    const res = buildBossEncounter(run, { mapId: map.id, boss: { name: "문지기 해골", at: { x: 20, y: 20 }, enemy: "해골" }, lines: ["멈춰라."] } as never);
    expect(res.summary).toContain("It does not bar the way (the player can walk around it); boss.blocks:true stands it on the passage at (19,17).");
    const foe = run.ctx.project.maps[map.id]!.events.find((e) => e.name === "문지기 해골")!;
    expect([foe.x, foe.y]).toEqual([20, 20]);
  }, 60_000);

  it("앞 단계의 사람이 막아 선 적 너머에 있으면 싸움을 앞 단계 뒤로 잠그지 않는다 — 서로 기다리지 않게", () => {
    const chained = (priestAt: { x: number; y: number }): { notes: string[]; conds: string[] } => {
      const { project, map } = cave();
      map.events = [...map.events, event("ev_priest", "신부", priestAt.x, priestAt.y, [page([], [{ kind: "text", body: "열쇠를 받게." }])])];
      const run = createBuildRun({ project, currentMapId: map.id, assistantRun: true } as never);
      expect(buildBossEncounter(run, { mapId: map.id, boss: { name: "문지기 해골", at: { x: 20, y: 20 }, enemy: "해골", blocks: true }, lines: ["멈춰라."] } as never).ok).toBe(true);
      const now = run.ctx.project;
      const st = (id: string, kind: string, who: string) => ({ id, kind, who, place: "굴", event: who, action: kind === "battle" ? "싸운다" : "듣는다", gives: `${id} 끝`, feeling: "긴장" });
      now.gameBlueprint = normalizeGameBlueprint({ title: "굴", genre: "JRPG", playerGoal: "지나가자", request: "x", steps: [st("s1", "talk", "신부"), st("s2", "battle", "문지기 해골")], ending: { name: "끝", how: "이긴다", feeling: "안도" } });
      const notes = chainFightStepsIn(now);
      const foe = now.maps[map.id]!.events.find((e) => e.name === "문지기 해골")!;
      return { notes, conds: foe.pages!.map((p) => ((p.conditions ?? []) as unknown as { switchId?: string }[]).map((c) => c.switchId).join("&") || "-") };
    };
    // 신부가 병사 너머(안쪽 방)에 있다 — 잠그면 영영 못 싸운다.
    const beyond = chained({ x: 24, y: 10 });
    expect(beyond.notes.join(" ")).toContain("Not chained: fight step s2 «문지기 해골» stands between the way in and s1 «신부»");
    expect(beyond.conds[0]).toBe("-");
    expect(beyond.conds).toHaveLength(2);
    // 신부가 병사 앞(들어오는 쪽)에 있으면 잠근다.
    const before = chained({ x: 22, y: 21 });
    expect(before.notes.join(" ")).toContain("Chained fight step s2 «문지기 해골»: it fights only after s1 «신부»");
    expect(before.conds.slice(0, 2)).toEqual(["-", "sw_bp_s1_done"]);
  }, 60_000);

  // P6: 병사가 필드에서는 붉은 머리 기사, 전투에서는 유령이었다.
  it("맵에 선 모습은 싸울 때의 그 모습이고, 바란 그림이 없으면 무엇으로 넣었는지 적는다", () => {
    const { project, map } = cave();
    const run = createBuildRun({ project, currentMapId: map.id, assistantRun: true } as never);
    const res = buildBossEncounter(run, { mapId: map.id, boss: { name: "문지기 해골", at: { x: 20, y: 20 }, enemy: "해골" }, lines: ["멈춰라."] } as never);
    const foe = run.ctx.project.maps[map.id]!.events.find((e) => e.name === "문지기 해골")!;
    const troopId = /"troopId":"([^"]+)"/u.exec(JSON.stringify(foe.pages))![1]!;
    const troop = run.ctx.project.database.troops.find((t) => t.id === troopId)!;
    const lead = run.ctx.project.database.enemies.find((e) => e.id === (troop.members?.[0]?.enemyId ?? troop.enemyIds?.[0]))! as unknown as { monsterResourceId?: string };
    expect((foe.pages![0]!.graphic as unknown as { sprite: { id: string } }).sprite.id).toBe(lead.monsterResourceId);
    expect(JSON.stringify(foe.pages)).not.toContain("changeFace");
    expect(res.missingArt.join("\n")).toContain("want=boss wanted=«skeleton-bone» where=«문지기 해골»");
    expect(res.missingArt.join("\n")).not.toContain("want=person");
  }, 60_000);
});

// 플레이 P2 · P4: 싸움 단계 둘 때문에 경로 호출이 통째로 거절돼 사슬이 대화 단계 셋에서 끊겼다 — 신부도 병사도 건너뛰고 보스만 이기면 엔딩.
describe("싸우는 단계를 이야기 사슬에 잇는다 — 확인 빌드 r6", () => {
  const build = (): { project: Project; map: GameMap } => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    map.name = "묘지";
    const troopId = project.database.troops[0]!.id;
    map.events = [event("ev_priest", "신부", 2, 4, [page([], [{ kind: "text", body: "열쇠를 받게." }])]), event("ev_guard", "해골 병사", 6, 4, [fightPage("sw_guard", troopId), gonePage("sw_guard")]), event("ev_lord", "종지기", 10, 4, [fightPage("sw_lord", troopId), gonePage("sw_lord")])];
    (project as unknown as { switches: Obj[] }).switches = [...((project.switches ?? []) as unknown as Obj[]), { id: "sw_guard", name: "병사 격파" }, { id: "sw_lord", name: "종지기 격파" }];
    (project as unknown as { endings: Obj[] }).endings = [{ id: "ending_dawn", name: "새벽", conditions: [], epilogue: [{ kind: "say", text: "끝." }], presentation: {} }];
    const st = (id: string, kind: string, who: string) => ({ id, kind, who, place: "묘지", event: who, action: kind === "battle" ? "싸운다" : "듣는다", gives: `${id} 끝`, feeling: "긴장" });
    project.gameBlueprint = normalizeGameBlueprint({ title: "종", genre: "JRPG", playerGoal: "종지기를 쓰러뜨리자", request: "x", steps: [st("s1", "talk", "신부"), st("s2", "battle", "해골 병사"), st("s3", "battle", "종지기")], ending: { name: "새벽", how: "이긴다", feeling: "안도" } });
    return { project, map };
  };
  const conds = (ev: GameEvent): string[] => ev.pages!.map((p) => ((p.conditions ?? []) as unknown as { switchId?: string }[]).map((c) => c.switchId).join("&") || "-");
  const byName = (map: GameMap, name: string) => map.events.find((e) => e.name === name)!;

  it("이기면 비켜서는 적은 걸어 닿는 칸을 셀 때 막지 않는다 — 이긴 뒤 페이지가 없으면 막는다", () => {
    const { map } = build();
    expect(eventBlocks(byName(map, "신부"))).toBe(true);
    expect(eventBlocks(byName(map, "해골 병사"))).toBe(false);
    expect(eventBlocks({ ...byName(map, "해골 병사"), pages: [byName(map, "해골 병사").pages![0]!] } as GameEvent)).toBe(true);
  });

  it("싸움은 앞 단계 뒤에만 열리고, 마지막 싸움을 이기면 엔딩을 부른다", () => {
    const { project, map } = build();
    expect(walkBlueprint(project).blockers.map((b) => b.id)).toEqual(["blueprint-no-ending"]);
    const notes = [...chainFightStepsIn(project), ...endAfterFinalFightIn(project)];
    expect(notes).toHaveLength(3);
    expect(notes[0]).toContain("Chained fight step s2 «해골 병사»: it fights only after s1 «신부»");
    expect(notes[2]).toBe("Winning the last fight s3 «종지기» now calls the ending «새벽»");
    // 신부의 말이 「마침」 스위치를 켜고, 병사는 그 뒤에만 싸운다. 그 전에는 «아직» 페이지가 선다(몸은 그대로 길을 막는다).
    expect(JSON.stringify(byName(map, "신부").pages)).toContain('"switchId":"sw_bp_s1_done"');
    expect(conds(byName(map, "해골 병사"))).toEqual(["-", "sw_bp_s1_done", "sw_guard"]);
    expect(byName(map, "해골 병사").pages![0]!.name).toBe("아직");
    // 보스는 병사를 이긴 뒤에만 싸우고, 이기면 그 승리 갈래에서 엔딩을 부른다.
    expect(conds(byName(map, "종지기"))).toEqual(["-", "sw_guard", "sw_lord"]);
    const win = ((byName(map, "종지기").pages![1]!.commands as unknown as Obj[]).find((c) => c.kind === "battleProcessing")!.victoryBranch as Obj[]).map((c) => c.kind);
    expect(win).toEqual(["setSwitch", "triggerEnding"]);
    expect(walkBlueprint(project).blockers).toEqual([]);
    // 되풀이 안전.
    expect([...chainFightStepsIn(project), ...endAfterFinalFightIn(project)]).toEqual([]);
  });
});

// 플레이 P5: 모델이 HP 700 으로 올리고 모의전한 보스 기록은 쓰이지 않고, 싸움은 길 사본(HP 406)으로 했다.
describe("모델이 손본 적이 실제 싸움에 쓰인다 — 확인 빌드 r6", () => {
  const build = (): Project => {
    const project = createBlankProject() as Project;
    const e0 = project.database.enemies[0]!, t0 = project.database.troops[0]!;
    project.database.enemies.push({ ...structuredClone(e0), id: "enemy_x_boss", name: "종지기" }, { ...structuredClone(e0), id: "enemy_path_x_boss_x_boss", name: "종지기", stats: { ...e0.stats, maxHp: 406 } } as never);
    project.database.troops.push({ ...structuredClone(t0), id: "troop_x_boss", name: "종지기", enemyIds: ["enemy_x_boss"], members: [{ enemyId: "enemy_x_boss", x: 0, y: 0 }] } as never,
      { ...structuredClone(t0), id: "troop_path_x_boss", name: "종지기", enemyIds: ["enemy_path_x_boss_x_boss"], members: [{ enemyId: "enemy_path_x_boss_x_boss", x: 0, y: 0 }] } as never);
    project.maps[project.startMapId]!.events = [event("ev_boss", "종지기", 5, 5, [page([], [{ kind: "battleProcessing", troopSource: "fixed", troopId: "troop_path_x_boss", canEscape: false }])])];
    return project;
  };

  it("원본을 모의전하면 맵이 싸우는 사본을 알려 준다", () => {
    const project = build();
    expect(settleFoughtCopy(project, "simulate_battle", { troopId: "troop_x_boss" })?.note).toContain("Map events fight troop_path_x_boss, the copy fitted to the starting party (enemy enemy_path_x_boss_x_boss, HP 406), not troop_x_boss.");
    expect(settleFoughtCopy(project, "simulate_battle", { troopId: "troop_path_x_boss" })).toBeUndefined();
  });
  it("원본을 고치면 사본을 걷고 싸움이 고친 원본으로 돌아간다 — 사본을 고친 호출 · 상관없는 적은 그대로", () => {
    const project = build();
    for (const params of [{ enemy: { id: "enemy_x_boss", stats: { maxHp: 700 } } }, { id: "enemy_x_boss", maxHp: 700 }]) {
      const settled = settleFoughtCopy(project, "upsert_enemy", params)!;
      expect(settled.note).toContain("troop_path_x_boss was the fitted copy the map fought; it is dropped and the fight uses troop_x_boss again");
      expect(JSON.stringify(settled.project.maps)).toContain('"troopId":"troop_x_boss"');
      expect(settled.project.database.troops.some((t) => t.id === "troop_path_x_boss")).toBe(false);
      expect(settled.project.database.enemies.some((e) => e.id.startsWith("enemy_path_"))).toBe(false);
    }
    expect(settleFoughtCopy(project, "upsert_enemy", { enemy: { id: "enemy_path_x_boss_x_boss" } })).toBeUndefined();
    expect(settleFoughtCopy(project, "upsert_enemy", { enemy: { id: project.database.enemies[0]!.id } })).toBeUndefined();
  });
  it("길 맞춤 사본에는 보스 위협 하한을 걸지 않는다 — 사본의 기술만 고쳤는데 HP 가 오르지 않는다", () => {
    const project = build();
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const res = runTool(ctx, "upsert_enemy", { role: "boss", enemy: { id: "enemy_path_x_boss_x_boss", skillIds: ["skill_attack"] } }, { dryRun: false });
    expect(res.ok).toBe(true);
    expect(res.summary).not.toContain("보스 위협 하한");
    expect(ctx.project.database.enemies.find((e) => e.id === "enemy_path_x_boss_x_boss")!.stats.maxHp).toBe(406);
  });
});

// #7: 순경이 «여학생 · 양갈래», 젊은 어부가 «젊은 여성», 중년 여인 상인이 남자 «여관 주인» 으로 섰다.
describe("사람 그림이 역할을 따른다 — 확인 빌드 r6", () => {
  const pick = (tileset: string | undefined, role: string, looks: string) => {
    const project = createBlankProject() as Project;
    const map = project.maps[project.startMapId]!;
    if (tileset) (map as unknown as { tilesetId: string }).tilesetId = tileset;
    const g = pickPersonGraphic(project, map, role, looks, true)!;
    return { label: g.label, family: charsetFamilyOf(project, g.textureKey), wanted: g.wanted };
  };

  it("현대 거리의 순경은 현대 칩의 남자로 서고, 못 쓰는 경찰관 칩의 이름을 «없는 그림» 으로 남긴다", () => {
    const cop = pick("jp_city_modern", "순경", "경찰관 제복");
    expect(cop.family).toBe("modern");
    expect(cop.label).not.toContain("여학생");
    expect(cop.label).toContain("남");
    expect(cop.wanted).toBe("경찰관 · 남색 제복");
    expect(pick("jp_city_modern", "학생", "학생 소년")).toEqual({ label: "남학생 · 남색 블레이저", family: "modern", wanted: undefined });
  });
  it("글이 말한 칩이 다른 화풍에 있으면 그 칩이 선다 — 계열은 기본값이지 벽이 아니다", () => {
    expect(pick(undefined, "어부", "젊은 어부")).toEqual({ label: "어부 · 파란 줄무늬", family: "refmap-doll", wanted: undefined });
    const monger = pick(undefined, "어물전 주인", "중년 여인 상인");
    expect(monger.label).toContain("마을 여인");
    expect(monger.wanted).toBeUndefined();
    // 제 화풍에 그 역할의 칩이 있으면 그대로다.
    expect(pick(undefined, "신부", "신부 사제")).toEqual({ label: "승려", family: "rtp-people", wanted: undefined });
  });
});
