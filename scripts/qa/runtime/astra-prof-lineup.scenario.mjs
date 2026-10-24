// 아스트라 대사 흉상 줄 세우기: 기존 인물 6명 + 박사 후보(표정 넷)를 같은 진짜 대사창에서 1배로 한 장씩 찍는다.
// 픽스처는 tmp/astra-pres/lineup_fixture.py 가 만든다(오프닝 끔, 시작 맵 자동 이벤트 = 인물마다 흉상 + 「[이름]」 대사 한 줄).
// 실행: npm run qa:runtime -- --scenario astra-prof-lineup
import { readFileSync } from "node:fs";
const labels = JSON.parse(readFileSync(new URL("../../../tmp/astra-pres/lineup-labels.json", import.meta.url), "utf8"));
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "astra-prof-lineup",
  projectFixture: "tmp/astra-pres/astra.lineup.json",
  viewport: { width: 480, height: 320 },
  beats: [
    { id: "title", expect: { testidPresent: ["title-screen"] } },
    ...labels.map((label, i) => ({
      id: `${String(i).padStart(2, "0")}-${label.replace(/[〈〉]/g, "").replace(/ /g, "-")}`,
      ops: [
        ...(i === 0 ? [{ kind: "pressUntil", timeoutMs: 1500, key: "Enter", testid: "dialogue-box", state: "present", maxPresses: 20 }] : []),
        { kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: label, settleMs: 2500, maxPresses: 4 },
      ],
      expect: { testidPresent: ["dialogue-box"] },
      shot: true,
    })),
  ],
};
