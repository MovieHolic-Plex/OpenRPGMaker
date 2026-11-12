// 조수가 지은 게임의 길 위 전투 화면 — 출하 플레이어에서 그 적 곁에 서서 싸움을 걸고, 전투 화면(배경·영웅·적·적 체력 막대)과 한 차례 뒤를 찍는다.
// 픽스처: bun scripts/qa/assistant-v2/battleFitProbe.mts <재생 결과 폴더> --shots <dir> (오프닝을 끈 사본 + 전투마다 설 칸)
//   BATTLE_FIT_SHOTS=<dir>/shots.json BATTLE_FIT_INDEX=0 \
//     npm run qa:runtime -- --scenario battle-fit --project <dir>/shots.project.json --out <shots>
// 배경 노드의 그림 주소·출처를 <dir>/shot-<n>.backdrop.json 에 남긴다. 문서 openwiki/assistant-v2.md 「전투가 장소·파티에 맞는다」.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const file = process.env.BATTLE_FIT_SHOTS;
const index = Number(process.env.BATTLE_FIT_INDEX ?? "0");
if (!file) throw new Error("BATTLE_FIT_SHOTS=<shots.json> 가 필요하다");
const row = JSON.parse(readFileSync(file, "utf8"))[index];
if (!row) throw new Error(`shots.json 에 ${index}번 전투가 없다`);
const { mapId, stand, face } = row;
const evidence = join(dirname(file), `shot-${index}.backdrop.json`);

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "battle-fit",
  beats: [
    {
      id: "beside-foe",
      note: `새 게임 → 「${row.map}」 의 ${row.role} 적(${row.troopId}) 곁 칸에서 적을 본다`,
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
        ...(row.switches ?? []).map((switchId) => ({ kind: "setSwitch", switchId, value: true })),
        { kind: "teleport", mapId, x: stand.x, y: stand.y },
        { kind: "waitForPosition", mapId, x: stand.x, y: stand.y },
        { kind: "face", dir: face },
      ],
      expect: { mapId },
      shot: true,
    },
    {
      id: "battle",
      note: "말을 걸거나 걸어 들어가 전투 — 배경·영웅·적·적 체력 막대",
      ops: [
        // 닿으면 싸우는 적은 걸어 들어가고, 말을 거는 상대(보스)는 조사한 뒤 대사를 넘긴다.
        ...(row.touch ? [{ kind: "hold", dir: face, ms: 600 }] : [{ kind: "action" }]),
        { kind: "pressUntil", key: "Enter", testid: "battle-scene", state: "present", maxPresses: 30, timeoutMs: 30_000 },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 40_000 },
        {
          kind: "evalToFile", out: evidence,
          fn: `() => { const b = document.querySelector('[data-testid="battle-backdrop"]'); const cam = b?.querySelector('[data-testid="battle-scenery"]');
            return { backgroundImage: b ? getComputedStyle(b).backgroundImage.slice(0, 200) : null, backdropSource: b?.dataset.backdropSource ?? null, sceneryLayers: cam?.dataset.layers ?? null, sceneryBiome: cam?.dataset.biome ?? null }; }`,
        },
      ],
      expect: { testidPresent: ["battle-scene", "actor-command-attack"] },
      shot: true,
    },
    {
      id: "after-attack",
      note: "«공격» 한 번 — 적 체력이 줄어드는 것이 보이는가, 적이 되받아치는가",
      ops: [
        // 명령 창의 «공격» → 대상 확인. 한 차례(적의 되받아치기까지)가 끝나 명령 창이 돌아올 때까지 기다린다.
        { kind: "key", key: "Enter", times: 2 },
        { kind: "hold", dir: null, ms: 3500 },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 40_000 },
      ],
      expect: { testidPresent: ["battle-scene"] },
      shot: true,
    },
  ],
};
