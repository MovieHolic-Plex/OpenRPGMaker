// _work/<세트>/preset.json(에이전트가 그림을 보고 붙인 이름) → 저장소 프리셋 src/project/rpgmakerMv/packs/refmapSets.json.
// 그림은 싣지 않는다 — 시트 파일 이름·sha256·칸 좌표·이름뿐이다. 프리셋 목록은 refmapSets.ts 가 MV_PACK_PRESETS 에 붙인다.
//
//   bun scripts/content/refmap/gen-presets.mts
import fs from "node:fs";
import path from "node:path";
import { presetFromJson, REFMAP_ROOT, sheetKey, type PresetJson, type SetSheets } from "./lib.mts";

const OUT = "src/project/rpgmakerMv/packs/refmapSets.json";
const presets = fs.readdirSync(path.join(REFMAP_ROOT, "_work")).sort().flatMap((id) => {
  const dir = path.join(REFMAP_ROOT, "_work", id);
  if (!fs.existsSync(path.join(dir, "preset.json"))) return [];
  const sheets = JSON.parse(fs.readFileSync(path.join(dir, "sheets.json"), "utf8")) as SetSheets;
  const json = JSON.parse(fs.readFileSync(path.join(dir, "preset.json"), "utf8")) as PresetJson;
  const keys = new Map(sheets.sheets.map((s) => [sheetKey(s.file, sheets.tag), s.file]));
  return [presetFromJson(id, sheets, json, (k) => { const f = keys.get(k); if (!f) throw new Error(`${id}: 시트 ${k}`); return f; })];
});
fs.writeFileSync(OUT, JSON.stringify(presets, null, 1) + "\n");
console.log(JSON.stringify(presets.map((p) => ({ id: p.id, sheets: p.sheets.length, autotiles: p.autotiles.length, flats: p.flats.length, objects: p.objects.length }))));
