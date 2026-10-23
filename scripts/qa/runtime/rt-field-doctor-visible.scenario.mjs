// rt-field-doctor-visible — 재현 스크립트에서 자동 생성(scripts/qa/play/to-scenario.mjs) 뒤
// 「마을로 돌아가 박사가 그려지는가」만 남기도록 비트를 다듬었다.
// 버그가 살아 있는 동안 이 시나리오는 실패한다: 고쳐지면 통과한다(회귀 방지).
// 원본 op: /home/main/salad/play/runs/main1/tasks/preset-monster-collect__first-run/actions.jsonl 546-548
// 증상: 첫 파트너를 주는 박사(ev_segment_starter)의 그래픽이 transparent 라 마을 어디에도 그려지지 않고,
// (6,13)에서 왼쪽을 보고 조사해야 대화가 열린다. findings preset-monster-collect__explore F2
//
// 실행: npm run qa:runtime -- --scenario rt-field-doctor-visible --checkpoint-set rt-field-doctor-visible --checkpoint all

const beats =
[
  {
    id: "rt-field-doctor-visible-repro",
    note: "마을의 박사(ev_segment_starter)가 걷기 칩으로 화면에 서 있다 — 지금은 투명 그래픽이라 빈 보도블록을 조사해야 대화가 열린다",
    // 체크포인트는 길 맵(map_segment_route, 생성마다 같은 id) 저장에서 부팅한다 — 마을 맵 id 는 생성마다
    // 달라서 옛 세션 저장을 그대로 앵커로 쓸 수 없다. 서쪽 문으로 마을에 들어가면 그 맵의 이벤트
    // 스프라이트가 전부 만들어진다(카메라 밖 이벤트도 스프라이트를 갖는다).
    ops: [
      // 체크포인트는 길 맵(map_segment_route, 생성마다 같은 id) 저장에서 부팅한다 — 마을 맵 id 는 생성마다
      // 달라서 옛 세션 저장을 그대로 앵커로 쓸 수 없다. 서쪽 문은 (0, entryY) 라 x=0 열로 간 뒤 위로
      // 지나며 문을 밟는다(playerTouch). 마을에 들어오면 그 맵의 모든 이벤트 스프라이트가 만들어진다.
      {"kind":"move","dir":"left","steps":8},
      {"kind":"move","dir":"up","steps":3},
      {"kind":"waitForMap","mapId":"map_segment_route","not":true},
    ],
    expect: {
      "pageAssertions": [
        {
          "id": "doctor-sprite-drawn",
          "note": "첫 파트너를 주는 박사는 걷기 칩으로 화면에 서 있어야 한다 — 화면에서 찾을 수 없는 NPC 는 첫 목표를 줄 수 없다",
          "fn": "() => {\n  const hook = window.__oprnCharacterSprites;\n  if (typeof hook !== 'function') return '캐릭터 스프라이트 훅이 없다 — 필드 화면이 아니다';\n  const debug = hook();\n  if (!debug) return '캐릭터 스프라이트 훅이 null 이다';\n  const sprite = debug.events && debug.events['ev_segment_starter'];\n  if (!sprite) return '박사(ev_segment_starter) 스프라이트가 그려지지 않았다 — 이벤트는 있는데 화면에 보이지 않는다';\n  if (!(sprite.alpha > 0.05)) return '박사 스프라이트 알파 ' + sprite.alpha + ' — 화면에 보이지 않는다';\n  if (!sprite.textureKey || /missing/i.test(sprite.textureKey)) return '박사 텍스처가 없다: ' + sprite.textureKey;\n  return true;\n}"
        }
      ],
      "note": "마을의 박사(ev_segment_starter)가 화면에 그려진다. findings preset-monster-collect__explore F2"
    },
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "rt-field-doctor-visible",
  projectGenerator: {"game":"preset-monster-collect"},
  checkpointSet: "rt-field-doctor-visible",
  // 게임: preset-monster-collect (scripts/qa/play/games.json)
  viewport: {"width":1280,"height":720},
  // 오프닝 컷신은 재현 대상이 아니다 — 세션과 같은 조건(끔)으로 맞춘다.
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats,
  checkpointBeats: { anchor: beats },
};
