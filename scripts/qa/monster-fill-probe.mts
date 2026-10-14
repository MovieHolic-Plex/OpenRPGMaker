// 몬스터 수집 캠페인의 야외 빈 땅 측정 + 「이어 고치기」 채움 모사 (모델 없음, bun).
//
//   bun scripts/qa/monster-fill-probe.mts <outDir> [--themes meadow,desert,snow,coast] [--render] [--check] [--followup]
//
// 1) build_monster_game(create) 을 테마마다 실제 도구 경로(runToolAsync)로 돌려 <outDir>/<theme>/project.json 에 쓴다.
// 2) 야외 맵(town·field)마다 「외로운 바닥」 비율 = 지역 바닥 칸 중 위층·이벤트가 없고 반경 2칸 안에 물체가 하나도 없는 칸의 몫.
// 3) --followup: 실편집기 이어 고치기 r11·r13(「서리꽃 마을 왼쪽 아래 빈 곳 채워」)을 모사한다 —
//    조수 노트대로 find_empty_ground → 왼쪽 아래 사분면과 겹치는 터마다 furnish_outdoor_area. 사분면의 빈 바닥 칸 전후를 센다.
// 4) --check: qa:game check 와 같은 runGameCheck(자동 플레이 포함)로 막힘·엔딩 도달을 본다.
// 5) --render: 맵을 원 크기 PNG 로(<outDir>/<theme>/render/<mapId>.png).
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../src/project/defaults.ts";
import { runToolAsync } from "../../src/editor/tools/asyncToolRunner.ts";
import { serialize } from "../../src/project/io.ts";
import { loadHeadlessProject } from "../../src/headless/index.ts";
import { measureBareGround } from "../../src/project/kitAreaFurnish.ts";
import { runGameCheck, formatGameCheckSummary } from "../../src/qa/gameCheck/index.ts";
import { renderMapPng } from "../qa-game/render.mts";
import { store } from "../../src/project/store.ts";
import type { GameMap, Project } from "../../src/project/types.ts";

const argv = process.argv.slice(2);
const out = argv.find(a => !a.startsWith("--") && !argv[argv.indexOf(a) - 1]?.startsWith("--themes"));
if (!out) throw Error("bun scripts/qa/monster-fill-probe.mts <outDir> [--themes ...] [--render] [--check] [--followup]");
const themes = (argv[argv.indexOf("--themes") + 1] && argv.includes("--themes") ? argv[argv.indexOf("--themes") + 1]! : "meadow,desert,snow,coast").split(",");
const flag = (f: string) => argv.includes(`--${f}`);

/** 기획서 세 개(monster-collect·monster-desert·monster-harbor)와 눈 기획을 모델 없이 같은 인자로. */
const ARGS: Record<string, Record<string, unknown>> = {
  meadow: { mode: "create" },
  desert: { mode: "create", startTheme: "desert", firstGymType: "ground", names: { startTown: "야자수 마을", professor: "모래박사", firstRoute: "1번 모랫길", firstGym: "모래바람 체육관", firstLeader: "사하라", firstBadge: "모래시계 배지" } },
  coast: { mode: "create", startTheme: "coast", firstGymType: "water" },
  snow: { mode: "create", startTheme: "snow", firstGymType: "ice" },
};
const BRIEFS: Record<string, string> = { meadow: "monster-collect", desert: "monster-desert", coast: "monster-harbor" };

/** 맨땅 = 지역 바닥 칸 중 3×3 이웃에 물체(위층 그림·지역 바닥 아닌 1층 칸·이벤트)가 하나도 없는 칸 — kitAreaFurnish 와 같은 판정. */
function emptiness(project: Project, map: GameMap, rect?: { x: number; y: number; w: number; h: number }) {
  return measureBareGround(project, map, rect);
}

async function build(theme: string): Promise<Project> {
  const project = createBlankProject();
  const ctx = { project, currentMapId: project.startMapId } as { project: Project; currentMapId: string };
  const r = await runToolAsync(ctx as never, "build_monster_game", ARGS[theme]!);
  if (!r.ok) throw Error(`${theme}: ${r.summary}`);
  return ctx.project;
}

