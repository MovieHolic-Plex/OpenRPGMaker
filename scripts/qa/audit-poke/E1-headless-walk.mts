import { readFileSync, writeFileSync } from "node:fs";
import { deserialize } from "@/project/io/serialize";
import { startSession } from "@/project/session";
import { giveMonster } from "@/project/monsterCollection";
import { runSceneTest } from "@/testing/sceneTestRunner";

function osc(x0: number, y: number, len: number, rounds: number) {
  const steps: any[] = [];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < len; i++) steps.push({ kind: "move", dir: "right" });
    for (let i = 0; i < len; i++) steps.push({ kind: "move", dir: "left" });
  }
  return steps;
}
function run(file: string, mapId: string, label: string, x: number, y: number, len: number, rounds: number) {
  const project: any = deserialize(readFileSync(file, "utf8"));
  const session: any = startSession(project, 7);
  const species = project.database.monsterSpecies[0].id;
  giveMonster(project, session, { speciesId: species, level: 30 });
  session.switches.mx_starter = true;
  const res: any = runSceneTest(project, { mapId, start: { x, y }, steps: osc(x, y, len, rounds) }, undefined, { initialSession: session, recoverBeforeRandomEncounters: true });
  const enc = res.log.filter((l: string) => l.startsWith("random encounter")).length;
  const moved = res.stepsRun ?? res.totalSteps;
  console.log(`${label}: ok=${res.ok} steps=${res.stepsRun}/${res.totalSteps} encounters=${enc} fail=${res.failureReason ?? ""} final=(${res.finalState.x},${res.finalState.y})`);
  return enc;
}
// A) author_wild_route output (e1_route): road row y=13 x8..13 (not grass) vs grass patch row y=15 x10..16
run("qa-runs/audit-poke/A1-t2.json", "e1_route", "wild_route: ROAD row (non-grass) 6-tile oscillation x100", 8, 13, 5, 100);
run("qa-runs/audit-poke/A1-t2.json", "e1_route", "wild_route: GRASS patch row 6-tile oscillation x100", 10, 15, 6, 100);

// B) built-in campaign (build_monster_game): find a 6-wide horizontal walkable run of PATH-group tiles inside the habitat, and one outside it
import { canMove } from "@/project/collision";
{
  const project: any = deserialize(readFileSync("qa-runs/audit-poke/A1-base.json", "utf8"));
  const map = project.maps.mx_map_meadow; const ts = project.tilesets[map.tilesetId];
  const pg = ts.autotileGroups.find((g: any) => g.id === "path"); const path = new Set<number>([...pg.memberTileIds, ...pg.connectTileIds]);
  const hab = map.locations[0];
  const inHab = (x: number, y: number) => x >= hab.x && y >= hab.y && x < hab.x + hab.w && y < hab.y + hab.h;
  let best: any = null, bestOut: any = null;
  for (let y = 0; y < map.height; y++) for (let x = 0; x + 3 < map.width; x++) {
    let ok = true, allIn = true, allOut = true;
    for (let i = 0; i < 4; i++) { if (i < 3 && !canMove(project, map, x + i, y, x + i + 1, y)) ok = false; if (!canMove(project, map, x + i + 1, y, x + i, y) && i < 3) ok = false; const h = inHab(x + i, y); allIn &&= h; allOut &&= !h; if (!path.has(map.lowerTiles[y * map.width + x + i])) ok = false; }
    if (ok && allIn && !best) best = { x, y }; if (ok && allOut && !bestOut) bestOut = { x, y };
  }
  console.log("path run inside habitat:", JSON.stringify(best), "outside habitat:", JSON.stringify(bestOut));
  for (const [lab, pos] of [["campaign meadow: PATH tiles INSIDE habitat rect", best], ["campaign meadow: path tiles OUTSIDE habitat rect", bestOut]] as const) {
    if (!pos) { console.log(lab, "no run found"); continue; }
    const session: any = startSession(project, 7); giveMonster(project, session, { speciesId: project.database.monsterSpecies[0].id, level: 30 }); session.switches.mx_starter = true;
    const res: any = runSceneTest(project, { mapId: "mx_map_meadow", start: pos, steps: osc(pos.x, pos.y, 3, 150) }, undefined, { initialSession: session, recoverBeforeRandomEncounters: true });
    console.log(`${lab}: steps=${res.stepsRun}/${res.totalSteps} encounters=${res.log.filter((l: string) => l.startsWith("random encounter")).length}`);
  }
}
