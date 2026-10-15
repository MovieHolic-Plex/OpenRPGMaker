// 연애 하루 루프 — 출하 플레이어에서: 호감 대화 → 하트 HUD 가 오르고 남은 시간 칸이 줄고 시계가 간다.
// 입력: output/qa/romance-loop/{project,proof}.json (scripts/qa/romance-fix/loop-fixture.mts 가 만든다). 저작 내용 쓰기 없음.
import fs from "node:fs";
import path from "node:path";
const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "output/qa/romance-loop-end/project.json";
const proof = JSON.parse(fs.readFileSync(path.join(path.dirname(projectFixture), "proof.json"), "utf8"));
const stable = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 40, deltaMs: 16 }, { kind: "resumeFrames" }];
const settle = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 150, deltaMs: 16 }, { kind: "resumeFrames" }];
// 조건 대기로 대사를 넘긴다(고정 횟수 입력은 초과 입력이 된다 — runtimeQa.mjs 주석). 한 줄: 첫 Enter = 타이핑 건너뛰기, 둘째 Enter = 다음.
const enter = { kind: "key", key: "Enter" };
const talk = (face) => [{ kind: "face", dir: face }, { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present" }, { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 }, ...stable];
const skipThenNext = [enter, ...stable, enter];
const feedback = (text) => [{ kind: "waitForText", testid: "dialogue-box", text }, { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 }, ...stable];
// 피드백은 한 쪽짜리다 — Enter 가 조사 키이기도 해서 한 번 더 누르면 같은 NPC 를 다시 부른다.
const closeFeedback = [enter, { kind: "waitFor", testid: "dialogue-box", state: "absent" }, ...settle];
export default {
  id: "romance-loop-end",
  projectFixture,
  beats: [
    { id: "title", expect: { testidPresent: ["title-screen"] } },
    { id: "01-start", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, ...settle, ...settle], expect: { mapId: proof.mapId, testidAbsent: ["title-screen"] } },
    { id: "02-walk", ops: [{ kind: "playerRoute", moves: proof.moves }, { kind: "waitForPosition", mapId: proof.mapId, x: proof.at.x, y: proof.at.y, timeoutMs: 30000 }, ...stable], expect: { x: proof.at.x, y: proof.at.y } },
    { id: "03-talk-1", ops: talk(proof.face), expect: { testidPresent: ["dialogue-box"] } },
    { id: "04-fb-1", ops: [...skipThenNext, ...feedback("남은 시간 2")], expect: {} },
    { id: "05-after-1", ops: closeFeedback, expect: { testidAbsent: ["dialogue-box"] } },
    { id: "06-talk-2", ops: talk(proof.face), expect: { testidPresent: ["dialogue-box"] } },
    { id: "07-fb-2", ops: [...skipThenNext, ...feedback("남은 시간 1")], expect: {} },
    { id: "08-after-2", ops: closeFeedback, expect: { testidAbsent: ["dialogue-box"] } },
    { id: "09-talk-3", ops: talk(proof.face), expect: { testidPresent: ["dialogue-box"] } },
    { id: "10-fb-3", note: "마지막 칸 — 하루가 저문다", shot: true, ops: [...skipThenNext, ...feedback("하루가 저문다")], expect: {} },
    { id: "11-deadline", note: "기한(1일)이 찼다 — 잠으로 넘어가는 순간 onDayEnd 가 엔딩을 부른다: 호감 20 → 「친구로 남는 결말」 에필로그", shot: true,
      ops: [enter, { kind: "waitForText", testid: "dialogue-box", text: "친구로 남는 결말" }, ...stable], expect: { testidPresent: ["dialogue-box"] } },
    { id: "12-ending-screen", note: "에필로그 뒤 엔딩 화면", shot: true,
      ops: [...skipThenNext, { kind: "waitFor", testid: "ending-screen", state: "present", timeoutMs: 60000 }, { kind: "waitForVisible", testid: "ending-screen", minAlpha: 0.95, timeoutMs: 20000 }, { kind: "pauseFrames" }, { kind: "stepFrames", frames: 600, deltaMs: 16 }, { kind: "resumeFrames" }], expect: { testidPresent: ["ending-screen"] } },
  ],
};
