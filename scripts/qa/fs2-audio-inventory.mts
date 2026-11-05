// fs2-audio 재고: 폴른 스타 프로젝트의 모든 전투·BGM·SE 호출을 JSON 으로 낸다.
import fs from "node:fs";
import { createFlagshipDemoProject } from "@/project/flagship";
import { resolveBattleBgmResourceId } from "@/project/mapMusic";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";

const out = process.argv[2] ?? "audio-inventory.json";
const { project } = createFlagshipDemoProject("chrono-bell");
type Node = Record<string, unknown>;
const battles: Node[] = []; const se: Node[] = []; const bgm: Node[] = []; const sysBgm: Node[] = [];
const textOf = (c: Node | undefined): string => {
  if (!c) return "";
  const t = (c.text ?? c.message ?? (c.fields as Node | undefined)?.text ?? "") as unknown;
  return Array.isArray(t) ? t.join(" ") : String(t ?? "");
};
function walkList(list: Node[], ctx: Node, battleCue: { v?: string }) {
  for (let i = 0; i < list.length; i += 1) {
    const c = list[i]!;
    const kind = String(c.kind ?? "");
    if (kind === "m2Command" && c.commandId === "m2-027-change-system-bgm") {
      const f = (c.fields ?? {}) as Node;
      sysBgm.push({ ...ctx, cue: f.cue, operation: f.operation, resourceId: f.resourceId });
      if (f.cue === "battle") battleCue.v = f.operation === "set" ? String(f.resourceId) : undefined;
    }
    if (kind === "battleProcessing") battles.push({ ...ctx, via: "event", troopId: c.troopId, battleBgm: battleCue.v ?? null });
    if ((kind === "playAudio" && (c.channel === "se" || c.loop === false && c.channel !== "bgm")) || kind === "playSe") {
      const near = [list[i - 2], list[i - 1], list[i + 1], list[i + 2]].filter(Boolean).map((n) => String(n!.kind) + (textOf(n) ? ":" + textOf(n).slice(0, 40) : (n!.kind === "m2Command" ? ":" + String(n!.commandId) : "")));
      se.push({ ...ctx, resourceId: c.resourceId, near });
    }
    if (kind === "playAudio" && c.channel === "bgm") bgm.push({ ...ctx, resourceId: c.resourceId, how: "event" });
    for (const v of Object.values(c)) {
      if (Array.isArray(v) && v.length && typeof v[0] === "object" && v[0] && "kind" in (v[0] as object)) walkList(v as Node[], ctx, battleCue);
      else if (v && typeof v === "object" && !Array.isArray(v)) for (const w of Object.values(v as Node)) if (Array.isArray(w) && w.length && typeof w[0] === "object" && w[0] && "kind" in (w[0] as object)) walkList(w as Node[], ctx, battleCue);
    }
  }
}
for (const [mapId, map] of Object.entries(project.maps)) {
  if (map.bgm?.mode === "custom") bgm.push({ mapId, mapName: map.name, resourceId: map.bgm.resourceId, how: "map" });
  for (const ev of map.events ?? []) (ev.pages ?? []).forEach((p, pi) => walkList((p.commands ?? []) as unknown as Node[], { mapId, mapName: map.name, eventId: ev.id, eventName: ev.name, page: pi, x: ev.x, y: ev.y }, {}));
  for (const s of map.fieldSpawns ?? []) battles.push({ mapId, mapName: map.name, via: "fieldSpawn", spawnId: s.id, troopId: s.troopId, battleBgm: null });
  for (const t of map.troopIds ?? []) if ((map.encounterRate ?? 0) > 0) battles.push({ mapId, mapName: map.name, via: "encounter", troopId: t, battleBgm: null });
  for (const e of map.encounterTable ?? []) battles.push({ mapId, mapName: map.name, via: "encounterTable", troopId: (e as Node).troopId, battleBgm: null });
}
for (const ce of project.database.commonEvents ?? []) walkList(((ce as unknown as Node).commands ?? []) as Node[], { mapId: "(common)", eventId: (ce as unknown as Node).id, eventName: (ce as unknown as Node).name }, {});
for (const tr of project.database.troops ?? []) for (const p of tr.battleEventPages ?? []) walkList(((p as unknown as Node).commands ?? []) as Node[], { mapId: "(troop)", eventId: tr.id, eventName: tr.name }, {});
const troops = Object.fromEntries((project.database.troops ?? []).map((t) => [t.id, { name: t.name, enemies: (t.members?.map((m) => m.enemyId) ?? t.enemyIds) }]));
const enemies = Object.fromEntries((project.database.enemies ?? []).map((e) => [e.id, { name: e.name, collapse: (e as unknown as Node).collapseEffect ?? null, hp: (e as unknown as Node).maxHp ?? (e as unknown as Node).hp ?? null }]));
const sys = project.system as unknown as Node;
fs.writeFileSync(out, JSON.stringify({ system: { battleBgm: sys.battleBgmResourceId, victoryMe: sys.battleVictoryMeResourceId, defeat: sys.battleDefeatSeResourceId, escape: sys.battleEscapeSeResourceId, defaultBgm: sys.defaultBgmResourceId, systemSounds: sys.sounds ?? sys.systemSounds ?? null }, maps: Object.fromEntries(Object.entries(project.maps).map(([id, m]) => [id, { name: m.name, bgm: m.bgm ?? null, battleBgm: (m as unknown as Node).battleBgmResourceId ?? null, role: m.mapRole ?? null }])), battles, se, bgm, sysBgm, troops, enemies }, null, 1));

