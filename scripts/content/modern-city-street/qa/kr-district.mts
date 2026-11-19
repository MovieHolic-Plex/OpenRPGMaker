// 한국 지구 구성기 탐침(모델 없음) — compose_modern_city_street 도구 그대로 지어 칸 배열 JSON 과 수치 표를 낸다.
//   bun scripts/content/modern-city-street/qa/kr-district.mts OUT.json [--kinds a,b|all] [--seeds 1,2] [--size 60x48] [--keys k1,k2] [--old]
//   그림: python3 scripts/content/modern-city-int/qa/render_map.py OUT.json DIR
// 수치: 건물 수 · 차도 몫 · 잔디 몫 · 놓인 기물 · 기물 종류 · 건물도 기물도 없는 20×15 창 · 이웃 건물 높이가 같은 비율.
import { writeFileSync } from "node:fs";
import { COMPOSE_MODERN_CITY_STREET_TOOL } from "@/editor/tools/modernCityTools";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { createModernCityTileset } from "@/project/defaults/modernCity";
import { withKitLook } from "@/project/kitLook";
import { isPassable } from "@/project/collision";
import { carLaneCells, walkerRoute } from "@/editor/tools/streetWalkersTool";
import { KR_DISTRICT_KINDS } from "@/project/modernCityDistrictKinds";

