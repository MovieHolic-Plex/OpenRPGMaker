// 『첫사랑』 통짜 플레이 — 출하 플레이어(player.html)로 타이틀부터 엔딩까지.
//   FL_PATH=A  호감 높게: 선배? · 솔직 · 직접 묻기 · 우유 두 개 · 팀장 보고 · 수첩 덮기 · 그때 왜 · 내 이야기 · 역 · 먼저 말하기 → 엔딩 A
//   FL_PATH=B  호감 낮게: 맞춰 인사 · 모른 척 · 차갑게 · 하나만 · 몰래 · 수첩 펼치기 · 나중에 · 데이터 · 역 · 먼저 말하기 → 엔딩 B
//   FL_PATH=C  금요일에 회식 → 엔딩 C
// 픽스처: scripts/qa/runtime/first-love-fixture.mts → .omo/runtime-qa/first-love/game.json
// 실행: FL_PATH=A npm run qa:runtime -- --scenario first-love --out verify-shots/runtime-qa/first-love-A
// 맵 사이는 실제 문 칸을 밟아 넘어간다. 같은 맵 안의 긴 이동만 순간이동으로 줄인다.
import fs from "node:fs";

const FIXTURE = process.env.FL_FIXTURE ?? ".omo/runtime-qa/first-love/game.json";
const PATH = (process.env.FL_PATH ?? "A").toUpperCase();
const [vw, vh] = (process.env.FL_VP ?? "960x540").split("x").map(Number);

// 문·인물 좌표는 픽스처에서 읽는다(맵 배치를 바꿔도 시나리오를 고치지 않게).
const project = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
function at(mapId, eventId) {
  const ev = project.maps[mapId]?.events.find((e) => e.id === eventId);
  if (!ev) throw new Error(`첫사랑 시나리오: ${mapId}/${eventId} 없음`);
  return { x: ev.x, y: ev.y };
}

