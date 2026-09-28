// 생성 짝 얼굴 증거 시나리오. oprn-sample 픽스처의 town-npc 를 원본 얼굴이 없던 "People4 #5 노란 전통옷 남성" 으로 바꾸고
// 옛 추정이 붙이던 얼굴(People2 #6 콧수염 남성)을 저장본에 넣는다. 로드 교정 뒤 출하 플레이어에 생성 짝 얼굴이 떠야 한다.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const source = JSON.parse(readFileSync(new URL("../../../test/fixtures/projects/oprn-sample-v3.json", import.meta.url), "utf8"));
const npc = source.maps.map_town.events.find((event) => event.id === "town-npc");
const page = npc.pages[0];
// characterIndex 5 = 시트 두 번째 줄 두 번째 칸. 아래 방향 가운데 걸음: row 4, column 4 → 4*12 + 4.
page.graphic = { sprite: { type: "bundled", id: "tex_easyrpg_charset_people4" }, direction: "down", pattern: 52 };
page.commands = [
  { kind: "changeFace", resourceId: "easyrpg-faceset-people2", faceIndex: 6, position: "left", flipHorizontally: false },
  { kind: "text", speaker: "상인", body: "원본에 없던 얼굴이 새로 생겼다." },
];
mkdirSync(new URL("../../../tmp/", import.meta.url), { recursive: true });
const fixturePath = "tmp/face-generated-fixture.json";
writeFileSync(new URL("../../../" + fixturePath, import.meta.url), JSON.stringify(source));

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const faceGeneratedScenario = {
  id: "face-generated",
  projectFixture: fixturePath,
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 마을 시작 지점(0,1), 우측 (1,1) 에 노란 전통옷 상인",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, { kind: "seed", seed: 1 }],
      expect: { mapId: "map_town", x: 0, y: 1, testidAbsent: ["title-screen", "dialogue-box"] },
    },
    {
      id: "talk",
      note: "말걸기 → 대화창에 생성 짝 얼굴(generated-faceset-missing-people-05)이 떠야 한다",
      ops: [{ kind: "face", dir: "right" }, { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present" }],
      expect: { testidPresent: ["dialogue-box"] },
      shot: true,
    },
  ],
};

export default faceGeneratedScenario;

