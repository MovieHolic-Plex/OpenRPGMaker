// ESC 「쉬기」 + 시간대 필드 스폰 — 출하 플레이어에서 본다.
// 픽스처: scripts/qa/runtime/rest-menu-fixture.mts
//   QA_RECORD_VIDEO=/tmp/hs/vid-e npm run qa:runtime -- --scenario rest-menu --project /tmp/hs/rest-menu.json --netns
// 아침 6시: 밤 무리 없음. 쉬기 → 자정: 화면이 어두워지고 무리 넷이 나온다. 쉬기 → 아침: 무리가 사라진다.
const present = (testid, timeoutMs = 30_000) => ({ kind: "waitFor", testid, state: "present", timeoutMs });
const absent = (testid, timeoutMs = 10_000) => ({ kind: "waitFor", testid, state: "absent", timeoutMs });
const OUT = process.env.REST_MENU_OUT ?? "/tmp/hs/rest";
const openRest = `async () => {
  const pick = () => document.querySelector("[data-testid='status-menu-command-rest'], [data-testid='status-menu-group-command-rest']");
  if (!pick()) [...document.querySelectorAll("[data-testid^='status-menu-command-']")].find((b) => /시스템/.test(b.textContent ?? "") && b.tagName === "BUTTON")?.click();
  for (let i = 0; i < 20 && !pick(); i += 1) await new Promise((r) => setTimeout(r, 100));
  const found = !!pick();
  pick()?.click();
  return { opened: found };
}`;
const probe = (id) => ({ kind: "evalToFile", out: `${OUT}-${id}.json`, fn: `() => {
  const state = JSON.parse(document.querySelector("[data-testid='runtime-state-json']")?.textContent || "{}");
  const rows = [...document.querySelectorAll("[data-testid^='status-menu-rest-']")].map((b) => ({ id: b.dataset.testid, text: b.textContent, unavailable: b.getAttribute('aria-disabled') === 'true' }));
  return { hud: document.querySelector("[data-testid='runtime-time-hud']")?.textContent ?? null, gameTime: state.gameTime ?? null, timePhase: state.timePhase ?? null,
    spawns: Object.keys(state.events ?? {}).filter((id) => id.startsWith("__field_spawn__")).length, rows };
}` });
const rest = (target) => [
  { kind: "key", key: "Escape" }, present("main-menu"), { kind: "hold", dir: null, ms: 500 },
  { kind: "evalToFile", out: `${OUT}-open-${target}.json`, fn: openRest }, present(`status-menu-rest-${target}`), { kind: "hold", dir: null, ms: 900 },
  probe(`menu-${target}`),
  { kind: "click", testid: `status-menu-rest-${target}` }, absent("main-menu"), { kind: "hold", dir: null, ms: 2600 },
];
export default {
  id: "rest-menu",
  projectFixture: process.env.REST_MENU_FIXTURE ?? "/tmp/hs/rest-menu.json",
  viewport: { width: 960, height: 540 },
  beats: [
    { id: "title", ops: [present("title-screen")], expect: { testidPresent: ["title-screen"] } },
    { id: "morning", note: "아침 6시 — 밤 무리 없음", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime", timeoutMs: 120_000 }, { kind: "hold", dir: null, ms: 1500 }, probe("morning")], expect: { testidAbsent: ["title-screen"] }, shot: true },
    { id: "rest-midnight", note: "ESC → 쉬기 → 자정까지: 어두워지고 밤 무리가 나온다", ops: rest("midnight"), expect: { testidAbsent: ["main-menu"] }, shot: true },
    { id: "night", note: "밤 — 무리 확인", ops: [{ kind: "hold", dir: null, ms: 1500 }, probe("night")], expect: { testidAbsent: ["main-menu"] }, shot: true },
    { id: "rest-morning", note: "쉬기 → 아침까지: 무리가 사라진다", ops: [...rest("morning"), probe("next-morning")], expect: { testidAbsent: ["main-menu"] }, shot: true },
  ],
};
