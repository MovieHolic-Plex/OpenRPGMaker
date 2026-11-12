// 이야기 수요 재고(모델 없음) — 번들 칩셋마다 «단계가 자주 쓰는 물건 다섯 갈래» 에 맞는 키트가 이미 있는지 키트에서 잰다. 그리지 않는다.
//
//   bun scripts/content/story-objects/needs.mts <out.json>
//
// 재는 법: 일지·레버·내려가는 길·방 사이 문은 조수가 실제로 쓰는 찾기(existingMatches — 키트 이름·꼬리표)에 needs.json 의 낱말을 물어 위 3건,
// 내려가는 길·문은 칩셋 표면 계약(tilesetSurface 의 stairs·doors 칸으로만 된 키트)도 함께. 큰 중심 기물은 낱말이 아니라 크기(입구 없는 물건 키트 6~20칸).
// 낱말·제외·건너뛸 칩셋은 needs.json 에 있다 — 여기 코드에 낱말 목록은 없다. 엉뚱한 적중은 needs.json 의 exclude 로 뺀다(뺀 것도 결과에 남긴다).
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults";
import { existingMatches } from "../../../src/editor/tools/objectGenTool";
import { tilesetSurface } from "../../../src/project/tilesetSurface";
import type { Project, StructureKitDef, TilesetDef } from "../../../src/project/types";

const outFile = process.argv[2];
if (!outFile) { console.error("usage: needs.mts <out.json>"); process.exit(2); }
const HERE = path.dirname(new URL(import.meta.url).pathname);
const conf = JSON.parse(fs.readFileSync(path.join(HERE, "needs.json"), "utf8")) as { needs: Record<string, { label: string; words: string[]; maxCells: number }>; exclude: string; natureLike: string; skip: string };
const EXCLUDE = new RegExp(conf.exclude, "iu"), NATURE = new RegExp(conf.natureLike, "iu"), SKIP = new RegExp(conf.skip, "u");
/** 물건이 아닌 그림의 역할(건물·벽·바닥·물) — 조수 v2 의 그림 찾기(place/fixtures)와 같은 갈래. */
const NOT_A_THING = new Set(["building", "wall", "roof", "terrain", "floor", "fence", "water", "stairs", "castle", "structure", "empty"]);
const project = createBlankProject() as Project;
type Hit = { id: string; name: string; size: string; by: string };
const out: Record<string, unknown> = {};
for (const [id, tileset] of Object.entries(project.tilesets)) {
  const ts = tileset as TilesetDef; const kits = (ts.structureKits ?? []) as StructureKitDef[];
  if (SKIP.test(id) || kits.length < 20) continue;
  const meta = (ts.tileMeta ?? []) as ({ role?: string } | undefined)[];
  const tiles = (k: StructureKitDef) => k.rows.flatMap((r) => [...(r.tiles ?? []), ...(r.upperTiles ?? [])]).filter((t) => t >= 0);
  const entrance = (k: StructureKitDef) => ((k as { parts?: { kind?: string }[] }).parts ?? []).some((p) => p.kind === "entrance");
  const cells = (k: StructureKitDef) => (k.width ?? 1) * (k.height ?? 1);
  const thing = (k: StructureKitDef) => !entrance(k) && !NOT_A_THING.has(k.ai?.role ?? "") && tiles(k).length > 0 && tiles(k).every((t) => !NOT_A_THING.has(meta[t]?.role ?? ""));
  const row = (k: StructureKitDef, by: string): Hit => ({ id: k.id, name: k.name ?? k.id, size: `${k.width}×${k.height}`, by });
  const byId = new Map(kits.map((k) => [k.id, k]));
  const surface = tilesetSurface(ts);
  const dropped: Hit[] = [];
  const keep = (hits: Hit[]) => hits.filter((h) => { const bad = EXCLUDE.test(`${h.id} ${h.name}`); if (bad) dropped.push(h); return !bad; });
  const byWords = (need: string, ok: (k: StructureKitDef) => boolean) => {
    const spec = conf.needs[need]!; const hits = new Map<string, string>();
    for (const word of spec.words) for (const m of existingMatches(project, ts, word).slice(0, 3)) { const k = byId.get(m.id); if (k && ok(k) && cells(k) <= spec.maxCells && !hits.has(k.id)) hits.set(k.id, word); }
    return keep([...hits].map(([kid, word]) => row(byId.get(kid)!, `«${word}»`)));
  };
  const allOf = (set: ReadonlySet<number>, max: number) => keep(kits.filter((k) => !entrance(k) && tiles(k).length > 0 && tiles(k).every((t) => set.has(t)) && cells(k) <= max).map((k) => row(k, "표면 계약")));
  const merge = (a: Hit[], b: Hit[]) => [...a, ...b.filter((h) => !a.some((x) => x.id === h.id))];
  const centre = kits.filter((k) => thing(k) && cells(k) >= 6 && cells(k) <= 20 && !NATURE.test(`${k.id} ${k.name ?? ""}`)).sort((a, b) => cells(b) - cells(a) || a.id.localeCompare(b.id));
  out[id] = {
    name: ts.name, kits: kits.length,
    log: byWords("log", thing), lever: byWords("lever", thing),
    down: merge(allOf(surface.stairs, 9), byWords("down", (k) => !entrance(k))),
    door: merge(allOf(surface.doors, 6), byWords("door", (k) => !entrance(k) && k.ai?.role !== "building")),
    centre: centre.slice(0, 6).map((k) => row(k, `${cells(k)}칸`)), centreCount: centre.length, largestCells: centre[0] ? cells(centre[0]) : 0,
    dropped,
  };
}
fs.writeFileSync(outFile, JSON.stringify({ needs: conf.needs, chipsets: out }, null, 1));
for (const [id, v] of Object.entries(out as Record<string, Record<string, Hit[]> & { kits: number; centreCount: number; largestCells: number }>)) {
  console.log(`${id} (키트 ${v.kits}) 일지 ${v.log!.length} · 레버 ${v.lever!.length} · 내려가는 길 ${v.down!.length} · 문 ${v.door!.length} · 큰 기물 ${v.centreCount}(가장 큰 것 ${v.largestCells}칸)`);
}