const CHOICES = "!!document.querySelector(\"[data-testid='runtime-choices']\")";
const DIALOG = "!!document.querySelector(\"[data-testid='dialogue-box']\")";
const stage = (n) => `() => !(${CHOICES}) && !(${DIALOG}) && (window.__oprnDebug.readState().variables.var_fl_stage ?? 0) >= ${n}`;
/** 대사를 넘겨 다음 선택지까지. */
const toChoice = () => ({ kind: "pressUntilJs", key: "Enter", fn: `() => ${CHOICES}`, maxPresses: 60, settleMs: 450 });
/** 선택지에서 index 번째를 고른다. */
const pick = (index) => [
  { kind: "hold", dir: null, ms: 300 },
  ...(index > 0 ? [{ kind: "key", key: "ArrowDown", times: index, holdMs: 60 }] : []),
  { kind: "key", key: "Enter" },
  { kind: "hold", dir: null, ms: 450 },
];
const choose = (index) => [toChoice(), ...pick(index)];
/** 단계가 n 이 되고 대사창이 닫힐 때까지 넘긴다. */
const untilStage = (n, max = 80) => ({ kind: "pressUntilJs", key: "Enter", fn: stage(n), maxPresses: max, settleMs: 450 });
const closeDialogue = (max = 30) => ({ kind: "pressUntilJs", key: "Enter", fn: `() => !(${DIALOG}) && !(${CHOICES})`, maxPresses: max, settleMs: 450 });
const untilEnding = { kind: "pressUntilJs", key: "Enter", fn: "() => !!document.querySelector(\"[data-testid='ending-screen']\")", maxPresses: 80, settleMs: 600 };
/** 문 칸 바로 옆에서 그쪽으로 걸어 밟는다. */
function stepInto(mapId, cell, dir) {
  const from = { up: { x: cell.x, y: cell.y + 1 }, down: { x: cell.x, y: cell.y - 1 }, left: { x: cell.x + 1, y: cell.y }, right: { x: cell.x - 1, y: cell.y } }[dir];
  return [
    { kind: "teleport", mapId, x: from.x, y: from.y },
    { kind: "hold", dir: null, ms: 400 },
    { kind: "hold", dir, ms: 380 },
    { kind: "hold", dir: null, ms: 1400 },
  ];
}
/** 이벤트 옆에 서서 그쪽을 보고 말을 건다. */
function talkTo(mapId, cell, dir = "up") {
  const from = { up: { x: cell.x, y: cell.y + 1 }, down: { x: cell.x, y: cell.y - 1 }, left: { x: cell.x + 1, y: cell.y }, right: { x: cell.x - 1, y: cell.y } }[dir];
  return [
    { kind: "teleport", mapId, x: from.x, y: from.y },
    { kind: "hold", dir: null, ms: 300 },
    { kind: "face", dir },
    { kind: "action" },
    { kind: "hold", dir: null, ms: 600 },
  ];
}
/** 콘솔 오류·경고와 페이지 재적재를 모은다(마지막 state 비트가 함께 적는다). */
const HOOK = "() => { if (!window.__flLog) { const log = window.__flLog = []; const t0 = Date.now(); const push = (m) => log.push(((Date.now() - t0) / 1000).toFixed(1) + 's ' + m); for (const k of ['error','warn']) { const o = console[k].bind(console); console[k] = (...a) => { push(k + ': ' + a.map(String).join(' ').slice(0, 300)); o(...a); }; } window.addEventListener('error', (e) => push('onerror: ' + e.message)); window.addEventListener('unhandledrejection', (e) => push('rejection: ' + String(e.reason?.stack ?? e.reason).slice(0, 400))); const watch = new Set(['runtime-choices','ending-screen','title-screen','cinematic-sequence']); new MutationObserver((ms) => { for (const m of ms) { for (const n of m.addedNodes) { if (!(n instanceof Element)) continue; const hits = [n, ...n.querySelectorAll('[data-testid]')].filter((x) => watch.has(x.dataset?.testid)); for (const h of hits) push('+' + h.dataset.testid + ' ' + (h.textContent ?? '').replace(/\\s+/g, ' ').slice(0, 80)); } for (const n of m.removedNodes) { if (n instanceof Element && watch.has(n.dataset?.testid)) push('-' + n.dataset.testid); } } }).observe(document.body, { childList: true, subtree: true }); document.addEventListener('click', (e) => { const b = e.target instanceof Element ? e.target.closest('[data-testid^=runtime-choice-]') : null; if (b) push('click ' + b.dataset.testid + ' detail=' + e.detail + ' trusted=' + e.isTrusted); }, true); document.addEventListener('keydown', (e) => { if (document.querySelector(\"[data-testid='runtime-choices']\")) push('key ' + e.key + ' with choices'); }, true); } return true; }";
const shotPause = (ms = 700) => ({ kind: "hold", dir: null, ms });
const RAIL = "[data-testid='status-menu-command-rail']";
const openMenu = (id, note) => ({ id, note, ops: [{ kind: "key", key: "Escape" }, { kind: "waitFor", testid: "status-menu-command-rail", state: "present", timeoutMs: 8000 }, shotPause(700)], shot: true });
const closeMenu = (id) => ({ id, note: "메뉴 닫기", ops: [{ kind: "pressUntilJs", key: "Escape", fn: `() => !document.querySelector("${RAIL}")`, maxPresses: 4, settleMs: 500 }], shot: false });

const A = PATH === "A";
const C = PATH === "C";
const pickC1 = A ? 1 : 0;
const pickC2 = A ? 0 : 1;
const pickC3 = A ? 0 : 2;
const pickC4 = A ? 0 : 1;
const pickC5 = A ? 0 : 1;
const pickNote = A ? 1 : 0;
const pickC6 = A ? 0 : 1;
const pickC7 = A ? 0 : 1;

const exitCell = at("fl_platform_am", "ev_fl_plat_exit");
const officeDoor = at("fl_street", "ev_fl_office_door");
const stairs = at("fl_office", "ev_fl_stairs");
const minho = at("fl_office", "ev_fl_minho");
const konDoorPm = at("fl_street_pm", "ev_fl_konbini_pm");
const cooler = at("fl_konbini", "ev_fl_cooler");
const notebook = at("fl_office_pm", "ev_fl_notebook");
const jihuPantry = at("fl_office_pm", "ev_fl_w_jihu_pantry");
const subwayPm = at("fl_street_pm", "ev_fl_subway_pm");

