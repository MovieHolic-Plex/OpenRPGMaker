// Run with: npx tsx --tsconfig tsconfig.app.json scripts/qa/bench-runtime-lvB.ts
// Node microbench only: no GPU, Phaser WebGL renderer, browser major-GC latency or UI claims.
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { createInterpreter } from "@/player/interpreter";
import { interactWithFarmPlot } from "@/player/farming";
import { createFieldSpawnRuntime, advanceFieldSpawns } from "@/player/fieldSpawns";
import { runtimeEventView } from "@/project/runtimeEventState";
import { syncWeatherLayer } from "@/player/playSceneWeather";
import { TILE } from "@/project/defaults/constants";
import type { Command, GameEvent } from "@/project/types";
import { graphicsRecorder } from "../../test/fixtures/runtimeLag8Graphics";
setFlagsFromString("--expose_gc"); const gc = runInNewContext("gc") as () => void;
const median = (a: number[]) => a.sort((a,b) => a-b)[Math.floor(a.length/2)]!;
function measure(fn: (i: number) => void, count: number, warmup = 200) {
  for (let i = 0; i < warmup; i++) fn(i);
  const heaps: number[] = [], times: number[] = [];
  for (let batch = 0; batch < 15; batch++) {
    gc(); const heap = process.memoryUsage().heapUsed, start = performance.now();
    for (let i = 0; i < count; i++) fn(i + batch * count);
    times.push((performance.now()-start)/count); heaps.push((process.memoryUsage().heapUsed-heap)/count/1024);
  }
  return { msPerCall: median(times), netHeapKiBPerCall: median(heaps), batchCalls: count, batches: 15 };
}
const project = createBlankProject(), map = project.maps[project.startMapId]!, session = startSession(project);
map.events = []; map.farmableArea = [];
// Large unrelated session payload, as seen in long-running play sessions.
for (let i = 0; i < 10000; i++) session.variables[`unrelated-${i}`] = i;
const farm = measure(() => { interactWithFarmPlot(project, session, map, 0, 0); }, 10, 20);
map.lowerTiles.fill(TILE.WALL);
map.fieldSpawns = [{ id: "full", troopId: project.database.troops[0]!.id, area: { x: 0, y: 0, w: map.width, h: map.height }, maxAlive: 3 }];
const player = { x: 0, y: 0 }, state = createFieldSpawnRuntime(project, map, player);
let areaReads = 0;
const area = state.entries[0]!.spawn.area;
Object.defineProperty(state.entries[0]!.spawn, "area", { get() { areaReads++; return area; } });
for (let i = 0; i < 60; i++) advanceFieldSpawns(state, project, map, player, 1000);
const scansIn60Seconds = areaReads;
const spawn = measure(() => { advanceFieldSpawns(state, project, map, player, 1000); }, 100);
let reads = 0;
const values: Command[] = [{ kind: "gotoLabel", name: "end" }, ...Array.from({ length: 2000 }, (): Command => ({ kind: "gotoLabel", name: "unused" })), { kind: "label", name: "end" }, { kind: "gotoLabel", name: "end" }];
const commands = new Proxy(values, { get(target, key, receiver) { if (typeof key === "string" && /^\d+$/.test(key)) reads++; return Reflect.get(target, key, receiver); } });
const warn = console.warn; console.warn = () => {};
createInterpreter(commands, session, undefined, { maxInstructions: 1000 }).start();
const labelReads = reads;
const labels = measure(() => { createInterpreter(values, session, undefined, { maxInstructions: 1000 }).start(); }, 20, 30);
console.warn = warn;
const event: GameEvent = { id: "e", x: 5, y: 6, commands: [], trigger: { kind: "action" }, pages: [{ id: "p", name: "p", commands: [], conditions: [], graphic: {}, trigger: { kind: "action" }, footprint: { width: 3, height: 3 }, passRows: 1 }] };
const positions = { e: { x: 5, y: 6 } };
let sink: unknown;
const views = measure(() => { sink = runtimeEventView(event, session, positions, project); }, 1000, 3000);
const graphics = graphicsRecorder();
const scene: any = { weatherGraphics: graphics, weatherLayer: { setVisible() {}, setPosition() {}, setScale() {} }, session: { m2Runtime: { screen: { weather: "storm,1" } } }, map: {}, cameras: { main: { width: 640, height: 480, zoom: 1 } } };
let time = 0;
const weather = measure(() => { scene.weatherClockMs = time += 16; syncWeatherLayer(scene); }, 50, 1000);
console.log(JSON.stringify({ node: process.version, farm, spawn: { ...spawn, scansIn60Seconds }, labels: { ...labels, arrayReadsFor1000Instructions: labelReads }, runtimeEventView: views, storm: { ...weather, lineBetweenCalls: graphics.lines, clearCalls: graphics.clears }, sinkUsed: !!sink }, null, 2));
