import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { runGameCheck } from "@/qa/gameCheck";
import { endingGoal, planCriticalPath } from "@/qa/gameCheck/autoPlay";
import { allPages, visitPageCommands, type CommandVisit } from "@/qa/gameCheck/walk";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { runSceneTest } from "@/testing/sceneTestRunner";
import type { Command, Project } from "@/project/types";
import { checkGallery } from "@/qa/gameCheck/gallery";
import { buildQaFixture, type QaFixtureName } from "./fixtures/qaGame/qaGameFixtures";

// 픽스처는 저장·다시 읽기를 거친다 — 검사기는 로더가 돌려준 모양(런타임이 보는 모양)을 본다.
function check(name: QaFixtureName) {
  const project = deserialize(serialize(buildQaFixture(name)));
  return runGameCheck(project, { autoPlayBudgetMs: 20_000 });
}
const codes = (report: ReturnType<typeof check>, severity = "blocker") =>
  report.findings.filter((finding) => finding.severity === severity).map((finding) => finding.code);

describe("qa gameCheck (모델 없는 게임 검사기)", () => {
  it("깨끗한 픽스처는 막힘 없이 엔딩까지 자동 플레이된다(동료 합류 경로 포함)", () => {
    const report = check("clean");
    expect(codes(report)).toEqual([]);
    expect(report.autoPlay?.runs.map((run) => [run.label, run.ok, run.endingReached])).toEqual([
      ["기본 경로", true, "ending_light"],
      ["동료 합류 후", true, "ending_light"],
    ]);
    expect(report.autoPlay?.runs[1]?.partyAtEnd).toEqual(["actor_hero", "actor_scout"]);
    expect(report.maps.every((map) => map.reachable)).toBe(true);
  });

  it("빈 선택지 분기를 막힘으로 잡는다", () => {
    const report = check("emptyChoices");
    expect(codes(report)).toContain("choice-all-empty");
    const finding = report.findings.find((f) => f.code === "choice-all-empty")!;
    expect(finding.where).toMatchObject({ mapId: "map_blank_start", eventId: "ev_kai", pageIndex: 0, path: "commands[1]" });
  });

  it("changeParty 의 speciesId 를 잡고, 동료 합류 실패를 자동 플레이로 재현한다(원본 JSON)", () => {
    // 로더는 이제 speciesId 를 actorId 로 옮긴다(#1191) — 생성기가 쓴 그대로(원본)를 검사해야 결함이 보인다.
    const report = runGameCheck(JSON.parse(serialize(buildQaFixture("speciesIdParty"))), { autoPlayBudgetMs: 20_000 });
    expect(codes(report)).toEqual(expect.arrayContaining(["command-missing-required", "autoplay-failed"]));
    expect(report.findings.some((f) => f.code === "command-unknown-field" && f.message.includes("speciesId"))).toBe(true);
    const companion = report.autoPlay!.runs.find((run) => run.label === "동료 합류 후")!;
    expect(companion.ok).toBe(false);
    // 옛 런타임은 파티에 null 을 넣고 전투가 Missing actor 로 멈췄다. #1191 뒤 런타임은 없는 배우를 건너뛴다 — 어느 쪽이든 합류 실패로 잡힌다.
    expect(companion.failure?.detail).toMatch(/없는 배우|파티가 늘지/u);
    // 동료 없이 가는 기본 경로는 여전히 끝까지 간다 — 결함이 동료 합류에 있다는 증거.
    expect(report.autoPlay!.runs.find((run) => run.label === "기본 경로")?.ok).toBe(true);
  });

  it("로더가 고친 명령은 load-normalized 경고로 남는다(생성기 결함의 흔적)", () => {
    const text = serialize(buildQaFixture("speciesIdParty"));
    const report = runGameCheck(deserialize(text), { rawProject: JSON.parse(text), skipAutoPlay: true });
    const normalized = report.findings.filter((f) => f.code === "load-normalized");
    if (normalized.length === 0) {
      // 로더가 아직 고치지 않는 판(옛 main)이면 원본 그대로 막힘으로 잡힌다.
      expect(codes(report)).toContain("command-missing-required");
    } else {
      expect(normalized[0]!.message).toContain("speciesId");
      expect(normalized[0]!.where?.eventId).toBe("ev_kai");
    }
  });

  it("엔딩 페이지를 여는 스위치를 켜는 곳이 없으면 막힘 + 자동 플레이 실패", () => {
    const report = check("endingSwitchUnset");
    expect(codes(report)).toEqual(expect.arrayContaining(["ending-page-switch-never-set", "autoplay-failed"]));
    const base = report.autoPlay!.runs[0]!;
    expect(base.ok).toBe(false);
    expect(base.steps.some((step) => step.detail.includes("찾지 못했습니다") || step.detail.includes("충족되지"))).toBe(true);
  });

  it("빈 껍데기 맵과 못 가는 맵을 잡는다", () => {
    const report = check("orphanMaps");
    const orphan = report.findings.find((f) => f.code === "orphan-empty-map")!;
    expect(orphan.severity).toBe("blocker");
    expect(orphan.where?.mapId).toBe("map_frozen_cave");
    const unreachable = report.findings.find((f) => f.code === "unreachable-map")!;
    expect(unreachable.where?.mapId).toBe("map_lighthouse");
    expect(report.maps.find((map) => map.id === "map_lighthouse")?.reachable).toBe(false);
  });

  it("엔딩을 부르는 곳이 하나도 없으면 막힘", () => {
    const project = deserialize(serialize(buildQaFixture("clean")));
    for (const map of Object.values(project.maps)) for (const e of map.events) for (const p of e.pages ?? []) p.commands = p.commands.filter((c) => c.kind !== "triggerEnding");
    expect(codes(runGameCheck(project, { skipAutoPlay: true }))).toContain("no-ending-trigger");
  });

  it("보스전이 선택지로 바뀌어 전투가 없으면, 같은 이름의 안 쓰인 적 그룹을 짚는다(실제 gen 런 lighthouse-1)", () => {
    const project = deserialize(serialize(buildQaFixture("clean")));
    const boss = project.maps.map_cave!.events.find((e) => e.id === "ev_boss")!;
    const battle = boss.pages[0]!.commands[0] as { victoryBranch: unknown[] };
    boss.pages[0]!.commands = [{ kind: "choices", options: [{ text: "맞서 싸운다", branch: battle.victoryBranch }, { text: "물러선다", branch: [{ kind: "text", body: "..." }] }] }] as never;
    project.database.troops.push({ ...project.database.troops.find((t) => t.id === "troop_slime")!, id: "troop_blizzard_spirit", name: "눈보라 정령" });
    const report = runGameCheck(project, { skipAutoPlay: true, briefText: "등대를 얼린 보스 눈보라 정령을 물리친다" });
    const finding = report.findings.find((f) => f.code === "brief-no-boss");
    expect(finding?.message).toContain("눈보라 정령(troop_blizzard_spirit)");
    expect(finding?.message).not.toContain("troop_slime");
  });

  // 3차 재시험 워크스페이스의 읽기 전용 내보내기(node scripts/oprn-store.mjs export-json …). 없으면 건너뛴다.
  const RETEST3 = "/tmp/qa-retest3.json";
  it.skipIf(!fs.existsSync(RETEST3))("3차 재시험 내보내기에서 speciesId/null 파티 막힘을 잡는다", () => {
    const report = runGameCheck(JSON.parse(fs.readFileSync(RETEST3, "utf8")), { autoPlayBudgetMs: 30_000 });
    expect(report.findings.some((f) => f.code === "command-missing-required" && f.where?.eventId === "ev_companion_kai")).toBe(true);
    const companion = report.autoPlay!.runs.find((run) => run.label === "동료 합류 후")!;
    expect(companion.failure?.detail).toMatch(/없는 배우|파티가 늘지/u);
  }, 60_000);
});

