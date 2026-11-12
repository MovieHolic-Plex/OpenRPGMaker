// 장소 테마 전투 배경 — 출하 플레이어에서 그 맵의 적과 싸울 때 실제로 깔리는 배경을 찍는다.
// 픽스처: bun scripts/qa/assistant-v2/themeBackdropProof.mts <outDir> [key] (구성기 장소 + 실제 빌더 채우기 + 조사할 적 한 마리)
//   THEME_BACKDROP_PROOF=<outDir>/proof.json THEME_BACKDROP_KEY=tomb \
//     node scripts/runtime-qa.mjs --scenario theme-backdrop --project <outDir>/tomb.proof.project.json --out <shots>
// 배경 노드의 그림 주소·겹 배경 표시를 <out>/backdrop.json 에 남긴다(장소 그림이면 layers=custom, 주소가 battle-scenery/<키>/preview.png).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const proofFile = process.env.THEME_BACKDROP_PROOF;
const key = process.env.THEME_BACKDROP_KEY;
if (!proofFile || !key) throw new Error("THEME_BACKDROP_PROOF=<proof.json> THEME_BACKDROP_KEY=<키> 가 필요하다");
const row = JSON.parse(readFileSync(proofFile, "utf8"))[key];
if (!row?.capture) throw new Error(`${key}: proof.json 에 조사할 적 자리(capture)가 없다`);
const { mapId } = row;
const { stand } = row.capture;
const evidence = process.env.THEME_BACKDROP_EVIDENCE ?? join(dirname(proofFile), `${key}.backdrop.json`);

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "theme-backdrop",
  beats: [
    {
      id: "facing-foe",
      note: `새 게임 → 「${row.name}」 의 적 바로 아래 칸에서 위를 본다`,
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
        { kind: "teleport", mapId, x: stand.x, y: stand.y },
        { kind: "waitForPosition", mapId, x: stand.x, y: stand.y },
        { kind: "face", dir: "up" },
      ],
      expect: { mapId, x: stand.x, y: stand.y, testidAbsent: ["battle-scene"] },
      shot: true,
    },
    {
      id: "battle",
      note: `조사 → 전투. 배경은 맵에 저장된 ${row.mapBattleBackground}`,
      ops: [
        { kind: "action" },
        { kind: "waitFor", testid: "battle-scene", state: "present", timeoutMs: 20_000 },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 40_000 },
        {
          kind: "evalToFile", out: evidence,
          fn: `() => { const b = document.querySelector('[data-testid="battle-backdrop"]'); const cam = b?.querySelector('[data-testid="battle-scenery"]');
            return { backgroundImage: b ? getComputedStyle(b).backgroundImage : null, backdropSource: b?.dataset.backdropSource ?? null, sceneryLayers: cam?.dataset.layers ?? null, sceneryBiome: cam?.dataset.biome ?? null }; }`,
        },
      ],
      expect: { testidPresent: ["battle-scene", "actor-command-attack"] },
      shot: true,
    },
  ],
};
