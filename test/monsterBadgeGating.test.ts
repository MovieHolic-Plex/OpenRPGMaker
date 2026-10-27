// 배지 수 조건(badgeCount)·배지 게이트 도구·원작식 복종 레벨 상한(2026-10-16). 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import {
  badgeContext, currentObedienceCap, defaultObedienceCaps, earnedBadgeCount, linearObedienceCaps, obedienceLevelCapFor, obedienceRefusalLine,
} from "@/project/badgeProgress";
import { partySkillContext } from "@/project/partySkills";
import { deserialize, serialize } from "@/project/io";
import { validateMonsterCampaign } from "@/project/io/shapeMonsterCampaign";
import { resolveEventPage } from "@/project/io/pageResolution";
import { evalCondition } from "@/project/session";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import type { Condition, GameEvent, Project } from "@/project/types";
import type { MonsterCampaignConfig } from "@/project/types/database";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";

const CAMPAIGN: MonsterCampaignConfig = {
  id: "c", name: "원정", speciesIds: [], speciesNotes: {}, locations: [], objectives: [],
  badges: [1, 2, 3].map((n) => ({ id: `badge_${n}`, name: `배지${n}`, switchId: `mx_badge_${n}`, cityMapId: "map" })),
};
/**
 * CAMPAIGN's badges point at a placeholder city map ("map"); load validation (io/references.ts) and
 * configure_monster_campaign require each badge's city map and switch to exist in the project.
 */
function campaignIn(project: Project): MonsterCampaignConfig {
  const campaign = structuredClone(CAMPAIGN);
  for (const badge of campaign.badges) {
    badge.cityMapId = project.startMapId;
    if (!project.switches.some((entry) => entry.id === badge.switchId)) project.switches.push({ id: badge.switchId, name: badge.name });
  }
  return campaign;
}
const session = (switches: Record<string, boolean>) => ({ switches, variables: {}, partyActorIds: [], flags: {}, actorVitals: {}, x: 0, y: 0, currentMapId: "m" });

describe("badgeCount 조건", () => {
  const atLeast = (value: number): Condition => ({ kind: "badgeCount", op: ">=", value });

  it("캠페인 정의가 있으면 그 배지 스위치가 켜진 개수를 센다(다른 스위치는 세지 않는다)", () => {
    const ctx = { partySkillIds: undefined, badgeSwitchIds: () => CAMPAIGN.badges.map((b) => b.switchId) };
    expect(evalCondition(session({ mx_badge_1: true, mx_badge_2: true, sw_other: true }), atLeast(2), undefined, ctx)).toBe(true);
    expect(evalCondition(session({ mx_badge_1: true, sw_other: true }), atLeast(2), undefined, ctx)).toBe(false);
  });

  it("정의가 없으면 mx_badge_N 규약 스위치를 센다", () => {
    expect(evalCondition(session({ mx_badge_1: true, mx_badge_2: true }), atLeast(2))).toBe(true);
    expect(evalCondition(session({ mx_badge_1: true, mx_story: true }), atLeast(2))).toBe(false);
    expect(evalCondition(session({}), { kind: "badgeCount", op: "==", value: 0 })).toBe(true);
  });

  it("페이지 해석기가 같은 결과를 낸다(partySkillContext 가 캠페인 배지 목록을 싣는다)", () => {
    const project = createScarloxyPokemonDemoProject();
    project.system.monsterCampaign = structuredClone(CAMPAIGN);
    const event = { id: "ev", x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [
      { id: "closed", name: "닫힘", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] },
      { id: "open", name: "열림", conditions: [atLeast(3)], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] },
    ] } as unknown as GameEvent;
    const at = (n: number) => {
      const switches = Object.fromEntries(CAMPAIGN.badges.slice(0, n).map((b) => [b.switchId, true]));
      const s = session(switches) as never;
      return resolveEventPage(event, s, partySkillContext(project, s))?.id;
    };
    expect(at(2)).toBe("closed");
    expect(at(3)).toBe("open");
    expect(badgeContext(project).badgeSwitchIds?.()).toEqual(["mx_badge_1", "mx_badge_2", "mx_badge_3"]);
  });

  it("earnedBadgeCount 는 스위치가 없거나 목록이 비어도 0", () => {
    expect(earnedBadgeCount(undefined)).toBe(0);
    expect(earnedBadgeCount({ mx_badge_1: true }, [])).toBe(0);
    expect(earnedBadgeCount({ a: true, b: false, c: true }, ["a", "b", "c", "a"])).toBe(2);
  });
});