// 동굴에 걸음마다 늑대가 나온다 — 한 판은 이기지만 회복 없이 두 판째에 쓰러지는 세기(결정적 시드).
function attritionProject(attack: number): Project {
  const project = buildQaFixture("clean");
  const wolf = structuredClone(project.database.enemies.find((enemy) => enemy.id === "enemy_slime")!);
  wolf.id = "enemy_wolf";
  wolf.name = "굶주린 늑대";
  wolf.stats = { ...wolf.stats, attack, maxHp: 200, agility: 30 };
  project.database.enemies.push(wolf);
  const troop = structuredClone(project.database.troops[0]!);
  project.database.troops.push({ ...troop, id: "troop_wolf", name: "늑대", enemyIds: ["enemy_wolf"], members: [{ enemyId: "enemy_wolf", x: 100, y: 100, hidden: false }] });
  const cave = project.maps.map_cave!;
  cave.encounterRate = 1000;
  cave.encounterTable = [{ troopId: "troop_wolf", weight: 1 }];
  return deserialize(serialize(project));
}

describe("qa gameCheck — 무작위 인카운터 소모전", () => {
  it("회복 없이 연달아 맞아 진 것은 막힘이 아니라 경고 — 인카운터 직전마다 회복하면 엔딩까지 간다", () => {
    const report = runGameCheck(attritionProject(120), { autoPlayBudgetMs: 20_000 });
    expect(codes(report as ReturnType<typeof check>)).toEqual([]);
    expect(codes(report as ReturnType<typeof check>, "warning")).toContain("autoplay-encounter-attrition");
    expect(report.autoPlay!.runs.map((run) => [run.label, run.ok])).toEqual([
      ["기본 경로(전투마다 회복)", true],
      ["동료 합류 후(전투마다 회복)", true],
    ]);
  });

  it("run_scene_test 기본값은 소모를 그대로 본다 — 회복은 러너 설정으로만 켠다", () => {
    const project = attritionProject(120);
    const steps = [1, 2, 3, 4, 5].map(() => ({ kind: "move" as const, dir: "right" as const }));
    const input = { mapId: "map_cave", start: { x: 3, y: 7 }, steps };
    expect(runSceneTest(project, input).log.some((line) => /random encounter troop_wolf: defeat/u.test(line))).toBe(true);
    const recovered = runSceneTest(project, input, undefined, { recoverBeforeRandomEncounters: true });
    expect(recovered.log.some((line) => /: defeat/u.test(line))).toBe(false);
  });
});

