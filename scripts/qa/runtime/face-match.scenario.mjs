// 얼굴 짝 교정(2026-09-28) 증거 시나리오. oprn-sample 픽스처의 town-npc 를 "People2 #0 중절모 신사" 로 바꾸고
// 옛 도구 추정이 붙이던 얼굴(People1 #0 갈색 단발 소년)을 저장본에 넣는다 — 실제 저장본 138건의 가장 흔한 틀린 짝.
// 출하되는 플레이어(player.html + exportProjectStoreShim)가 로드 교정 후 짝 얼굴(People2 #6)을 띄우는지 본다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const source = JSON.parse(readFileSync(new URL("../../../test/fixtures/projects/oprn-sample-v3.json", import.meta.url), "utf8"));
const map = source.maps.map_town;
const npc = map.events.find((event) => event.id === "town-npc");
const page = npc.pages[0];
const pattern = 0 * 12 + 1; // characterIndex 0, down, pattern 1
page.graphic = { sprite: { type: "bundled", id: "tex_easyrpg_charset_people2" }, direction: "down", pattern };
page.commands = [
  // v3 픽스처는 얼굴을 시트 id + faceIndex 로 저장한다 — 마이그레이션이 easyrpg-faceset-people1-00 으로 바꾼다.
  { kind: "changeFace", resourceId: "easyrpg-faceset-people1", faceIndex: 0, position: "left", flipHorizontally: false },
  { kind: "text", speaker: "신사", body: "얼굴이 걷기 그림과 같은 사람인지 보세요." },
];
mkdirSync(new URL("../../../tmp/", import.meta.url), { recursive: true });
const fixturePath = "tmp/face-match-fixture.json";
writeFileSync(new URL("../../../" + fixturePath, import.meta.url), JSON.stringify(source));

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const faceMatchScenario = {
  id: "face-match",
  projectFixture: fixturePath,
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 마을 시작 지점(0,1), 우측 (1,1) 에 중절모 신사",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, { kind: "seed", seed: 1 }],
      expect: { mapId: "map_town", x: 0, y: 1, testidAbsent: ["title-screen", "dialogue-box"] },
    },
    {
      id: "talk",
      note: "말걸기 → 대화창에 짝 얼굴(People2 #6 검은 머리 콧수염)이 떠야 한다",
      ops: [{ kind: "face", dir: "right" }, { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present" }],
      expect: { testidPresent: ["dialogue-box"] },
      shot: true,
    },
  ],
};

export default faceMatchScenario;

