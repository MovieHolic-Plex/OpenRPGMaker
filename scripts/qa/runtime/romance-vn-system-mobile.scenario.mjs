// 미연시 시스템 UI 수리 — 좁은 화면(390×844)에서 대사창에 읽기 단추 줄이 없고 오른쪽 흉상을 가리는 것이 없는지 확인.
// 입력: romance-vn-system 과 같은 픽스처. 흉상을 오른쪽에 두려면 fixture 네 번째 인자 right:
//   bun scripts/qa/runtime/romance-vn-system-fixture.mts output/qa/romance-vn-mobile ko "" right
//   node scripts/runtime-qa.mjs --scenario romance-vn-system-mobile --project output/qa/romance-vn-mobile/project.json
import base from "./romance-vn-system.scenario.mjs";
export default {
  ...base,
  id: "romance-vn-system-mobile",
  viewport: { width: 390, height: 844 },
  beats: base.beats.filter((beat) => ["title", "01-start", "02-walk", "03-dialogue-window", "06-skip-stops-unread"].includes(beat.id)),
};
