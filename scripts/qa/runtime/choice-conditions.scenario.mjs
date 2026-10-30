// 선택지 줄 조건(showWhen 숨김 · enableWhen 흐림+이유) — 출하 플레이어에서 본다.
// 픽스처: scripts/qa/runtime/choice-conditions-fixture.mts
//   QA_RECORD_VIDEO=/tmp/hs/vid npm run qa:runtime -- --scenario choice-conditions --project /tmp/hs/choice-conditions.json --netns
// 1차 대화: 3줄(늪 계약 숨음), 하수도 줄은 흐리고 「보증금 은화 50」. 흐린 줄을 결정해도 창이 열린 채.
// 「소문을 묻는다」 → 스위치 ON + 은화 60. 2차 대화: 4줄, 하수도 줄을 고를 수 있다.
const present = (testid, timeoutMs = 30_000) => ({ kind: "waitFor", testid, state: "present", timeoutMs });
const absent = (testid, timeoutMs = 10_000) => ({ kind: "waitFor", testid, state: "absent", timeoutMs });
const toChoices = { kind: "pressUntil", key: "z", testid: "runtime-choices", state: "present", maxPresses: 8 };
const measure = (id) => ({ kind: "evalToFile", out: `${process.env.CHOICE_COND_OUT ?? "/tmp/hs/cc"}-${id}.json`, fn: `() => {
  const rows = [...document.querySelectorAll('[data-testid^="runtime-choice-"]')].filter((b) => /^runtime-choice-\\d+$/.test(b.dataset.testid));
  return rows.map((b) => ({ text: b.textContent, disabled: b.getAttribute('aria-disabled') === 'true', selected: b.classList.contains('selected') }));
}` });
export default {
  id: "choice-conditions",
  projectFixture: process.env.CHOICE_COND_FIXTURE ?? "/tmp/hs/choice-conditions.json",
  viewport: { width: 960, height: 540 },
  beats: [
    { id: "title", ops: [present("title-screen")], expect: { testidPresent: ["title-screen"] } },
    { id: "field", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime", timeoutMs: 120_000 }, { kind: "hold", dir: null, ms: 800 }], expect: { testidAbsent: ["title-screen"] } },
    {
      id: "first-open", note: "1차: 늪 계약 숨음, 하수도 흐림+이유",
      ops: [{ kind: "face", dir: "right" }, { kind: "action" }, present("dialogue-box"), { kind: "hold", dir: null, ms: 900 }, toChoices, { kind: "hold", dir: null, ms: 700 }, measure("first-open")],
      expect: { testidPresent: ["runtime-choice-2", "runtime-choice-0-reason"], testidAbsent: ["runtime-choice-3"] }, shot: true,
    },
    {
      id: "disabled-confirm", note: "흐린 줄에서 결정 — 경고음, 창은 열린 채",
      ops: [{ kind: "key", key: "ArrowUp" }, { kind: "hold", dir: null, ms: 500 }, { kind: "key", key: "z" }, { kind: "hold", dir: null, ms: 700 }],
      expect: { testidPresent: ["runtime-choices"] }, shot: true,
    },
    {
      id: "ask-rumor", note: "「소문을 묻는다」",
      ops: [{ kind: "key", key: "ArrowDown" }, { kind: "hold", dir: null, ms: 500 }, { kind: "key", key: "z" }, absent("runtime-choices"), { kind: "hold", dir: null, ms: 1200 }],
      expect: { testidAbsent: ["runtime-choices"] }, shot: true,
    },
    {
      id: "close", note: "대사 닫기",
      ops: [{ kind: "pressUntil", key: "z", testid: "dialogue-box", state: "absent", maxPresses: 6 }, { kind: "hold", dir: null, ms: 600 }],
      expect: { testidAbsent: ["dialogue-box"] },
    },
    {
      id: "second-open", note: "2차: 늪 계약 보임, 하수도 고를 수 있음",
      ops: [{ kind: "action" }, present("dialogue-box"), { kind: "hold", dir: null, ms: 900 }, toChoices, { kind: "hold", dir: null, ms: 700 }, measure("second-open")],
      expect: { testidPresent: ["runtime-choice-3"], testidAbsent: ["runtime-choice-1-reason"] }, shot: true,
    },
    {
      id: "pick-sewer", note: "하수도 계약을 뗀다",
      ops: [{ kind: "key", key: "ArrowDown" }, { kind: "hold", dir: null, ms: 500 }, { kind: "key", key: "z" }, absent("runtime-choices"), { kind: "hold", dir: null, ms: 1500 }],
      expect: { testidAbsent: ["runtime-choices"] }, shot: true,
    },
  ],
};
