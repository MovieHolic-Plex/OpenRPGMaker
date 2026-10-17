// 캠퍼스 «죽은 문» 규칙 검사 — compose_campus_grounds(entrances)·link_campus_interior(building)·projectLint(campus-dead-door)를 조수 도구 그대로 돌린다.
//   node_modules/.bin/vite-node scripts/content/modern-campus/qa/check-campus-doors.mts [--out /tmp/campus-doors]
// 확인: ① 기본(entrances 없음)은 문 그림 0개 ② entrances 건물만 문+이음, 나머지는 문 없는 벽 ③ 실내가 없으면 깔지 않는다(맵 불변)
//       ④ 문 없는 건물에 link_campus_interior({building}) 가 문 그림과 이음을 한 번에 낸다 ⑤ 이음 이벤트를 지우면 projectLint 가 campus-dead-door error
import fs from "node:fs";
import { renderMapPng } from "../../../qa-game/render.mts";
import { createEmptyToolProject } from "../../../../src/editor/tools/emptyProject.ts";
import { ensureBundledTilesets } from "../../../../src/project/defaults/defaultAssets.ts";
import { runTool } from "../../../../src/editor/tools/index.ts";
import { projectLint } from "../../../../src/project/lint/projectLint.ts";
import { campusPaletteFromTileset } from "../../../../src/project/campusComposer.ts";
import { campusDoorTileIds } from "../../../../src/project/campusDoors.ts";
const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", "/tmp/campus-doors"); fs.mkdirSync(OUT, { recursive: true });
const ctx: any = { project: createEmptyToolProject("chk") }; ensureBundledTilesets(ctx.project);
let bad = 0;
const must = (ok: boolean, what: string) => { console.log(ok ? "PASS" : "FAIL", what); if (!ok) bad++; };
const call = (tool: string, args: any) => runTool(ctx, tool, args) as any;
const def = ctx.project.tilesets["modern_campus"];
const pal = campusPaletteFromTileset(def);
const kits = (def.structureKits ?? []).map((k: any) => pal.kit(k.id)).filter(Boolean);
const bottom = campusDoorTileIds(kits).bottom;
const doorCells = (m: any) => { let n = 0; for (let i = 0; i < m.lowerTiles.length; i++) if (bottom.has(m.upperTiles[i]) || bottom.has(m.lowerTiles[i])) n++; return n; };
const room = (id: string) => {
  const ex = JSON.parse(fs.readFileSync("tiledata/modern-campus/interior/plans/school-class-wing.json", "utf8"));
  return call("build_hand_interior_room", { tileset: "modern_campus", mapId: id, name: `${id} 실내`, plan: ex.plan, floor: ex.floor, wall: ex.wall, zones: ex.zones ?? [], objects: ex.objects ?? [], tables: ex.tables ?? [], goods: ex.goods ?? [], exitWidth: 2, start: [{ x: ex.start[0], y: ex.start[1] }], links: [] });
};
const mk = (name: string, w: number, h: number) => call("create_map", { name, width: w, height: h, tilesetId: "modern_campus" }).data.mapId as string;
const errorsOf = () => projectLint(ctx.project, { skipRoundtrip: true }).filter((i) => i.code === "campus-dead-door");

// ① 기본: 문 그림 0
const a = mk("a-default", 48, 36);
const ra = call("compose_campus_grounds", { mapId: a, style: "school", seed: 2 });
must(ra.ok && doorCells(ctx.project.maps[a]) === 0, `기본 교정에는 문 그림이 없다 (ok=${ra.ok}, 문 칸 ${doorCells(ctx.project.maps[a])})`);
must(errorsOf().length === 0, "문 없는 교정은 campus-dead-door 0");
fs.writeFileSync(`${OUT}/default-doorless.png`, renderMapPng(ctx.project, ctx.project.maps[a]).png);
// ② entrances: 본관만 문+이음
must(room("in-main").ok, "실내 본관 짓기");
const b = mk("b-entrance", 48, 36);
const rb = call("compose_campus_grounds", { mapId: b, style: "school", seed: 2, entrances: [{ building: "본관", interiorMapId: "in-main" }] });
console.log(rb.ok ? rb.summary.slice(0, 160) : JSON.stringify(rb).slice(0, 400));
must(rb.ok && doorCells(ctx.project.maps[b]) === 2, `본관 문 2칸만 그려졌다 (문 칸 ${doorCells(ctx.project.maps[b])})`);
must(errorsOf().length === 0, "entrances 교정은 campus-dead-door 0");
fs.writeFileSync(`${OUT}/main-entrance.png`, renderMapPng(ctx.project, ctx.project.maps[b]).png);
// ③ 없는 실내 → 깔지 않음
const c = mk("c-missing", 48, 36);
const before = JSON.stringify(ctx.project.maps[c].lowerTiles);
const rc = call("compose_campus_grounds", { mapId: c, style: "school", seed: 2, entrances: [{ building: "본관", interiorMapId: "no-such-room" }] });
must(!rc.ok && JSON.stringify(ctx.project.maps[c].lowerTiles) === before, "없는 실내 맵을 가리키면 거부되고 맵이 안 바뀐다");
// ④ 문 없는 건물에 link({building}) → 문+이음
must(room("in-hall").ok, "실내 강당 짓기");
const lk = call("link_campus_interior", { mapId: b, building: "강당", interiorMapId: "in-hall" });
console.log(lk.ok ? lk.summary.slice(0, 200) : JSON.stringify(lk).slice(0, 500));
must(lk.ok && doorCells(ctx.project.maps[b]) === 4, `강당 문까지 4칸 (문 칸 ${doorCells(ctx.project.maps[b])})`);
must(errorsOf().length === 0, "link 뒤에도 campus-dead-door 0");
fs.writeFileSync(`${OUT}/main-hall-entrance.png`, renderMapPng(ctx.project, ctx.project.maps[b]).png);
// ⑤ 이음 이벤트를 지우면 error
const m = ctx.project.maps[b];
const removed = m.events.filter((e: any) => e.id.startsWith("ev_mc_enter_"));
m.events = m.events.filter((e: any) => !e.id.startsWith("ev_mc_enter_"));
const dead = errorsOf();
must(removed.length > 0 && dead.length >= 2 && dead.every((i) => i.severity === "error"), `이음 이벤트를 지우면 campus-dead-door error ${dead.length}개`);
console.log(dead.slice(0, 2).map((i) => i.message).join("\n"));
process.exit(bad);
