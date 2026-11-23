// 맵 다양성 판(모델 없음, 2026-11-23 map-variety): 서로 다른 요청 20개마다 첫 판 MVP 의 세 장소(마을·숲·동굴)를
// 지금 빌더로 지어 1배 PNG·품질 지표·구조 격자를 남기고, 종류별 20×20 구조 유사도 행렬을 낸다.
//   bun scripts/qa/assistant-v2/mapVariety.mts <outDir> [--tag before]
// make_place 가 넣는 값을 흉내 낸다: variety = `<프로젝트 열쇠>|<요청문>`, salt = 요청 해시(실제는 무작위 — 전/후 비교용으로 고정).
// 장소 명세는 청사진 버들항 고전 종류(world.ts beodeul: village·deep-forest·cave)에 모델이 붙였을 법한 이름만 더한 것이다.
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { createBuildRun } from "../../../src/ai/v2/shared/buildRun.ts";
import { builderFor } from "../../../src/ai/v2/place/builders/index.ts";
import { quality } from "./mapQuality.mts";
import { structureGrid, structureSimilarity, type StructureGrid } from "../../../src/ai/v2/place/structureSimilarity.ts";
import type { PlaceSpec } from "../../../src/ai/v2/shared/types.ts";
import type { ToolContext } from "../../../src/editor/tools/types.ts";

const argv = process.argv.slice(2).filter((a) => a !== "--");
const opt = (name: string, d: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1]! : d; };
const out = argv.find((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1]!.startsWith("--"))) ?? "qa-runs/map-variety";
const tag = opt("tag", "now");
const only = opt("only", "");
fs.mkdirSync(out, { recursive: true });

/** 요청 20개 — [요청문, 마을 이름, 숲 이름, 동굴 이름]. 장르 안(판타지 모험 여럿)과 장르 밖(경영·농장·공포·미스터리·동화)을 섞었다. */
export const VARIETY_REQUESTS: readonly (readonly [string, string, string, string])[] = [
  ["용사가 마을에서 출발해 숲 너머 동굴의 마물을 물리치는 모험 게임을 만들어 줘.", "별빛 마을", "북쪽 숲길", "마물의 동굴"],
  ["강가 방앗간 마을에서 사라진 동생을 찾아 숲과 동굴을 헤매는 이야기.", "방앗간 마을", "물안개 숲", "메아리 동굴"],
  ["바닷가 어촌에서 시작해 해적이 숨긴 보물을 찾는 게임.", "갈매기 포구", "해송 숲", "해적의 동굴"],
  ["언덕 위 포도밭 마을의 수확 축제에서 벌어지는 미스터리.", "포도 언덕 마을", "덩굴 숲", "술 창고 동굴"],
  ["늪지 마을에서 벌어지는 마녀 사냥 이야기.", "안개 늪 마을", "썩은 나무 숲", "마녀의 굴"],
  ["장터가 열리는 교역 마을에서 상인이 되어 돈을 버는 경영 게임.", "장터 마을", "상인의 숲길", "도적 소굴"],
  ["성벽으로 둘러싸인 요새 마을을 지키는 전쟁 RPG.", "성벽 요새 마을", "전장 숲", "적의 땅굴"],
  ["흩어진 농가 몇 채뿐인 산골에서 보내는 느긋한 농장 생활.", "산골 농가", "고사리 숲", "버섯 동굴"],
  ["울창한 숲속 나무꾼 마을의 정령 이야기.", "나무꾼 마을", "정령의 숲", "뿌리 동굴"],
  ["광부 마을 아래 폐광으로 내려가는 공포 게임.", "광부 마을", "검은 숲", "버려진 갱도"],
  ["개울이 흐르는 숲에서 요정을 찾는 동화.", "개울가 마을", "요정의 개울 숲", "반딧불 동굴"],
  ["절벽 아래 숲길을 지나 산 위 사원으로 가는 순례.", "순례자 마을", "절벽 숲길", "사원 아래 굴"],
  ["지하 호수가 있는 동굴에서 잃어버린 왕관을 찾는 모험.", "호숫가 마을", "이끼 숲", "지하 호수 동굴"],
  ["갈래길이 많은 미로 동굴에서 탈출하는 퍼즐 게임.", "출구 마을", "갈림길 숲", "미로 동굴"],
  ["작은 강변 마을의 다리를 고치며 이웃과 친해지는 힐링 게임.", "강변 마을", "산책 숲", "다리 밑 동굴"],
  ["광장 한가운데 오래된 우물이 있는 마을의 비밀.", "우물 광장 마을", "속삭이는 숲", "우물 아래 동굴"],
  ["사냥꾼이 되어 깊은 숲의 거대한 늑대를 쫓는 게임.", "사냥꾼 마을", "늑대의 숲", "늑대 굴"],
  ["교차로에 선 여관 마을에 모이는 여행자들의 이야기.", "네거리 여관 마을", "여행자의 숲길", "옛 굴"],
  ["쇠락한 옛 왕국의 폐허 마을에서 시작하는 복수극.", "폐허 마을", "잿빛 숲", "왕의 지하 굴"],
  ["봄 꽃이 피는 공터에서 친구들과 소풍 가는 짧은 이야기.", "꽃마을", "꽃 공터 숲", "작은 굴"],
];

