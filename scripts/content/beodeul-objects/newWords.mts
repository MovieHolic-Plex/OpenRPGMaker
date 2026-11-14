// 새 종류 기물(2026-11-14)이 낱말로 찾아지는가(모델 없음): 킷마다 그 킷의 낱말(한국어·영어, catalog words)을 조수의 «이미 있는 물건 찾기»
// (existingMatches — draw_object·generate_missing_object 가 «이미 있다 → 그 킷» 으로 이르는 길)와 list_tileset_objects(query) 에 물어
// 그 킷이 첫째로 오는지·목록에 드는지 적는다. 낱말 목록은 코드가 아니라 킷 태그(spec words)다.
//
//   bun scripts/content/beodeul-objects/newWords.mts [<결과 json>]
import fs from "node:fs";
import { createBlankProject } from "../../../src/project/defaults/blankProject";
import { existingMatches } from "../../../src/editor/tools/objectGenTool";
import { runTool } from "../../../src/editor/tools";
import type { Project } from "../../../src/project/types";
import catalog from "../../../tiledata/beodeul-objects/catalog.json";

const NEW = (catalog.items as { id: string; kit: string; name: string; words: string[]; waiver?: string }[]).filter((it) => it.waiver === "fable-objects100-beodeul-2026-11-14");
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
console.log(`새 종류 ${NEW.length}종 · 낱말 ${rows.length}개 — 그 킷이 첫째 ${firstHit.length} · 목록 안 ${anyHit.length} · 못 찾음 ${miss.length}`);
console.log(`한국어 낱말 ${rows.filter((r) => ko(r.word)).length}개 중 첫째 ${firstHit.filter((r) => ko(r.word)).length} · 영어 낱말 ${rows.filter((r) => !ko(r.word)).length}개 중 첫째 ${firstHit.filter((r) => !ko(r.word)).length}`);
console.log(`낱말 하나로라도 첫째에 닿는 킷 ${kitsReached.size}/${NEW.length}${kitsReached.size < NEW.length ? ` — 못 닿는 킷: ${NEW.filter((it) => !kitsReached.has(it.kit)).map((it) => it.kit).join(", ")}` : ""}`);
console.log(`list_tileset_objects(query) 에 드는 낱말 ${rows.filter((r) => r.listed).length}/${rows.length}`);
for (const r of rows.filter((x) => x.rank !== 0)) console.log(`  ${r.kit} «${r.word}» → ${r.rank < 0 ? "없음" : `${r.rank + 1}번째`}(첫째 ${r.first ?? "없음"})`);
const out = process.argv[2];
if (out) fs.writeFileSync(out, JSON.stringify({ kits: NEW.length, words: rows.length, first: firstHit.length, any: anyHit.length, miss: miss.length, kitsReached: kitsReached.size, rows }, null, 1));
