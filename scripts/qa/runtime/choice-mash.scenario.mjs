// 선택지 Enter 연타: 대사를 넘기려고 연타한 Enter 가 뒤이어 뜬 선택지의 0번(오답)을 저절로 고르면 안 된다.
// 회귀 벤치 ebfe-sl(방탈출·추리 sl3 terra, 판정자 A8 「Enter 10번」)에서 첫 항목이 자동 선택되던 결함의 재현·확인.
// 픽스처: scripts/qa/runtime/choice-mash-fixture.mts (세 쪽 대사 → 0247(오답)/0742(정답) 2지선다 → 결과 대사).
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/runtime/choice-mash-fixture.mts > .omo/runtime-qa/choice-mash/project.json
//   npm run qa:runtime -- --scenario choice-mash --netns   (--netns 없으면 이 머신에서 ERR_NETWORK_CHANGED 로 타이틀 대기가 끊긴다)
// 보는 것: advance-pace — 읽는 속도(600ms)로 넘기는 대사는 Enter 마다 바로 다음 쪽(지연 ms 는 rec-pace.json).
//          mash-fast·mash-human 뒤에도 선택지가 떠 있다(runtime-choices 있음, 「[오답]」 없음).
//          쉬었다 Enter 한 번이면 선택된다 / ↓ 뒤 Enter 한 번이면 정답 / 연타 직후라도 ↓ 를 누른 뒤의 Enter 는 받는다(mash-then-nav).
const present = (testid, timeoutMs = 30_000) => ({ kind: "waitFor", testid, state: "present", timeoutMs });
const settle = (ms) => ({ kind: "hold", dir: null, ms });
// 사람 손 연타: 약 9번/초. 누른 시각을 110ms 간격으로 박는다(keyBurst) — page.keyboard.press 를 이어 부르면
// 부하가 걸린 판에서 간격이 300~1000ms 로 벌어져 「쉬었다 누른 결정」과 구별할 수 없게 된다.
const humanMash = (n, tail = []) => [{ kind: "keyBurst", keys: [...Array.from({ length: n }, () => "Enter"), ...tail], intervalMs: 110 }];
// 쪽이 다 나온 뒤(page-ready) 600ms 읽고 Enter.
const readThenEnter = [{ kind: "waitForClass", testid: "dialogue-box", cls: "page-ready", timeoutMs: 10_000 }, settle(600), { kind: "key", key: "Enter" }, settle(150)];
// 결과 대사를 닫는다(아직 흐르는 중이면 첫 Enter 는 다 보이기만 한다).
const closeResult = [settle(400), { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 4, timeoutMs: 1500 }, settle(800)];
const talk = [{ kind: "face", dir: "right" }, { kind: "action" }, present("dialogue-box"), settle(150)];
// 키 누른 시각과 선택지 등장·사라짐을 기록한다 — 연타 간격이 실제로 얼마였는지 보려고.
const recordKeys = { kind: "evalToFile", out: ".omo/runtime-qa/choice-mash/rec-start.json", fn: `() => {
  const log = window.__mashLog = [];
  const t0 = performance.now();
  window.addEventListener('keydown', (e) => log.push(['down', e.key, Math.round(performance.now() - t0), Math.round(e.timeStamp - t0)]), true);
  new MutationObserver(() => {
    const open = !!document.querySelector('[data-testid="runtime-choices"]');
    if (open !== window.__mashOpen) { window.__mashOpen = open; log.push([open ? 'choices-open' : 'choices-gone', '', Math.round(performance.now() - t0)]); }
  }).observe(document.body, { childList: true, subtree: true });
  return true;
}` };
// 대사 넘기기 지연: Enter 를 누른 순간(timeStamp)부터 대사창 글·선택지가 바뀐 순간까지.
const recordPace = { kind: "evalToFile", out: ".omo/runtime-qa/choice-mash/rec-pace-start.json", fn: `() => {
  const log = window.__paceLog = [];
  const read = () => (document.querySelector('.dialogue-overlay')?.textContent ?? '') + '|' + !!document.querySelector('[data-testid="runtime-choices"]');
  let last = read();
  window.addEventListener('keydown', (e) => { if (e.key === 'Enter') log.push(['down', e.timeStamp]); }, true);
  new MutationObserver(() => { const now = read(); if (now !== last) { last = now; log.push(['change', performance.now()]); } })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
  return true;
}` };
const dumpPace = { kind: "evalToFile", out: ".omo/runtime-qa/choice-mash/rec-pace.json", fn: `() => {
  const log = window.__paceLog ?? [];
  const out = [];
  log.forEach(([kind, at], i) => {
    if (kind !== 'down') return;
    const next = log.slice(i + 1).find(([k]) => k === 'change');
    out.push(next ? Math.round(next[1] - at) : null);
  });
  return { enterToChangeMs: out };
}` };
const dumpKeys = (id) => ({ kind: "evalToFile", out: `.omo/runtime-qa/choice-mash/rec-${id}.json`, fn: "() => window.__mashLog" });
const noWrong = { kind: "evalToFile", out: ".omo/runtime-qa/choice-mash/state.json", fn: `() => ({
  choices: !!document.querySelector('[data-testid="runtime-choices"]'),
  body: (document.querySelector('.dialogue-overlay')?.textContent ?? '').replace(/\\s+/g, ' ').trim(),
})` };
export default {
  id: "choice-mash",
  projectFixture: process.env.CHOICE_MASH_FIXTURE ?? ".omo/runtime-qa/choice-mash/project.json",
  viewport: { width: 960, height: 720 },
  beats: [
    { id: "title", ops: [present("title-screen")], expect: { testidPresent: ["title-screen"] } },
    { id: "field", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime", timeoutMs: 120_000 }, settle(1200)], expect: { testidAbsent: ["title-screen"] } },
    {
      id: "advance-pace", note: "쪽마다 다 나온 뒤 600ms 읽고 Enter(3번) → 세 쪽을 넘겨 선택지가 뜬다. Enter→화면 변화 지연은 rec-pace.json",
      ops: [recordPace, ...talk, ...readThenEnter, ...readThenEnter, ...readThenEnter, present("runtime-choices", 5000), settle(300), dumpPace],
      expect: { testidPresent: ["runtime-choices"] }, shot: true,
    },
    {
      id: "pace-pick", note: "선택지를 읽고(600ms) Enter 한 번 → 0번이 골라진다",
      ops: [settle(600), { kind: "key", key: "Enter" }, { kind: "waitForBodyText", text: "[오답]", timeoutMs: 5000 }, settle(300)],
      expect: { testidAbsent: ["runtime-choices"] },
    },
    { id: "pace-close", ops: closeResult, expect: { testidAbsent: ["dialogue-box"] } },
    {
      id: "mash-fast", note: "대사 첫 쪽에서 Enter 10번(기계 연타, 간격 0) → 선택지가 떠 있어야 한다",
      ops: [recordKeys, ...talk, { kind: "key", key: "Enter", times: 10 }, settle(900), noWrong, dumpKeys("fast")],
      expect: { testidPresent: ["runtime-choices"] }, shot: true,
    },
    {
      id: "confirm-once", note: "쉬었다가 Enter 한 번 → 0번(커서 자리)이 골라진다",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForBodyText", text: "[오답]", timeoutMs: 5000 }, settle(300)],
      expect: { testidAbsent: ["runtime-choices"] }, shot: true,
    },
    { id: "close", note: "결과 대사를 닫는다", ops: closeResult, expect: { testidAbsent: ["dialogue-box"] } },
    {
      id: "mash-human", note: "대사 첫 쪽에서 Enter 14번(사람 손 연타, 110ms 간격) → 선택지가 떠 있어야 한다",
      ops: [recordKeys, ...talk, ...humanMash(14), settle(900), noWrong, dumpKeys("human")],
      expect: { testidPresent: ["runtime-choices"] }, shot: true,
    },
    {
      id: "pick-right", note: "↓ 한 번, Enter 한 번 → 정답",
      ops: [{ kind: "key", key: "ArrowDown" }, settle(300), { kind: "key", key: "Enter" }, { kind: "waitForBodyText", text: "[정답]", timeoutMs: 5000 }, settle(300)],
      expect: { testidAbsent: ["runtime-choices"] }, shot: true,
    },
    { id: "close-2", note: "결과 대사를 닫는다", ops: closeResult, expect: { testidAbsent: ["dialogue-box"] } },
    {
      id: "mash-then-nav", note: "Enter 20번 연타(110ms)에 바로 이어 ↓, 110ms 뒤 Enter → 커서를 옮긴 뒤의 결정은 연타가 아니다 → 정답",
      ops: [recordKeys, ...talk, ...humanMash(20, ["ArrowDown", "Enter"]),
        { kind: "waitForBodyText", text: "[정답]", timeoutMs: 5000 }, settle(300), dumpKeys("nav")],
      expect: { testidAbsent: ["runtime-choices"] }, shot: true,
    },
  ],
};
