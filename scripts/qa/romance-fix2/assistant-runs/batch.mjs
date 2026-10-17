// usage: node batch.mjs <project.json> <calls.json>   calls = [[tool,args],...]; stops at first failure unless "continue"
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const [pf, cf] = process.argv.slice(2);
const m = await import(pathToFileURL(process.env.HEADLESS_BUNDLE).href);
m.setHeadlessPublicRoot("public");
const calls = JSON.parse(readFileSync(cf, "utf8"));
let project = m.normalizeHeadlessProject(m.loadHeadlessProject(readFileSync(pf, "utf8")));
const resolveIds = (v) => {
  if (typeof v === "string" && v.startsWith("@")) {
    for (const map of Object.values(project.maps)) for (const e of map.events) if (e.characterId === v.slice(1)) return e.id;
  }
  if (Array.isArray(v)) return v.map(resolveIds);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveIds(x)]));
  return v;
};
for (const [tool, args0, opt] of calls) {
  const args = resolveIds(args0);
  await m.prepareHeadlessTool(tool, args, project);
  const { result, project: next } = m.runHeadlessToolWithProject(project, tool, args, { assistantRun: true, ...(opt?.currentMapId ? { currentMapId: opt.currentMapId } : {}) });
  const iss = (result.issues ?? []).slice(0, 4).map(i => `${i.severity}:${i.code}:${String(i.message).slice(0, 220)}`);
  const full = opt?.full ? JSON.stringify(result.data) : JSON.stringify(result.data ?? null).slice(0, opt?.n ?? 350);
  console.log(`# ${tool} ok=${result.ok} :: ${String(result.summary).slice(0, 300)}${iss.length ? "\n   issues: " + iss.join(" | ") : ""}${result.warnings?.length ? "\n   warn: " + result.warnings.slice(0, 3).map(String).map(s => s.slice(0, 200)).join(" | ") : ""}\n   data: ${full}`);
  if (result.ok && next !== project) { project = next; writeFileSync(pf, m.serializeHeadlessProject(project)); }
  else if (!result.ok && !opt?.continue) { console.log("-- stopped"); break; }
}
