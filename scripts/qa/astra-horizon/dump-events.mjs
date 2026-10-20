// 맵별 이벤트와 대사 요약을 찍는다.  node scripts/qa/astra-horizon/dump-events.mjs <project.json> [mapId...]
import fs from "node:fs";
const p = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const only = process.argv.slice(3);
const sum = (cmds, d = 0) => { const out = []; for (const c of cmds ?? []) {
  const pad = "  ".repeat(d + 2);
  if (c.kind === "text") out.push(`${pad}${c.speaker ? c.speaker + ": " : ""}${c.body}`);
  else if (c.kind === "choices") { out.push(`${pad}[choices] ${c.prompt ?? ""}`); for (const o of c.options) { out.push(`${pad} - ${o.text}`); out.push(...sum(o.branch, d + 2)); } }
  else if (c.kind === "fork") { out.push(`${pad}[fork ${JSON.stringify(c.condition)}]`); out.push(...sum(c.then, d + 1)); if (c.else?.length) { out.push(`${pad}[else]`); out.push(...sum(c.else, d + 1)); } }
  else if (c.kind === "battleProcessing") { out.push(`${pad}[battle ${c.troopId}]`); out.push(...sum(c.victoryBranch, d + 1)); }
  else out.push(`${pad}[${c.kind}] ${JSON.stringify(c).slice(0, 140)}`);
} return out; };
for (const m of Object.values(p.maps)) {
  if (only.length && !only.includes(m.id)) continue;
  console.log(`\n## ${m.id} ${m.name} ${m.width}x${m.height}`);
  for (const e of m.events) {
    console.log(`- ${e.id} (${e.x},${e.y}) ${e.name ?? ""}`);
    for (const pg of e.pages ?? [{ commands: e.commands, conditions: [] }]) {
      console.log(`   page ${pg.name ?? ""} cond=${JSON.stringify(pg.conditions ?? [])} trig=${pg.trigger?.kind ?? ""} sprite=${pg.graphic?.sprite?.id ?? ""}`);
      for (const l of sum(pg.commands)) console.log(l);
    }
  }
}
