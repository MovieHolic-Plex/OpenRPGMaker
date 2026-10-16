// 다인 연애 캠퍼스 일상 — 출하 플레이어에서: 인물 셋이 시간대(아침·낮·저녁)마다 다른 곳에 서 있고,
// 만날 때마다 시간대가 한 칸 가며, 호감 하트가 인물 여럿으로 늘어나고, ESC 관계 탭에 호감이 보이는가.
// 입력: output/qa/romance-multi/{project,proof}.json (scripts/qa/romance-fix2/multi-fixture.mts). 저작 내용 쓰기 없음.
import fs from "node:fs";
import path from "node:path";
const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "output/qa/romance-multi/project.json";
const proof = JSON.parse(fs.readFileSync(path.join(path.dirname(projectFixture), "proof.json"), "utf8"));
const { mapId, spots: S, placed } = proof;
const yuna = placed.char_yuna.eventId, seoyeon = placed.char_seoyeon.eventId, minji = placed.char_minji.eventId;
const stable = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 40, deltaMs: 16 }, { kind: "resumeFrames" }];
const settle = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 150, deltaMs: 16 }, { kind: "resumeFrames" }];
const enter = { kind: "key", key: "Enter" };
const key = (k, times = 1) => ({ kind: "key", key: k, times });
const talk = (face) => [{ kind: "face", dir: face }, { kind: "action" }, { kind: "waitFor", testid: "dialogue-box", state: "present" }, { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 }, ...stable];
const skipThenNext = [enter, ...stable, enter];
const feedback = (text) => [{ kind: "waitForText", testid: "dialogue-box", text }, { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 }, ...stable];
const closeFeedback = [enter, { kind: "waitFor", testid: "dialogue-box", state: "absent" }, ...settle];
const at = (eventId, spot) => ({ kind: "waitForEventAt", eventId, mapId, x: spot.x, y: spot.y, timeoutMs: 60000 });
const walk = (step) => [{ kind: "playerRoute", moves: step.moves }, { kind: "waitForPosition", mapId, x: step.arrive.x, y: step.arrive.y, timeoutMs: 60000 }, ...stable];
const [s1, s2, s3, s4] = proof.steps;
export default {
  id: "romance-multi",
  projectFixture,
  beats: [
    { id: "title", expect: { testidPresent: ["title-screen"] } },
    { id: "01-start", note: "새 게임 → 아침 06:00, 월요일. 세 사람이 아침 자리에 있다(유나 강의동 앞·서연 대강의동 앞·민지 기숙사 앞)", shot: true,
      ops: [enter, { kind: "waitForRuntime" }, ...settle, ...settle, at(yuna, S.lecture), at(seoyeon, S.hall), at(minji, S.dorm)], expect: { mapId, testidPresent: ["field-hud"] } },
    { id: "02-walk-yuna", note: "유나 옆까지 걷는다", shot: true, ops: walk(s1), expect: { mapId, x: s1.arrive.x, y: s1.arrive.y } },
    { id: "03-talk-yuna", note: "유나와 대화(월요일 = 수업 많은 날 페이지)", shot: true, ops: [...talk(s1.face), { kind: "waitForText", testid: "dialogue-box", text: "수업이 많은 날" }], expect: { testidPresent: ["dialogue-box"] } },
    { id: "04-feedback-yuna", note: "호감 +10 · 남은 시간 2", shot: true, ops: [...skipThenNext, ...feedback("남은 시간 2")], expect: { testidPresent: ["dialogue-box"] } },
    { id: "05-midday", note: "대화를 닫으면 낮 — 세 사람이 낮 자리로 옮겨 있다(유나 광장·서연 연구동·민지 학과동). HUD 에 호감 둘 이상이면 목록", shot: true,
      ops: [...closeFeedback, at(yuna, S.plaza), at(seoyeon, S.lab), at(minji, S.dept), ...settle], expect: { testidAbsent: ["dialogue-box"] } },
    { id: "06-walk-minji", note: "낮의 민지(학과동 앞) 옆으로 걷는다", shot: true, ops: walk(s2), expect: { x: s2.arrive.x, y: s2.arrive.y } },
    { id: "07-talk-minji", note: "민지와 대화", shot: true, ops: talk(s2.face), expect: { testidPresent: ["dialogue-box"] } },
    { id: "08-feedback-minji", note: "호감 +10 · 남은 시간 1", shot: true, ops: [...skipThenNext, ...feedback("남은 시간 1")], expect: { testidPresent: ["dialogue-box"] } },
    { id: "09-evening", note: "저녁 — 유나 기숙사 앞·서연 광장·민지 강의동 앞. 호감 하트가 유나·민지 둘", shot: true,
      ops: [...closeFeedback, at(yuna, S.dorm), at(seoyeon, S.plaza), at(minji, S.lecture), ...settle], expect: { testidAbsent: ["dialogue-box"] } },
    { id: "10-walk-seoyeon", note: "저녁의 서연(광장 분수) 옆으로 걷는다", shot: true, ops: walk(s3), expect: { x: s3.arrive.x, y: s3.arrive.y } },
    { id: "11-talk-seoyeon", note: "서연과 대화 — 마지막 칸", shot: true, ops: talk(s3.face), expect: { testidPresent: ["dialogue-box"] } },
    { id: "12-feedback-seoyeon", note: "호감 +10 · 하루가 저문다", shot: true, ops: [...skipThenNext, ...feedback("하루가 저문다")], expect: { testidPresent: ["dialogue-box"] } },
    { id: "13-next-day", note: "이튿날 아침(화요일) — 남은 시간 3/3 으로 되돌아가고, 세 사람이 다시 아침 자리(유나 강의동 앞·서연 대강의동 앞·민지 기숙사 앞)에 선다. 호감 하트는 셋",
      shot: true, ops: [...closeFeedback, at(yuna, S.lecture), at(seoyeon, S.hall), at(minji, S.dorm), ...settle], expect: { testidAbsent: ["dialogue-box"] } },
    { id: "14-walk-yuna-day2", note: "화요일 아침의 유나 옆으로 걷는다", shot: true, ops: walk(s4), expect: { x: s4.arrive.x, y: s4.arrive.y } },
    { id: "15-talk-yuna-day2", note: "같은 사람, 다른 날 — 화요일은 동아리 모임 페이지(월요일의 수업 페이지가 아니다)", shot: true,
      ops: [...talk(s4.face), { kind: "waitForText", testid: "dialogue-box", text: "동아리 모임" }], expect: { testidPresent: ["dialogue-box"] } },
    { id: "16-feedback-yuna-day2", note: "유나 호감 20 → 문턱(20)에 닿는다", shot: true, ops: [...skipThenNext, ...feedback("남은 시간 2")], expect: { testidPresent: ["dialogue-box"] } },
    { id: "17-close", note: "대화를 닫는다 — 하트 셋(유나 20·민지 10·서연 10)", shot: true, ops: closeFeedback, expect: { testidAbsent: ["dialogue-box"] } },
    { id: "18-esc-menu", note: "ESC — 첫 화면", shot: true, ops: [key("Escape"), { kind: "waitFor", testid: "main-menu", state: "present" }, ...stable], expect: { testidPresent: ["main-menu"] } },
    { id: "19-esc-record", note: "ESC → 기록 묶음", shot: true, ops: [key("ArrowDown", 4), key("ArrowRight"), ...stable], expect: { testidPresent: ["main-menu"] } },
    { id: "20-esc-relationships", note: "기록 → 관계 — 호감이 기록된 사람이 높은 순으로 이름과 함께 보인다", shot: true, ops: [key("ArrowDown", 2), key("Enter"), ...stable],
      expect: { testidPresent: ["status-menu-relationship-char_yuna", "status-menu-relationship-char_minji", "status-menu-relationship-char_seoyeon"] } },
  ],
};
