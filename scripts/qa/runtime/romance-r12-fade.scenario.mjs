// R12 증거: 연애 3명과 차례로 대화한 뒤 다음 날 06:00 필드가 «어두운 채로 남는지» 보려고 대사 직후와 뒤늦게 두 번 찍는다. (romance-real-2 의 romance-r2-heroine 에서 파생)
// 시작 맵의 인물들을 차례로 걸어가 말 걸고(선택지는 첫 항목) 대사를 끝까지 넘긴 뒤 HUD·ESC 호감.
import fs from "node:fs";
import path from "node:path";
const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "output/qa/r2-c/project.json";
const proof = JSON.parse(fs.readFileSync(path.join(path.dirname(projectFixture), "proof3.json"), "utf8"));
const settle = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 150, deltaMs: 16 }, { kind: "resumeFrames" }];
const stable = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 40, deltaMs: 16 }, { kind: "resumeFrames" }];
const enter = { kind: "key", key: "Enter" };
const beats = [{ id: "01-start", shot: false, ops: [enter, { kind: "waitForRuntime" }, ...settle, ...settle], expect: {} }];
proof.steps.forEach((s, i) => {
  beats.push({ id: `0${i + 2}a-walk-${i}`, shot: false, ops: [{ kind: "playerRoute", moves: s.moves }, { kind: "waitForPosition", mapId: s.mapId, x: s.x, y: s.y, timeoutMs: 60000 }, ...stable], expect: {} });
  beats.push({ id: `0${i + 2}b-talk-${i}`, note: `${s.name} 와 대화`, shot: true, ops: [{ kind: "face", dir: s.face }, { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present" }, { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 }, ...stable, enter, ...stable, enter, ...stable], expect: {} });
  beats.push({ id: `0${i + 2}c-done-${i}`, note: `${s.name} 대사 끝 — HUD`, shot: true, ops: [{ kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 30 }, ...settle], expect: {} });
});
for (let i = 1; i <= 6; i += 1) {
  const step = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 60, deltaMs: 16 }, { kind: "resumeFrames" }];
  beats.push({ id: `08-later-${i}`, note: `대사 끝 + 설정 150프레임 뒤 ${i}초(고정 프레임 60×${i})`, shot: true, ops: step, expect: {} });
}
beats.push({ id: "09-esc", note: "ESC 호감", shot: true, ops: [{ kind: "key", key: "Escape" }, { kind: "waitFor", testid: "main-menu", state: "present" }, ...stable], expect: {} });
export default { id: "romance-r12-fade", projectFixture, beats };