const KINDS = [
  { id: "village", spec: (name: string): Omit<PlaceSpec, "salt"> => ({ type: "village", theme: "river", size: "small", name }) },
  { id: "forest", spec: (name: string): Omit<PlaceSpec, "salt"> => ({ type: "dungeon", theme: "forest", size: "small", name }) },
  { id: "cave", spec: (name: string): Omit<PlaceSpec, "salt"> => ({ type: "cave", size: "small", name }) },
] as const;

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

const rows: Record<string, unknown>[] = [];
const grids: Record<string, StructureGrid[]> = { village: [], forest: [], cave: [] };
// --merge <접두사>: 갈래로 나눠 돌린 <접두사>-s*.json 을 합쳐 <tag>.json 하나로(행렬은 격자에서 다시 잰다).
const merge = opt("merge", "");
if (merge) {
  const parts = fs.readdirSync(out).filter((f) => f.startsWith(`${merge}-s`) && f.endsWith(".json")).sort();
  for (const f of parts) rows.push(...(JSON.parse(fs.readFileSync(path.join(out, f), "utf8")) as { rows: Record<string, unknown>[] }).rows);
  rows.sort((a, b) => Number(a.i) - Number(b.i) || KINDS.findIndex((k) => k.id === a.kind) - KINDS.findIndex((k) => k.id === b.kind));
  for (const r of rows) if (typeof r.grid === "string") grids[String(r.kind)]!.push({ n: 24, cells: new Uint8Array(Buffer.from(r.grid, "base64")) });
  console.log(`merged ${parts.length} shard(s), ${rows.length} rows`);
}
// --gate: 한 게임에 같은 종류 장소를 여럿 지어 생성물끼리 관문이 문법·씨앗을 바꾸는지 본다(요청·이름에 모양 낱말 없음).
if (opt("gate", "")) {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: undefined as unknown as string, assistantRun: true };
  const request = "용사가 마물을 물리치는 모험 게임";
  const built: { name: string; kind: string; id: string }[] = [];
  // --gate same: 이름 낱말이 같아 같은 문법이 골라지는 장소들 — 관문이 실제로 걸려 문법·씨앗을 바꾸는지 본다.
  const same = opt("gate", "") === "same";
  const sets = same
    ? [["forest", ["개울 숲 하나", "개울 숲 둘", "개울 숲 셋"]], ["cave", ["지하 호수 동굴 하나", "지하 호수 동굴 둘", "지하 호수 동굴 셋"]], ["village", ["광장 마을 하나", "광장 마을 둘"]]] as const
    : [["forest", ["첫째 숲", "둘째 숲", "셋째 숲"]], ["cave", ["첫째 동굴", "둘째 동굴", "셋째 동굴"]], ["village", ["첫째 마을", "둘째 마을"]]] as const;
  for (const [kind, names] of sets) {
    for (const name of names) {
      const run = createBuildRun(ctx);
      const k = KINDS.find((x) => x.id === kind)!;
      const spec: PlaceSpec = { ...k.spec(name), salt: hash(name) % 1_000_000, variety: `["project","gate"]|${request}` } as PlaceSpec;
      const res = builderFor(spec)!.build(run, spec);
      const map = res.mapIds[0] ? ctx.project.maps[res.mapIds[0]] : undefined;
      if (!map) { console.log(`${name} no map ${res.summary}`); continue; }
      const file = `${tag}-${kind}-${built.length}.png`;
      fs.writeFileSync(path.join(out, file), renderMapPng(ctx.project, map).png);
      const twin = built.filter((b) => b.kind === kind).map((b) => ({ name: b.name, s: structureSimilarity(structureGrid(ctx.project, map), structureGrid(ctx.project, ctx.project.maps[b.id]!)) }));
      rows.push({ name, kind, file, summary: String(res.summary).slice(0, 400), sameKind: twin, ...quality(ctx.project, map) });
      console.log(`${name}: ${String(res.summary).slice(0, 220)} | 같은 종류와 ${twin.map((t) => `${t.name} ${t.s.toFixed(2)}`).join(", ")}`);
      built.push({ name, kind, id: map.id });
    }
  }
  fs.writeFileSync(path.join(out, `${tag}.json`), JSON.stringify({ tag, rows }, null, 1));
  console.log(`DONE ${path.join(out, `${tag}.json`)}`);
  process.exit(0);
}
for (const [i, req] of merge ? [] : [...VARIETY_REQUESTS.entries()]) {
  if (only && !only.split(",").includes(String(i))) continue;
  const [request, ...names] = req;
  for (const [k, kind] of KINDS.entries()) {
    const project = createBlankProject();
    const ctx: ToolContext = { project, currentMapId: undefined as unknown as string, assistantRun: true };
    const run = createBuildRun(ctx);
    const spec: PlaceSpec = { ...kind.spec(names[k]!), salt: hash(`${request}|${kind.id}`) % 1_000_000, variety: `["project","mv${i}"]|${request}` } as PlaceSpec;
    const t0 = Date.now();
    let res;
    try { res = builderFor(spec)!.build(run, spec); } catch (e) { rows.push({ i, kind: kind.id, error: (e as Error).stack?.slice(0, 600) }); console.log(`${i} ${kind.id} ERR ${(e as Error).message}`); continue; }
    const id = res.mapIds[0];
    const map = id ? ctx.project.maps[id] : undefined;
    if (!map) { rows.push({ i, kind: kind.id, error: `no map: ${res.summary}` }); console.log(`${i} ${kind.id} no map ${String(res.summary).slice(0, 200)}`); continue; }
    const file = `${tag}-${kind.id}-${String(i).padStart(2, "0")}.png`;
    fs.writeFileSync(path.join(out, file), renderMapPng(ctx.project, map).png);
    const g = structureGrid(ctx.project, map);
    grids[kind.id]!.push(g);
    const q = quality(ctx.project, map);
    const row = { i, kind: kind.id, name: names[k], file, ms: Date.now() - t0, ...q, summary: String(res.summary).slice(0, 300), grid: Buffer.from(g.cells).toString("base64") };
    rows.push(row);
    console.log(`${i} ${kind.id} ${q.size} bare ${q.bare} props ${q.props100} reach ${q.reach} ${row.ms}ms · ${String(res.summary).slice(0, 120)}`);
  }
}

const matrices: Record<string, { n: number; matrix: number[][]; mean: number; max: number }> = {};
for (const [kind, gs] of Object.entries(grids)) {
  const matrix = gs.map((a) => gs.map((b) => Math.round(structureSimilarity(a, b) * 1000) / 1000));
  const off = matrix.flatMap((r, a) => r.filter((_, b) => b !== a));
  matrices[kind] = { n: gs.length, matrix, mean: off.length ? Math.round((1000 * off.reduce((x, y) => x + y, 0)) / off.length) / 1000 : 0, max: off.length ? Math.max(...off) : 0 };
  console.log(`== ${kind}: n ${gs.length} mean ${matrices[kind]!.mean} max ${matrices[kind]!.max}`);
}
fs.writeFileSync(path.join(out, `${tag}.json`), JSON.stringify({ tag, rows, matrices }, null, 1));
console.log(`DONE ${path.join(out, `${tag}.json`)}`);