describe("복종 레벨 상한 — 규칙", () => {
  const rule = { enabled: true, caps: [{ badges: 0, maxLevel: 20 }, { badges: 2, maxLevel: 30 }, { badges: 5, maxLevel: 50 }] };

  it("배지 수 이하인 마지막 항목이 상한이고, 모자라면 첫 항목", () => {
    expect([0, 1, 2, 4, 5, 8].map((n) => obedienceLevelCapFor(rule, n))).toEqual([20, 20, 30, 30, 50, 50]);
    expect(obedienceLevelCapFor({ enabled: true, caps: [{ badges: 3, maxLevel: 40 }] }, 0)).toBe(40);
  });

  it("꺼짐·없음·빈 caps 는 제한 없음(undefined)", () => {
    expect(obedienceLevelCapFor(undefined, 3)).toBeUndefined();
    expect(obedienceLevelCapFor({ ...rule, enabled: false }, 3)).toBeUndefined();
    expect(obedienceLevelCapFor({ enabled: true, caps: [] }, 3)).toBeUndefined();
  });

  it("프로젝트·세션 스위치로 현재 상한을 읽는다", () => {
    const project = { system: { monsterCampaign: { ...structuredClone(CAMPAIGN), obedienceLevelCaps: rule } } } as unknown as Project;
    expect(currentObedienceCap(project, { mx_badge_1: true, mx_badge_2: true })).toBe(30);
    expect(currentObedienceCap({ system: { monsterCampaign: structuredClone(CAMPAIGN) } } as unknown as Project, { mx_badge_1: true })).toBeUndefined();
  });

  it("기본 사다리와 거부 문장", () => {
    expect(defaultObedienceCaps(3)).toEqual([{ badges: 0, maxLevel: 20 }, { badges: 1, maxLevel: 25 }, { badges: 2, maxLevel: 30 }, { badges: 3, maxLevel: 35 }]);
    expect(linearObedienceCaps(1, 10, 3)).toEqual([{ badges: 0, maxLevel: 10 }, { badges: 1, maxLevel: 13 }]);
    expect(obedienceRefusalLine(undefined, "새싹이", 0)).toBe("새싹이는 말을 듣지 않는다!");
    expect(obedienceRefusalLine({ enabled: true, caps: [], refuseLine: "{name}이(가) 고개를 돌렸다." }, "불꽃", 3)).toBe("불꽃이(가) 고개를 돌렸다.");
    const lines = new Set([0, 1, 2, 3].map((turn) => obedienceRefusalLine(undefined, "물결", turn)));
    expect(lines.size).toBe(4);
  });

  it("검증 — 잘못된 caps 는 거부하고 필드 없음은 통과(기본 꺼짐)", () => {
    const base = structuredClone(CAMPAIGN);
    expect(() => validateMonsterCampaign(base)).not.toThrow();
    expect(() => validateMonsterCampaign({ ...base, obedienceLevelCaps: { enabled: true, caps: [{ badges: 0, maxLevel: 20 }] } })).not.toThrow();
    expect(() => validateMonsterCampaign({ ...base, obedienceLevelCaps: { enabled: true, caps: [] } })).toThrow(/caps/);
    expect(() => validateMonsterCampaign({ ...base, obedienceLevelCaps: { enabled: true, caps: [{ badges: 2, maxLevel: 20 }, { badges: 1, maxLevel: 30 }] } })).toThrow(/오름차순/);
    expect(() => validateMonsterCampaign({ ...base, obedienceLevelCaps: { enabled: true, caps: [{ badges: 0, maxLevel: 0 }] } })).toThrow(/maxLevel/);
    expect(() => validateMonsterCampaign({ ...base, obedienceLevelCaps: { enabled: "yes", caps: [] } })).toThrow(/enabled/);
  });

  it("기본값에서는 직렬화에 나타나지 않는다", () => {
    const project = createScarloxyPokemonDemoProject();
    project.system.monsterCampaign = campaignIn(project);
    expect(serialize(project)).not.toContain("obedienceLevelCaps");
    project.system.monsterCampaign.obedienceLevelCaps = { enabled: true, caps: [{ badges: 0, maxLevel: 20 }] };
    expect(deserialize(serialize(project)).system.monsterCampaign?.obedienceLevelCaps).toEqual({ enabled: true, caps: [{ badges: 0, maxLevel: 20 }] });
  });
});

