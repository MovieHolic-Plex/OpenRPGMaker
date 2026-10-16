// 조수가 지은 연애 한 편의 출하 플레이어 캡처 — 새 게임 → 첫 인물의 아침 자리까지 걷기 → 대화 → 호감 하트 → ESC 관계.
// 입력: output/qa/<id>/{project,proof}.json (scripts/qa/romance-fix2/run-proof.mts). 저작 내용 쓰기 없음.
import fs from "node:fs";
import path from "node:path";
const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "output/qa/romance-run/project.json";
const proof = JSON.parse(fs.readFileSync(path.join(path.dirname(projectFixture), "proof.json"), "utf8"));
const { mapId, pick } = proof;
const skipThenNext = [enter0(), ...[{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 40, deltaMs: 16 }, { kind: "resumeFrames" }], enter0()];
function enter0() { return { kind: "key", key: "Enter" }; }
const stable = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 40, deltaMs: 16 }, { kind: "resumeFrames" }];
const settle = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 150, deltaMs: 16 }, { kind: "resumeFrames" }];
const enter = { kind: "key", key: "Enter" };
const key = (k, times = 1) => ({ kind: "key", key: k, times });
export default {
  id: "romance-run",
  projectFixture,
  beats: [
    { id: "title", expect: { testidPresent: ["title-screen"] } },
    { id: "01-start", note: "새 게임 → 캠퍼스 첫 화면(호감 HUD·시계)", shot: true, ops: [enter, { kind: "waitForRuntime" }, ...settle, ...settle], expect: { mapId, testidPresent: ["field-hud"] } },
    { id: "02-walk", note: `${pick.name} 옆까지 걷는다`, shot: true,
      ops: [{ kind: "playerRoute", moves: proof.moves }, { kind: "waitForPosition", mapId, x: proof.arrive.x, y: proof.arrive.y, timeoutMs: 60000 }, ...stable], expect: { x: proof.arrive.x, y: proof.arrive.y } },
    { id: "03-talk", note: `${pick.name}와 대화`, shot: true,
      ops: [{ kind: "face", dir: proof.face }, { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present" }, { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 }, ...stable], expect: { testidPresent: ["dialogue-box"] } },
    { id: "04-feedback", note: "호감 +10 · 남은 시간 2", shot: true,
      ops: [...Array.from({ length: proof.lineCount }, () => skipThenNext).flat(), ...(proof.hasChoices ? [{ kind: "waitFor", testid: "runtime-choices", state: "present" }, ...stable, enter, ...stable, ...skipThenNext] : []), { kind: "waitForText", testid: "dialogue-box", text: "남은 시간 2" }, { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 }, ...stable], expect: { testidPresent: ["dialogue-box"] } },
    { id: "05-close", note: "대화를 닫는다 — 호감 하트", shot: true, ops: [enter, { kind: "waitFor", testid: "dialogue-box", state: "absent" }, ...settle], expect: { testidAbsent: ["dialogue-box"] } },
    { id: "06-esc-relationships", note: "ESC → 기록 → 관계", shot: true,
      ops: [key("Escape"), { kind: "waitFor", testid: "main-menu", state: "present" }, ...stable, key("ArrowDown", 4), key("ArrowRight"), ...stable, key("ArrowDown", 2), key("Enter"), ...stable],
      expect: { testidPresent: [`status-menu-relationship-${pick.characterId}`] } },
  ],
};
