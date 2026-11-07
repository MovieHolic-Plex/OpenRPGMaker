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
    const q = (t) => document.querySelector('[data-testid="' + t + '"]');
    const needs = [...document.querySelectorAll('[data-testid^="craft-shop-need-"]')].map((n) => ({ id: n.dataset.testid, have: Number(n.dataset.have), need: Number(n.dataset.need), short: n.dataset.short === "1" }));
    const craft = q("craft-shop-craft");
    const win = q("craft-shop-scene")?.querySelector(".runtime-shop-shell");
    const vp = document.querySelector(".play-viewport")?.getBoundingClientRect();
    const leave = q("craft-shop-leave")?.getBoundingClientRect();
    return { gold: s.gold, inventory: Object.fromEntries(${JSON.stringify(ITEMS)}.map((id) => [id, inv[id] ?? 0])), rows,
      window: craft ? { craftDisabled: craft.disabled, craftLabel: craft.textContent, reason: q("craft-shop-reason")?.hidden ? null : q("craft-shop-reason")?.textContent, count: q("craft-shop-count")?.textContent, quantityShown: !q("craft-shop-quantity")?.hidden, needs,
        leaveInside: !!(vp && leave && leave.width > 0 && leave.left >= vp.left - 1 && leave.right <= vp.right + 1 && leave.top >= vp.top - 1 && leave.bottom <= vp.bottom + 1),
        overflowX: win ? win.scrollWidth - win.clientWidth : null, overflowY: win ? win.scrollHeight - win.clientHeight : null } : null };
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

// CRAFT_SHOP_STILL=1: 플레이어 설정 「메뉴 움직임 줄이기」를 켜고 같은 흐름 — 연출 없이 같은 정보가 나오는지 본다.
const stillOps = process.env.CRAFT_SHOP_STILL === "1"
  ? [{ kind: "evalToFile", out: `${OUT}-still-pref.json`, fn: `() => { const k = "oprn:player-preferences:v1"; const p = JSON.parse(localStorage.getItem(k) || "{}"); p.reduceMenuMotion = true; localStorage.setItem(k, JSON.stringify(p)); return p; }` }]
  : [];

const windowBeats = [
  { id: "open", note: "니나에게 말을 건다 → 제작 공방 창", ops: [...stillOps, { kind: "face", dir: "up" }, { kind: "action" }, present("dialogue-box"), { kind: "pressUntil", key: "z", testid: "craft-shop-scene", state: "present", maxPresses: 6, timeoutMs: 2000 }, settle(800), measure("open", WINDOW_ROWS)], shot: true },
  { id: "quantity", note: "→ 로 수량 2 (불씨 병은 재료·골드가 2번 분량)", ops: [{ kind: "key", key: "ArrowRight" }, settle(400), measure("quantity", WINDOW_ROWS)], shot: true },
  { id: "craft-burst", note: "← 로 수량 1 → 불씨 병 결정 — 연출 한가운데(재료가 날아들고 반짝임)", ops: [{ kind: "key", key: "ArrowLeft" }, settle(200), { kind: "key", key: "z" }, present("craft-shop-notice"), { kind: "hold", dir: null, ms: 330 }], shot: true },
  { id: "craft-flask", note: "연출이 끝난 뒤 — 같은 창이 결과 한 줄과 함께", ops: [settle(900), measure("craft-flask", WINDOW_ROWS)], shot: true },
  { id: "craft-antidote", note: "해독초", ops: [{ kind: "key", key: "ArrowDown" }, settle(300), { kind: "key", key: "z" }, { kind: "waitForText", testid: "craft-shop-notice", text: "해독초" }, settle(700), measure("craft-antidote", WINDOW_ROWS)], shot: true },
  { id: "try-tonic", note: "투지 강장제를 누른다 — 상세에 송곳니 1/2(빨강), 만들기 꺼짐+이유", ops: [{ kind: "click", testid: "craft-shop-row-fs_craft_tonic" }, settle(500), { kind: "click", testid: "craft-shop-craft" }, settle(500), measure("try-tonic", WINDOW_ROWS)], shot: true },
  { id: "leave", note: "나가기", ops: [{ kind: "click", testid: "craft-shop-leave" }, absent("craft-shop-scene"), { kind: "pressUntil", key: "z", testid: "dialogue-box", state: "absent", maxPresses: 6, timeoutMs: 2000 }, settle(700), measure("leave", WINDOW_ROWS)], shot: true },
];

const beats = process.env.CRAFT_SHOP_MODE === "choices" ? choicesBeats : windowBeats;

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "craft-shop",
  checkpointSet: "craft-shop",
  // CRAFT_SHOP_VIEWPORT=390x844 처럼 창 크기를 바꿔 같은 흐름을 돌린다(기본은 체크포인트 집합의 960×540).
  ...(process.env.CRAFT_SHOP_VIEWPORT ? { viewport: Object.fromEntries(process.env.CRAFT_SHOP_VIEWPORT.split("x").map((n, i) => [i ? "height" : "width", Number(n)])) } : {}),
  beats,
  checkpointBeats: { "nina-workshop": beats },
};