const summary: Record<string, unknown> = {};
for (const theme of themes) {
  const dir = path.join(out, theme);
  fs.mkdirSync(dir, { recursive: true });
  const built = await build(theme);
  fs.writeFileSync(path.join(dir, "project.json"), serialize(built));
  const project = loadHeadlessProject(fs.readFileSync(path.join(dir, "project.json"), "utf8"));
  const outdoor = Object.values(project.maps).filter(m => m.mapRole === "town" || m.mapRole === "field" || m.id === "mx_map_beach" || m.id === "mx_map_garden");
  const perMap = Object.fromEntries(outdoor.map(m => [m.id, emptiness(project, m)]));
  const total = Object.values(perMap).reduce((a, m) => ({ g: a.g + m.ground, b: a.b + m.bare }), { g: 0, b: 0 });
  const towns = Object.entries(perMap).filter(([id]) => project.maps[id]!.mapRole === "town").reduce((a, [, m]) => ({ g: a.g + m.ground, b: a.b + m.bare }), { g: 0, b: 0 });
  const entry: Record<string, unknown> = { bareShare: +(total.b / total.g).toFixed(4), townBareShare: +(towns.b / towns.g).toFixed(4), ground: total.g, bare: total.b, perMap };

  if (flag("followup")) {
    // r11·r13 재현: 서리꽃 마을(눈 테마면 그 자리 마을) 왼쪽 아래.
    const target = project.maps["mx_map_frost"]!;
    const ctx = { project, currentMapId: target.id } as { project: Project; currentMapId: string };
    const quad = { x: 0, y: Math.floor(target.height / 2), w: Math.ceil(target.width / 2), h: Math.ceil(target.height / 2) };
    const before = emptiness(project, target, quad);
    let found = await runToolAsync(ctx as never, "find_empty_ground", { mapId: target.id, limit: 4, region: "bottom-left" });
    if (!found.ok) found = await runToolAsync(ctx as never, "find_empty_ground", { mapId: target.id, limit: 4 });
    const calls: unknown[] = [];
    // 조수 노트(kitAreaNote)가 시키는 대로: 사용자가 말한 쪽을 region 으로 한 번.
    const legacy = !((found.data as { regionRect?: unknown })?.regionRect);
    if (legacy) {
      // 옛 도구(region 없음): r11·r13 처럼 찾은 터 중 사분면과 겹치는 것마다 기본 스타일로.
      const areas = ((found.data as { areas?: { x: number; y: number; w: number; h: number }[] })?.areas ?? [])
        .filter(a => a.x < quad.x + quad.w && a.x + a.w > quad.x && a.y < quad.y + quad.h && a.y + a.h > quad.y);
      for (const a of areas) {
        const r = await runToolAsync(ctx as never, "furnish_outdoor_area", { mapId: target.id, area: { x: a.x, y: a.y, w: a.w, h: a.h } });
        calls.push({ area: a, ok: r.ok, summary: r.summary });
      }
    } else {
      const r = await runToolAsync(ctx as never, "furnish_outdoor_area", { mapId: target.id, region: "bottom-left" });
      calls.push({ region: "bottom-left", ok: r.ok, summary: r.summary, warnings: (r as { warnings?: unknown }).warnings });
    }
    const after = emptiness(ctx.project, ctx.project.maps[target.id]!, quad);
    entry.followup = { map: target.id, quad, found: found.summary, calls, before, after };
    fs.writeFileSync(path.join(dir, "followup.json"), serialize(ctx.project));
    if (flag("render")) {
      store.replaceProject(ctx.project);
      fs.mkdirSync(path.join(dir, "render"), { recursive: true });
      fs.writeFileSync(path.join(dir, "render", `followup_${target.id}.png`), renderMapPng(store.getCurrent(), store.getCurrent().maps[target.id]!, 1).png);
    }
  }
  if (flag("render")) {
    store.replaceProject(project);
    const cur = store.getCurrent();
    fs.mkdirSync(path.join(dir, "render"), { recursive: true });
    for (const m of Object.values(cur.maps)) fs.writeFileSync(path.join(dir, "render", `${m.id}.png`), renderMapPng(cur, m, 1).png);
  }
  if (flag("check")) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, "project.json"), "utf8"));
    const report = runGameCheck(project, { rawProject: raw });
    fs.writeFileSync(path.join(dir, "check.txt"), formatGameCheckSummary(report) + "\n");
    entry.check = { blockers: report.counts.blocker, warnings: report.counts.warning, ending: report.autoPlay?.runs.map(r => r.ok ? (r.endingReached ?? "ok") : "FAIL").join(",") };
  }
  summary[theme] = entry;
  console.log(theme, JSON.stringify({ bareShare: entry.bareShare, townBareShare: entry.townBareShare, followup: entry.followup ? { before: (entry.followup as { before: unknown }).before, after: (entry.followup as { after: unknown }).after } : undefined, check: entry.check }));
}
fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 2));
