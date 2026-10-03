import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBattleRuntime, type BattleRuntime, type BattleSnapshot, type TargetedActorCommand } from "@/battle/runtime";
import { commandPanel, type BattleCommandPanelOptions, type BattleCommandSubmenu } from "@/player/battleCommandDom";
import { createBlankProject, DEFAULT_ITEM_ID, DEFAULT_TROOP_ID } from "@/project/defaults";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";
import type { MonsterInstance, Project, SkillId } from "@/project/types";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";

type Gen1Harness = {
  readonly project: Project;
  readonly runtime: BattleRuntime;
  readonly snapshot: BattleSnapshot;
};

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

describe("Gen1 monster battle command DOM", () => {
  it("renders exactly Fight / PKMN / Item / Run for a Pokemon monster actor", () => {
    const { runtime, snapshot } = gen1Harness();
    const { options } = panelOptions(runtime);

    const root = commandPanel(snapshot, options) as unknown as FakeElement;

    expect(commandIds(root)).toEqual([
      "actor-command-fight",
      "actor-command-item",
      "actor-command-pkmn",
      "actor-command-run",
    ]);
    // 한국어판 포켓몬 전투 화면 순서·이름(f115c53bb9): 싸운다 · 가방 / 몬스터 · 도망간다.
    expect(commandLabels(root)).toEqual(["싸운다", "가방", "몬스터", "도망간다"]);
    expect(root.querySelector("[data-testid='actor-command-attack']")).toBeNull();
    expect(root.querySelector("[data-testid='actor-command-defend']")).toBeNull();
    expect(root.querySelector("[data-testid='actor-command-capture']")).toBeNull();
  });

  it("limits Fight to four moves, shows current/max PP, and disables PP 0", () => {
    const { runtime, snapshot } = gen1Harness();
    const state = panelOptions(runtime);
    const root = commandPanel(snapshot, state.options) as unknown as FakeElement;

    button(root, "actor-command-fight").click();
    expect(state.submenu()).toEqual({ kind: "pokemonFight" });

    const fight = commandPanel(snapshot, { ...state.options, submenu: state.submenu() }) as unknown as FakeElement;
    expect(fight.querySelectorAll(".battle-command").filter((node) => node.dataset.testid?.startsWith("actor-skill-"))).toHaveLength(4);
    expect(fight.textContent).toContain("횟수 0/20");
    expect(fight.textContent).toContain("횟수 5/5");
    expect(fight.querySelector("[data-testid='actor-skill-skill_move_1']")).toBeNull();
    // 횟수 0 인 기술은 `disabled` 가 아니라 `aria-disabled` 로 남긴다 — 커서가 서야 "남은 횟수가 없습니다" 를 읽는다.
    expect(button(fight, "actor-skill-skill_move_2").dataset.battleCommandInert).toBe("true");
    expect(button(fight, "actor-skill-skill_move_2").textContent).toContain("남은 횟수가 없습니다");
    expect(button(fight, "actor-skill-skill_move_4").dataset.battleCommandInert).toBeUndefined();
    expect(button(fight, "actor-skill-skill_move_5").dataset.battleCommandInert).toBeUndefined();
  });

  it("offers Struggle when every finite move is out of PP", () => {
    const { runtime, snapshot } = gen1Harness();
    const exhausted: BattleSnapshot = {
      ...snapshot,
      actors: snapshot.actors.map((actor) => ({
        ...actor,
        skillIds: actor.skillIds.filter((skillId) => skillId !== "skill_move_4"),
        skillPp: Object.fromEntries(actor.skillIds.map((skillId) => [skillId, 0])),
      })),
    };
    const state = panelOptions(runtime);
    const root = commandPanel(exhausted, state.options) as unknown as FakeElement;

    button(root, "actor-command-fight").click();
    const fight = commandPanel(exhausted, { ...state.options, submenu: state.submenu() }) as unknown as FakeElement;

    expect(button(fight, "actor-command-struggle").textContent).toContain("발버둥");
    expect(button(root, "actor-command-fight").disabled).toBe(false);
  });

  it("offers Struggle when the only PP-less legacy move cannot afford its MP cost", () => {
    const { project, runtime, snapshot } = gen1Harness();
    const legacy = project.database.skills.find((skill) => skill.id === "skill_move_4")!;
    legacy.mpCost = { flat: 99, percentMax: 0 };
    store.replace(project);
    const exhausted: BattleSnapshot = {
      ...snapshot,
      actors: snapshot.actors.map((actor) => ({
        ...actor,
        mp: 0,
        skillIds: ["skill_move_1", "skill_move_2", "skill_move_3", "skill_move_4"],
        skillPp: { skill_move_1: 0, skill_move_2: 0, skill_move_3: 0 },
      })),
    };
    const state = panelOptions(runtime);
    const root = commandPanel(exhausted, state.options) as unknown as FakeElement;

    button(root, "actor-command-fight").click();
    const fight = commandPanel(exhausted, { ...state.options, submenu: state.submenu() }) as unknown as FakeElement;

    expect(button(fight, "actor-command-struggle").textContent).toContain("발버둥");
  });

  it.each(["trainerBattle", "uncapturable"] as const)("omits balls from Item when %s forbids capture, preserving medicine", (flag) => {
    const { project, runtime, snapshot } = gen1Harness();
    project.database.troops.find((troop) => troop.id === snapshot.troopId)![flag] = true;
    store.replace(project);
    const { options } = panelOptions(runtime);
    const items = commandPanel(snapshot, { ...options, submenu: { kind: "item" } }) as unknown as FakeElement;
    expect(items.querySelector("[data-testid='actor-capture-item_capture_orb']")).toBeNull();
    expect(items.querySelector(`[data-testid='actor-item-${DEFAULT_ITEM_ID}']`)).not.toBeNull();
  });

  it("puts normal items and balls in Item and routes a ball through canonical capture targeting", () => {
    const { runtime, snapshot } = gen1Harness();
    const beginTargetCommand = vi.fn<(command: TargetedActorCommand) => void>();
    const state = panelOptions(runtime, beginTargetCommand);
    const root = commandPanel(snapshot, state.options) as unknown as FakeElement;

    button(root, "actor-command-item").click();
    const items = commandPanel(snapshot, { ...state.options, submenu: state.submenu() }) as unknown as FakeElement;

    expect(items.querySelector(`[data-testid='actor-item-${DEFAULT_ITEM_ID}']`)).not.toBeNull();
    button(items, "actor-capture-item_capture_orb").click();
    expect(beginTargetCommand).toHaveBeenCalledWith({ kind: "capture", captureItemId: "item_capture_orb" });
  });

  it("keeps the classic RM2K3 actor command surface unchanged", () => {
    const project = createBlankProject();
    project.system.battleUiStyle = "retro2003";
    store.replace(project);
    const runtime = createBattleRuntime({
      project,
      troopId: DEFAULT_TROOP_ID,
      canEscape: true,
      canLose: true,
      battleFlow: "strict",
      rng: () => 0.5,
    });
    const root = commandPanel(runtime.snapshot(), panelOptions(runtime).options) as unknown as FakeElement;

    expect(root.querySelector("[data-testid='actor-command-attack']")).not.toBeNull();
    expect(root.querySelector("[data-testid='actor-command-defend']")).not.toBeNull();
    expect(root.querySelector("[data-testid='actor-command-fight']")).toBeNull();
  });
});