// 보스(드래곤 급)를 잡아서 혼자·합류 파티·확인 레벨로 각각 다르게 이기게 만든 변형.
// 패배는 게임 오버(canLose:false) — 자동 플레이가 「승리 분기 목표 미도달」로 보고하는 실제 보스전 손실을 재현한다.
// 2026-09-24 도그푸딩 등대지기의 겨울(혼자만 패배, 동료 합류 후엔 엔딩)·잿불 광산(합류 파티도 도달 레벨에선 패배).
function bossBattleProject(options: { maxHp: number; attack: number; growCurves?: boolean }): Project {
  const project = buildQaFixture("clean");
  const tyrant = structuredClone(project.database.enemies.find((enemy) => enemy.id === "enemy_dragon")!);
  tyrant.id = "enemy_ember_tyrant";
  tyrant.name = "잿불 폭군";
  tyrant.stats = { ...tyrant.stats, maxHp: options.maxHp, attack: options.attack, agility: 30 };
  project.database.enemies.push(tyrant);
  const base = structuredClone(project.database.troops.find((troop) => troop.id === "troop_slime")!);
  project.database.troops.push({ ...base, id: "troop_boss_tyrant", name: "잿불 폭군", enemyIds: [tyrant.id], members: [{ enemyId: tyrant.id, x: 100, y: 100, hidden: false }] });
  const boss = project.maps.map_cave!.events.find((entry) => entry.id === "ev_boss")!;
  const battle = boss.pages![0]!.commands.find((command) => command.kind === "battleProcessing") as Extract<Command, { kind: "battleProcessing" }>;
  battle.troopId = "troop_boss_tyrant";
  battle.canLose = false;
  if (options.growCurves) {
    for (const actor of project.database.actors) {
      const curves = actor.parameterCurves as Record<string, number[]>;
      const length = (curves.maxHp ?? [1, 2]).length;
      const ramp = (from: number, to: number) => Array.from({ length }, (_, index) => Math.round(from + (to - from) * (index / Math.max(1, length - 1))));
      actor.parameterCurves = { ...curves, maxHp: ramp(514, 2400), attack: ramp(53, 220), defense: ramp(72, 200), agility: ramp(45, 96) };
    }
  }
  return deserialize(serialize(project));
}

