// rt-scarloxy-south-exit-marked — 재현 스크립트에서 자동 생성(scripts/qa/play/to-scenario.mjs) 뒤
// 비트를 둘로 나눠 「표시가 있는가」와 「그 길로 실제로 넘어가는가」를 따로 판정한다.
// 버그가 살아 있는 동안 이 시나리오는 실패한다: 고쳐지면 통과한다(회귀 방지).
// 원본 op: /home/main/salad/play/runs/rerun2/tasks/scarloxy-demo__first-run/actions.jsonl 13-15
// 증상: 사막 유적으로 가는 이동 지점(15,21)이 보이지 않는 playerTouch 이벤트이고 주변이 평범한 풀밭이라
// 화면만 보고는 찾을 수 없다. findings scarloxy-demo__first-run F1 (rerun2)
//
// 실행: npm run qa:runtime -- --scenario rt-scarloxy-south-exit-marked --checkpoint-set rt-scarloxy-south-exit-marked --checkpoint all

/**
 * 초원 마을 x=15 열의 y=13..21 이 평지와 다른 타일인가 — 즉 남쪽 출구까지 「길」이 그려져 있는가.
 * 이벤트 스프라이트가 아니라 지도 타일을 읽는 이유: 이동 지점은 playerTouch(밟으면 넘어감)라
 * 그림이 없고, 저자가 놓는 표시는 타일이다(이 시나리오가 잡는 결함이 정확히 그 누락이었다).
 */
const southRoadMarked = "() => {\n"
  + "  const scene = window.__oprnHooksScene;\n"
  + "  if (!scene || !scene.map || !Array.isArray(scene.map.lowerTiles)) return '지도 타일을 읽을 수 없다 — 필드 씬이 아니다';\n"
  + "  const map = scene.map;\n"
  + "  if (map.id !== 'map_scarloxy_meadow') return '초원 마을이 아니다: ' + map.id;\n"
  + "  const plain = map.lowerTiles[12 * map.width + 15];\n"
  + "  const marked = [];\n"
  + "  for (let y = 13; y <= 21; y += 1) if (map.lowerTiles[y * map.width + 15] !== plain) marked.push(y);\n"
  + "  return marked.length >= 8 ? true : '남쪽 출구로 이어지는 길이 화면에 없다 — x=15 열에서 평지와 다른 칸: ' + (marked.join(',') || '없음');\n"
  + "}";

const beats =
[
  {
    id: "rt-scarloxy-south-exit-marked-road",
    note: "초원 마을 남쪽 출구(15,21)로 이어지는 길이 타일로 그려져 있다 — 지금은 전부 평범한 풀이라 출구가 화면에 없다",
    ops: [
      {"kind":"waitFor","testid":"field-hud","state":"present"},
    ],
    expect: {
      "pageAssertions": [
        {
          "id": "meadow-south-road-marked",
          "note": "x=15 열 y=13..21 이 평지와 다른 타일(모래 길)이어야 한다",
          "fn": southRoadMarked
        }
      ],
      "note": "초원 마을 남쪽 출구로 이어지는 길이 타일로 그려져 있다. findings scarloxy-demo__first-run F1 (rerun2)"
    },
    shot: true,
  },
  {
    id: "rt-scarloxy-south-exit-marked-transfer",
    note: "그 길을 따라 남쪽으로 걸으면 사막 유적으로 넘어간다 — 길이 출구를 가리키고 출구가 실제로 동작한다",
    ops: [
      {"kind":"move","dir":"down","steps":1},
      {"kind":"move","dir":"down","steps":12},
      {"kind":"waitForMap","mapId":"map_scarloxy_ruins"},
    ],
    expect: {
      "mapId": "map_scarloxy_ruins",
      "note": "남쪽 길을 따라 내려가면 사막 유적으로 넘어간다"
    },
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "rt-scarloxy-south-exit-marked",
  projectGenerator: {"game":"scarloxy-demo"},
  checkpointSet: "rt-scarloxy-south-exit-marked",
  // 게임: scarloxy-demo (scripts/qa/play/games.json)
  viewport: {"width":1280,"height":720},
  // 오프닝 컷신은 재현 대상이 아니다 — 세션과 같은 조건(끔)으로 맞춘다.
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats,
  checkpointBeats: { anchor: beats },
};