const argv = process.argv.slice(2);
const opt = (name: string, d: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1]! : d; };
const out = argv[0]!;
const [W, H] = opt("size", "60x48").split("x").map(Number) as [number, number];
const seeds = opt("seeds", "1").split(",").map(Number);
const kindsArg = opt("kinds", "all");
const kinds = kindsArg === "all" ? KR_DISTRICT_KINDS.map((k) => k.id) : kindsArg.split(",");
const keys = opt("keys", "").split(",").filter(Boolean);
const old = argv.includes("--old");
const ts = createModernCityTileset();
// --fakekr: 한국 건물·옥상 키트가 아직 시트에 없을 때 급·제자리·옥상 장면 규칙을 재려고, 있는 키트를 한국 키트 이름·태그로 베껴 넣는다(그림은 옛 것 그대로 — 수치만 본다).
if (argv.includes("--fakekr")) {
  const kits = ts.structureKits as unknown as { id: string; name: string; width: number; height: number; ai?: Record<string, unknown> }[];
  const clone = (from: string, id: string, tags: string[], extra: Record<string, unknown> = {}) => { const k = kits.find((x) => x.id === from); if (k) kits.push({ ...k, id, name: id, ai: { ...(k.ai ?? {}), tags: ["country:kr", ...tags], ...extra } }); };
  const first = (type: string) => kits.find((k) => new RegExp(`^mc-bld-${type}-[A-C]`).test(k.id))?.id ?? "";
  for (const [type, kr, tier, prog] of [["conv", "conv", "small", "mc_konbini"], ["cafe", "cafe", "small", "mc_cafe"], ["shop", "pharmacy", "small", "mc_clothing"], ["low3", "sangga3", "medium", "mc_restaurant"], ["mid4", "sangga5", "medium", "mc_office"], ["apartment", "villa", "medium", "mc_house"], ["hospital", "hospital", "large", "mc_office"], ["dept", "dept", "xlarge", "mc_clothing"], ["school", "ktx", "xlarge", "mc_school_building"], ["office-wide", "univ", "xlarge", "mc_school_building"], ["tower10", "tower", "landmark", "mc_office"]] as const)
    clone(first(type), `mc-bld-kr-${kr}`, [`tier:${tier}`, `program:${prog}`], { program: prog });
  clone(first("shop"), "mc-bld-kr-clocktower", ["tier:landmark"]);
  const low = kits.find((k) => k.id === first("bakery"));
  if (low) clone(low.id, "mc-bld-kr-laundry", ["tier:small", "program:mc_bakery_cafe", "roof:empty"], { program: "mc_bakery_cafe", roofFace: { dx: 0, dy: 1, w: low.width, h: 1, empty: true } });
  clone("mc-prop-planter-a", "mc-roof-kr-garden", []); clone("mc-prop-trash-a", "mc-roof-kr-antenna", []);
}
// --fakeprops <jobs.json>: 한국 거리 기물이 아직 시트에 없을 때 구성기 배선(자리·묶음·바닥·표시·머리 위 줄)을 재려고, 그릴 목록(id·칸 종류·set·slot)대로 있는 칸을 빌려 키트를 지어 넣는다. 그림은 뜻이 없다 — 수치와 실패만 본다.
const fakeProps = argv.indexOf("--fakeprops") >= 0 ? argv[argv.indexOf("--fakeprops") + 1]! : "";
if (fakeProps) {
  const { readFileSync } = await import("node:fs");
  const jobs = (JSON.parse(readFileSync(fakeProps, "utf8")) as { jobs: { id: string; kind: string; cw: number; ch: number; passRows: string[]; set: string; slots?: string[]; most?: number | null }[] }).jobs;
  const kits = ts.structureKits as unknown as { id: string; name: string; width: number; height: number; rows: { tiles: number[]; upperTiles?: number[] }[]; ai?: Record<string, unknown> }[];
  const solid = ts.passability.findIndex((p, t) => t > 100 && p.up === false && ts.priority[t] === "upper");
  const star = ts.passability.findIndex((p, t) => t > 100 && p.up === true && ts.priority[t] === "upper");
  const flat = (ts.tileGroups!.find((g) => g.id === "mc:marking-manhole")?.tileIds ?? [53])[0]!;
  const floor = ts.tileGroups!.find((g) => g.id === "mc:plaza")!.tileIds;
  for (const j of jobs) {
    const ground = j.kind === "ground";
    const rows = j.passRows.map((row, y) => { const up = [...row].map((c) => (ground || c === " " ? -1 : c === "X" ? solid : c === "*" ? star : flat)); return { tiles: [...row].map((_, x) => (ground ? floor[(x + y) % floor.length]! : -1)), upperTiles: up }; });
    kits.push({ id: `mc-prop-kr-${j.id}`, name: j.id, width: j.cw, height: j.ch, rows, ai: { tags: ["country:kr", `set:${j.set}`, ...(j.slots ?? []).map((x) => `slot:${x}`), ...(j.most ? [`max:${j.most}`] : [])] } });
  }
}
const group = (id: string) => new Set(ts.tileGroups!.find((g) => g.id === id)?.tileIds ?? []);
const lawn = new Set([...group("mc:lawn"), ...[...group("mc:green")].slice(0, 3)]);
const roadIds = new Set<number>();
ts.tileMeta!.forEach((m, t) => { const tags = (m as { tags?: string[] })?.tags ?? []; if (tags.includes("road") && !tags.includes("walk")) roadIds.add(t); });
const waterIds = group("mc:water");      // 물길도 차도처럼 «기물이 설 수 없는 칸» 이다 — 빈 창을 셀 때 차도와 함께 뺀다
const kitOf = new Map(ts.structureKits!.map((k) => [k.id, k]));
const maps: Record<string, unknown> = {}; const rows: string[] = []; let bad = 0;
function one(id: string, args: Record<string, unknown>, key?: string, project = createEmptyToolProject("krd")) {
  project.tilesets.modern_city = ts;
  const walk = [...group("mc:sidewalk")][0]!;
  project.maps[id] = { id, name: id, width: W, height: H, tilesetId: "modern_city", tileSize: 16, lowerTiles: new Array(W * H).fill(walk), upperTiles: new Array(W * H).fill(-1), events: [] } as never;
  try {
    const r = withKitLook(key, () => COMPOSE_MODERN_CITY_STREET_TOOL.run(project, { mapId: id, ...args }));
    const m = project.maps[id]!; const data = r.data as { buildings: { rect: { x: number; y: number; w: number; h: number }; program: string | null }[]; propList: { kit: string; x: number; y: number }[]; district: { id: string; ko: string } | null; transitRoutes: number };
    const n = W * H; let road = 0, green = 0;
    for (let i = 0; i < n; i++) { const t = m.lowerTiles[i]!; if (roadIds.has(t)) road++; if (lawn.has(t)) green++; }
    const mark = new Uint8Array(n);
    for (const b of data.buildings) for (let y = b.rect.y; y < b.rect.y + b.rect.h; y++) for (let x = b.rect.x; x < b.rect.x + b.rect.w; x++) mark[y * W + x] = 1;
    for (const p of data.propList) { const k = kitOf.get(p.kit); if (!k) continue; for (let y = p.y; y < p.y + k.height; y++) for (let x = p.x; x < p.x + k.width; x++) if (x >= 0 && y >= 0 && x < W && y < H) mark[y * W + x] = 1; }
    let empty = 0;
    for (let y0 = 0; y0 + 15 <= H; y0++) for (let x0 = 0; x0 + 20 <= W; x0++) { let any = false; for (let y = y0; y < y0 + 15 && !any; y++) for (let x = x0; x < x0 + 20; x++) if (mark[y * W + x]) { any = true; break; } if (!any) empty++; }
    // 눈에 비어 보이는 자리: 건물·기물이 한 칸도 없는 8×6 창(차도·물 칸이 절반 넘는 창은 뺀다 — 차도는 달리는 차의 자리, 물은 물길이다). 겹치는 창을 한 덩이로 세려고 창이 덮는 칸 수도 낸다.
    let empty86 = 0; const bare = new Uint8Array(n);
    for (let y0 = 0; y0 + 6 <= H; y0++) for (let x0 = 0; x0 + 8 <= W; x0++) {
      let any = false, lanes = 0;
      for (let y = y0; y < y0 + 6 && !any; y++) for (let x = x0; x < x0 + 8; x++) { if (mark[y * W + x]) { any = true; break; } if (roadIds.has(m.lowerTiles[y * W + x]!) || waterIds.has(m.lowerTiles[y * W + x]!)) lanes++; }
      if (!any && lanes <= 24) { empty86++; for (let y = y0; y < y0 + 6; y++) for (let x = x0; x < x0 + 8; x++) bare[y * W + x] = 1; }
    }
    const bareCells = bare.reduce((a, c) => a + c, 0);
    // 건물 수는 그림으로 센다(실내 없는 풍경 건물 포함): 위층의 건물 키트 왼쪽 위 칸
    const lines = new Map<number, { x: number; h: number }[]>();
    for (const b of data.buildings) (lines.get(b.rect.y + b.rect.h) ?? lines.set(b.rect.y + b.rect.h, []).get(b.rect.y + b.rect.h)!).push({ x: b.rect.x, h: b.rect.h });
    let pairs = 0, same = 0;
    for (const l of lines.values()) { l.sort((p, q) => p.x - q.x); for (let i = 1; i < l.length; i++) { pairs++; if (l[i]!.h === l[i - 1]!.h) same++; } }
    const noProg = data.buildings.filter((b) => !b.program).length;
    const krB = data.buildings.filter((b) => (b as unknown as { kit: string }).kit.startsWith("mc-bld-kr-")).map((b) => (b as unknown as { kit: string }).kit.slice(10));
    const big = krB.filter((t) => ["dept", "ktx", "univ", "tower"].includes(t)), roofN = data.propList.filter((p) => p.kit.startsWith("mc-roof-kr-")).length, mon = data.propList.filter((p) => p.kit === "mc-bld-kr-clocktower").length;
    // 행인 길: 문 접근칸 쌍 열둘을 골라 행인 도구의 길 찾기(보도·횡단보도만, 차선은 못 지난다)로 이어지는지 잰다. 이어진 쌍의 시작 칸은 그림에 사람을 세울 자리다.
    const lanes = carLaneCells(project, m); const doors = data.buildings.map((b) => (b as unknown as { access: { x: number; y: number }[] }).access[0]!).filter(Boolean);
    let walkOk = 0, walkN = 0; const walkers: { x: number; y: number }[] = [];
    for (let k = 0; k < 12 && doors.length > 3; k++) {
      const a = doors[(k * 5) % doors.length]!, c = doors[(k * 5 + 3 + k) % doors.length]!; if (a === c) continue;
      walkN++; const route = walkerRoute(project, m, [{ x: a.x, y: a.y }, { x: c.x, y: c.y }], 560, lanes);
      if (route) { walkOk++; walkers.push(a); }
    }
    // 행인 섬: 걸을 수 있고 차선이 아닌 칸을 네 방향으로 이은 덩이 — 문 접근칸이 몇 덩이에 흩어져 있나(1 이어야 모든 문 사이를 걸어서 간다).
    const comp = new Int16Array(n).fill(-1); let comps = 0;
    for (let i0 = 0; i0 < n; i0++) {
      if (comp[i0] !== -1 || lanes.has(i0) || !isPassable(project, m, i0 % W, Math.floor(i0 / W))) continue;
      const q = [i0]; comp[i0] = comps;
      while (q.length) { const i = q.pop()!, x = i % W, y = (i - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const j = Y * W + X; if (comp[j] === -1 && !lanes.has(j) && isPassable(project, m, X, Y)) { comp[j] = comps; q.push(j); } } }
      comps++;
    }
    const islands = new Set(doors.map((d) => comp[d.y * W + d.x])).size;
    maps[id] = { comp: [...comp], walkers, width: W, height: H, lower: m.lowerTiles, lower2: m.lowerOverlayTiles ?? [], upper: m.upperTiles, upper2: m.upperOverlayTiles ?? [], data: r.data, transit: m.transit, bare: [...bare] };
    rows.push(`| ${id} | ${data.district?.ko ?? "도쿄풍 길"} | ${data.buildings.length} | ${(100 * road / n).toFixed(1)}% | ${(100 * green / n).toFixed(1)}% | ${data.propList.length} | ${new Set(data.propList.map((p) => p.kit)).size} | ${empty} | ${pairs ? Math.round(100 * same / pairs) : 0}% | ${data.transitRoutes} | ${noProg} | ${empty86} (${bareCells}칸) | ${walkOk}/${walkN} · 섬 ${islands} |` + (fakeProps ? ` 한국 기물 ${data.propList.filter((p) => p.kit.startsWith("mc-prop-kr-")).length}개 ${new Set(data.propList.filter((p) => p.kit.startsWith("mc-prop-kr-")).map((p) => p.kit)).size}종 |` : "") + (argv.includes("--fakekr") ? ` 한국 ${krB.length} · 큰 것 ${big.join(",") || "-"} · 옥상 ${roofN} · 기념물 ${mon} |` : ""));
  } catch (e) { bad++; rows.push(`| ${id} | FAIL ${(e as Error).message.slice(0, 160)} |`); }
  return project;
}
if (old) for (const s of seeds) one(`old-s${s}`, { seed: s, korean: true });
if (keys.length) for (const k of keys) { let p = createEmptyToolProject("krd"); for (const n of [1, 2, 3]) p = one(`key-${k}-${n}`, { seed: seeds[0]! + n, district: "auto" }, k, p); }
else for (const kind of kinds) for (const s of seeds) one(`${kind}-s${s}`, { seed: s, district: kind });
writeFileSync(out, JSON.stringify({ maps }));
console.log("| 맵 | 지구 | 건물 | 차도 | 잔디 | 기물 | 기물 종류 | 빈 20×15 창 | 이웃 같은 높이 | 차 노선 | 실내 없는 건물 | 빈 8×6 창 | 행인 길(문 쌍) |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n" + rows.join("\n"));
process.exitCode = bad;