describe("qa gameCheck — 보스 전투 패배는 전투 패배로 보고하고 레벨·합류 전제는 경고로 낮춘다", () => {
  it("혼자만 지고 동료 합류 실행은 엔딩까지 가면 막힘이 아니다(등대지기의 겨울 r3)", () => {
    const report = runGameCheck(bossBattleProject({ maxHp: 576, attack: 130 }), { autoPlayBudgetMs: 20_000 });
    const solo = report.autoPlay!.runs.find((run) => run.label === "기본 경로")!;
    expect(solo.ok).toBe(false);
    expect(solo.failure?.detail).toMatch(/이벤트 전투에서 패배해 게임 오버 — 승리 분기의 목표 명령에 닿지 않았습니다/u);
    expect(solo.failure?.detail).toContain("battle troop_boss_tyrant: defeat");
    expect(report.autoPlay!.runs.find((run) => run.label === "동료 합류 후")!.ok).toBe(true);
    expect(codes(report as ReturnType<typeof check>)).toEqual([]);
    const warning = report.findings.find((finding) => finding.code === "autoplay-boss-attrition");
    expect(warning?.message).toContain("다른 실행은 엔딩까지 갑니다");
    expect(warning?.where?.eventId).toBe("ev_boss");
  });

  it("동료 합류 파티도 도달 레벨에선 지지만 확인 레벨(Lv10) 모의전에서 이기면 경고로 낮춘다(잿불 광산 r2)", () => {
    const report = runGameCheck(bossBattleProject({ maxHp: 2000, attack: 140, growCurves: true }), { autoPlayBudgetMs: 20_000 });
    expect(codes(report as ReturnType<typeof check>)).toEqual([]);
    const warning = report.findings.find((finding) => finding.code === "autoplay-boss-attrition");
    expect(warning?.message).toContain("모의전으로는 동료 합류 파티 2명 Lv10 에서 승률");
    expect(report.autoPlay!.runs.every((run) => run.ok === false)).toBe(true);
  });

  it("확인 레벨에서도 못 이기는 보스는 그대로 막힘이다 — 레벨업으로 못 이기는 걸 경고로 끼우지 않는다", () => {
    const report = runGameCheck(bossBattleProject({ maxHp: 6000, attack: 250 }), { autoPlayBudgetMs: 20_000 });
    expect(codes(report as ReturnType<typeof check>)).toContain("autoplay-failed");
    expect(report.findings.some((finding) => finding.code === "autoplay-boss-attrition")).toBe(false);
    const solo = report.autoPlay!.runs.find((run) => run.label === "기본 경로")!;
    expect(solo.failure?.detail).toMatch(/이벤트 전투에서 패배해/u);
  });
});

