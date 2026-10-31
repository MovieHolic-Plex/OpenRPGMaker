// Re-render a bbox run's project.json with experiment pieces injected (before baking).
//   RAMP_PIECES=a.json[,b.json] bun render-run.mts <run dir> <out.png>    (json = {"<style>": {key: patch}})
import { readFileSync, writeFileSync } from "node:fs";
import rampArt from "../../../../src/project/relief/rampArt.json";
for (const f of (process.env.RAMP_PIECES ?? "").split(",").filter(Boolean)) {
  const add = JSON.parse(readFileSync(f, "utf8"));
  for (const [style, pcs] of Object.entries<any>(add)) { const a = (rampArt as any)[style] ?? ((rampArt as any)[style] = {}); a.pieces = { ...(a.pieces ?? {}), ...pcs }; }
}
const [dir, out] = process.argv.slice(2);
const { project, mapId } = JSON.parse(readFileSync(`${dir}/project.json`, "utf8"));
const { renderMapPng } = await import("../../../qa-game/render.mts");
writeFileSync(out!, renderMapPng(project, project.maps[mapId]).png);
console.log("ok", out);