for (const b of battles) {
  const mapId = String(b.mapId);
  b.resolved = resolveBattleBgmResourceId(project, project.maps[mapId] ? mapId : undefined, (b.battleBgm as string | null) ?? undefined) ?? null;
}
const ids = new Set<string>([...battles.map((b) => String(b.resolved)), ...se.map((s) => String(s.resourceId)), ...bgm.map((b) => String(b.resourceId))]);
const unresolved = [...ids].filter((id) => id && id !== "null" && id !== "undefined" && !resolveAssetResourceUrl(id, { project }));
const fileMissing = [...ids].filter((id) => {
  const url = id && id !== "null" ? resolveAssetResourceUrl(id, { project }) : null;
  return url && url.startsWith("/") && !fs.existsSync("public" + url) && !fs.existsSync("public" + url.split("?")[0]!);
});
const seCount = new Map<string, number>(); for (const s of se) seCount.set(String(s.resourceId), (seCount.get(String(s.resourceId)) ?? 0) + 1);
const seTop = [...seCount].sort((a, b) => b[1] - a[1]).slice(0, 5);
const perMap = new Map<string, Set<string>>(); for (const b of battles) { const k = String(b.mapId); (perMap.get(k) ?? perMap.set(k, new Set()).get(k)!).add(String(b.resolved)); }
const bossSink = new Set((project.database.enemies ?? []).filter((e) => (e as unknown as Node).collapseEffect === "bossSink").map((e) => e.id));
const bossTroops = new Set((project.database.troops ?? []).filter((tr) => (tr.members?.map((m) => m.enemyId) ?? tr.enemyIds).some((id) => bossSink.has(id))).map((tr) => tr.id));
const bossCues = [...new Set(battles.filter((b) => bossTroops.has(String(b.troopId))).map((b) => `${b.troopId}=${b.resolved}`))];
const summary = {
  battles: battles.length, distinctBattleCues: [...new Set(battles.map((b) => String(b.resolved)))],
  battleCueShare: Object.fromEntries([...battles.reduce((m, b) => m.set(String(b.resolved), (m.get(String(b.resolved)) ?? 0) + 1), new Map<string, number>())]),
  mapsWithBattles: perMap.size, bossTroopCues: bossCues, seCalls: se.length, seDistinct: seCount.size,
  seTop: seTop.map(([id, n]) => ({ id, n, share: Math.round((100 * n) / Math.max(1, se.length)) })),
  unresolved, fileMissing,
};
fs.writeFileSync(out.replace(/\.json$/, ".summary.json"), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary));
console.log("battles", battles.length, "se", se.length, "bgm", bgm.length, "sysBgm", sysBgm.length);
