// 맵 배경(패럴랙스) 렌더 QA 시나리오.
//
// 픽스처(=`map-background-fixture.mjs`)가 시작 맵 위쪽 6행을 비우고 시작 지점을 그 아래로
// 옮긴다. 그래서 화면 위 40% 는 **비어 있는 칸**이고, 그 위에 무엇이 그려지는지가 곧
// 「맵 배경이 렌더되는가」다.
//
// 대조군은 같은 시나리오를 배경 없는 픽스처로 다시 돌린 것이다:
//   node scripts/runtime-qa.mjs --scenario map-background                    # 배경 ON
//   node scripts/runtime-qa.mjs --scenario map-background \
//     --project /tmp/rpg-zzu-map-background-off.json                         # 배경 OFF
// 두 런의 cliff-lookout 샷을 비교해야 "하늘색 픽셀이 배경 그림에서 왔다" 가 증명된다 —
// 한쪽만 보면 빈 칸이 원래 그 색인지 알 수 없다.
import { START, writeMapBackgroundFixture } from "./map-background-fixture.mjs";

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const mapBackgroundScenario = {
  id: "map-background",
  projectFixture: writeMapBackgroundFixture(),
  beats: [
    {
      id: "title",
      note: "타이틀 화면이 뜬다",
      expect: { testidPresent: ["title-screen"] },
    },
    {
      id: "cliff-lookout",
      note: "새 게임 → 절벽 위 시작 지점. 비어 있는 위쪽 띠에 맵 배경이 깔린다",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
      ],
      expect: {
        mapId: "map_lantern_village",
        x: START.x,
        y: START.y,
        playerSpriteTextureLoaded: true,
        testidAbsent: ["title-screen", "dialogue-box"],
      },
      shot: true,
    },
    {
      // 벽시계 대기 대신 **정확히 60 프레임**을 돌린다. 스크롤 양이 저작값에서 계산되므로
      // 기대 이동: 60프레임 × 17ms = 1.02초 × 2px/프레임 × 60Hz ≈ 122 논리 px(화면 배율 3 → 367px).
      // 샷을 **멈춘 채로** 찍는다 — resume 뒤에 찍으면 벽시계 프레임 몇 개가 더 굴러
      // 이동량이 측정마다 달라진다(실측: 122px 기대에 140px).
      id: "scroll-60-frames",
      note: "60 프레임 뒤 — 배경이 저작한 스크롤 속도만큼 움직인다",
      ops: [
        { kind: "pauseFrames" },
        { kind: "stepFrames", frames: 60, deltaMs: 17 },
      ],
      expect: { mapId: "map_lantern_village", x: START.x, y: START.y },
      shot: true,
    },
    {
      id: "resume",
      note: "프레임 제어를 풀고 정상 루프로 돌려놓는다(샷 없음)",
      ops: [{ kind: "resumeFrames" }],
    },
  ],
};

export default mapBackgroundScenario;
