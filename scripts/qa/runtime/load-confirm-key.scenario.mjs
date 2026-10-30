// 불러오기를 키보드로 확정했을 때(메뉴 → 불러오기 → 1번 칸에서 Enter) 그 Enter 가 필드 조사로 새는지, 목표 줄이 돌아오는지.
// 2026-10-29 vm3 판정 A6: terra 방탈출 — 불러오자 정면의 번호 쪽지 대사가 다시 시작됐다. flash 방탈출 — 불러온 뒤 메뉴 「현재 목표」가 빈칸.
//
//   QA_OBJ_OUT=<폴더> QA_STAND=3,4,up QA_WALK=3,7 node scripts/runtime-qa.mjs --scenario load-confirm-key --project <web.json> --netns
//
// QA_STAND 칸에 서서 그쪽을 보고 한 번 조사(대사를 다 넘김) → 1번 칸에 저장 → QA_WALK 로 옮김 → Esc·불러오기·Enter(키보드)로 불러오기.
// 각 단계의 목표 기록·화면 목표 줄·떠 있는 대사 글을 OUT 폴더 JSON 으로 남긴다.

const OUT = process.env.QA_OBJ_OUT ?? "/tmp/load-confirm-key";
const [sx, sy, sdir] = (process.env.QA_STAND ?? "3,4,up").split(",");
const [wx, wy] = (process.env.QA_WALK ?? "3,7").split(",").map(Number);
const MAP = process.env.QA_MAP ?? "map_blank_start";
const box = ".dialogue-overlay .dialogue-box, [data-testid='runtime-choices']";
const noBox = `() => !document.querySelector("${box.replace(/"/g, "\\\"")}")`;
const hasBox = `() => !!document.querySelector("${box.replace(/"/g, "\\\"")}")`;
const hasObjective = `() => (window.__oprnHooksScene?.getSession?.()?.m2Runtime?.ui ?? []).some((e) => e.surface === 'objectiveChip') && !document.querySelector("${box.replace(/"/g, "\\\"")}")`;
const read = `() => {
  const s = window.__oprnHooksScene?.getSession?.();
  const ui = (s?.m2Runtime?.ui ?? []).filter((e) => e.surface === "objectiveChip").map((e) => e.message);
  const line = document.querySelector(".zone-feedback-objective");
  const dlg = document.querySelector("${box.replace(/"/g, "\\\"")}");
  return { pos: s ? [s.currentMapId, s.x, s.y, s.playerFacing] : null, objectives: ui, shown: line && !line.hidden ? line.textContent.replace(/\\s+/g, " ").trim() : null,
    dialogue: dlg ? dlg.textContent.replace(/\\s+/g, " ").trim() : null,
    switches: Object.keys(s?.switches ?? {}).filter((k) => s.switches[k]).sort() };
}`;
const menuObjective = `() => { const el = document.querySelector("[aria-label='현재 목표']"); return { menuObjective: el ? el.textContent.replace(/\\s+/g, " ").trim() : null }; }`;

/** 저장·불러오기 명령 — 묶음 메뉴(시스템 ▸)면 먼저 그 묶음을 연다. */
const openCommand = (id) => `async () => {
  const pick = () => document.querySelector("[data-testid='status-menu-command-${id}'], [data-testid='status-menu-group-command-${id}']");
  if (!pick()) [...document.querySelectorAll("[data-testid^='status-menu-command-']")].find((b) => /시스템/.test(b.textContent ?? "") && b.tagName === "BUTTON")?.click();
  for (let i = 0; i < 20 && !pick(); i += 1) await new Promise((r) => setTimeout(r, 100));
  const found = !!pick();
  pick()?.click();
  return { opened: found, ids: found ? [] : [...document.querySelectorAll("[data-testid]")].map((e) => e.dataset.testid).filter((t) => /status-menu|slot|system/.test(t)).slice(0, 60) };
}`;

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const loadConfirmKeyScenario = {
  id: "load-confirm-key",
  beats: [
    { id: "start", note: "새 게임 → 시작 컷신·시작 목표", ops: [
      { kind: "pressUntilJs", key: "Enter", fn: "() => !document.querySelector(\"[data-testid='title-screen']\")", maxPresses: 4, settleMs: 2500 },
      { kind: "waitForRuntime", timeoutMs: 240000 },
      { kind: "pressUntilJs", key: "Enter", fn: hasObjective, maxPresses: 80, settleMs: 700 },
      { kind: "evalToFile", fn: read, out: `${OUT}/1-start.json` },
    ], shot: true },
    { id: "examine", note: "정한 칸에서 한 번 조사하고 대사를 다 넘긴다", ops: [
      { kind: "teleport", mapId: MAP, x: Number(sx), y: Number(sy) },
      { kind: "face", dir: sdir },
      { kind: "pressUntilJs", key: "Enter", fn: hasBox, maxPresses: 3, settleMs: 600 },
      { kind: "pressUntilJs", key: "Enter", fn: noBox, maxPresses: 30, settleMs: 600 },
      { kind: "evalToFile", fn: read, out: `${OUT}/2-before-save.json` },
    ], shot: true },
    { id: "save", note: "Esc → 저장 → 1번 칸", ops: [
      { kind: "key", key: "Escape" }, { kind: "evalToFile", fn: menuObjective, out: `${OUT}/2b-menu-before-save.json` },
      { kind: "evalToFile", fn: openCommand("save"), out: `${OUT}/2c-open-save.json` }, { kind: "click", testid: "save-slot-1" },
      { kind: "pressUntilJs", key: "Enter", fn: "() => /저장했습니다/.test(document.body.textContent ?? '')", maxPresses: 2, settleMs: 700 },
      { kind: "pressUntilJs", key: "Escape", fn: "() => !document.querySelector(\"[data-testid='main-menu']\")", maxPresses: 4, settleMs: 400 },
    ], shot: true },
    { id: "walk", note: "저장 뒤 자리 옮기기", ops: [
      { kind: "teleport", mapId: MAP, x: wx, y: wy },
      { kind: "evalToFile", fn: read, out: `${OUT}/3-after-walk.json` },
    ] },
    { id: "load", note: "Esc → 불러오기 → 1번 칸을 키보드 Enter 로", ops: [
      { kind: "key", key: "Escape" }, { kind: "evalToFile", fn: openCommand("load"), out: `${OUT}/3b-open-load.json` },
      { kind: "key", key: "Enter" },
      // 1.5초 둔다(조사가 새면 그사이 대사창이 뜬다).
      { kind: "evalToFile", fn: "async () => { await new Promise((r) => setTimeout(r, 1500)); return { waitedMs: 1500 }; }", out: `${OUT}/4a-wait.json` },
      { kind: "evalToFile", fn: read, out: `${OUT}/4-after-load.json` },
    ], shot: true },
    { id: "menu", note: "불러온 뒤 메뉴의 현재 목표", ops: [
      { kind: "pressUntilJs", key: "Enter", fn: noBox, maxPresses: 20, settleMs: 500 },
      { kind: "key", key: "Escape" },
      { kind: "evalToFile", fn: menuObjective, out: `${OUT}/5-menu-after-load.json` },
    ], shot: true },
  ],
};
