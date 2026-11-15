// jp_city 새 거리 계획 뽑기(모델·칩셋 없음) — 계획(단계·건물·바닥 가족·놓인 조각)과 규칙 검사 결과를 JSON 으로.
//   bun scripts/qa/jpStreetPlanDump.mts --kind arcade --seed 1 --key game-a [--w 60 --h 48] --out plan.json     한 장(오프시트 그리기용: 조각 PNG 로 그린다)
//   bun scripts/qa/jpStreetPlanDump.mts --audit --seeds 40 [--w 60 --h 48] --out audit.json                      종류마다 씨앗 여러 개의 검사·수치(그림 없음)
// 그림은 tiledata/jp-city/fable-street/pieces 의 조각 PNG 로 오프시트 그리기가 그린다(굽기 전에도 같은 그림이 나온다).
import { writeFileSync } from "node:fs";
import { planJpCityScene } from "../../src/project/jpCitySceneComposer.ts";
import { auditFable } from "../../src/project/jpCitySceneFable.ts";
import { Occ } from "../../src/project/jpCitySceneCtx.ts";
import { SCENE_KINDS } from "../../src/project/jpCitySceneKinds.ts";
import { GROUND_FAMILIES, STREET_PIECES } from "../../src/project/jpCityStreetPieces.ts";

const arg = (k: string, d?: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const W = Number(arg("w", "60")), H = Number(arg("h", "48"));
const STYLE: Record<string, "shopping" | "residential" | "shitamachi" | "shotengai"> = {};
for (const k of SCENE_KINDS) STYLE[k.id] = k.styles[0] as never;

const TARMAC = GROUND_FAMILIES.indexOf("tarmac");
/** 그 칸을 지나는 아스팔트가 가로·세로 모두 두 칸 넘게 이어지는가(한 칸 폭 자투리가 아닌가). */
function wide(g: Uint8Array, x: number, y: number): boolean {
  let h = 1, v = 1;
  for (let k = x - 1; k >= 0 && g[y * W + k] === TARMAC; k--) h++;
  for (let k = x + 1; k < W && g[y * W + k] === TARMAC; k++) h++;
  for (let k = y - 1; k >= 0 && g[k * W + x] === TARMAC; k--) v++;
  for (let k = y + 1; k < H && g[k * W + x] === TARMAC; k++) v++;
  return Math.min(h, v) >= 2;
}
function one(kind: string, seed: number, key: string) {
  const plan = planJpCityScene({ mapId: "m", width: W, height: H, seed, key, kind, style: STYLE[kind] ?? "shopping", fable: true });
  const f = plan.fable!;
  const audit = auditFable(f);
  let road = 0, bare = 0;
  const thing = new Uint8Array(W * H);
  for (const p of plan.placed) for (let y = p.y; y <= p.foot; y++) for (let x = p.x; x < p.x + p.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) thing[y * W + x] = 1;
  for (const p of f.placed) if (STREET_PIECES[p.name]?.layer !== "floor" && STREET_PIECES[p.name]?.layer !== "ground") for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) thing[y * W + x] = 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (GROUND_FAMILIES[f.gfam[i]!] === "tarmac" && f.occ[i] === Occ.Road && !thing[i]) { if (wide(f.gfam, x, y)) road++; continue; }   // jpStreetMeasure 와 같은 뜻: 폭 두 칸이 넘는 아스팔트(차도·주차장) 가운데 차가 덮지 않은 칸. 생활도로 포장은 차도 몫이 아니다
    if (thing[i] || ["water", "lane", "laneside"].includes(GROUND_FAMILIES[f.gfam[i]!]!) || f.occ[i] === Occ.Road) continue;   // 물·길은 죽은 띠가 아니다
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && thing[yy * W + xx]) { near = true; break; } }
    if (!near) bare++;
  }
  const looks = plan.placed.filter((p) => p.kit).map((p) => p.kit!.look ?? p.kit!.id);
  const rows = new Map<number, number>();
  for (const p of plan.placed) if (p.kit && p.kit.cat !== "house" && p.kit.cat !== "apartment") rows.set(p.foot, (rows.get(p.foot) ?? 0) + 1);
  const standing = f.placed.filter((p) => !["run", "floor"].includes(p.anchor) && STREET_PIECES[p.name]?.layer !== "ground");
  return {
    plan, audit,
    numbers: {
      kind, seed, buildings: plan.placed.length, distinctLooks: new Set(looks).size, repeatedLooks: looks.length - new Set(looks).size, oldKits: plan.placed.filter((p) => p.kit && !p.kit.id.startsWith("jp-bldg-f-")).length,
      shopsInLongestRow: Math.max(0, ...rows.values()), props: standing.length, distinctProps: new Set(standing.map((p) => p.look)).size,
      roadShare: road / (W * H), deadShare: bare / (W * H), runs: f.runs.length, gates: f.runs.reduce((a, r) => a + r.gates.length, 0) + f.kaki.filter((k) => k.gate).length, kakiGates: f.kaki.filter((k) => k.gate).length, kakiWalls: f.kaki.filter((k) => !k.gate).length, violations: audit.length,
    },
  };
}

if (process.argv.includes("--audit")) {
  const n = Number(arg("seeds", "20"));
  const rows: unknown[] = [], kinds: Record<string, number> = {}, worst: string[] = [], byRule: Record<string, number> = {};
  for (const k of SCENE_KINDS) for (let seed = 1; seed <= n; seed++) {
    const key = `game-${"abcdefgh"[seed % 8]}`;
    const r = one(k.id, seed, key);
    rows.push(r.numbers);
    for (const v of r.audit) { const t = v.split(" ")[0]!; kinds[t] = (kinds[t] ?? 0) + 1; if ((byRule[t] = (byRule[t] ?? 0) + 1) <= 6) worst.push(`${k.id}#${seed} ${v}`); }
  }
  writeFileSync(arg("out", "audit.json")!, JSON.stringify({ W, H, seeds: n, rows, violationsByRule: kinds, examples: worst }));
  console.log("maps", rows.length, "violations", JSON.stringify(kinds));
} else {
  const r = one(arg("kind", "kawazoi")!, Number(arg("seed", "1")), arg("key", "game-a")!);
  const f = r.plan.fable!;
  writeFileSync(arg("out", "plan.json")!, JSON.stringify({
    W, H, seed: Number(arg("seed", "1")), kind: r.plan.kind.id, kindKo: r.plan.kind.ko, summary: r.plan.summary, numbers: r.numbers, audit: r.audit,
    steps: r.plan.steps.map((s) => ({ tool: s.tool, note: s.note, args: s.args })),
    placed: r.plan.placed.map((p) => ({ id: p.kit?.id, role: p.role, x: p.x, y: p.y, w: p.w, h: p.h, foot: p.foot, doors: p.doors })),
    gfam: [...f.gfam], occ: [...f.occ], walkRows: r.plan.walkRows,
  }));
  console.log(JSON.stringify(r.numbers), "audit", r.audit.slice(0, 12));
}