describe("복종 레벨 상한 — 전투 런타임", () => {
  const caughtAt = (project: Project) => ({ mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y });
  function start(level: number, rule: MonsterCampaignConfig["obedienceLevelCaps"], switches: Record<string, boolean> = {}) {
    const project = createScarloxyPokemonDemoProject();
    project.system.battleModel = "gen1";
    project.system.monsterCampaign = { ...structuredClone(CAMPAIGN), ...(rule ? { obedienceLevelCaps: rule } : {}) };
    return createBattleRuntime({
      project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, battleFlow: "strict",
      sessionState: { switches, variables: {}, inventory: {} },
      partyMonsters: [{ instanceId: "monster-obey", speciesId: scarloxySpeciesId("sparchu"), level, exp: 0, skillIds: ["skill_scarloxy_quick"], friendship: 70, caughtAt: caughtAt(project) }],
      rng: () => 0,
    });
  }
  const rule = { enabled: true, caps: [{ badges: 0, maxLevel: 20 }, { badges: 1, maxLevel: 40 }] };
  const refusals = (runtime: ReturnType<typeof start>) => runtime.snapshot().timeline.filter((entry) => entry.kind === "special" && /말을 듣지|제멋대로|딴청|지시를 따르지/.test(entry.message ?? ""));

  it("상한을 넘은 몬스터는 기술 명령을 거부하고 상대는 맞지 않는다", () => {
    const runtime = start(30, rule);
    const enemyHpBefore = runtime.snapshot().enemies[0]!.hp;
    runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
    expect(refusals(runtime)).toHaveLength(1);
    expect(runtime.snapshot().enemies[0]!.hp).toBe(enemyHpBefore);
  });

  it("상한 이하이거나 배지가 늘어 상한이 오르면 말을 듣는다", () => {
    for (const runtime of [start(20, rule), start(30, rule, { mx_badge_1: true })]) {
      runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
      expect(refusals(runtime)).toHaveLength(0);
    }
  });

  it("규칙이 없거나 꺼져 있으면 아무것도 바뀌지 않는다", () => {
    for (const runtime of [start(60, undefined), start(60, { ...rule, enabled: false })]) {
      runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
      expect(refusals(runtime)).toHaveLength(0);
    }
  });

  it("거부 중에도 아이템·도망은 명령할 수 있다(거부는 기술 명령만)", () => {
    const runtime = start(30, rule);
    runtime.performActorCommand({ kind: "escape" });
    expect(refusals(runtime)).toHaveLength(0);
  });
});

describe("도구 — place_badge_gate / configure_monster_campaign {obedienceLevelCaps}", () => {
  const ctxOf = (project: Project): ToolContext => ({ project, currentMapId: project.startMapId, assistantRun: true, monsterTurn: true });
  const prepared = (): Project => {
    const project = createScarloxyPokemonDemoProject();
    project.system.battleModel = "gen1";
    return project;
  };

  it("place_badge_gate: 세 페이지(막힘 → 확인 → 열림)와 badgeCount 조건을 만든다", () => {
    const project = prepared();
    const map = project.maps[project.startMapId]!;
    const spot = { x: Math.min(map.width - 2, project.startPos.x + 2), y: project.startPos.y };
    const ctx = ctxOf(project);
    const result = runTool(ctx, "place_badge_gate", { mapId: map.id, x: spot.x, y: spot.y, badges: 3, name: "문지기" }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const event = ctx.project.maps[map.id]!.events.find((e) => e.id === (result.data as { eventIds: string[] }).eventIds[0])!;
    expect(event.pages!.map((page) => page.id.replace(/^.*_/, ""))).toEqual(["locked", "check", "open"]);
    expect(event.pages![1]!.conditions).toContainEqual({ kind: "badgeCount", op: ">=", value: 3 });
    expect(event.pages![0]!.priority).toBe("same");
    expect(event.pages![2]!.priority).toBe("below");
  });

  it("place_badge_gate: 캠페인 배지 수보다 큰 N·모르는 칸은 거부한다", () => {
    const project = prepared();
    project.system.monsterCampaign = structuredClone(CAMPAIGN);
    const ctx = ctxOf(project);
    const map = project.maps[project.startMapId]!;
    const tooMany = runTool(ctx, "place_badge_gate", { mapId: map.id, x: 3, y: 3, badges: 4 }, { dryRun: false });
    expect(tooMany.ok).toBe(false);
    const unknown = runTool(ctx, "place_badge_gate", { mapId: map.id, x: 3, y: 3, badges: 2, count: 2 }, { dryRun: false });
    expect(unknown.ok).toBe(false);
  });

  it("configure_monster_campaign: 켜기(caps 생략=기본 사다리)·끄기(필드 제거)", () => {
    const project = prepared();
    project.system.monsterCampaign = campaignIn(project);
    const ctx = ctxOf(project);
    const on = runTool(ctx, "configure_monster_campaign", { obedienceLevelCaps: { enabled: true } }, { dryRun: false });
    expect(on.ok, on.summary).toBe(true);
    expect(ctx.project.system.monsterCampaign!.obedienceLevelCaps).toEqual({ enabled: true, caps: defaultObedienceCaps(3) });
    const custom = runTool(ctx, "configure_monster_campaign", { obedienceLevelCaps: { enabled: true, caps: [{ badges: 0, maxLevel: 12 }, { badges: 3, maxLevel: 50 }], refuseLine: "{name}은 코를 판다." } }, { dryRun: false });
    expect(custom.ok, custom.summary).toBe(true);
    expect(ctx.project.system.monsterCampaign!.obedienceLevelCaps).toMatchObject({ caps: [{ badges: 0, maxLevel: 12 }, { badges: 3, maxLevel: 50 }], refuseLine: "{name}은 코를 판다." });
    const off = runTool(ctx, "configure_monster_campaign", { obedienceLevelCaps: { enabled: false } }, { dryRun: false });
    expect(off.ok, off.summary).toBe(true);
    expect(ctx.project.system.monsterCampaign!.obedienceLevelCaps).toBeUndefined();
  });
});
