// rt-shitamachi-venue-room-no-exit — 거리 문으로 들어간 실내에서 걸어서 다시 거리로 나온다.
// 2026-10-23 F1: 예전 판의 실내 명소는 순간이동 메뉴로만 들어가고 나가는 문이 없어 갇혔다.
// 2026-10-25 재구성: 실내는 link_jp_city_interior 로 거리 문과 왕복으로 이어진다. 앵커는 진흥회 사무소 입구 (24,24) —
// 아래로 걸으면 맨 아래 줄 출입구 발판을 밟고 사무소 문 앞 거리로 나온다.
//
// 실행: npm run qa:runtime -- --scenario rt-shitamachi-venue-room-no-exit --checkpoint-set rt-shitamachi-venue-room-no-exit --checkpoint all

const beats =
[
  {
    id: "rt-shitamachi-venue-room-walk-out",
    note: "진흥회 사무소 입구에서 아래로 걸으면 상점가로 나온다",
    ops: [
      {"kind":"move","dir":"down","steps":1},
      {"kind":"waitForMap","mapId":"map_shitamachi_arcade","timeoutMs":20000},
    ],
    expect: {
      "pageAssertions": [
        {
          "id": "left-venue-room",
          "note": "사무소 입구에서 아래로 걸으면 거리(map_shitamachi_arcade)로 나와야 한다",
          "fn": "() => { const debug = window.__oprnDebug; if (!debug || typeof debug.readState !== 'function') return '런타임 훅이 없다 — 현재 맵을 읽을 수 없다'; const map = debug.readState().currentMapId; return map === 'map_shitamachi_arcade' ? true : `아래로 걸어도 거리로 나오지 못했다 (${map})`; }"
        }
      ],
      "note": "거리 문으로 들어간 실내에서 걸어서 나온다",
    },
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "rt-shitamachi-venue-room-no-exit",
  projectGenerator: {"game":"shitamachi-fourth-season"},
  checkpointSet: "rt-shitamachi-venue-room-no-exit",
  viewport: {"width":960,"height":540},
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats,
  checkpointBeats: { anchor: beats },
};
