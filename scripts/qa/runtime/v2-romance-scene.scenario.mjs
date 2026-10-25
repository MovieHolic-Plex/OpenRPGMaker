// 조수 v2 두 선택 대화 장면(cmp-romance-scene)을 출하 플레이어로 본다 — 옥상 시작 → 하린 앞까지 걷기 → 말 걸기(초상·도입) → 선택지 → 첫째 선택의 반응.
// 입력: bun scripts/qa/assistant-v2/content.mts <out> romance 가 남긴 <out>/romance-project.json(오프닝만 끈 사본). 저작 내용 쓰기 없음.
const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "qa-runs/montown/content/romance-play.json";
const long = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 150, deltaMs: 16 }, { kind: "resumeFrames" }];
const stable = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 40, deltaMs: 16 }, { kind: "resumeFrames" }];
export default {
  id: "v2-romance-scene",
  projectFixture,
  beats: [
    { id: "title", expect: { testidPresent: ["title-screen"] } },
    { id: "01-start", note: "새 게임 → 학교 옥상 시작", shot: true,
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, ...stable], expect: { testidAbsent: ["title-screen"] } },
    { id: "02-walk", note: "하린 앞까지 걷는다", shot: true,
      ops: [{ kind: "playerRoute", moves: [{ kind: "move", dir: "up" }, { kind: "move", dir: "up" }, { kind: "move", dir: "up" }] }, { kind: "waitForPosition", mapId: "map_blank_start", x: 12, y: 7, timeoutMs: 20000 }, ...stable] },
    { id: "03-talk", note: "말 걸기 — 초상과 도입 대사", shot: true,
      ops: [{ kind: "face", dir: "up" }, { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present" }, ...long],
      expect: { testidPresent: ["dialogue-box"] } },
    { id: "04-choices", note: "선택지 둘", shot: true,
      ops: [{ kind: "pressUntil", key: "Enter", testid: "runtime-choices", maxPresses: 10, settleMs: 400 }, ...long],
      expect: { testidPresent: ["runtime-choices"] } },
    { id: "05-reaction", note: "첫째 선택 → 하린의 반응", shot: true,
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForText", testid: "dialogue-box", text: "나만 그런 줄" }, ...long], expect: { testidPresent: ["dialogue-box"] } },
  ],
};
