// 480×270 선택지 맞춤: 얼굴/흉상/없음 × 3·4지선다가 창 안에 다 들어오는지 찍는다.
// 픽스처: scripts/qa/runtime/choice-fit-480-fixture.mts (CHOICE_STYLE 로 스타일).
//   CHOICE_FIXTURE=.omo/runtime-qa/choice-fit/glass.json npm run qa:runtime -- --scenario choice-fit-480 --out verify-shots/choice-fit-480/glass
const OUT = process.env.CHOICE_MEASURE_DIR ?? ".omo/runtime-qa/choice-fit";
// 선택지 단추가 창·목록·무대 안에 다 보이는지 잰다(잘린 픽셀 수, 무대 기준 좌표).
const measure = (id) => ({ kind: "evalToFile", out: `${OUT}/${process.env.CHOICE_STYLE ?? "default"}-${id}.json`, fn: `() => {
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height }; };
  const stage = document.querySelector('.play-stage') ?? document.body;
  const list = document.querySelector('[data-testid="runtime-choices"]');
  const win = list?.closest('.dialogue-box');
  const clipOf = (e) => { let n = e?.parentElement, clip = null; while (n && n !== document.body) { const cs = getComputedStyle(n); if (cs.overflowY !== 'visible') { const b = n.getBoundingClientRect(); clip = clip ? { top: Math.max(clip.top, b.top), bottom: Math.min(clip.bottom, b.bottom) } : { top: b.top, bottom: b.bottom }; } n = n.parentElement; } return clip; };
  const btns = [...document.querySelectorAll('[data-testid^="runtime-choice-"], .choice-prompt-row')].map((b) => { const br = r(b), c = clipOf(b); const s = r(stage); const lo = Math.max(c ? c.top : -1e9, s.top), hi = Math.min(c ? c.bottom : 1e9, s.bottom); return { text: (b.classList.contains('choice-prompt-row') ? '?' : '') + b.textContent, ...br, hiddenPx: Math.max(0, br.bottom - hi) + Math.max(0, lo - br.top) }; });
  return { style: document.querySelector('.dialogue-overlay')?.dataset.dialogueStyle ?? null, overlayClass: document.querySelector('.dialogue-overlay')?.className, stage: r(stage), win: r(win), list: r(list), listScroll: list ? { sh: list.scrollHeight, ch: list.clientHeight } : null, fontSize: list ? getComputedStyle(list.querySelector('.choice-btn')).fontSize : null, btns, anyHidden: btns.some((b) => b.hiddenPx > 0.5) };
}` });
const present = (testid, timeoutMs = 30_000) => ({ kind: "waitFor", testid, state: "present", timeoutMs });
const toChoices = { kind: "pressUntil", key: "z", testid: "runtime-choices", state: "present", maxPresses: 8 };
const next = [{ kind: "key", key: "z" }, { kind: "waitFor", testid: "runtime-choices", state: "absent", timeoutMs: 10_000 }];
export default {
  id: "choice-fit-480",
  projectFixture: process.env.CHOICE_FIXTURE ?? ".omo/runtime-qa/choice-fit/glass.json",
  viewport: { width: 960, height: 540 },
  beats: [
    { id: "title", ops: [present("title-screen")], expect: { testidPresent: ["title-screen"] } },
    { id: "field", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime", timeoutMs: 120_000 }, { kind: "hold", dir: null, ms: 1200 }], expect: { testidAbsent: ["title-screen"] } },
    { id: "face-text", note: "48px 얼굴 대사", ops: [{ kind: "face", dir: "right" }, { kind: "action" }, present("dialogue-box"), { kind: "hold", dir: null, ms: 1200 }], expect: { testidPresent: ["dialogue-box"] }, shot: true },
    { id: "c1-open", note: "얼굴 대사 뒤 3지선다(처음 뜬 모습)", ops: [toChoices, { kind: "hold", dir: null, ms: 500 }, measure("c1-open")], expect: { testidPresent: ["runtime-choice-2"] }, shot: true },
    { id: "c1-last", note: "셋째 선택", ops: [{ kind: "key", key: "ArrowDown", times: 2 }, { kind: "hold", dir: null, ms: 400 }, measure("c1-last")], expect: { testidPresent: ["runtime-choice-2"] }, shot: true },
    { id: "c2-open", note: "흉상 대사 뒤 4지선다", ops: [...next, toChoices, { kind: "hold", dir: null, ms: 500 }, measure("c2-open")], expect: { testidPresent: ["runtime-choice-3"] }, shot: true },
    { id: "c2-last", note: "넷째 선택", ops: [{ kind: "key", key: "ArrowDown", times: 3 }, { kind: "hold", dir: null, ms: 400 }, measure("c2-last")], expect: { testidPresent: ["runtime-choice-3"] }, shot: true },
    { id: "c3-open", note: "얼굴 없음 3지선다(질문 없음)", ops: [...next, toChoices, { kind: "hold", dir: null, ms: 500 }, measure("c3-open")], expect: { testidPresent: ["runtime-choice-2"] }, shot: true },
    { id: "c4-open", note: "긴 질문 4지선다", ops: [{ kind: "key", key: "z" }, { kind: "hold", dir: null, ms: 600 }, present("runtime-choices"), { kind: "hold", dir: null, ms: 400 }, measure("c4-open")], expect: { testidPresent: ["runtime-choice-3"] }, shot: true },
    { id: "c4-last", note: "넷째 선택", ops: [{ kind: "key", key: "ArrowDown", times: 3 }, { kind: "hold", dir: null, ms: 400 }, measure("c4-last")], expect: { testidPresent: ["runtime-choice-3"] }, shot: true },
    { id: "c5-top", note: "위쪽 창 4지선다", ops: [{ kind: "key", key: "z" }, toChoices, { kind: "hold", dir: null, ms: 500 }, measure("c5-top")], expect: { testidPresent: ["runtime-choice-3"] }, shot: true },
    { id: "c6-open", note: "5지선다(두 줄 선택지)", ops: [{ kind: "key", key: "z" }, { kind: "waitFor", testid: "runtime-choice-4", state: "present", timeoutMs: 10_000 }, { kind: "hold", dir: null, ms: 500 }, measure("c6-open")], expect: { testidPresent: ["runtime-choice-4"] }, shot: true },
    { id: "c6-last", note: "다섯째 선택", ops: [{ kind: "key", key: "ArrowUp" }, { kind: "hold", dir: null, ms: 400 }, measure("c6-last")], expect: { testidPresent: ["runtime-choice-4"] }, shot: true },
  ],
};
