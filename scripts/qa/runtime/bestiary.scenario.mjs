// 괴물 도감 — 출하 플레이어에서 본다.
// 픽스처: scripts/qa/runtime/bestiary-fixture.mts
//   QA_RECORD_VIDEO=/tmp/hs/vid-b npm run qa:runtime -- --scenario bestiary --project /tmp/hs/bestiary.json --netns
// 증인 대사 → 단서 스위치 → 「습성」 칸 열림(구석 알림). 도감: 이름 「???」 아님, 외형·약점·처치 잠김.
// 익사귀와 싸워 평타(물리 약점)로 이긴다 → 외형·약점·처치 기록이 열리고 약점 칸에 「물리 약점」이 붙는다.
const present = (testid, timeoutMs = 30_000) => ({ kind: "waitFor", testid, state: "present", timeoutMs });
const absent = (testid, timeoutMs = 10_000) => ({ kind: "waitFor", testid, state: "absent", timeoutMs });
const OUT = process.env.BESTIARY_OUT ?? "/tmp/hs/bst";
const openBestiary = `async () => {
  const pick = () => document.querySelector("[data-testid='status-menu-command-bestiary'], [data-testid='status-menu-group-command-bestiary']");
  if (!pick()) [...document.querySelectorAll("[data-testid^='status-menu-command-']")].find((b) => /기록/.test(b.textContent ?? "") && b.tagName === "BUTTON")?.click();
  for (let i = 0; i < 20 && !pick(); i += 1) await new Promise((r) => setTimeout(r, 100));
  const found = !!pick();
  pick()?.click();
  return { opened: found };
}`;
const probe = (id) => ({ kind: "evalToFile", out: `${OUT}-${id}.json`, fn: `() => {
  const rows = [...document.querySelectorAll("[data-testid^='status-menu-bestiary-']")].map((b) => ({ id: b.dataset.testid, text: (b.textContent ?? "").trim(),
    unlocked: b.dataset.bestiaryUnlocked ?? null, known: b.dataset.bestiaryKnown ?? null }));
  return { toast: document.querySelector("[data-testid='zone-feedback-toast']")?.textContent ?? null, title: document.querySelector("[data-testid='status-menu-detail-title']")?.textContent ?? null,
    art: !!document.querySelector("[data-testid='life-ledger-artwork']"), rows };
}` });
const openEntry = [
  { kind: "key", key: "Escape" }, present("main-menu"), { kind: "hold", dir: null, ms: 500 },
  { kind: "evalToFile", out: `${OUT}-open.json`, fn: openBestiary }, present("status-menu-bestiary-bst_drowner"), { kind: "hold", dir: null, ms: 700 },
  { kind: "click", testid: "status-menu-bestiary-bst_drowner" }, present("status-menu-bestiary-section-look"), { kind: "hold", dir: null, ms: 900 },
];
// 상세 → 목록 → 「기록」 묶음 → 메인 → 닫힘. 단계 수가 메뉴 스킨마다 달라 닫힐 때까지 누른다.
const closeMenu = [{ kind: "pressUntil", key: "Escape", testid: "main-menu", state: "absent", maxPresses: 6, timeoutMs: 1500 }, absent("main-menu"), { kind: "hold", dir: null, ms: 400 }];

export default {
  id: "bestiary",
  projectFixture: process.env.BESTIARY_FIXTURE ?? "/tmp/hs/bestiary.json",
  viewport: { width: 960, height: 540 },
  beats: [
    { id: "title", ops: [present("title-screen")], expect: { testidPresent: ["title-screen"] } },
    { id: "field", note: "새 게임", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime", timeoutMs: 120_000 }, { kind: "hold", dir: null, ms: 1000 }], expect: { testidAbsent: ["title-screen"] } },
    { id: "witness", note: "증인 대사 → 단서 스위치 → 「습성」 칸 열림 알림", ops: [
      { kind: "face", dir: "right" }, { kind: "hold", dir: null, ms: 400 }, { kind: "action" }, present("dialogue-box", 15_000), { kind: "hold", dir: null, ms: 800 },
      { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 6, timeoutMs: 1500 },
      { kind: "waitForText", testid: "zone-feedback-toast", text: "도감에 적었다", timeoutMs: 8000 },
      probe("toast"),
    ], expect: { testidPresent: ["zone-feedback-toast"] }, shot: true },
    { id: "locked", note: "도감 상세 — 습성만 열림, 외형·약점·처치 기록은 ???", ops: [...openEntry, probe("locked")], expect: { testidPresent: ["status-menu-bestiary-section-habit"] }, shot: true },
    { id: "battle", note: "익사귀와 싸운다 — 평타가 물리 약점(약점 발견)", ops: [
      ...closeMenu,
      { kind: "face", dir: "up" }, { kind: "action" },
      present("battle-scene", 30_000),
      { kind: "battle", fallback: "attack", untilEnd: true, resultHoldMs: 600, timeoutMs: 120_000 },
      absent("battle-scene", 30_000), { kind: "hold", dir: null, ms: 1500 },
      probe("after-battle"),
    ], expect: { testidAbsent: ["battle-scene"] }, shot: true },
    { id: "unlocked", note: "도감 상세 — 외형·약점(물리 약점 붙음)·처치 기록 열림", ops: [...openEntry, probe("unlocked")], expect: { testidPresent: ["status-menu-bestiary-section-weakness"] }, shot: true },
  ],
};
