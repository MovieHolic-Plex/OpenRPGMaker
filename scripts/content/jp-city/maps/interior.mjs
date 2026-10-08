#!/usr/bin/env node
// jp_city 예제 맵 ⑥ 일본 집 실내 — 2층 단독주택(1층·2층, 계단으로 이어짐)과 원룸 아파트(1K).
// 조수와 같은 길로 짓는다: 도구 build_hand_interior_room({tileset:"jp_city", plan, …}) 를 그대로 부른다(평면·가구는 tiledata/jp-city/interior/examples/*.json).
//
//   node scripts/content/jp-city/maps/interior.mjs            # → maps/out/interior-*.{map,report}.json + verify-shots/jp-city/interior-*-{1x,x3}.png
//   node scripts/content/jp-city/maps/interior.mjs --publish  # 검사 + 관문(--stage interior) 통과 시 장소 3곳 게시
//
// 이동(예제 JSON 의 links): 1층 계단 발칸 (9,9) → 2층 계단통 옆 (18,10) / 2층 계단통 아랫줄 (19,10)(20,10) → 1층 계단 앞 (9,10).
// 현관은 맵 아래 끝 틈 — 밖으로 나가는 이동은 거리 맵을 붙일 때 links 로 단다(INTERIOR_EXIT_* 환경 변수).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { underTsx, ROOT, OUT } from "./kitmap.mjs";
underTsx(import.meta.url);

const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const { BUILD_HAND_INTERIOR_ROOM_TOOL } = await imp("src/editor/tools/handInteriorTools.ts");
const { createEmptyToolProject } = await imp("src/editor/tools/emptyProject.ts");
const { canMove } = await imp("src/project/collision.ts");

const EX = join(ROOT, "tiledata/jp-city/interior/examples");
const read = (f) => JSON.parse(fs.readFileSync(join(EX, `${f}.json`), "utf8"));
const exit = process.env.INTERIOR_EXIT_MAP ? { toMapId: process.env.INTERIOR_EXIT_MAP, toX: Number(process.env.INTERIOR_EXIT_X), toY: Number(process.env.INTERIOR_EXIT_Y), direction: "down" } : null;

const HOUSE_1F = "jp-city-house-1f", HOUSE_2F = "jp-city-house-2f", APT = "jp-city-apartment-1k";
// start·links(계단 이동)는 예제 JSON 이 들고 있다 — 조수가 보는 예제 그대로. 현관 밖 이동만 환경 변수로 덧붙인다(출구 칸 = 맨 아래 줄 틈).
const exitCell = (plan) => { const y = plan.length - 1; return { x: plan[y].indexOf("."), y }; };
// 2묶음(2026-10-07): 가게·공공·집 보강 예제 19곳 — 한 장소 = 한 맵, 표는 examples/places2.json.
const PLACES2 = JSON.parse(fs.readFileSync(join(EX, "places2.json"), "utf8"));
// 3묶음(2026-10-08~): 학교·역·사무실·우체국 … — examples/places3*.json. 한 장소가 여러 맵(maps: 1층·2층·옥상·승강장·차내)일 수 있다.
// inner:true 인 맵(위층·승강장·차내)은 거리 문과 잇지 않는다 — 계단·이동(links)으로만 들어온다.
const PLACES3 = fs.readdirSync(EX).filter((f) => /^places3.*\.json$/.test(f)).sort().flatMap((f) => JSON.parse(fs.readFileSync(join(EX, f), "utf8")));
// --only a,b = 그 예제 파일만 짓는다(작업자 확인용 — 서로 잇는 층은 함께 준다). --only 를 주면 게시하지 않는다.
const onlyAt = process.argv.indexOf("--only");
const ONLY = onlyAt > 0 ? new Set(process.argv[onlyAt + 1].split(",")) : null;
const MAPS = [[HOUSE_1F, "house-1f", true], [HOUSE_2F, "house-2f", false], [APT, "apartment-1k", true],
  ...PLACES2.map((p) => [`jp-city-${p.file}`, p.file, true]),
  ...PLACES3.flatMap((p) => (p.maps ?? [p.file]).map((f) => [`jp-city-${f}`, f, !read(f).inner]))].filter(([, file]) => !ONLY || ONLY.has(file)).map(([id, file, door]) => {
  const ex = read(file);
  return { id, file, start: ex.start, links: [...(ex.links ?? []), ...(exit && door ? [{ ...exitCell(ex.plan), ...exit }] : [])] };
});

const project = createEmptyToolProject("jp-interior");
const results = [];
const argsOf = (m, links) => { const ex = read(m.file); return { tileset: "jp_city", mapId: m.id, name: ex.name, plan: ex.plan, floor: ex.floor, wall: ex.wall, zones: ex.zones ?? [], objects: ex.objects ?? [], tables: ex.tables ?? [], goods: ex.goods ?? [], ...(ex.exitWidth ? { exitWidth: ex.exitWidth } : {}),
  start: [{ x: m.start[0], y: m.start[1] }], links }; };
