import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parseNpcRewardRequirements, type NpcRewardGrant } from "@/ai/intentDeclaration";
import { verifyNpcRewardsPlayable } from "@/ai/workItemOutcome";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { runTool } from "@/editor/tools";
import { PLAY_TOOLS } from "@/editor/tools/playTools";
import { createBlankProject } from "@/project/defaults";
import type { Command, GameEvent } from "@/project/types";
import { runSceneTest, type SceneStep } from "@/testing/sceneTestRunner";

const GOLD = { kind: "gold", count: 20 } as const;
const MONEY: Command = { kind: "changeGold", op: "+=", amount: 20 };
const ITEM: Command = { kind: "changeItem", itemId: "gold", op: "+=", amount: 20 };
const ITEM_GRANT = { kind: "item", name: "골드", count: 20 } as const;
const request = (grants: readonly NpcRewardGrant[] = [GOLD]) => [{ target: { eventId: "chief" }, grants, oneTime: true }];

function fixture(commands: Command[] = [MONEY], once = true) {
  const project = createBlankProject();
  project.session.gold = 37;
  const map = project.maps[project.startMapId];
  const page: NonNullable<GameEvent["pages"]>[number] = {
    id: "reward", name: "Chief", conditions: [], graphic: { transparent: true },
    trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [...commands, ...(once ? [{ kind: "setSelfSwitch", key: "A", value: true } satisfies Command] : [])],
  };
  const event: GameEvent = { id: "chief", name: "Chief", x: 2, y: 3, trigger: { kind: "action" }, commands: [], pages: [page,
    ...(once ? [{ ...page, id: "paid", conditions: [{ kind: "selfSwitch", key: "A", value: true }], commands: [] } satisfies NonNullable<GameEvent["pages"]>[number]] : []),
  ] };
  map.events = [event];
  return { project, map, event, page };
}

const interact: SceneStep = { kind: "interact", eventId: "chief" };
const snapshot: SceneStep = { kind: "snapshotRewards" };
const proof: SceneStep[] = [snapshot, interact,
  { kind: "expect", goldDelta: 20, inventoryDelta: { gold: 0 }, interactionComplete: true },
  snapshot, interact, { kind: "expect", goldDelta: 0, inventoryDelta: { gold: 0 }, interactionComplete: true }];

