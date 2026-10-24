// cast-portrait 하네스 「dialogue」 단계: 캐스트 흉상 + 후보 표정을 진짜 대사창에서 1배로 한 장씩 찍는다.
// 픽스처·라벨은 src/harnesses/cast-portrait/harness.py dialogue 가 만들고 환경 변수로 넘긴다(직접 부를 일 없음).
import { readFileSync } from "node:fs";
const labelsPath = process.env.CAST_PORTRAIT_LABELS;
const labels = labelsPath ? JSON.parse(readFileSync(new URL(`../../../${labelsPath}`, import.meta.url), "utf8")) : [];
const [vw, vh] = (process.env.CAST_PORTRAIT_VIEWPORT ?? "480x320").split("x").map(Number);
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "cast-portrait-dialogue",
  projectFixture: process.env.CAST_PORTRAIT_FIXTURE ?? "tmp/astra-pres/astra.lineup.json",
  viewport: { width: vw, height: vh },
  beats: [
    { id: "title", expect: { testidPresent: ["title-screen"] } },
    ...labels.map((label, i) => ({
      id: `${String(i).padStart(2, "0")}-${label.replace(/[〈〉]/g, "").replace(/ /g, "-").toLowerCase()}`,
      ops: [
        ...(i === 0 ? [{ kind: "pressUntil", timeoutMs: 1500, key: "Enter", testid: "dialogue-box", state: "present", maxPresses: 20 }] : []),
        { kind: "pressUntilText", key: "Enter", testid: "dialogue-box", text: label, settleMs: 2500, maxPresses: 4 },
      ],
      expect: { testidPresent: ["dialogue-box"] },
      shot: true,
    })),
  ],
};