describe("qa gameCheck — changeItem 은 장비 id 도 소지품이다(r4 보물상자)", () => {
  function chestWith(itemId: string): Project {
    const project = deserialize(serialize(buildQaFixture("clean")));
    project.maps[project.startMapId]!.events.push({
      id: "ev_chest_equipment", name: "낡은 보물상자", x: 7, y: 7,
      pages: [{
        id: "p1", name: "p1", conditions: [], graphic: { transparent: true },
        trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [
          { kind: "changeItem", itemId, op: "+=", amount: 1 },
          { kind: "changeGold", op: "+=", amount: 100 },
          { kind: "text", body: "보물상자를 열었다!" },
          { kind: "setSelfSwitch", key: "A", value: true },
        ] as Command[],
      }],
    } as never);
    return project;
  }

  it("장비 id 를 가리키는 changeItem 은 커밋·런타임 계약(items∪equipment)과 같게 막힘이 아니다", () => {
    const equipmentId = chestWith("item_not_here").database.equipment[0]!.id;
    const report = runGameCheck(chestWith(equipmentId), { skipAutoPlay: true });
    expect(report.findings.filter((f) => f.code === "command-missing-reference" && f.where?.eventId === "ev_chest_equipment")).toEqual([]);
    expect(codes(report as ReturnType<typeof check>)).toEqual([]);
  });

  it("아이템·장비 어디에도 없는 itemId 는 여전히 막힘이다", () => {
    const report = runGameCheck(chestWith("item_definitely_missing"), { skipAutoPlay: true });
    const finding = report.findings.find((f) => f.code === "command-missing-reference" && f.where?.eventId === "ev_chest_equipment");
    expect(finding?.severity).toBe("blocker");
    expect(finding?.message).toContain("item_definitely_missing");
  });

  // 실제 gen 런 산출물(.readString 그대로) — 「기사의 철검」 보물상자가 유효 장비 참조였다.
  const R4 = "qa-runs/jrpg-r4/project.json";
  it.skipIf(!fs.existsSync(R4))("r4 생성물 전체에서 changeItem 장비 참조 막힘이 없다", () => {
    const report = runGameCheck(JSON.parse(fs.readFileSync(R4, "utf8")), { autoPlayBudgetMs: 30_000 });
    expect(report.findings.filter((f) => f.code === "command-missing-reference")).toEqual([]);
    expect(report.counts.blocker).toBe(0);
  }, 60_000);
});

describe("qa gameCheck — 턴제 JRPG 장르 검사", () => {
  function jrpgFixture() {
    const project = deserialize(serialize(buildQaFixture("clean")));
    project.system.genre = "adventure-jrpg";
    return project;
  }

  it("골드만 깎고 아무것도 주지 않는 선택지(가짜 상점)를 짚는다", () => {
    const project = jrpgFixture();
    const map = project.maps[project.startMapId]!;
    map.events.push({
      id: "ev_fake_shop", name: "무기 상인", x: 1, y: 1,
      pages: [{
        id: "p1", name: "무기점", conditions: [], trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "choices", options: [
          { label: "철 검 구매 (150 골드)", branch: [{ kind: "changeGold", op: "-=", amount: 150 }, { kind: "text", body: "철 검을 샀다!" }] },
          { label: "포션 구매 (20 골드)", branch: [{ kind: "changeGold", op: "-=", amount: 20 }, { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 1 }] },
        ] }],
      }],
    } as never);
    const report = runGameCheck(project, { skipAutoPlay: true });
    const fake = report.findings.filter((f) => f.code === "jrpg-paid-choice-grants-nothing");
    expect(fake).toHaveLength(1);
    expect(fake[0]!.where).toMatchObject({ eventId: "ev_fake_shop", path: "commands[0].options[0]" });
  });

  it("JRPG 가 아닌 프로젝트에는 장르 검사를 하지 않는다", () => {
    const project = deserialize(serialize(buildQaFixture("clean")));
    project.system.genre = undefined as never;
    delete (project as { gameDesignBrief?: unknown }).gameDesignBrief;
    const report = runGameCheck(project, { skipAutoPlay: true });
    expect(report.findings.some((f) => f.code.startsWith("jrpg-"))).toBe(false);
  });
});

