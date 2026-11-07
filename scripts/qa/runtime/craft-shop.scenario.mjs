// 제작 공방(openCraftShop) — 폴른 스타 니나의 공방을 출하 플레이어에서 본다.
//   npm run qa:runtime -- --scenario craft-shop --checkpoint-set craft-shop --checkpoint all --netns
// 같은 세이브(재료·골드)에서: 메뉴 열기 → 불씨 병 제작 → 해독초 제작 → 투지 강장제(송곳니 2 필요, 1개뿐) 시도 → 그만둔다.
// 매 단계 가방·골드를 craft-shop-<단계>.json 으로 떨군다(CRAFT_SHOP_OUT, 기본 /tmp/craft-shop).
// CRAFT_SHOP_MODE=choices 는 이 명령 이전의 손으로 짠 선택지 메뉴를 같은 입력으로 몬다(origin/main 사본에서 BEFORE 를 찍을 때).
const OUT = process.env.CRAFT_SHOP_OUT ?? "/tmp/craft-shop";
const ITEMS = ["item_fs_wisp_ember", "item_fs_spider_silk", "item_fs_venom_sac", "item_fs_wolf_fang", "item_fs_fire_flask", "item_antidote", "item_fs_tonic"];
const measure = (id, rowSelector) => ({
  kind: "evalToFile",
  out: `${OUT}-${id}.json`,
  fn: `() => {
    const s = window.__oprnDebug.readState();
    const inv = s.inventory || {};
    const rows = [...document.querySelectorAll(${JSON.stringify(rowSelector)})].map((b) => ({
      text: b.textContent.replace(/\\s+/g, " ").trim(),
      disabled: b.getAttribute("aria-disabled") === "true" || b.dataset.disabled === "true",
    }));
    return { gold: s.gold, inventory: Object.fromEntries(${JSON.stringify(ITEMS)}.map((id) => [id, inv[id] ?? 0])), rows };
  }`,
});
const settle = (ms = 500) => ({ kind: "hold", dir: null, ms });
const present = (testid, timeoutMs = 15_000) => ({ kind: "waitFor", testid, state: "present", timeoutMs });
const absent = (testid, timeoutMs = 15_000) => ({ kind: "waitFor", testid, state: "absent", timeoutMs });

const CHOICE_ROWS = '[data-testid^="runtime-choice-"]:not([data-testid$="-reason"])';
const WINDOW_ROWS = '[data-testid^="craft-shop-row-"]:not([data-testid$="-reason"])';

const choicesBeats = [
  { id: "open", note: "니나에게 말을 건다 → 손으로 짠 선택지 메뉴", ops: [{ kind: "face", dir: "up" }, { kind: "action" }, present("dialogue-box"), { kind: "pressUntil", key: "z", testid: "runtime-choices", state: "present", maxPresses: 6, timeoutMs: 2000 }, settle(800), measure("open", CHOICE_ROWS)], shot: true },
  { id: "craft-flask", note: "1번째 줄(불씨 병) 결정 → 대사 넘겨 메뉴로", ops: [{ kind: "click", testid: "runtime-choice-0" }, { kind: "pressUntil", key: "z", testid: "runtime-choices", state: "present", maxPresses: 8, timeoutMs: 2000 }, settle(700), measure("craft-flask", CHOICE_ROWS)], shot: true },
  { id: "craft-antidote", note: "2번째 줄(해독초)", ops: [{ kind: "click", testid: "runtime-choice-1" }, { kind: "pressUntil", key: "z", testid: "runtime-choices", state: "present", maxPresses: 8, timeoutMs: 2000 }, settle(700), measure("craft-antidote", CHOICE_ROWS)], shot: true },
  { id: "try-tonic", note: "4번째 줄(투지 강장제 — 송곳니 2 필요, 1개뿐)", ops: [{ kind: "click", testid: "runtime-choice-3" }, { kind: "pressUntil", key: "z", testid: "runtime-choices", state: "present", maxPresses: 8, timeoutMs: 2000 }, settle(700), measure("try-tonic", CHOICE_ROWS)], shot: true },
  { id: "leave", note: "취소(x)로 닫는다 — 「그만둔다」 줄은 화면에 없다", ops: [{ kind: "key", key: "x" }, { kind: "pressUntil", key: "z", testid: "dialogue-box", state: "absent", maxPresses: 6, timeoutMs: 2000 }, settle(700), measure("leave", CHOICE_ROWS)], shot: true },
];

const windowBeats = [
  { id: "open", note: "니나에게 말을 건다 → 제작 공방 창", ops: [{ kind: "face", dir: "up" }, { kind: "action" }, present("dialogue-box"), { kind: "pressUntil", key: "z", testid: "craft-shop-scene", state: "present", maxPresses: 6, timeoutMs: 2000 }, settle(800), measure("open", WINDOW_ROWS)], shot: true },
  { id: "craft-flask", note: "불씨 병 결정 → 같은 창이 결과 한 줄과 함께 다시 열림", ops: [{ kind: "key", key: "z" }, present("craft-shop-notice"), settle(700), measure("craft-flask", WINDOW_ROWS)], shot: true },
  { id: "craft-antidote", note: "해독초", ops: [{ kind: "key", key: "ArrowDown" }, settle(300), { kind: "key", key: "z" }, { kind: "waitForText", testid: "craft-shop-notice", text: "해독초" }, settle(700), measure("craft-antidote", WINDOW_ROWS)], shot: true },
  { id: "try-tonic", note: "투지 강장제(흐림) 결정 — 경고음, 창 그대로, 재료 그대로", ops: [{ kind: "click", testid: "craft-shop-row-fs_craft_tonic" }, settle(700), measure("try-tonic", WINDOW_ROWS)], shot: true },
  { id: "leave", note: "그만둔다", ops: [{ kind: "click", testid: "craft-shop-leave" }, absent("craft-shop-scene"), { kind: "pressUntil", key: "z", testid: "dialogue-box", state: "absent", maxPresses: 6, timeoutMs: 2000 }, settle(700), measure("leave", WINDOW_ROWS)], shot: true },
];

const beats = process.env.CRAFT_SHOP_MODE === "choices" ? choicesBeats : windowBeats;

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "craft-shop",
  checkpointSet: "craft-shop",
  beats,
  checkpointBeats: { "nina-workshop": beats },
};
