// 연애 하루 루프 — 출하 플레이어에서: 호감 대화 → 하트 HUD 가 오르고 남은 시간 칸이 줄고 시계가 간다.
// 입력: output/qa/romance-loop/{project,proof}.json (scripts/qa/romance-fix/loop-fixture.mts 가 만든다). 저작 내용 쓰기 없음.
import fs from "node:fs";
import path from "node:path";
const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "output/qa/romance-loop/project.json";
const proof = JSON.parse(fs.readFileSync(path.join(path.dirname(projectFixture), "proof.json"), "utf8"));
const stable = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 40, deltaMs: 16 }, { kind: "resumeFrames" }];
const settle = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 150, deltaMs: 16 }, { kind: "resumeFrames" }];
const advance = [{ kind: "action" }, ...settle];
export default {
  id: "romance-loop",
  projectFixture,
  beats: [
    { id: "title", note: "연애 타이틀(번들 그림, 눈 덮인 마을 기본값 아님)", shot: true, expect: { testidPresent: ["title-screen"] } },
    { id: "01-start", note: "새 게임 → 오프닝 카드를 지나 캠퍼스 — 호감 하트 0, 남은 시간 3/3", shot: true,
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, ...settle, ...settle],
      expect: { mapId: proof.mapId, testidAbsent: ["title-screen"], testidPresent: ["field-hud"] } },
    { id: "02-walk", note: "상대 옆까지 걷는다", shot: true,
      ops: [{ kind: "playerRoute", moves: proof.moves }, { kind: "waitForPosition", mapId: proof.mapId, x: proof.at.x, y: proof.at.y, timeoutMs: 30000 }, ...stable],
      expect: { mapId: proof.mapId, x: proof.at.x, y: proof.at.y } },
    { id: "03-talk-1", note: "첫 대화 — 대사", shot: true,
      ops: [{ kind: "face", dir: proof.face }, { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present" }, ...settle],
      expect: { testidPresent: ["dialogue-box"] } },
    { id: "04-feedback-1", note: "대사를 넘기면 호감 피드백 — 호감 +10, 남은 시간 2", shot: true,
      ops: [...advance, ...advance], expect: { testidPresent: ["dialogue-box"] } },
    { id: "05-after-1", note: "대화가 끝난 화면 — 하트 절반(10/20 은 하트 한 칸), 시계가 한 칸(약 6시간) 흘렀다", shot: true,
      ops: [...advance, ...settle], expect: { testidAbsent: ["dialogue-box"] } },
    { id: "06-talk-2", note: "같은 사람과 또 대화 — 하루 상한(20)에 닿는다", shot: true,
      ops: [{ kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present" }, ...settle, ...advance, ...advance],
      expect: { testidPresent: ["dialogue-box"] } },
    { id: "07-after-2", note: "둘째 대화 뒤 — 하트 두 칸, 남은 시간 1", shot: true,
      ops: [...advance, ...settle], expect: { testidAbsent: ["dialogue-box"] } },
  ],
};
