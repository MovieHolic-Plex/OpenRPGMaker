// 서양 도시 세트 킷이 낱말로 찾아지는가, 옛 킷이 제 낱말의 첫째 자리를 잃지 않는가(모델 없음).
//   bun scripts/content/modern-city-west/words.mts <굽기 전 modernCityTileset.json> [<결과 json>]
// 새 킷: 태그의 찾는 낱말(한국어·영어, 사양 words + 영어 이름)마다 existingMatches 첫째가 그 킷인지. 같은 낱말을 나눠 가진 새 킷끼리는(차양·광고판 등) 묶음 안 어느 것이든 첫째면 된다.
// 옛 킷: 이름·태그마다 «굽기 전 정의의 첫째» 와 «지금의 첫째» 가 같은지.
import fs from "node:fs";
import { createBlankProject } from "../../../src/project/defaults/blankProject";
import { existingMatches } from "../../../src/editor/tools/objectGenTool";
import type { Project, StructureKitDef, TilesetDef } from "../../../src/project/types";

const [basePath, outPath] = process.argv.slice(2);
const project = createBlankProject() as Project;
const ts = project.tilesets.modern_city as TilesetDef;
const kits = (ts.structureKits ?? []) as StructureKitDef[];
const isNew = (id: string) => id.startsWith("mc-bld-w-") || id.startsWith("mc-prop-w-");
const META = /^(modern-city|building|prop-street|서양|서양 도시|북미 중심가|유럽 구시가|소형|중형|대형|초대형|랜드마크|prop|flat|over)$|:/u;
const SETS = new Set(["중심가 보도", "가게 앞", "카페 테라스", "장터 좌판", "공원", "뒷골목", "공사장", "전차·버스 정류장", "계절 장식", "옥상", "농장", "과수원", "포도밭", "시골 길가", "마을 풀밭"]);
const rows: { kit: string; word: string; first?: string; ok: boolean }[] = [];
for (const kit of kits.filter((k) => isNew(k.id))) {
  const words = [...new Set((kit.ai?.tags ?? []).filter((t) => !META.test(t) && !SETS.has(t)))];
  for (const word of words) {
    const first = existingMatches(project, ts, word)[0]?.id;
    const sharers = new Set(kits.filter((k) => isNew(k.id) && (k.ai?.tags ?? []).includes(word)).map((k) => k.id));
    rows.push({ kit: kit.id, word, first, ok: first !== undefined && sharers.has(first) });
  }
}
const bad = rows.filter((r) => !r.ok);
const reached = new Set(rows.filter((r) => r.first === r.kit).map((r) => r.kit));
const all = kits.filter((k) => isNew(k.id));
console.log(`새 킷 ${all.length}종 · 낱말 ${rows.length}개 — 새 킷이 첫째 ${rows.length - bad.length} · 옛 킷이 첫째(또는 없음) ${bad.length}`);
console.log(`낱말 하나로라도 첫째에 닿는 킷 ${reached.size}/${all.length}${reached.size < all.length ? ` — 못 닿는 킷: ${all.filter((k) => !reached.has(k.id)).map((k) => k.id).join(", ")}` : ""}`);
for (const r of bad) console.log(`  ${r.kit} «${r.word}» → 첫째 ${r.first ?? "없음"}`);
let lost: { word: string; before?: string; now?: string }[] = [];
if (basePath) {
  const before = createBlankProject() as Project;
  const base = JSON.parse(fs.readFileSync(basePath, "utf8")) as TilesetDef;
  const bts = { ...(before.tilesets.modern_city as TilesetDef), structureKits: base.structureKits } as TilesetDef;
  before.tilesets.modern_city = bts;
  const oldWords = new Set<string>();
  for (const kit of (base.structureKits ?? []) as StructureKitDef[]) { oldWords.add(kit.name); for (const t of kit.ai?.tags ?? []) if (!/^(modern-city|building|prop-street)$/.test(t)) oldWords.add(t); }
  for (const word of oldWords) {
    const a = existingMatches(before, bts, word)[0]?.id, b = existingMatches(project, ts, word)[0]?.id;
    if (a !== b) lost.push({ word, before: a, now: b });
  }
  console.log(`옛 킷 이름·태그 ${oldWords.size}개 — 첫째가 바뀐 것 ${lost.length}`);
  for (const l of lost.slice(0, 30)) console.log(`  «${l.word}» ${l.before ?? "없음"} → ${l.now ?? "없음"}`);
}
if (outPath) fs.writeFileSync(outPath, JSON.stringify({ rows, lost }, null, 1));