// 조수에게 가르치는 층 순서 그대로: ① 모든 층을 links 없이 짓고 ② 같은 mapId·replace:true 로 links 를 넣어 다시 짓는다(없는 맵으로 가는 links 는 도구가 거부한다).
const run = (args) => BUILD_HAND_INTERIOR_ROOM_TOOL.run(project, args);   // run(draft) 은 draft 를 고친다
for (const m of MAPS) run(argsOf(m, []));
for (const m of MAPS) {
  const ex = read(m.file);
  const r = run({ ...argsOf(m, m.links), replace: true });
  const MAP = project.maps[m.id];
  // 이동 칸은 실제로 걸어서 닿아야 한다(엔진 canMove 로 다시 잰다 — 도구 BFS 와 따로).
  const W = MAP.width, H = MAP.height, idx = (x, y) => y * W + x;
  const reach = new Set([idx(...m.start)]); const q = [m.start];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || reach.has(idx(nx, ny)) || !canMove(project, MAP, x, y, nx, ny)) continue;
      reach.add(idx(nx, ny)); q.push([nx, ny]);
    }
  }
  const linkCells = m.links.map((l) => ({ x: l.x, y: l.y, to: l.toMapId, reached: reach.has(idx(l.x, l.y)) }));
  const report = { map: { id: m.id, size: [W, H] }, start: m.start, summary: r.summary, tool: r.data, warnings: r.warnings ?? [], links: linkCells, reach: reach.size,
    ok: !(r.warnings ?? []).length && linkCells.every((l) => l.reached) };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(join(OUT, `interior-${m.file}.map.json`), JSON.stringify(MAP));
  fs.writeFileSync(join(OUT, `interior-${m.file}.report.json`), JSON.stringify(report, null, 1));
  const rr = spawnSync("python3", ["scripts/content/jp-city/maps/render.py", join(OUT, `interior-${m.file}.map.json`), `interior-${m.file}`], { cwd: ROOT, encoding: "utf8" });
  if (rr.status !== 0) { console.error(rr.stderr); process.exit(2); }
  // 관문·참고문서가 보는 2배 그림도 같이(1x 를 최근접으로 키운다 — 옛 x2 가 남아 관문이 낡은 그림을 보는 일이 없게).
  const x2 = spawnSync("python3", ["-c", "import sys;from PIL import Image;a=Image.open(sys.argv[1]);a.resize((a.width*2,a.height*2),Image.NEAREST).save(sys.argv[2])",
    join(ROOT, `verify-shots/jp-city/interior-${m.file}-1x.png`), join(ROOT, `verify-shots/jp-city/interior-${m.file}-x2.png`)], { encoding: "utf8" });
  if (x2.status !== 0) { console.error(x2.stderr); process.exit(2); }
  console.log(JSON.stringify({ map: m.id, ok: report.ok, reach: report.reach, warnings: report.warnings.slice(0, 6), links: linkCells }));
  results.push({ m, MAP, report, ex });
}
if (results.some((r) => !r.report.ok)) process.exitCode = 2;

