// #2586-3: drive the real playTacticsBattle (src/player/playSceneTactics.ts) + mountTacticsBattle in happy-dom,
// then end the play the way stopGame does (Phaser scene "shutdown"/"destroy", then the play DOM goes away).
import { Window } from "happy-dom";
import { readFileSync } from "node:fs";
const win = new Window();
const g = globalThis as any;
for (const key of ["window", "document", "HTMLElement", "KeyboardEvent", "Node", "Element"]) g[key] = key === "window" ? win : (win as any)[key];
let keydown = 0;
const add = win.addEventListener.bind(win), remove = win.removeEventListener.bind(win);
(win as any).addEventListener = (type: string, ...rest: any[]) => { if (type === "keydown") keydown++; return (add as any)(type, ...rest); };
(win as any).removeEventListener = (type: string, ...rest: any[]) => { if (type === "keydown") keydown--; return (remove as any)(type, ...rest); };
const { deserialize } = await import("@/project/io");
const project = deserialize(readFileSync("test/fixtures/projects/battle-strict-v3.json", "utf8"));
g.__probeProject = project;
const { playTacticsBattle } = await import("@/player/playSceneTactics");
const { startSession } = await import("@/project/session");
function makeScene() {
  const handlers = new Map<string, Set<() => void>>();
  const on = (n: string, f: () => void) => { (handlers.get(n) ?? handlers.set(n, new Set()).get(n)!).add(f); };
  const events = { on, once: on, off: (n: string, f: () => void) => handlers.get(n)?.delete(f), emit: (n: string) => { for (const f of [...(handlers.get(n) ?? [])]) { handlers.get(n)!.delete(f); f(); } } };
  const viewport = win.document.createElement("div"); viewport.className = "play-viewport";
  const stage = win.document.createElement("div"); stage.className = "play-stage";
  viewport.append(stage); win.document.body.append(viewport);
  const session = startSession(project, 1);
  return { scene: { events, session, inputEnabled: true, setInputEnabled(v: boolean) { this.inputEnabled = v; }, game: { registry: { get: (k: string) => (k === "dialogueHost" ? stage : undefined) } } } as any, viewport };
}
console.log("run  mounted  keydown-listeners  promise           inputEnabled");
for (let run = 1; run <= 3; run++) {
  const { scene, viewport } = makeScene();
  let settled = "pending";
  void playTacticsBattle(scene, { kind: "tacticsBattle", troopId: "troop_strict_training", width: 8, height: 6, canLose: true } as any)
    .then((r) => { settled = `resolved(${String(r)})`; }, (e) => { settled = `rejected(${e})`; });
  await new Promise((r) => setTimeout(r, 0));
  const mounted = win.document.querySelectorAll("[data-testid='tactics-battle']").length;
  scene.events.emit("shutdown"); scene.events.emit("destroy"); // game.destroy(true)
  viewport.remove();                                            // play surface removed
  await new Promise((r) => setTimeout(r, 0));
  console.log(`${run}    ${mounted}        ${keydown}                  ${settled.padEnd(17)} ${scene.inputEnabled}`);
}
await win.happyDOM.close();
