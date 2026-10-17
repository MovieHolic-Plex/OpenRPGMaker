// 미연시 2단계 — 출하 플레이어에서: 새 게임 → 대화로 CG 1장 해금 → ESC 메뉴 → 갤러리(잠긴 칸) → 엔딩 목록(체크리스트·가림) → 저장 → 저장 칸 카드(날짜+마지막 대사) → 불러오기 패널.
// 입력: output/qa/vn2/{project,proof}.json (bun scripts/qa/runtime/romance-vn-ui2-fixture.mts output/qa/vn2 [ko|en] 가 만든다).
//   node scripts/runtime-qa.mjs --scenario romance-vn-ui2 [--project output/qa/vn2-en/project.json]
// 「이 기기에 이미 본 엔딩」은 localStorage 시드(클리어 기록)로 심는다 — 엔딩 하나(좋은 사이로)만 본 상태.
import fs from "node:fs";
import path from "node:path";
const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "output/qa/vn2/project.json";
const proof = JSON.parse(fs.readFileSync(path.join(path.dirname(projectFixture), "proof.json"), "utf8"));
const stable = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 40, deltaMs: 16 }, { kind: "resumeFrames" }];
const settle = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 150, deltaMs: 16 }, { kind: "resumeFrames" }];
const key = (k, times = 1) => ({ kind: "key", key: k, times });
const present = (testid) => ({ kind: "waitFor", testid, state: "present" });
const absent = (testid) => ({ kind: "waitFor", testid, state: "absent" });
const text = (testid, value) => ({ kind: "waitForText", testid, text: value });
const en = proof.language === "en";
export default {
  id: "romance-vn-ui2",
  projectFixture,
  localStorageSeed: {
    "{ns}:clear-record:v1": JSON.stringify({ endingIds: [proof.seenEnding], clearCount: 1, clearedAt: "2026-10-16T12:00:00.000Z", carry: {} }),
  },
  beats: [
    { id: "title", note: "연애 타이틀", shot: false, expect: { testidPresent: ["title-screen"] } },
    { id: "01-start", note: "새 게임 → 캠퍼스", ops: [key("Enter"), { kind: "waitForRuntime" }, ...settle, ...settle], expect: { mapId: proof.mapId, testidAbsent: ["title-screen"] } },
    { id: "02-walk", note: "상대 옆까지 걷는다", ops: [{ kind: "playerRoute", moves: proof.moves }, { kind: "waitForPosition", mapId: proof.mapId, x: proof.at.x, y: proof.at.y, timeoutMs: 30000 }, ...stable], expect: { mapId: proof.mapId } },
    { id: "03-talk", note: "대화 시작", ops: [{ kind: "face", dir: proof.face }, { kind: "action" }, present("dialogue-box"), ...stable] },
    { id: "04-to-choices", note: "선택지까지", ops: [{ kind: "pressUntil", key: "Enter", testid: "runtime-choices", state: "present", maxPresses: 16 }, ...stable], expect: { testidPresent: ["runtime-choices"] } },
    { id: "05-choose", note: "1 — 같이 읽는다. CG 1장 해금 + 호감 +10", ops: [key("1"), text("dialogue-box", "추천할게."), ...stable] },
    { id: "06-close", note: "대사를 닫는다", ops: [{ kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 6 }, ...settle], expect: { testidAbsent: ["dialogue-box"] } },
    { id: "07-esc-menu", note: "ESC 메뉴 — 갤러리·엔딩 항목이 보인다", shot: true, ops: [key("Escape"), present("main-menu"), ...stable], expect: { testidPresent: ["main-menu"] } },
    { id: "08-gallery", note: "갤러리 — 연 CG 1장 + 잠긴 칸 3개(「???」) + 본 엔딩 회상 1줄", shot: true,
      ops: [key("ArrowDown", 2), key("Enter"), present("status-menu-gallery-0"), ...stable], expect: { testidPresent: ["status-menu-gallery-0", "status-menu-gallery-locked-1", "status-menu-gallery-ending-0"] } },
    { id: "09-gallery-viewer", note: "→ 로 목록에 들어가 결정 — 연 CG 를 화면 가득 본다", shot: true,
      ops: [key("ArrowRight"), key("Enter"), present("gallery-viewer"), ...stable], expect: { testidPresent: ["gallery-viewer"] } },
    { id: "10-gallery-locked", note: "뷰어를 닫고 ↓ — 잠긴 칸은 건너뛰고 엔딩 회상 줄로 커서가 간다", shot: true,
      ops: [key("Escape"), absent("gallery-viewer"), key("ArrowDown"), ...stable] },
    { id: "11-ending-recall", note: "엔딩 회상 — 본 엔딩(좋은 사이로)의 글을 백로그 뷰어로 다시 읽는다", shot: true,
      ops: [key("Enter"), present("dialogue-backlog"), ...stable], expect: { testidPresent: ["dialogue-backlog"] } },
    { id: "12-endings", note: "엔딩 목록 — 달성 1/3, 서수현 체크리스트(해피·평범·혼자), 못 본 엔딩은 「???」", shot: true,
      ops: [key("Escape"), absent("dialogue-backlog"), key("ArrowLeft"), key("ArrowDown"), key("Enter"), present("status-menu-endings-summary"), ...stable], expect: { testidPresent: ["status-menu-endings-summary", "status-menu-endings-checklist-char_suhyun"] } },
    { id: "13-save", note: "저장 — 칸을 고르면 날짜·마지막 대사가 함께 저장된다", shot: true,
      ops: [key("ArrowLeft"), key("ArrowDown", 2), key("Enter"), present("save-slot-1"), ...stable] },
    { id: "14-save-card", note: "저장 뒤 칸에 날짜 + 마지막 대사 한 줄", shot: true,
      ops: [key("Enter"), ...stable] },
    { id: "15-load", note: "불러오기 화면 — 같은 저장 칸이 날짜 + 마지막 대사 한 줄과 함께 보인다", shot: true,
      ops: [key("ArrowLeft"), key("ArrowDown"), key("Enter"), present("load-slot-1"), ...stable], expect: { testidPresent: ["load-slot-1"] } },
  ],
};