describe("qa gameCheck — 꽃잎 체력 검사는 전투 게임에 쓰지 않는다", () => {
  const brief = "체력이 0이 되면 게임 오버. 광산의 용암 골렘을 쓰러뜨린다.";
  it("보스전이 있는 게임은 전투 HP 가 체력이다 — gallery-no-life-damage 없음", () => {
    expect(checkGallery(buildQaFixture("clean"), brief).map((f) => f.code)).not.toContain("gallery-no-life-damage");
  });
  it("추격의 「게임 오버」 문장만으로는 꽃잎 체력을 요구하지 않는다", () => {
    expect(checkGallery(buildQaFixture("clean"), "닿으면 붙잡혀 게임 오버. 옷장에 숨는다.")).toEqual([]);
  });

  it("전투가 없는 게임은 여전히 짚는다", () => {
    const project = buildQaFixture("clean");
    const boss = project.maps.map_cave!.events.find((event) => event.id === "ev_boss")!;
    boss.pages[0]!.commands = [{ kind: "text", body: "정령이 사라졌다." }];
    expect(checkGallery(project, brief).map((f) => f.code)).toContain("gallery-no-life-damage");
  });
});

// 이름 있는 엔딩의 호감 조건
describe("qa gameCheck — 이름 있는 엔딩의 호감 조건", () => {
  it("triggerEnding(endingId)의 엔딩 조건을 선행 목표로 넣는다", () => {
    const project = createBlankProject();
    const variableId = project.variables[0]!.id;
    project.variables[0]!.name = "나래호감";
    project.endings = [{ id: "ending_love", name: "고백", priority: 10, conditions: [{ kind: "variable", variableId, op: ">=", value: 6 }] }];
    const map = project.maps[project.startMapId]!;
    const page = {
      conditions: [], trigger: { kind: "action" }, priority: "same", graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 },
    };
    map.events.push({
      id: "ev_talk", name: "대화", x: project.startPos.x + 1, y: project.startPos.y,
      trigger: { kind: "action" }, commands: [],
      pages: [{ ...page, id: "talk", commands: [{ kind: "setVariable", variableId, op: "+=", value: 2 }] }],
    } as never);
    map.events.push({
      id: "ev_confess", name: "고백", x: project.startPos.x, y: project.startPos.y + 1,
      trigger: { kind: "action" }, commands: [],
      pages: [{ ...page, id: "confess", commands: [{ kind: "triggerEnding", endingId: "ending_love" }] }],
    } as never);
    const hits: CommandVisit[] = [];
    for (const ref of allPages(project)) visitPageCommands(ref, (hit) => { if (hit.command.kind === "triggerEnding") hits.push(hit); });
    const visit = hits[0]!;
    const plan = planCriticalPath(project, visit, endingGoal(visit));
    expect(plan.goals.map((goal) => goal.label).join("\n")).toContain("나래호감 >= 6 만들기");
    expect(plan.unresolved).toEqual([]);
  });
});

// 2026-09-24 감성 스토리 r3: 컷신 say 비트가 text 로 컴파일되며 style·context·container 를 싣는데
// 검사기는 스키마 폼에 없다고 «모르는 필드» 로 세어 경고 45건을 터뜨렸다(런타임 타입에는 있다).
describe("qa gameCheck — 런타임 대화 필드는 모르는 필드가 아니다", () => {
  it("text 명령의 style·context·container 는 command-unknown-field 경고를 만들지 않는다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.events.push({
      id: "ev_style_lines", name: "연출 대사", x: 5, y: 5, trigger: { kind: "action" }, commands: [],
      pages: [{
        id: "p", conditions: [], trigger: { kind: "action" }, priority: "same", graphic: {},
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", speaker: "노을", body: "빗소리가…", emotion: "sad", style: "calm", context: "whisper", container: "box", autoAdvance: true }],
      }],
    } as never);
    const report = runGameCheck(project, { skipAutoPlay: true });
    const unknown = report.findings.filter((f) => f.code === "command-unknown-field" && f.where?.eventId === "ev_style_lines");
    expect(unknown).toEqual([]);
  });
});