function gen1Harness(): Gen1Harness {
  const project = createBlankProject();
  project.system.battleUiStyle = "pokemon";
  project.system.battleParty = "monsters";
  const skillIds = Array.from({ length: 5 }, (_, index) => `skill_move_${index + 1}` as SkillId);
  project.database.skills.push(...skillIds.map((id, index) => normalizeSkillRecord({
    id,
    name: `Move ${index + 1}`,
    scope: "enemy",
    power: 20 + index,
    maxPp: [35, 20, 15, undefined, 5][index],
  })));
  const monster: MonsterInstance = {
    instanceId: "monster_001",
    speciesId: "species_wild_slime",
    level: 5,
    exp: 0,
    skillIds,
    friendship: 70,
    caughtAt: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
  };
  store.replace(project);
  const inventory = { [DEFAULT_ITEM_ID]: 2, item_capture_orb: 3 };
  const runtime = createBattleRuntime({
    project,
    troopId: DEFAULT_TROOP_ID,
    canEscape: true,
    canLose: true,
    battleFlow: "strict",
    partyMonsters: [monster],
    sessionState: { switches: {}, variables: {}, inventory },
    rng: () => 0.5,
  });
  const current = runtime.snapshot();
  const actor = current.actors[0];
  if (!actor) throw new Error("missing monster battler");
  const snapshot: BattleSnapshot = {
    ...current,
    actors: [{
      ...actor,
      skillPp: {
        skill_move_1: 12,
        skill_move_2: 0,
        skill_move_3: 8,
        skill_move_4: 0,
        skill_move_5: 5,
      },
    }],
  };
  return { project, runtime, snapshot };
}

function panelOptions(runtime: BattleRuntime, begin = vi.fn<(command: TargetedActorCommand) => void>()) {
  let currentSubmenu: BattleCommandSubmenu = null;
  const options: BattleCommandPanelOptions = {
    runtime,
    submenu: currentSubmenu,
    setSubmenu: (submenu) => {
      currentSubmenu = submenu;
    },
    setDirectorState: () => undefined,
    render: () => undefined,
    runActorCommand: () => undefined,
    beginTargetCommand: begin,
    confirmTargetSelection: () => undefined,
  };
  return { options, submenu: () => currentSubmenu };
}

function button(root: FakeElement, testid: string): FakeElement {
  const found = root.querySelector(`[data-testid='${testid}']`);
  if (!found) throw new Error(`missing button ${testid}`);
  return found;
}

function commandIds(root: FakeElement): string[] {
  return root.querySelectorAll(".battle-command").map((node) => node.dataset.testid).filter(Boolean);
}

function commandLabels(root: FakeElement): string[] {
  return root.querySelectorAll(".battle-command").map((node) => node.querySelector("strong")?.textContent ?? "");
}
