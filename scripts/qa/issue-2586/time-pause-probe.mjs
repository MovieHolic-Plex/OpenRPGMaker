// #2586-2: run the real isGameTimePausedForRuntime body (src/player/playSceneTime.ts) in happy-dom
// with each runtime overlay mounted the way the player mounts it (data-testid on an element under .play-stage).
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
const src = readFileSync(process.argv[2] ?? "src/player/playSceneTime.ts", "utf8");
const start = src.indexOf("export function isGameTimePausedForRuntime");
const bodyStart = src.indexOf("): boolean {", start) + "): boolean ".length;
let depth = 0, end = bodyStart;
for (; end < src.length; end++) { if (src[end] === "{") depth++; else if (src[end] === "}" && --depth === 0) break; }
const body = src.slice(bodyStart + 1, end);
const fn = Function("isCutsceneInputLocked", `return (scene) => {${body}}`)(() => false);
const window = new Window();
const doc = window.document;
// Real nesting (player.ts): .play-viewport > .play-stage(dialogueHost) > canvas. The normal battle mounts on the
// dialogue host (.play-stage); playTacticsBattle mounts on host.closest(".play-viewport") — outside .play-stage.
for (const [testid, where] of [["battle-scene", "stage"], ["main-menu", "stage"], ["tactics-battle", "viewport"], ["none", ""]]) {
  const overlay = `<section data-testid="${testid}"></section>`;
  doc.body.innerHTML = `<div class="play-viewport"><div class="play-stage"><canvas></canvas>${where === "stage" ? overlay : ""}</div>${where === "viewport" ? overlay : ""}</div>`;
  const canvas = doc.querySelector("canvas");
  const paused = fn({ timeSleepInProgress: false, session: {}, game: { canvas } });
  console.log(`${testid.padEnd(15)} paused=${paused}  -> 1000ms at minutesPerRealSecond=1 advances ${paused ? 0 : 1} game minute(s)`);
}
await window.happyDOM.close();