if (process.argv.includes("--publish") && ONLY) { console.error("--only 와 --publish 는 같이 쓰지 않는다"); process.exit(2); }
if (process.argv.includes("--publish")) {
  if (process.exitCode) { console.error("검사 실패 — 게시하지 않았다"); process.exit(2); }
  // 집 실내(1묶음)는 관문 interior, 가게·공공·집 보강(2묶음 places2)은 관문 interior-shop — 둘 다 통과해야 게시한다.
  for (const stage of ["interior", "interior-shop"]) {
    const gate = spawnSync("python3", ["scripts/content/jp-city/gate/adversarial_gate.py", "check", "--stage", stage], { cwd: ROOT, encoding: "utf8" });
    process.stdout.write(gate.stdout);
    if (gate.status !== 0 && !process.env.SKIP_GATE) { console.error(`적대적 검증 관문 ${stage} 미통과 — 게시하지 않았다`); process.exit(3); }
  }
  const TS = project.tilesets.jp_city;
  const REGION_DIR = join(ROOT, "public/assets/region-references");
  const tpl = JSON.parse(fs.readFileSync(join(REGION_DIR, "jp-city-apartment-1k.oprn.json"), "utf8"));
  const slim = { id: TS.id, image: TS.image, tileSize: TS.tileSize, tilesPerRow: TS.tilesPerRow, count: TS.count, passability: TS.passability, priority: TS.priority, terrain: TS.terrain };
  const tsPath = join(ROOT, "src/project/jpCityPlaceReferences.ts");
  const snapPath = join(ROOT, "src/project/regionReferenceSnapshots.ts");
  let arr = JSON.parse(fs.readFileSync(tsPath, "utf8").match(/export const JP_CITY_PLACE_REFERENCES = (\[[\s\S]*\]) as const;/)[1]);
  let snap = fs.readFileSync(snapPath, "utf8");
  // 집은 1층·2층을 한 다운로드에(계단 이동이 이어지게), 원룸은 혼자.
  const groups = [
    { file: "house", placeId: "jp-city-house-interior-21x15", name: "일본 2층 단독주택 실내(1층·2층)", maps: [HOUSE_1F, HOUSE_2F], main: HOUSE_1F,
      rules: ["1층: 현관(타타키+아가리카마치 띠·신발장·문턱) → 동서 복도(북쪽 벽 계단) — 북쪽 화실(후스마)·화장실(문)·부엌, 남서 욕실·탈의실(미닫이 옆문), 동쪽 LDK(옆문·대면 카운터·식탁·TV).",
        "2층: 남쪽 복도(계단통 — 아랫줄 밟으면 1층·실내 건조대) · 부부 침실(더블 침대·화장대·옷장) · 화장실 · 아이방(이층침대·공부 책상·벽장) — 방마다 가로 칸막이 1칸 틈에 열린 문.",
        "평면 문자열과 가구 id 는 tiledata/jp-city/interior/examples/house-1f.json·house-2f.json — build_hand_interior_room({tileset:\"jp_city\"}) 인자 그대로."],
      limitations: "실내만이다 — 현관 밖 이동은 비어 있다(거리 맵에 붙일 때 1층 맨 아래 틈 칸에 links 를 단다). 가족 NPC·이벤트 없음." },
    { file: "apartment-1k", placeId: "jp-city-apartment-1k-12x13", name: "일본 원룸 아파트(1K) 실내", maps: [APT], main: APT,
      rules: ["현관 타타키(좁은 신발장·문턱) → 부엌 복도(싱크·조리대·가스대·냉장고·세탁기) · 서쪽 유닛 배스(욕조+변기, 미닫이 옆문) · 문 → 북쪽 방(침대·TV·좌탁).",
        "평면·가구는 tiledata/jp-city/interior/examples/apartment-1k.json."],
      limitations: "실내만이다 — 현관 밖 이동은 비어 있다. NPC·이벤트 없음." },
    ...PLACES2.map((p) => ({ file: p.file, placeId: p.placeId, name: p.name, maps: [`jp-city-${p.file}`], main: `jp-city-${p.file}`, rules: p.rules,
      limitations: "실내만이다 — 거리 건물 문과는 link_jp_city_interior 로 잇는다. 점원·손님 NPC·이벤트 없음." })),
  ];
  for (const g of groups) {
    const proj = structuredClone(tpl);
    proj.meta.title = g.name;
    proj.tilesets = { jp_city: { ...structuredClone(TS), referenceDocuments: structuredClone(TS.referenceDocuments ?? []) } };
    proj.maps = Object.fromEntries(g.maps.map((id) => [id, project.maps[id]]));
    proj.mapTree = { mapId: g.main, children: g.maps.filter((id) => id !== g.main).map((mapId) => ({ mapId, children: [] })) };
    const main = results.find((r) => r.m.id === g.main);
    proj.startMapId = g.main; proj.startPos = { x: main.m.start[0], y: main.m.start[1] };
    proj.mapConnections = [];
    fs.writeFileSync(join(REGION_DIR, `jp-city-${g.file}.oprn.json`), JSON.stringify(proj));
    fs.copyFileSync(join(ROOT, `verify-shots/jp-city/interior-${main.m.file}-1x.png`), join(REGION_DIR, `jp-city-${g.file}.png`));
    fs.writeFileSync(join(ROOT, `src/project/regionReferences/jp-city-${g.file}.json`), JSON.stringify({ map: project.maps[g.main], tileset: slim }));
    arr = arr.filter((e) => e.id !== g.placeId);
    arr.push({ id: g.placeId, name: g.name, kind: "completed-place", placeKind: "facility", revision: 1, x: 0, y: 0, width: main.MAP.width, height: main.MAP.height, tilesetId: "jp_city",
      preview: `/assets/region-references/jp-city-${g.file}.png`, tilesetPreview: "/assets/jp-city/jp-city-chipset.png", projectDownload: `/assets/region-references/jp-city-${g.file}.oprn.json`,
      sourceProjectId: `oprn-bundled-jp-city-${g.file}`, sourceMapId: g.main, snapshotProjectId: `oprn-place-jp-city-${g.file}-v1`, rules: g.rules, limitations: g.limitations });
    if (!snap.includes(`"${g.placeId}"`)) {
      const anchor = `  "jp-city-shopstreet-48x40": () => import("./regionReferences/jp-city-shopstreet.json"),\n`;
      if (!snap.includes(anchor)) { console.error("regionReferenceSnapshots.ts 에 로더를 붙일 자리를 못 찾았다"); process.exit(2); }
      snap = snap.replace(anchor, anchor + `  "${g.placeId}": () => import("./regionReferences/jp-city-${g.file}.json"),\n`);
    }
    console.log("publish", { placeId: g.placeId, maps: g.maps });
  }
  fs.writeFileSync(tsPath, "// Generated by scripts/content/jp-city/maps/*.mjs --publish. 일본 도시(jp_city) 예제 under 장소; snapshots in regionReferences/jp-city-*.json.\nexport const JP_CITY_PLACE_REFERENCES = " + JSON.stringify(arr, null, 2) + " as const;\n");
  fs.writeFileSync(snapPath, snap);
}