export default {
  id: `first-love-${PATH}`,
  // 출하 경로 그대로: player.html?demo=first-love 가 데모를 스스로 짓는다(픽스처 JSON 은 좌표 읽기에만 쓴다).
  projectFixture: "scripts/qa/runtime/first-love-empty.json",
  query: { demo: "first-love" },
  viewport: { width: vw, height: vh },
  beats: [
    { id: "title", note: "타이틀", ops: [{ kind: "waitFor", testid: "title-screen", state: "present", timeoutMs: 120000 }, { kind: "evalToFile", out: `/tmp/fl-hook-${PATH}.json`, fn: HOOK }, { kind: "pressUntilJs", key: "Shift", fn: "() => (window.__flT ??= Date.now()) && Date.now() - window.__flT > 2500", maxPresses: 12, settleMs: 400 }], shot: true },
    { id: "opening-1", note: "오프닝 1컷 — 10년 전 교복의 두 사람", ops: [{ kind: "key", key: "Enter" }, shotPause(4200)], shot: true },
    { id: "opening-2", note: "오프닝 2컷 — 편지의 빛", ops: [shotPause(5600)], shot: true },
    { id: "opening-4", note: "오프닝 4컷 — 지금", ops: [shotPause(13000)], shot: true },
    { id: "intro", note: "오프닝 넘김 → 승강장 첫 대사", ops: [
      { kind: "pressUntilJs", key: "Escape", fn: "() => !document.querySelector(\"[data-testid='cinematic-sequence']\")", maxPresses: 8, settleMs: 800 },
      { kind: "waitForRuntime", timeoutMs: 120000 },
      { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 30000 },
      shotPause(1500),
    ], shot: true },
    { id: "intro-bust", note: "서하 흉상 대사", ops: [{ kind: "pressUntilJs", key: "Enter", fn: "() => /할 수 있어/.test(document.querySelector(\"[data-testid='dialogue-box']\")?.textContent ?? '')", maxPresses: 10 }, shotPause(900)], shot: true },
    { id: "platform", note: "승강장 — 조작 가능", ops: [untilStage(1), shotPause(600)], shot: true },
    { id: "street", note: "역 밖 거리(낮)", ops: [...stepInto("fl_platform_am", exitCell, "down"), untilStage(2), shotPause(600)], shot: true },
    { id: "office-arrive", note: "사무실 도착 — 팀장 인사", ops: [...stepInto("fl_street", officeDoor, "up"), { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 20000 }, shotPause(1200)], shot: true },
    { id: "meet", note: "처음 뵙겠습니다", ops: [{ kind: "pressUntilJs", key: "Enter", fn: "() => /강지후입니다/.test(document.querySelector(\"[data-testid='dialogue-box']\")?.textContent ?? '')", maxPresses: 40, settleMs: 500 }, shotPause(1200)], shot: true },
    { id: "c1", note: "선택 1", ops: [toChoice(), shotPause(500)], shot: true },
    { id: "after-c1", note: "선택 1 결과", ops: [...pick(pickC1), shotPause(900)], shot: true },
    ...(A ? [{ id: "pulse", note: "호감 알림 — 오른쪽 위 ♥", ops: [{ kind: "pressUntilJs", key: "Enter", fn: "() => !!document.querySelector(\"[data-testid='relationship-pulse']\")", maxPresses: 12, settleMs: 250 }, shotPause(300)], shot: true }] : []),
    { id: "office-free", note: "사무실 자유 이동", ops: [untilStage(3), shotPause(800)], shot: true },
    openMenu("menu-mon", "ESC 메뉴 — 연애 메뉴(호감도·대화 기록·엔딩·저장)"),
    closeMenu("menu-mon-close"),
    { id: "pantry", note: "탕비실 민호", ops: [...talkTo("fl_office", minho, "up"), toChoice(), shotPause(500)], shot: true },
    { id: "after-pantry", note: "선택 2 → 옥상 힌트", ops: [...pick(pickC2), untilStage(4), shotPause(500)], shot: true },
    { id: "rooftop", note: "옥상의 지후", ops: [...stepInto("fl_office", stairs, "up"), { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 20000 }, shotPause(1500)], shot: true },
    { id: "c3", note: "옥상 선택", ops: [toChoice(), shotPause(500)], shot: true },
    { id: "after-c3", note: "옥상 선택 결과", ops: [...pick(pickC3), shotPause(1000)], shot: true },
    { id: "night-street", note: "밤거리", ops: [untilStage(6), shotPause(1200)], shot: true },
    { id: "konbini", note: "편의점", ops: [...stepInto("fl_street_pm", konDoorPm, "up"), untilStage(7), shotPause(800)], shot: true },
    { id: "konbini-jihu", note: "편의점의 지후", ops: [...talkTo("fl_konbini", cooler, "up"), toChoice(), shotPause(500)], shot: true },
    { id: "flashback", note: "회상 — 방송실", ops: [...pick(pickC4), { kind: "pressUntilJs", key: "Enter", fn: "() => /성하고등학교/.test(document.querySelector(\"[data-testid='dialogue-box']\")?.textContent ?? '')", maxPresses: 30, settleMs: 600 }, shotPause(1500)], shot: true },
    { id: "flashback-2", note: "회상 — 어린 지후", ops: [{ kind: "pressUntilJs", key: "Enter", fn: "() => /서성이는/.test(document.querySelector(\"[data-testid='dialogue-box']\")?.textContent ?? '')", maxPresses: 30, settleMs: 600 }, shotPause(900)], shot: true },
    { id: "wednesday", note: "수요일 야근 — 실수", ops: [{ kind: "pressUntilJs", key: "Enter", fn: "() => /수정 전 버전/.test(document.querySelector(\"[data-testid='dialogue-box']\")?.textContent ?? '')", maxPresses: 40, settleMs: 600 }, shotPause(900)], shot: true },
    { id: "c5", note: "선택 5", ops: [toChoice(), ...pick(pickC5), shotPause(600)], shot: true },
    { id: "c5b", note: "수요일 밤 — 시안 이야기(선택지)", ops: [toChoice(), shotPause(500)], shot: true },
    { id: "after-c5b", note: "시안 이야기 결과", ops: [...pick(A ? 0 : 1), untilStage(9), shotPause(600)], shot: true },
    openMenu("menu-wed", "ESC 메뉴 — 수요일 호감도"),
    closeMenu("menu-wed-close"),
    { id: "notebook", note: "지후 수첩", ops: [...talkTo("fl_office_pm", notebook, "up"), toChoice(), shotPause(500)], shot: true },
    { id: "ramen", note: "탕비실 라면", ops: [...pick(pickNote), closeDialogue(), ...talkTo("fl_office_pm", jihuPantry, "down"), toChoice(), shotPause(500)], shot: true },
    { id: "friday", note: "금요일 발표", ops: [...pick(pickC6), { kind: "pressUntilJs", key: "Enter", fn: "() => /핵심이 뭡니까/.test(document.querySelector(\"[data-testid='dialogue-box']\")?.textContent ?? '')", maxPresses: 40, settleMs: 600 }, shotPause(1200)], shot: true },
    { id: "c7", note: "발표 선택", ops: [toChoice(), ...pick(pickC7), shotPause(900)], shot: true },
    { id: "c8", note: "역으로 / 회식", ops: [toChoice(), shotPause(500)], shot: true },
    ...(C
      ? [{ id: "ending-c", note: "엔딩 C", ops: [...pick(1), untilEnding, shotPause(3600)], shot: true }]
      : [
        { id: "run", note: "비 오는 밤거리", ops: [...pick(0), untilStage(12), shotPause(1200)], shot: true },
        { id: "platform-night", note: "막차 승강장", ops: [...stepInto("fl_street_pm", subwayPm, "up"), { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 20000 }, shotPause(1500)], shot: true },
        { id: "letter", note: "편지", ops: [{ kind: "pressUntilJs", key: "Enter", fn: "() => /처음으로 이름이 적힌/.test(document.querySelector(\"[data-testid='dialogue-box']\")?.textContent ?? '')", maxPresses: 30, settleMs: 600 }, shotPause(900)], shot: true },
        { id: "c9", note: "마지막 선택", ops: [toChoice(), shotPause(500)], shot: true },
        { id: "confess", note: "고백", ops: [...pick(0), shotPause(1500)], shot: true },
        { id: "peak", note: "고백 정점 — 10년 전 그림이 겹친다", ops: [{ kind: "pressUntilJs", key: "Enter", fn: `() => /${A ? "10년 늦은 답장이에요" : "그 금요일에도. 지금도"}/.test(document.querySelector("[data-testid='dialogue-box']")?.textContent ?? '')`, maxPresses: 20, settleMs: 700 }, shotPause(600)], shot: true },
        { id: `ending-${PATH.toLowerCase()}`, note: `엔딩 ${PATH}`, ops: [untilEnding, shotPause(3600)], shot: true },
      ]),
    { id: "ending-after", note: "엔딩 에필로그 뒤", ops: [{ kind: "key", key: "Enter" }, shotPause(2500), { kind: "key", key: "Enter" }, shotPause(2500)], shot: true },
    { id: "state", note: "최종 상태", ops: [{ kind: "evalToFile", out: `/tmp/fl-state-${PATH}${process.env.FL_TAG ?? ""}.json`, fn: "() => { const s = window.__oprnDebug.readState(); return { log: window.__flLog ?? 'reloaded (hook lost)', heapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576), map: s.currentMapId, vars: s.variables, sw: Object.fromEntries(Object.entries(s.switches).filter(([k]) => k.startsWith('sw_fl'))) }; }" }], shot: false },
  ],
};
