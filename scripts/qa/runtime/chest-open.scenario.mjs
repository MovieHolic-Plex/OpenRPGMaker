// place_chest 보물상자 개봉 시나리오 (출하 플레이어 경로).
//
// 왜 필요한가 (실측 2026-09-04): AI 조수가 place_chest 로 놓은 상자는 열어도 소리 하나 없고
// 열림 페이지가 닫힘 그림을 그대로 썼다. 이 시나리오는 개봉 SE·보상 SE 가 오디오 엔진까지
// 실제로 도달하는지(audioObservedIncludes)와 소지금이 붙는지(gold), 열린 상자 프레임이 화면에
// 남는지(스크린샷)를 한 번에 본다.
//
// 픽스처는 scripts/qa/runtime/chest-open-fixture.mts 가 실물 도구로 굽는다:
//   npx vite-node --script scripts/qa/runtime/chest-open-fixture.mts --out /tmp/chest-open.json
//   node scripts/runtime-qa.mjs --scenario chest-open --project /tmp/chest-open.json
// 상자는 시작 (14,18) 북쪽 (14,17), 보상 회복약 + 50G, 시작 소지금 0.

const CHEST_OPEN_SE = "cc0-se-osx-wooded-box-open";
const LOOT_ITEM_SE = "cc0-se-kjg-8-bit-jingles-jingles-nes09";
const LOOT_GOLD_SE = "cc0-se-orp-inventory-coin";

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const chestOpenScenario = {
  id: "chest-open",
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 시작 지점. 상자는 바로 위 칸, 아직 아무 소리도 나지 않았다",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
        { kind: "face", dir: "up" },
      ],
      expect: { mapId: "map_lantern_village", x: 14, y: 18, gold: 0 },
      shot: true,
    },
    {
      id: "open-chest",
      note: "조사 → 개봉 SE → 뚜껑 프레임 → 아이템 징글 → 동전 → 「손에 넣었다」 대사창(판정점)",
      ops: [
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 15_000 },
      ],
      expect: {
        gold: 50,
        testidPresent: ["dialogue-box"],
        audioObservedIncludes: [CHEST_OPEN_SE, LOOT_ITEM_SE, LOOT_GOLD_SE],
      },
      shot: true,
    },
    {
      id: "chest-stays-open",
      note: "대사를 닫은 뒤 다시 조사 → 「비어 있다」. 소지금은 그대로, 상자는 열린 그림",
      ops: [
        { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 6 },
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present" },
      ],
      expect: { gold: 50, testidPresent: ["dialogue-box"] },
      shot: true,
    },
  ],
};

export default chestOpenScenario;
