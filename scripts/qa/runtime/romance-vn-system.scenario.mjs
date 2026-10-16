// 미연시 시스템 UI 1단계 — 출하 플레이어에서: 대사 → 오토 → 스킵(읽지 않은 글에서 멈춤) → 숨기기/복귀 → 백로그 열기·스크롤·닫기
// → 선택지(오토·스킵이 멈춘다) → ESC 메뉴 백로그 → 설정 화면(새 항목) → 저장 → 불러오기 → 백로그가 남아 있다.
// 입력: output/qa/romance-vn/{project,proof}.json (scripts/qa/runtime/romance-vn-system-fixture.mts 가 만든다). 저작 내용 쓰기 없음.
//   bun scripts/qa/runtime/romance-vn-system-fixture.mts output/qa/romance-vn [ko|en]
//   node scripts/runtime-qa.mjs --scenario romance-vn-system [--project output/qa/romance-vn-en/project.json]
import fs from "node:fs";
import path from "node:path";
const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "output/qa/romance-vn/project.json";
const proof = JSON.parse(fs.readFileSync(path.join(path.dirname(projectFixture), "proof.json"), "utf8"));
const stable = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 40, deltaMs: 16 }, { kind: "resumeFrames" }];
const settle = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 150, deltaMs: 16 }, { kind: "resumeFrames" }];
const key = (k, times = 1) => ({ kind: "key", key: k, times });
const present = (testid) => ({ kind: "waitFor", testid, state: "present" });
const absent = (testid) => ({ kind: "waitFor", testid, state: "absent" });
const text = (testid, value) => ({ kind: "waitForText", testid, text: value });
// 한 줄: 첫 Enter = 타이핑 건너뛰기, 둘째 Enter = 다음 줄.
const next = [key("Enter"), key("Enter")];
const en = proof.language === "en";
export default {
  id: "romance-vn-system",
  projectFixture,
  beats: [
    { id: "title", note: "연애 타이틀", shot: false, expect: { testidPresent: ["title-screen"] } },
    { id: "01-start", note: "새 게임 → 캠퍼스", ops: [key("Enter"), { kind: "waitForRuntime" }, ...settle, ...settle], expect: { mapId: proof.mapId, testidAbsent: ["title-screen"] } },
    { id: "02-walk", note: "상대 옆까지 걷는다",
      ops: [{ kind: "playerRoute", moves: proof.moves }, { kind: "waitForPosition", mapId: proof.mapId, x: proof.at.x, y: proof.at.y, timeoutMs: 30000 }, ...stable],
      expect: { mapId: proof.mapId, x: proof.at.x, y: proof.at.y } },
    { id: "03-dialogue-bar", note: "대사창 — 오른쪽 위에 오토·스킵·백로그·숨기기 단추 줄(단축키 A·S·L·H)", shot: true,
      ops: [{ kind: "face", dir: proof.face }, { kind: "action" }, present("dialogue-box"), { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 }, text("dialogue-box", "그 작가 좋아하는데"), ...stable],
      expect: { testidPresent: ["dialogue-box", "dialogue-bar", "dialogue-bar-auto", "dialogue-bar-skip", "dialogue-bar-backlog", "dialogue-bar-hide"] } },
    { id: "04-auto-on", note: "A — 오토 켬(단추가 켜진 색). 글이 다 나온 뒤 읽을 시간만큼 기다렸다가 스스로 다음 줄로 넘어간다", shot: true,
      ops: [key("a"), { kind: "waitForAttr", testid: "dialogue-bar-auto", attr: "aria-pressed", value: "true" }, ...stable],
      expect: { testidPresent: ["dialogue-bar-auto"] } },
    { id: "05-auto-advanced", note: "손대지 않았는데 둘째 줄이 떴다(오토)", shot: true,
      ops: [text("dialogue-box", "서수현이야"), ...stable], expect: { testidPresent: ["dialogue-box"] } },
    { id: "06-skip-stops-unread", note: "S — 스킵. 「읽은 글만」 범위라 아직 읽지 않은 글에서 바로 멈추고 이유를 알린다", shot: true,
      ops: [key("s"), text("dialogue-bar-notice", en ? "unread" : "읽지"), { kind: "waitForVisible", testid: "dialogue-bar-notice", minAlpha: 0.9 }, ...stable],
      expect: { testidPresent: ["dialogue-bar-notice"], visibleText: { "dialogue-bar-notice": en ? "Stopped at unread text" : "읽지 않은 글에서 멈췄습니다" } } },
    { id: "07-hidden", note: "H — 대사창 숨기기. 장면만 보인다", shot: true,
      ops: [key("h"), { kind: "waitForAttr", testid: "dialogue-box", attr: "data-dialogue-phase", value: "shown" }, ...stable] },
    { id: "08-restore", note: "아무 키나(X) — 창이 돌아온다. 그 키는 게임에 닿지 않는다", shot: true,
      ops: [key("x"), { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 }, ...stable], expect: { testidPresent: ["dialogue-box", "dialogue-bar"] } },
    { id: "09-backlog-open", note: "L — 백로그: 지금까지 나온 줄이 화자와 함께 아래가 최신으로 쌓여 있다", shot: true,
      ops: [key("l"), present("dialogue-backlog"), { kind: "waitForVisible", testid: "dialogue-backlog", minAlpha: 0.95 }, ...stable],
      expect: { testidPresent: ["dialogue-backlog", "dialogue-backlog-list"] } },
    { id: "10-backlog-scroll", note: "↑ 로 넘겨 본다", shot: true, ops: [key("ArrowUp", 6), key("Home"), ...stable], expect: { testidPresent: ["dialogue-backlog"] } },
    { id: "11-backlog-close", note: "Esc — 닫으면 대사는 그대로", shot: true, ops: [key("Escape"), absent("dialogue-backlog"), ...stable], expect: { testidAbsent: ["dialogue-backlog"], testidPresent: ["dialogue-box"] } },
    // 조건 대기로 넘긴다 — 선택지가 뜨는 순간 멈추므로 초과 입력이 없다.
    { id: "12-to-choices", note: "남은 줄을 넘겨 선택지가 뜰 때까지", ops: [{ kind: "pressUntil", key: "Enter", testid: "runtime-choices", state: "present", maxPresses: 16 }, ...stable], expect: { testidPresent: ["runtime-choices"] } },
    { id: "13-choices", note: "선택지 — 오토·스킵·숨기기 단추가 사라지고 스스로 고르지 않는다", shot: true, ops: [{ kind: "waitForVisible", testid: "runtime-choices", minAlpha: 0.95 }, ...stable], expect: { testidPresent: ["runtime-choices"] } },
    { id: "14-after-choice", note: "1 — 첫 선택지를 고른다. 호감 +10", shot: true,
      ops: [key("1"), text("dialogue-box", "반가운 듯"), text("dialogue-box", "추천할게."), ...stable], expect: { testidPresent: ["dialogue-box"] } },
    { id: "15-close", note: "대사를 닫는다", ops: [{ kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 6 }, ...settle], expect: { testidAbsent: ["dialogue-box"] } },
    { id: "16-esc-menu", note: "ESC 메뉴 — 호감도·일정·소지품·백로그·저장·불러오기·설정·타이틀로", shot: true,
      ops: [key("Escape"), present("main-menu"), ...stable], expect: { testidPresent: ["main-menu"] } },
    { id: "17-menu-backlog", note: "백로그 항목 — 위에 「지난 대사 읽기」, 아래에 최근 대사 미리보기", shot: true,
      ops: [key("ArrowDown", 2), key("Enter"), present("status-menu-backlog-open"), ...stable], expect: { testidPresent: ["status-menu-backlog-open", "status-menu-backlog-recent-0"] } },
    { id: "18-menu-backlog-viewer", note: "결정키 — 전체 화면 백로그. 선택지로 고른 항목(▶)이 함께 남아 있다", shot: true,
      ops: [key("Enter"), present("dialogue-backlog"), { kind: "waitForVisible", testid: "dialogue-backlog", minAlpha: 0.95 }, ...stable], expect: { testidPresent: ["dialogue-backlog"] } },
    { id: "19-menu-backlog-closed", note: "Esc — 뷰어만 닫히고 메뉴는 남는다", ops: [key("Escape"), absent("dialogue-backlog"), ...stable], expect: { testidAbsent: ["dialogue-backlog"], testidPresent: ["main-menu"] } },
    { id: "20-options", note: "설정 — 오토 속도·스킵 범위·대사창 투명도가 더해졌다", shot: true,
      ops: [key("Escape"), key("ArrowDown", 3), key("Enter"), present("player-option-window-opacity"), ...stable], expect: { testidPresent: ["player-option-auto-speed", "player-option-skip-scope", "player-option-window-opacity", "player-option-text-speed"] } },
  ],
};
