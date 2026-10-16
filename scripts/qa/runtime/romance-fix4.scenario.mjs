// 연애 수리 4 — 호감 선택 → ESC 호감 일치 → HUD 가림 → 호감에 따라 갈리는 엔딩. 출하 플레이어(player.html + shim)로 본다.
// 입력: output/qa/romance-fix4/project.json + proof.json (scripts/qa/romance-fix/fix4-fixture.mts). 선택은 FIX4_PICK=0|1|2 (해피·평범·혼자).
import fs from "node:fs";
import path from "node:path";
const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "output/qa/romance-fix4/project.json";
const proof = JSON.parse(fs.readFileSync(path.join(path.dirname(projectFixture), "proof.json"), "utf8"));
const pick = Number(process.env.FIX4_PICK ?? 0);
const endingName = [proof.endingNames.happy, proof.endingNames.normal, proof.endingNames.solo][pick];
const stable = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 40, deltaMs: 16 }, { kind: "resumeFrames" }];
const settle = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 150, deltaMs: 16 }, { kind: "resumeFrames" }];
const enter = { kind: "key", key: "Enter" };
const tp = (s) => ({ kind: "teleport", mapId: s.mapId ?? proof.mapId, x: s.x, y: s.y });
export default { id: `romance-fix4-pick${pick}`, projectFixture, beats: [
  { id: "title", shot: true, expect: { testidPresent: ["title-screen"] } },
  { id: "01-start", note: "시작 — HUD 는 모서리 시계 칩 하나뿐", shot: true, ops: [enter, { kind: "waitForRuntime" }, ...settle, ...settle], expect: { testidAbsent: ["title-screen"] } },
  { id: "02-starter", note: "수첩을 읽는다(핵심 행동)", shot: true, ops: [{ kind: "playerRoute", moves: proof.starter.moves }, { kind: "waitForPosition", mapId: proof.mapId, x: proof.starter.at.x, y: proof.starter.at.y, timeoutMs: 30000 }, ...stable, { kind: "face", dir: proof.starter.face }, { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 40000 }, ...stable], expect: {} },
  { id: "03-starter-close", shot: false, ops: [{ kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 12 }, ...settle], expect: {} },
  { id: "04-top", note: "지도 위쪽에 선 모습 — 시계 칩이 아래로 비켜 플레이어를 안 가린다", shot: true, ops: [tp(proof.top), ...settle, ...settle], expect: {} },
  { id: "05-board", note: "호감 선택지", shot: true, ops: [tp(proof.board.at), ...settle, { kind: "face", dir: proof.board.face }, { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 40000 }, ...stable, enter, ...stable, enter, ...stable, { kind: "waitFor", testid: "runtime-choices", state: "present", timeoutMs: 40000 }, ...stable], expect: {} },
  { id: "06-picked", note: "선택 직후 대사를 닫은 화면 — 호감 칩이 3초 보인다", shot: true, ops: [...(pick > 0 ? [{ kind: "key", key: "ArrowDown", times: pick }] : []), enter, ...stable, { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 12 }, { kind: "pauseFrames" }, { kind: "stepFrames", frames: 20, deltaMs: 16 }, { kind: "resumeFrames" }], expect: {} },
  { id: "07-settled", note: "3초 뒤 — 칩이 사라지고 화면이 비어 있다", shot: true, ops: [{ kind: "waitForAttr", testid: "hud-widget-affection", attr: "hidden", value: "", timeoutMs: 12000 }, ...settle], expect: {} },
  { id: "08-esc", note: "ESC 호감도 — 선택 결과와 일치", shot: true, ops: [{ kind: "key", key: "Escape" }, { kind: "waitFor", testid: "main-menu", state: "present" }, ...stable], expect: {} },
  { id: "09-esc-close", shot: false, ops: [{ kind: "pressUntil", key: "Escape", testid: "main-menu", state: "absent", maxPresses: 4 }, ...settle], expect: {} },
  { id: "10-end-door", note: "산책로 끝", shot: true, ops: [tp(proof.end), ...settle, { kind: "face", dir: proof.end.face }, { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 40000 }, ...stable], expect: {} },
  { id: "11-ending", note: `엔딩 화면 — 「${endingName}」`, shot: true, ops: [{ kind: "pressUntil", key: "Enter", testid: "ending-screen", state: "present", maxPresses: 30 }, { kind: "waitForText", testid: "ending-screen", text: endingName, timeoutMs: 60000 }, { kind: "pauseFrames" }, { kind: "stepFrames", frames: 600, deltaMs: 16 }, { kind: "resumeFrames" }], expect: { testidPresent: ["ending-screen"] } },
] };
