import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import { startSession } from "@/project/session";
import { pickRandomEncounterTroop, rollRandomEncounter } from "@/player/playSceneMovement";
import { createRngState, rngForState } from "@/util/rng";
import battleFixture from "./fixtures/projects/battle-v3.json";

type DirentLike = { readonly name: string; readonly isDirectory: () => boolean; readonly isFile: () => boolean };
type FsLike = {
  readonly readdirSync: (path: string, options: { readonly withFileTypes: true }) => readonly DirentLike[];
  readonly readFileSync: (path: string, encoding: "utf8") => string;
};

const MATH_RANDOM_WHITELIST: readonly string[] = [];

async function loadFs(): Promise<FsLike> {
  const moduleName = "node:fs";
  return await import(/* @vite-ignore */ moduleName) as FsLike;
}

function battleProject() {
  const project = deserialize(JSON.stringify(battleFixture));
  const actor = project.database.actors.find((entry) => entry.id === "actor_hero");
  if (actor) actor.critical = { enabled: true, chanceDenominator: 2 };
  const enemy = project.database.enemies.find((entry) => entry.id === "enemy_slime");
  if (enemy) {
    enemy.stats.maxHp = 200;
    enemy.rewards.dropItemId = project.database.items[0]?.id;
    enemy.rewards.dropRatePercent = 50;
  }
  return project;
}

function runBattleTrace(seed: number): readonly unknown[] {
  const rngState = createRngState(seed);
  const runtime = createBattleRuntime({
    project: battleProject(),
    troopId: "troop_slime",
    canEscape: true,
    canLose: true,
    rng: rngForState(rngState, "battle"),
  });
  const trace: unknown[] = [];
  for (let step = 0; step < 12; step += 1) {
    runtime.tick(1_000);
    const snap = runtime.snapshot();
    trace.push({
      phase: snap.phase,
      result: snap.result,
      actorHp: snap.actors[0]?.hp,
      enemyHp: snap.enemies[0]?.hp,
      last: snap.lastActionResult,
      drops: snap.rewards.items,
    });
    if (snap.result) break;
    if (snap.phase === "actorCommand") {
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    }
  }
  return trace;
}

function encounterTrace(seed: number): readonly unknown[] {
  const project = battleProject();
  const session = startSession(project, seed);
  const troops = ["troop_a", "troop_b", "troop_c"];
  return [120, 240, 480, 960, 120, 240].map((accumulator) => {
    const triggered = rollRandomEncounter(session, accumulator);
    return {
      triggered,
      troopId: triggered ? pickRandomEncounterTroop(session, troops) : undefined,
      rngState: session.rng?.streams.encounter.state,
    };
  });
}

function sourceFiles(fs: FsLike, root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory()) files.push(...sourceFiles(fs, path));
    if (entry.isFile() && path.endsWith(".ts")) files.push(path);
  }
  return files;
}

describe("deterministic runtime RNG", () => {
  it("does not call Math.random directly in player or battle gameplay code", async () => {
    const fs = await loadFs();
    const offenders = [...sourceFiles(fs, "src/player"), ...sourceFiles(fs, "src/battle")]
      .filter((file) => !MATH_RANDOM_WHITELIST.includes(file))
      .flatMap((file) => {
        const text = fs.readFileSync(file, "utf8");
        return /Math\.random\s*\(/.test(text) ? [file] : [];
      });
    expect(offenders).toEqual([]);
  });

  it("replays the actual battle runtime sequence with the same battle seed", () => {
    expect(runBattleTrace(20260706)).toEqual(runBattleTrace(20260706));
    expect(runBattleTrace(20260706)).not.toEqual(runBattleTrace(20260707));
  });

  it("replays random encounter rolls and troop picks with the same encounter seed", () => {
    expect(encounterTrace(4242)).toEqual(encounterTrace(4242));
    expect(encounterTrace(4242)).not.toEqual(encounterTrace(4243));
  });
});
