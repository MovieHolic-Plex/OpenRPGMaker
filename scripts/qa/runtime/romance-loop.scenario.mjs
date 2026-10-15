// 연애 하루 루프 — 출하 플레이어에서: 호감 대화 → 하트 HUD 가 오르고 남은 시간 칸이 줄고 시계가 간다.
// 입력: output/qa/romance-loop/{project,proof}.json (scripts/qa/romance-fix/loop-fixture.mts 가 만든다). 저작 내용 쓰기 없음.
import fs from "node:fs";
import path from "node:path";
const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "output/qa/romance-loop/project.json";
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
    { id: "03-talk-1", note: "첫 대화", shot: true, ops: talk(proof.face), expect: { testidPresent: ["dialogue-box"] } },
    { id: "04-feedback-1", note: "대사를 넘기면 호감 피드백 — 호감 +10, 남은 시간 2", shot: true,
      ops: [...skipThenNext, ...feedback("남은 시간 2")], expect: { testidPresent: ["dialogue-box"] } },
    { id: "05-after-1", note: "대화 뒤 — 하트 한 칸 채움, 시계가 한 칸(6시간 40분) 흘렀다", shot: true,
      ops: closeFeedback, expect: { testidAbsent: ["dialogue-box"] } },
    { id: "06-talk-2", note: "같은 사람과 또 대화 — 둘째 칸", shot: true, ops: talk(proof.face), expect: { testidPresent: ["dialogue-box"] } },
    { id: "07-feedback-2", note: "둘째 호감 +10(하루 상한 20 에 닿는다), 남은 시간 1", shot: true,
      ops: [...skipThenNext, ...feedback("남은 시간 1")], expect: { testidPresent: ["dialogue-box"] } },
    { id: "08-after-2", note: "둘째 대화 뒤 — 하트 두 칸", shot: true, ops: closeFeedback, expect: { testidAbsent: ["dialogue-box"] } },
    { id: "09-talk-3", note: "셋째 — 이미 상한을 채운 사람, 호감 0 이지만 마지막 칸을 쓴다", shot: true, ops: talk(proof.face), expect: { testidPresent: ["dialogue-box"] } },
    { id: "10-feedback-3", note: "상한 안내 + 하루가 저문다", shot: true,
      ops: [...skipThenNext, ...feedback("하루가 저문다")], expect: { testidPresent: ["dialogue-box"] } },
    { id: "11-next-day", note: "대화를 닫으면 잠으로 넘어가 이튿날 아침 — 날짜 2일, 남은 시간 3/3, 호감은 그대로", shot: true,
      ops: [...closeFeedback, ...settle], expect: { testidAbsent: ["dialogue-box"] } },
  ],
};
