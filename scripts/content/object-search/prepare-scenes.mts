// 장면 키트 사전 만들기: scenes-source.json(상식 초안) → src/assets/objectScenes.json.
// 낱말마다 공용 기물 이름에 실제로 드는지 본다. 안 들면 머리 낱말(마지막 낱말, 그다음 첫 낱말)로 줄여 보고, 그래도 0건이면 뺀다.
// 실행: npx vite-node --script scripts/content/object-search/prepare-scenes.mts
import { readFileSync, writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults/blankProject";
import { sharedObjects } from "@/editor/tools/sharedDesignCatalog";
import { nameHasWord, type SceneRole } from "@/editor/tools/objectScenes";

type Draft = { place: string; triggers: string[] } & Record<SceneRole, string[]>;
const ROLES: SceneRole[] = ["structure", "floor", "life", "light", "nature"];
const source = JSON.parse(readFileSync(new URL("./scenes-source.json", import.meta.url), "utf8")) as { scenes: Draft[] };
const synonyms = (JSON.parse(readFileSync(new URL("./scenes-synonyms.json", import.meta.url), "utf8")) as { synonyms: Record<string, string[]> }).synonyms;
const names = sharedObjects(createBlankProject()).filter(row => !/monster/u.test(row.tilesetId ?? "")).map(row => row.name);
const hits = (word: string) => names.some(name => nameHasWord(name, word));
let kept = 0, shortened = 0, dropped = 0;
const scenes = source.scenes.map(scene => {
  const roles = Object.fromEntries(ROLES.map(role => {
    const words: string[] = [];
    for (const word of scene[role] ?? []) {
      // 다른 이름(scenes-synonyms.json)과 머리 낱말(마지막·첫 낱말)까지 후보로 두고, 카탈로그 이름에 실제로 드는 것만 | 로 잇는다.
      // 두 글자 미만은 버린다 — 「독」「초」는 「독서대」「초가」에도 든다.
      const parts = word.trim().split(/\s+/u);
      const alternatives = [...new Set([word.trim(), ...(synonyms[word.trim()] ?? []).map(alt => alt.trim()), parts.at(-1)!, parts[0]!])]
        .filter(candidate => candidate.replace(/\s/gu, "").length >= 2 && hits(candidate));
      if (!alternatives.length) { dropped += 1; continue; }
      if (alternatives[0] !== word.trim()) shortened += 1; else kept += 1;
      const joined = alternatives.join("|");
      if (!words.includes(joined)) words.push(joined);
    }
    return [role, words];
  }));
  return { place: scene.place, triggers: [...new Set(scene.triggers.map(t => t.trim()).filter(Boolean))], roles };
});
writeFileSync(new URL("../../../src/assets/objectScenes.json", import.meta.url), JSON.stringify({
  note: "장면 키트 사전 — scripts/content/object-search/prepare-scenes.mts 가 만든다(손으로 고치지 말고 scenes-source.json 을 고친 뒤 다시 돌린다).",
  scenes }, null, 1) + "\n");
console.log(JSON.stringify({ scenes: scenes.length, kept, shortened, dropped }));