describe("first-class NPC currency contract", () => {
  it("admits reference-free exact and unspecified gold without reinterpreting localized items", () => {
    for (const grant of [GOLD, { kind: "gold" } as const, ITEM_GRANT]) {
      expect(parseNpcRewardRequirements(request([grant]))).toEqual(request([grant]));
    }
  });

  it.each([
    ...[0, -1, 1.5, "20", null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map(count => ({ kind: "gold", count })),
    ...[{ id: "gold" }, { name: "골드" }, { id: null }, { name: null }, { id: "" }, { id: undefined }, { name: undefined }].map(ref => ({ ...GOLD, ...ref })),
    { kind: "currency", count: 20 }, { kind: "Gold", count: 20 },
  ])("fails closed for malformed gold grant %j", grant => {
    expect(parseNpcRewardRequirements([{ target: { eventId: "chief" }, grants: [grant] }])).toHaveProperty("invalidReason");
  });

  it("proves native 37 -> 57 -> 57 through the actual scene and registered tool without project writes", () => {
    const { project, map } = fixture();
    project.database.items = [];
    project.database.monsterSpecies = [];
    const before = structuredClone(project);
    const input = { mapId: map.id, start: { x: 2, y: 2 }, steps: proof };
    const result = runSceneTest(project, input);
    expect(result.ok, result.failureReason).toBe(true);
    expect(result.session.gold).toBe(57);
    expect(result.finalState.gold).toBe(result.session.gold);
    const checkpoints = result.log.filter(line => line.startsWith("reward baseline "))
      .map(line => JSON.parse(line.slice("reward baseline ".length)).gold);
    expect(checkpoints).toEqual([37, 57]);
    expect(runTool({ project }, "run_scene_test", input)).toMatchObject({ ok: true, data: { ok: true, finalState: { gold: 57, inventory: {} } } });
    expect(verifyNpcRewardsPlayable(project, request())).toEqual({ ok: true });
    expect(project).toEqual(before);
  });

  it.each([0, 19, 21])("rejects native currency payment of %i instead of 20", amount => {
    const { project } = fixture([{ ...MONEY, amount }]);
    expect(verifyNpcRewardsPlayable(project, request())).toMatchObject({ ok: false });
  });

  it.each(["repeat", "text-switch", "shadowed", "unfinished-choice", "wrong-target", "prerequisite"])("rejects %s instead of a completed local once-only payment", variant => {
    const { project, event, page, map } = fixture(variant === "text-switch" ? [{ kind: "text", body: "Paid 20 gold." }] : [MONEY], variant !== "repeat");
    if (variant === "shadowed" && event.pages?.[1]) event.pages[1].conditions = [];
    if (variant === "unfinished-choice") page.commands.push({ kind: "choices", options: [{ text: "OK", branch: [] }] });
    if (variant === "wrong-target") map.events.unshift({ ...structuredClone(event), id: "blocker", name: "Other" });
    if (variant === "prerequisite") page.conditions = [{ kind: "switch", switchId: "key_acquired", value: true }];
    expect(verifyNpcRewardsPlayable(project, request())).toMatchObject({ ok: false });
    expect(project.session.gold).toBe(37);
  });

  it("requires a positive delta for unspecified gold, not a preexisting balance", () => {
    const { project, page } = fixture();
    expect(verifyNpcRewardsPlayable(project, request([{ kind: "gold" }]))).toEqual({ ok: true });
    page.commands = [];
    expect(verifyNpcRewardsPlayable(project, request([{ kind: "gold" }]))).toMatchObject({ ok: false });
  });

  it("rejects duplicate gold requirements rather than overwriting the first count", () => {
    const { project } = fixture();
    expect(verifyNpcRewardsPlayable(project, request([GOLD, { kind: "gold", count: 19 }]))).toMatchObject({ ok: false });
  });

  it.each([
    [GOLD, { kind: "gold", count: 19 }], [GOLD, GOLD], [{ kind: "gold" }, { kind: "gold" }],
    [GOLD, ITEM_GRANT, { kind: "gold" }],
  ] satisfies NpcRewardGrant[][])("rejects duplicate currency components at admission: %j", (...grants) => {
    const raw = request(grants);
    const before = structuredClone(raw);
    expect(parseNpcRewardRequirements(raw)).toHaveProperty("invalidReason");
    expect(raw).toEqual(before);
  });

  it("allows independent NPC currency grants and preserves mixed noncurrency components", () => {
    const mixed = request([ITEM_GRANT, GOLD, { kind: "monster", id: "species_leafling", count: 2 }]);
    const independent = [...mixed, { ...request()[0], target: { eventId: "another_chief" } }];
    expect(parseNpcRewardRequirements(independent)).toEqual(independent);
  });

  it.each(["gold", "item", "mixed"] as const)("keeps legitimate item ID gold/name 골드 separate for %s rewards", kind => {
    const { project, map } = fixture(kind === "gold" ? [MONEY] : kind === "item" ? [ITEM] : [MONEY, ITEM]);
    const potion = project.database.items[0];
    project.database.items = [{ ...potion, id: "gold", name: "골드" }];
    const item = verifyNpcRewardsPlayable(project, request([ITEM_GRANT]));
    const currency = verifyNpcRewardsPlayable(project, request());
    const mixed = verifyNpcRewardsPlayable(project, request([GOLD, ITEM_GRANT]));
    expect(item.ok).toBe(kind !== "gold");
    expect(currency.ok).toBe(kind !== "item");
    expect(mixed.ok).toBe(kind === "mixed");
    const result = runTool({ project }, "run_scene_test", { mapId: map.id, start: { x: 2, y: 2 }, steps: [snapshot, interact,
      { kind: "expect", goldDelta: kind === "item" ? 0 : 20, inventoryDelta: { gold: kind === "gold" ? 0 : 20 }, interactionComplete: true },
      snapshot, interact, { kind: "expect", goldDelta: 0, inventoryDelta: { gold: 0 }, interactionComplete: true }] });
    expect(result).toMatchObject({ ok: true, data: { ok: true, finalState: { gold: kind === "item" ? 37 : 57 } } });
  });

  it("also rejects currency paid on the repeat of an item-only obligation", () => {
    const { project, event } = fixture([{ kind: "changeItem", itemId: "item_potion", op: "+=", amount: 2 }]);
    if (!event.pages?.[1]) throw new Error("Missing paid page");
    event.pages[1].commands = [MONEY];
    expect(verifyNpcRewardsPlayable(project, request([{ kind: "item", id: "item_potion", count: 2 }]))).toMatchObject({ ok: false });
  });

  it("exposes the currency assertion in the provider tool schema", () => {
    const schema = PLAY_TOOLS.find(tool => tool.name === "run_scene_test")?.parameters;
    expect(schema).toHaveProperty("properties.steps.items.properties.goldDelta");
  });

  it("retains the goldDelta field without narrowing its value through installed Google/CCA normalization", () => {
    const schema = PLAY_TOOLS.find(tool => tool.name === "run_scene_test")?.parameters;
    const result = spawnSync("bun", ["-e", `
      import { normalizeSchemaForGoogle, normalizeSchemaForCCA } from "./node_modules/@oh-my-pi/pi-ai/src/utils/schema/normalize.ts";
      console.log(JSON.stringify(normalizeSchemaForCCA(normalizeSchemaForGoogle(await Bun.stdin.json()))));
    `], { cwd: process.cwd(), input: JSON.stringify(schema), encoding: "utf8", timeout: 15000 });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    const normalized = JSON.parse(result.stdout);
    expect(normalized).toHaveProperty("properties.steps.items.properties.goldDelta");
    const field = normalized.properties.steps.items.properties.goldDelta;
    expect(field.type).toBeUndefined();
    expect(field.oneOf).toBeUndefined();
    expect(field.anyOf).toBeUndefined();
  });

  it("cannot erase failed currency proof by weakening the amount, changing reward kind, or losing repeat checkpoints", () => {
    const { project, map } = fixture();
    const input = (steps: SceneStep[]) => ({ mapId: map.id, start: { x: 2, y: 2 }, steps });
    const impossible = input([snapshot, interact, { kind: "expect", goldDelta: 21, interactionComplete: true },
      snapshot, interact, { kind: "expect", goldDelta: 0, interactionComplete: true }]);
    const evidence = new ToolVerificationEvidence();
    const failed = runTool({ project }, "run_scene_test", impossible);
    expect(failed).toMatchObject({ ok: true, data: { ok: false, finalState: { gold: 57 } } });
    evidence.observe("run_scene_test", impossible, failed);
    for (const changed of [proof, [snapshot, interact, { kind: "expect", inventoryDelta: { gold: 0 } }],
      [snapshot, interact, { kind: "expect", goldDelta: 20 }]] satisfies SceneStep[][]) {
      const args = input(changed);
      const passed = runTool({ project }, "run_scene_test", args);
      expect(passed).toMatchObject({ ok: true, data: { ok: true } });
      evidence.observe("run_scene_test", args, passed);
      expect(evidence.passed("run_scene_test")).toBe(false);
    }
  });

  it("allows navigation repair only with the same exact currency assertions and repeat checkpoints", () => {
    const { project, map } = fixture();
    const input = { mapId: map.id, start: { x: 2, y: 2 }, steps: [{ kind: "face", dir: "up" } satisfies SceneStep, ...proof] };
    const evidence = new ToolVerificationEvidence();
    const failed = runTool({ project }, "run_scene_test", input);
    expect(failed).toMatchObject({ ok: true, data: { ok: false } });
    evidence.observe("run_scene_test", input, failed);
    const corrected = { ...input, steps: [{ kind: "face", dir: "down" } satisfies SceneStep, ...proof] };
    const passed = runTool({ project }, "run_scene_test", corrected);
    expect(passed).toMatchObject({ ok: true, data: { ok: true } });
    evidence.observe("run_scene_test", corrected, passed);
    expect(evidence.passed("run_scene_test")).toBe(true);
    evidence.invalidateAfterWrite();
    expect(evidence.passed("run_scene_test")).toBe(false);
  });

  it.each([
    ...["20", null, true, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, [], {}, { atLeast: "1" }, { atLeast: Infinity }, { atLeast: 0.5 }, { atLeast: 1, extra: true }, { equals: 20 }].map(goldDelta => ({ kind: "expect", goldDelta })),
    { kind: "expect", gold: 57 }, { kind: "expect", currencyDelta: 20 }, { kind: "snapshotRewards", goldDelta: 20 },
  ])("rejects malformed or unsupported currency assertions at the real tool boundary: %j", malformed => {
    const { project, map } = fixture();
    const before = structuredClone(project);
    const result = runTool({ project }, "run_scene_test", { mapId: map.id, start: { x: 2, y: 2 }, steps: [interact, malformed] });
    expect(result.ok).toBe(false);
    expect(result.data).toBeUndefined();
    expect(project).toEqual(before);
  });

  it("supports signed integer deltas and atLeast against scene-start and refreshed baselines", () => {
    const { project, map } = fixture([{ kind: "changeGold", op: "-=", amount: 20 }]);
    const result = runSceneTest(project, { mapId: map.id, start: { x: 2, y: 2 }, steps: [
      { kind: "expect", goldDelta: 0 }, interact, { kind: "expect", goldDelta: -20 },
      snapshot, interact, { kind: "expect", goldDelta: { atLeast: 0 } },
    ] });
    expect(result.ok, result.failureReason).toBe(true);
    expect(result.finalState.gold).toBe(17);
  });
});
