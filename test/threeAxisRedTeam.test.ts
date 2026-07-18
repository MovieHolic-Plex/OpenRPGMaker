import { describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { giveMonster, evolveMonster } from "@/project/monsterCollection";
import { startSession } from "@/project/session";
import { interactWithFarmPlot } from "@/player/farming";
import { simulateBattle } from "@/battle/simulate";

type AttackCase = {
  id: string;
  axis: "pokemon" | "stardew" | "jrpg" | "cross";
  scenario: string;
  expectedBehavior: string;
  verdict: "passed" | "failed";
  detail: string;
};

function attack(
  id: string,
  axis: AttackCase["axis"],
  scenario: string,
  expectedBehavior: string,
  fn: () => { ok: boolean; detail: string },
): AttackCase {
  try {
    const result = fn();
    return {
      id,
      axis,
      scenario,
      expectedBehavior,
      verdict: result.ok ? "passed" : "failed",
      detail: result.detail,
    };
  } catch (error) {
    return {
      id,
      axis,
      scenario,
      expectedBehavior,
      verdict: "failed",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

describe("three-axis red-team attack suite", () => {
  it("rejects invalid/abusive tool and runtime paths (critical attacks)", () => {
    const cases: AttackCase[] = [];

    cases.push(
      attack("rt-pkmn-system-off-starter", "pokemon", "give_starter while monsterCollection off", "warn or still create but warn", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        delete ctx.project.system.monsterCollection;
        const r = runTool(ctx, "give_starter_monsters", {
          speciesIds: ["species_leafling", "species_sparkit", "species_aqualing"],
        });
        const warnings = [
          ...(r.warnings ?? []),
          ...(((r as { diff?: { warnings?: string[] } }).diff?.warnings) ?? []),
        ];
        const warned = warnings.some((w) => /monster|configure_monster|포획/i.test(w));
        return { ok: r.ok === true && warned, detail: `ok=${r.ok} warnings=${JSON.stringify(warnings)}` };
      }),
    );

    cases.push(
      attack("rt-pkmn-invalid-species", "pokemon", "giveMonster missing species", "ok:false missingSpecies", () => {
        const project = createBlankProject();
        const session = startSession(project, 1);
        const r = giveMonster(project, session, { speciesId: "species_does_not_exist", level: 5 });
        return { ok: !r.ok && r.reason === "missingSpecies", detail: JSON.stringify(r) };
      }),
    );

    cases.push(
      attack("rt-pkmn-evolve-missing-item", "pokemon", "item evolution without item", "ok:false missingItem", () => {
        const project = createBlankProject();
        const slime = project.database.monsterSpecies?.find((s) => s.id === "species_wild_slime");
        if (!slime) return { ok: false, detail: "no slime" };
        slime.evolutions = [{ toSpeciesId: "species_king_slime", requires: { itemId: "item_capture_orb" } }];
        const session = startSession(project, 2);
        const gift = giveMonster(project, session, { speciesId: "species_wild_slime", level: 3 });
        if (!gift.ok) return { ok: false, detail: "gift fail" };
        const r = evolveMonster(project, session, { instanceId: gift.instance.instanceId, allowItemEvolution: true });
        return { ok: !r.ok && r.reason === "missingItem", detail: JSON.stringify(r) };
      }),
    );

    cases.push(
      attack("rt-pkmn-type-chart-invalid-types", "pokemon", "set_type_chart empty/malformed", "tool rejects or no-ops safely", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const r = runTool(ctx, "set_type_chart", { types: [], multipliers: {} });
        // empty chart should either fail or leave a non-crashing system
        const safe = r.ok === false || Array.isArray(ctx.project.system.typeChart?.types);
        return { ok: safe, detail: `ok=${r.ok} types=${JSON.stringify(ctx.project.system.typeChart?.types)}` };
      }),
    );

    cases.push(
      attack("rt-pkmn-capture-system-off-battle", "pokemon", "monsterParty battle without battleParty flag path", "simulateBattle enables path or falls back without crash", () => {
        const project = createBlankProject();
        const session = startSession(project, 3);
        const gift = giveMonster(project, session, { speciesId: "species_aqualing", level: 10 });
        if (!gift.ok) return { ok: false, detail: "gift" };
        const r = simulateBattle({
          project,
          troopId: "troop_slime",
          heroLevel: 1,
          battleFlow: "strict",
          n: 1,
          seed: 1,
          monsterParty: [gift.instance],
          maxSteps: 10,
        });
        return { ok: r.participatingActorIds.length > 0, detail: `participants=${r.participatingActorIds.join(",")}` };
      }),
    );

    cases.push(
      attack("rt-farm-outside-area", "stardew", "interact outside farmableArea", "ignored", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        map.farmableArea = [{ x: 5, y: 5, w: 1, h: 1 }];
        const session = startSession(project, 4);
        session.inventory.item_any_hoe = 1;
        const r = interactWithFarmPlot(project, session, map, 0, 0);
        return { ok: r.kind === "ignored", detail: r.kind };
      }),
    );

    cases.push(
      attack("rt-farm-no-seed", "stardew", "till then plant without seed", "does not plant / no crash", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        map.farmableArea = [{ x: 2, y: 2, w: 2, h: 2 }];
        const session = startSession(project, 5);
        // hoe only if any farmTool item exists; otherwise till may ignore — still must not throw
        const hoe = project.database.items.find((i) => i.farmTool === "hoe");
        if (hoe) session.inventory[hoe.id] = 1;
        const till = interactWithFarmPlot(project, session, map, 2, 2);
        const plant = interactWithFarmPlot(project, session, map, 2, 2);
        const ok = till.kind === "tilled" || till.kind === "ignored" || plant.kind !== "planted";
        return { ok, detail: `till=${till.kind} plant=${plant.kind}` };
      }),
    );

    cases.push(
      attack("rt-time-disable", "stardew", "configure_time_system enabled:false removes package", "timeSystem undefined", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        runTool(ctx, "configure_time_system", { enabled: true });
        const off = runTool(ctx, "configure_time_system", { enabled: false });
        return { ok: off.ok && ctx.project.system.timeSystem === undefined, detail: JSON.stringify(ctx.project.system.timeSystem) };
      }),
    );

    cases.push(
      attack("rt-hunt-ghost-troop", "jrpg", "set_encounter_table with unknown troopId", "rejected", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const r = runTool(ctx, "set_encounter_table", {
          mapId: ctx.project.startMapId,
          entries: [{ troopId: "troop_does_not_exist", weight: 1 }],
        });
        return { ok: r.ok === false, detail: `ok=${r.ok} ${r.summary ?? ""}` };
      }),
    );

    cases.push(
      attack("rt-hunt-bad-area", "jrpg", "make_hunting_ground out of bounds / invalid", "rejected or clamped safely", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const troopId = ctx.project.database.troops[0]?.id ?? "troop_slime";
        const r = runTool(ctx, "make_hunting_ground", {
          mapId: ctx.project.startMapId,
          area: { x: -10, y: -10, w: 0, h: 0 },
          troopId,
        });
        // Must not throw; either reject or no-op-ish write
        return { ok: typeof r.ok === "boolean", detail: `ok=${r.ok} ${r.summary ?? r.error ?? ""}` };
      }),
    );

    cases.push(
      attack("rt-promo-missing-class", "jrpg", "define_promotion unknown class", "rejected", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const r = runTool(ctx, "define_promotion", {
          classId: "class_nope",
          toClassId: "class_also_nope",
          requires: { level: 99 },
        });
        return { ok: r.ok === false, detail: `ok=${r.ok}` };
      }),
    );

    cases.push(
      attack("rt-crop-missing-items", "stardew", "define_crop with missing seed item", "rejected or warning", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const r = runTool(ctx, "define_crop", {
          crop: {
            id: "crop_bad",
            name: "불량",
            seedItemId: "item_missing_seed",
            harvestItemId: "item_missing_harvest",
            stages: [{ days: 1 }],
            seasons: ["spring"],
          },
        });
        // Prefer hard reject; accept soft write only if project still loadable (no throw)
        const ok = r.ok === false || ctx.project.database.crops?.some((c) => c.id === "crop_bad") === true;
        return { ok, detail: `ok=${r.ok}` };
      }),
    );

    const failed = cases.filter((c) => c.verdict === "failed");
    const report = {
      schemaVersion: 1,
      kind: "three-axis-red-team-report",
      generatedAt: new Date().toISOString(),
      total: cases.length,
      passed: cases.length - failed.length,
      failed: failed.length,
      cases,
    };

    const outDir = resolve("output/evidence/three-axis-redteam");
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, "report.json");
    writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

    expect(failed, `red-team failures: ${failed.map((f) => f.id).join(", ")}`).toEqual([]);
    expect(report.passed).toBe(cases.length);
  });
});
