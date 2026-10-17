// 수리 PR(vn-review-2) — 불러온 뒤에도 엔딩·CG 가 남는지, 엔딩 목록 12행 스크롤, 뷰어 닫기 단추.
//   bun scripts/qa/runtime/romance-vn-ui4-fixture.mts output/qa/vn4 [ko|en]  →  node scripts/runtime-qa.mjs --scenario romance-vn-ui4 [--project output/qa/vn4/project.json]
import fs from "node:fs";
import path from "node:path";
const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "output/qa/vn4/project.json";
const proof = JSON.parse(fs.readFileSync(path.join(path.dirname(projectFixture), "proof.json"), "utf8"));
const stable = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 40, deltaMs: 16 }, { kind: "resumeFrames" }];
const settle = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 150, deltaMs: 16 }, { kind: "resumeFrames" }];
const key = (k, times = 1) => ({ kind: "key", key: k, times });
const present = (testid) => ({ kind: "waitFor", testid, state: "present" });
const absent = (testid) => ({ kind: "waitFor", testid, state: "absent" });
const text = (testid, value) => ({ kind: "waitForText", testid, text: value });
const en = proof.language === "en";

export default {
  id: "romance-vn-ui4",
  projectFixture,
  localStorageSeed: {
    "{ns}:clear-record:v1": JSON.stringify({ endingIds: [proof.seenEnding], clearCount: 1, clearedAt: "2026-10-16T12:00:00.000Z", carry: {} }),
  },
  beats: [
    { id: "title", note: "연애 타이틀", shot: false, expect: { testidPresent: ["title-screen"] } },
    { id: "01-start", note: "새 게임 → 캠퍼스", ops: [key("Enter"), { kind: "waitForRuntime" }, ...settle, ...settle], expect: { mapId: proof.mapId, testidAbsent: ["title-screen"] } },
    { id: "01b-step", note: "한 칸 걷는다(상대 앞 한 칸 전)", ops: [{ kind: "playerRoute", moves: proof.moves.slice(0, 1) }, { kind: "waitForPosition", mapId: proof.mapId, x: proof.at.x, y: proof.at.y + 1, timeoutMs: 30000 }, ...stable], expect: { mapId: proof.mapId } },
    { id: "02-save-before-cg", note: "CG 를 열기 전에 1번 칸에 저장한다(이 저장에는 해금이 없다)", ops: [{ kind: "face", dir: "down" }, ...stable, key("Escape"), present("main-menu"), key("ArrowDown", 5), key("Enter"), present("save-slot-1"), key("Enter"), ...stable], expect: { testidPresent: ["save-slot-1"] } },
    { id: "03-back", note: "메뉴를 닫는다", ops: [key("Escape"), key("Escape"), absent("main-menu"), ...settle] },
    { id: "04-walk", note: "상대 옆까지 마저 걷는다", ops: [{ kind: "playerRoute", moves: proof.moves.slice(1) }, { kind: "waitForPosition", mapId: proof.mapId, x: proof.at.x, y: proof.at.y, timeoutMs: 30000 }, ...stable], expect: { mapId: proof.mapId } },
    { id: "05-talk", note: "대화 시작", ops: [{ kind: "face", dir: proof.face }, { kind: "action" }, present("dialogue-box"), ...stable] },
    { id: "06-to-choices", note: "선택지까지", ops: [{ kind: "pressUntil", key: "Enter", testid: "runtime-choices", state: "present", maxPresses: 16 }, ...stable], expect: { testidPresent: ["runtime-choices"] } },
    { id: "07-choose", note: "1 — CG 1장 해금", ops: [key("1"), text("dialogue-box", "추천할게."), ...stable] },
    { id: "08-close", note: "대사를 닫는다", ops: [{ kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 6 }, ...settle], expect: { testidAbsent: ["dialogue-box"] } },
    { id: "09-gallery-open", note: "해금 직후 갤러리 — 그림 1 이 열려 있다", shot: true, ops: [key("Escape"), present("main-menu"), key("ArrowUp", 3), key("Enter"), present("status-menu-gallery-0"), ...stable], expect: { testidPresent: ["status-menu-gallery-0"], testidAbsent: ["status-menu-gallery-locked-0"] } },
    { id: "10-load-old", note: "해금 전에 저장한 1번 칸을 ESC 에서 불러온다", ops: [key("ArrowLeft"), key("ArrowDown", 4), key("Enter"), present("load-slot-1"), key("Enter"), { kind: "waitForRuntime" }, ...settle, ...settle], expect: { testidAbsent: ["main-menu"] } },
    { id: "10b-dismiss", note: "불러온 자리의 이벤트 대사가 떠 있으면 닫는다", ops: [{ kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 8 }, ...settle], expect: { testidAbsent: ["dialogue-box"] } },
    { id: "11-gallery-after-load", note: "불러온 뒤에도 기기에 남은 그림 1 은 열려 있다(칸별 저장이 아니다)", shot: true, ops: [key("Escape"), present("main-menu"), key("ArrowUp", 4), key("Enter"), present("status-menu-gallery-0"), ...stable], expect: { testidPresent: ["status-menu-gallery-0"], testidAbsent: ["status-menu-gallery-locked-0"] } },
    { id: "12-viewer", note: "뷰어 — 「닫기」 단추와 캡션 글자 크기가 균형을 이룬다", shot: true, ops: [key("ArrowRight"), key("Enter"), present("gallery-viewer"), ...stable], expect: { testidPresent: ["gallery-viewer"] } },
    { id: "13-endings-after-load", note: "불러온 뒤 엔딩 목록 — 본 엔딩이 0 으로 초기화되지 않는다", shot: true, ops: [key("Escape"), absent("gallery-viewer"), key("ArrowLeft"), key("ArrowDown"), key("Enter"), present("status-menu-endings-summary"), ...stable], expect: { testidPresent: ["status-menu-endings-summary", "status-menu-endings-checklist-char_suhyun"] } },
    { id: "14a-endings-scroll-1", note: "↓ 한 번 — 체크리스트 7번째 행부터", shot: true, ops: [key("ArrowDown", 1), ...stable] },
    { id: "14b-endings-scroll-2", note: "↓ 두 번 — 12명 체크리스트 끝과 「공통」 행", shot: true, ops: [key("ArrowDown", 1), ...stable] },
    { id: "14c-endings-wheel-up", note: "마우스 휠로 위로 — 휠도 목록을 스크롤한다(차단기가 삼키지 않는다)", shot: true, ops: [{ kind: "wheel", testid: ".status-menu-detail-list", deltaY: -400 }, ...stable] },
    { id: "15-endings-scroll-end", note: "맨 아래 — 마지막 행(공통)이 보인다", shot: true, ops: [key("ArrowDown", 12), ...stable] },
  ],
};
