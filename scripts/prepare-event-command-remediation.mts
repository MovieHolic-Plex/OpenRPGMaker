import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { createBlankMap, createBlankProject, singleNodeTree, DEFAULT_EASYRPG_CHARSET_ID } from "../src/project/defaults";
import { deserialize, serialize } from "../src/project/io";
import type { Command, Project } from "../src/project/types";

/** H0 has no content fixture on disk. Later units own their own buildFixture. */
export function buildHarnessFixture(): Project {
  const project = createBlankProject();
  const map = createBlankMap("H0", 8, 8);
  map.id = "map_intro";
  project.meta.title = "H0 event-command contract";
  project.maps = { [map.id]: map };
  project.mapTree = singleNodeTree(map.id);
  project.startMapId = map.id;
  project.startPos = { x: 2, y: 3 };
  if (project.system.titleScreen) project.system.titleScreen.musicResourceId = "";
  const commands: Command[] = [
    { kind: "changeGold", op: "+=", amount: 7 },
    { kind: "text", body: "H0" },
  ];
  map.events = [{ id: "host", x: 2, y: 2, trigger: { kind: "action" }, commands, pages: [{
    id: "host-page", name: "H0", conditions: [],
    graphic: { sprite: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID }, direction: "down", pattern: 0 },
    trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  }] }];
  return deserialize(serialize(project));
}

export async function loadUnitFixture(unit: string): Promise<Project> {
  if (unit === "H0") return buildHarnessFixture();
  if (!/^U(?:0[1-9]|[12][0-9]|3[0-6])$/.test(unit)) throw new Error(`Invalid remediation unit: ${unit}`);
  // Deliberately lazy: importing this helper never requires future unit files.
  const module = await import(new URL(`../test/eventCommandRemediation/${unit}.fixture.ts`, import.meta.url).href);
  if (typeof module.buildFixture !== "function") throw new Error(`${unit} must export buildFixture`);
  return deserialize(serialize(await module.buildFixture()));
}

export async function prepareUnitFixture(unit: string, directory = join(tmpdir(), "event-command-remediation", unit)): Promise<string> {
  const project = await loadUnitFixture(unit);
  await mkdir(directory, { recursive: true });
  const path = join(directory, "project.json");
  await writeFile(path, serialize(project), { encoding: "utf8", flag: "wx" });
  return path;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [unit, directory] = process.argv.slice(2);
  if (!unit) throw new Error("Usage: prepare-event-command-remediation.mts H0|U01..U36 [temporary-directory]");
  console.log(await prepareUnitFixture(unit, directory));
}
