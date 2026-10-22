// author_beodeul_town 마을 형태(form) 프로브 — LLM 없이 theme × form × seed 로 짓고 렌더·통계를 남긴다.
//   bun scripts/qa/beodeul-village-forms-probe.mts [--out output/evidence/village-forms] [--seeds 3,7,11] [--themes river,coast] [--forms riverbank] [--terrains terraces,flat] [--size 88x56]
//   bun scripts/qa/beodeul-village-forms-probe.mts --cases coast:street:terraces:42:64x40,swamp:street:ridge:7   (정한 판만)
//   … --rebuild   (seed+100 으로 먼저 지어 relief 가 남은 맵에 같은 mapId 로 다시 짓기)
// 결과: <out>/<theme>-<form>-<seed>.png, <out>/report.json(문 앞 도달·막다른 칸·울타리·경고)
import fs from "node:fs";
import { renderMapPng } from "../qa-game/render.mts";
import { runTool } from "../../src/editor/tools/index.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import { analyzeCityForm } from "../../src/editor/tools/cityForm.ts";
import { BEODEUL_VILLAGE_THEMES, allowedVillageForms, type BeodeulVillageTheme } from "../../src/editor/tools/beodeulVillage.ts";
import { allowedVillageTerrains } from "../../src/editor/tools/beodeulTerrain.ts";
import type { Project } from "../../src/project/types.ts";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", "output/evidence/village-forms");
const seeds = arg("seeds", "3,7,11").split(",").map(Number);
const themes = arg("themes", BEODEUL_VILLAGE_THEMES.join(",")).split(",") as BeodeulVillageTheme[];
const forms = arg("forms", "").split(",").filter(Boolean);
const terrainsArg = arg("terrains", "").split(",").filter(Boolean); // 생략 = theme 의 지형 전부
const size = arg("size", ""); // 예: 88x56 (생략 = theme 기본 크기)
const rebuild = process.argv.includes("--rebuild");
fs.mkdirSync(OUT, { recursive: true });
const base = createBlankProject() as Project; ensureBundledTilesets(base);
const baseJson = JSON.stringify(base);
const rows: Record<string, unknown>[] = [];
// --cases river:street:terraces:7:88x56,coast:street:terraces:42:64x40 — 정한 판만(조수 실입력창 검수에서 짚인 판 다시 재기)
// 6·7·8·9번째 칸(선택): roofs(red·slate·moss·log)·houseCount(3~5)·water(river·none)·woods(edge·dense) — 예: river:scatter:flat:5:42x32:moss:4:none
const cases = arg("cases", "").split(",").filter(Boolean).map((c) => { const [t, f, tr, sd, sz, rf, hc, wa, wd] = c.split(":"); return { theme: t as BeodeulVillageTheme, form: f!, terrain: tr!, seed: Number(sd), size: sz ?? "", roofs: rf || undefined, houseCount: hc ? Number(hc) : undefined, water: wa || undefined, woods: wd || undefined }; });
const plan: { theme: BeodeulVillageTheme; form: string; terrain: string; seed: number; size: string; roofs?: string; houseCount?: number; water?: string; woods?: string }[] = [];
if (cases.length) plan.push(...cases);
else for (const theme of themes) for (const form of allowedVillageForms(theme)) {
  if (forms.length && !forms.includes(form)) continue;
  for (const terrain of allowedVillageTerrains(theme)) for (const seed of seeds) {
    if (terrainsArg.length && !terrainsArg.includes(terrain)) continue;
    plan.push({ theme, form, terrain, seed, size });
  }
}
for (const { theme, form, terrain, seed, size, roofs, houseCount, water, woods } of plan) {
  const extra = { ...(roofs ? { roofs } : {}), ...(houseCount ? { houseCount } : {}), ...(water ? { water } : {}), ...(woods ? { woods } : {}) };
  const [sw, sh] = size ? size.split("x").map(Number) : [];
  {
    const ctx = { project: JSON.parse(baseJson) as Project };
    const t0 = Date.now();
    const id = `v_${theme}_${form}_${terrain}_${seed}`;
    // --rebuild: 먼저 다른 seed 로 지어 옛 높이(relief)를 남긴 맵에 같은 mapId 로 다시 짓는다(높이를 아는 stamp_object 가 옛 relief 로 키트를 거절하지 않는지)
    // 마을 집이 선 맵은 완성된 집 보호로 덮어 짓기가 거절되므로(조수 경로), 집 보호 기록만 걷어 「relief 는 남았고 보호된 집은 없는 맵」을 만든다.
    if (rebuild) {
      const r0 = runTool(ctx, "author_beodeul_town", { theme, form, terrain, seed: seed + 100, id, ...(sw ? { width: sw, height: sh } : {}) } as never); if (!r0.ok) console.log("rebuild first FAIL", r0.summary);
      const m0 = ctx.project.maps[id]; if (m0) { m0.structurePlacements = []; console.log("rebuild: old relief", !!m0.relief); }
    }
    const r = runTool(ctx, "author_beodeul_town", rebuild ? { theme, form, terrain, seed, mapId: id } as never : { theme, form, terrain, seed, id, ...extra, ...(sw ? { width: sw, height: sh } : {}) } as never);
    const name = `${theme}-${form}-${terrain}-${seed}${size ? `-${size}` : ""}${roofs ? `-${roofs}` : ""}${houseCount ? `-h${houseCount}` : ""}${water ? `-${water}` : ""}${woods ? `-${woods}` : ""}${rebuild ? "-rebuild" : ""}`;
    if (!r.ok) { rows.push({ name, ok: false, summary: r.summary }); console.log(name, "FAIL", r.summary); continue; }
    const d = r.data as any; const map = ctx.project.maps[d.mapId]!;
    fs.writeFileSync(`${OUT}/${name}.png`, renderMapPng(ctx.project, map).png);
    const cf = analyzeCityForm(ctx.project, map);
    const doors = d.doors as { reached: boolean }[];
    // 단 위 도달(2026-10-11): upMiss = 높은 단의 걸을 수 있는 칸 중 못 닿는 칸 수, gateMiss = 못 닿는 울타리 문,
    // reach1·reach2 = 1단·2단 걸을 수 있는 칸 중 닿는 몫(%), gate2 = 2단 이상 울타리 문 닿음/전체, up2 = 오르막을 낸 단(data.upper)
    const gates = (d.fenceGates ?? []) as { level: number; reached: boolean }[];
    const lr = (d.levelReach ?? {}) as Record<string, { walk: number; reached: number }>;
    const pct = (L: string) => (lr[L] ? Math.round((lr[L]!.reached / Math.max(1, lr[L]!.walk)) * 100) : null);
    const g2 = gates.filter((g) => g.level >= 2);
    const upMiss = Object.values(lr).reduce((a, e) => a + (e.walk - e.reached), 0); // 높은 단의 걸을 수 있는 칸 중 입구에서 못 닿는 칸(실제 통행 + 단 경사로)
    const reach = { upMiss, gateMiss: gates.filter((g) => !g.reached).length, reach1: pct("1"), reach2: pct("2"), gate2: g2.length ? `${g2.filter((g) => g.reached).length}/${g2.length}` : null, up2: d.upper ?? null };
    const row = { name, ...reach, ok: true, ms: Date.now() - t0, form: d.form, gathering: d.gathering, houses: d.houses, distinct: d.distinctHouses,
      doors: doors.length, unreached: doors.filter((x) => !x.reached).length, deadCells: cf.deadEnds.filter((x) => x.kind === "cell").length,
      deadStreets: cf.deadEnds.filter((x) => x.kind === "street").length,
      longest: cf.lines.longestLen, longStraight: cf.lines.longStraight.map((l) => `${l.orient}${l.len}@${l.from.join(",")}`), isolated: cf.graph.isolated.length, fields: d.fields, fenceCells: d.fenceCells, trees: d.trees,
      stampFailed: d.stampFailed, terrain: d.terrain, relief: d.relief,
      stairs: (map.relief?.ramps ?? []).filter((v) => v >= 5 && v <= 8).length, warnings: ((r as any).diff?.warnings ?? r.warnings ?? []), summary: r.summary };
    rows.push(row);
    console.log(name, JSON.stringify({ ms: row.ms, houses: row.houses, unreached: row.unreached, dead: row.deadCells, deadSt: row.deadStreets, long: row.longStraight, longest: row.longest, iso: row.isolated, fence: row.fenceCells, fail: row.stampFailed, terrain: d.terrain, lv: d.relief?.levels, ramps: d.relief?.ramps, rfail: d.relief?.fails, cut: d.relief?.cuts, straddle: d.relief?.straddle, offRoad: d.relief?.rampsOffRoad, rim: d.relief?.roadOnRim, stairs: row.stairs, upMiss: reach.upMiss, ...(d.upperLost ? { lost: d.upperLost } : {}), gateMiss: reach.gateMiss, reach1: reach.reach1, reach2: reach.reach2, gate2: reach.gate2, up2: reach.up2, warn: (((r as any).diff?.warnings ?? r.warnings ?? [])).length }));
  }
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rows, null, 1));
