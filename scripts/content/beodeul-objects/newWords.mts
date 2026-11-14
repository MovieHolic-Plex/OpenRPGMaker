// 새 종류 기물(2026-11-14)이 낱말로 찾아지는가(모델 없음): 킷마다 그 킷의 낱말(한국어·영어, catalog words)을 조수의 «이미 있는 물건 찾기»
// (existingMatches — draw_object·generate_missing_object 가 «이미 있다 → 그 킷» 으로 이르는 길)와 list_tileset_objects(query) 에 물어
// 그 킷이 첫째로 오는지·목록에 드는지 적는다. 낱말 목록은 코드가 아니라 킷 태그(spec words)다.
//
//   bun scripts/content/beodeul-objects/newWords.mts [--waiver <묶음 id>] [--old] [<결과 json>]
import fs from "node:fs";
import { createBlankProject } from "../../../src/project/defaults/blankProject";
import { existingMatches } from "../../../src/editor/tools/objectGenTool";
import { runTool } from "../../../src/editor/tools";
import type { Project } from "../../../src/project/types";
import catalog from "../../../tiledata/beodeul-objects/catalog.json";

// 묶음: 기본은 새 종류 105종(fable-objects100-…). `--waiver fable-objects300-beodeul-2026-11-14` 로 마을 종류별 기물을 묻는다. `--old` 는 옛 킷의 이름 조각·태그마다
// «이 묶음을 뺀 타일셋의 첫째» 와 «지금의 첫째» 가 같은지 본다(옛 킷이 제 낱말의 첫째 자리를 잃지 않는다).
const argv = process.argv.slice(2);
const flag = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
const WAIVER = flag("--waiver") ?? "fable-objects100-beodeul-2026-11-14";
const OLD = argv.includes("--old") ? (argv.splice(argv.indexOf("--old"), 1), true) : false;
const NEW = (catalog.items as { id: string; kit: string; name: string; words: string[]; waiver?: string }[]).filter((it) => it.waiver === WAIVER);
const project = createBlankProject() as Project;
const mapId = project.startMapId;
const ts = project.tilesets[project.maps[mapId]!.tilesetId]!;
const rows: { kit: string; word: string; first: string | undefined; rank: number; listed: boolean }[] = [];
for (const it of NEW) for (const word of it.words) {
  const found = existingMatches(project, ts, word).map((r) => r.id);
  const list = runTool({ project, currentMapId: mapId, assistantRun: true }, "list_tileset_objects", { mapId, query: word });
  const listed = ((list.data as { objects?: { id: string }[] } | undefined)?.objects ?? []).some((o) => o.id === it.kit);
  rows.push({ kit: it.kit, word, first: found[0], rank: found.indexOf(it.kit), listed });
}
const firstHit = rows.filter((r) => r.rank === 0), anyHit = rows.filter((r) => r.rank >= 0), miss = rows.filter((r) => r.rank < 0);
const kitsReached = new Set(firstHit.map((r) => r.kit));
const ko = (w: string) => /[가-힣]/.test(w);
console.log(`${WAIVER} ${NEW.length}종 · 낱말 ${rows.length}개 — 그 킷이 첫째 ${firstHit.length} · 목록 안 ${anyHit.length} · 못 찾음 ${miss.length}`);
console.log(`한국어 낱말 ${rows.filter((r) => ko(r.word)).length}개 중 첫째 ${firstHit.filter((r) => ko(r.word)).length} · 영어 낱말 ${rows.filter((r) => !ko(r.word)).length}개 중 첫째 ${firstHit.filter((r) => !ko(r.word)).length}`);
console.log(`낱말 하나로라도 첫째에 닿는 킷 ${kitsReached.size}/${NEW.length}${kitsReached.size < NEW.length ? ` — 못 닿는 킷: ${NEW.filter((it) => !kitsReached.has(it.kit)).map((it) => it.kit).join(", ")}` : ""}`);
console.log(`list_tileset_objects(query) 에 드는 낱말 ${rows.filter((r) => r.listed).length}/${rows.length}`);
for (const r of rows.filter((x) => x.rank !== 0)) console.log(`  ${r.kit} «${r.word}» → ${r.rank < 0 ? "없음" : `${r.rank + 1}번째`}(첫째 ${r.first ?? "없음"})`);
if (OLD) {
  const newIds = new Set(NEW.map((it) => it.kit));
  const before = createBlankProject() as Project;
  const tsBefore = before.tilesets[ts.id]!;
  tsBefore.structureKits = (tsBefore.structureKits ?? []).filter((kit) => !newIds.has(kit.id));
  const queries = new Set<string>();
  for (const kit of tsBefore.structureKits) {
    if (kit.width > 8 || kit.height > 8) continue;
    for (const part of String(kit.name ?? "").split("·")) { const q = part.replace(/\d+×\d+/gu, "").trim(); if (q.length >= 2) queries.add(q); }
    for (const tag of kit.ai?.tags ?? []) if (/[가-힣]/u.test(tag) && tag.length >= 2) queries.add(tag);
  }
  const moved: string[] = [];
  for (const q of queries) { const b = existingMatches(before, tsBefore, q)[0]?.id, a = existingMatches(project, ts, q)[0]?.id; if (a !== b) moved.push(`«${q}» ${b ?? "없음"} → ${a ?? "없음"}`); }
  console.log(`옛 킷 이름·태그 ${queries.size}개 — 첫째가 바뀐 것 ${moved.length}`);
  for (const line of moved) console.log(`  ${line}`);
}
const out = argv[0];
if (out) fs.writeFileSync(out, JSON.stringify({ kits: NEW.length, words: rows.length, first: firstHit.length, any: anyHit.length, miss: miss.length, kitsReached: kitsReached.size, rows }, null, 1));
