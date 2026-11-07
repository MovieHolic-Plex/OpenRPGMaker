// 제작 공방(openCraftShop) 명령의 실플레이어 창 — 상점 창과 같은 틀(runtime-shop-*)의 전용 제작 화면.
//   위: 공방 이름 + 소지금.  왼쪽: 제작법 목록(아이콘 · 이름 · 만들 수 있는 횟수).
//   오른쪽: 고른 제작법 상세 — 산출물 아이콘·설명·보유, 재료마다 가진/필요(모자라면 빨강), 골드 비용 vs 소지금.
//   아래: 결과 한 줄 · 수량 단계 · 「만들기」(못 만들면 꺼지고 이유) · 「나가기」 · 키 안내.
// 고른 제작법(과 횟수)을 돌려주면 인터프리터가 만들고 이 창을 다시 연다.
import { store } from "@/project/store";
import type { StepResult } from "@/player/interpreter";
import { CANCEL_KEY_LABEL, SHOP_CONFIRM_KEY_LABEL } from "@/player/keyBindings";
import { createShopOverlay } from "@/player/playSceneShopDom";
import { coinIcon, keyHints, shopBrandBlock, shopItemIcon } from "@/player/playSceneShopParts";
import { dialogueHost } from "@/player/playSceneDom";
import { getPlayerPreferences } from "@/player/playerPreferences";
import { playProjectSeCue } from "@/player/seCuePlayback";
import { mountPixelFxDom } from "@/pixelfx/domPlayer";
import { prefersReducedMotion } from "@/util/reducedMotion";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import { emitRuntimeJuice } from "@/player/runtimeJuice";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { ShopGoods } from "@/player/playSceneShopGoods";
import type { CraftShopRow } from "@/project/craftShop";
import { el } from "@/util/dom";

type CraftShopStep = Extract<StepResult, { kind: "craftShop" }>;

/** 고른 값. 한 번이면 제작법 id, 여러 번이면 [id, 횟수]. 나가면 undefined. */
export type CraftShopPick = string | readonly [string, string];

function iconGoods(id: string, name: string, iconResourceId: string | undefined): ShopGoods {
  // 상점 아이콘 그리기(shopItemIcon)는 ShopGoods 의 id·name·iconResourceId 만 읽는다.
  return { id, name, iconResourceId } as ShopGoods;
}

/** 제작 연출 길이 상한(ms). 입력은 막지 않고, 키·탭 하나면 즉시 끝난다. */
export const CRAFT_FX_MS = 900;

/** 운영체제 「움직임 줄이기」 또는 플레이어 「메뉴 움직임 줄이기」 — 그때는 연출 없이 같은 정보만. */
function craftStill(): boolean {
  return getPlayerPreferences().reduceMenuMotion || prefersReducedMotion();
}

/** 방금 만든 제작법 — 창이 결과와 함께 다시 열릴 때 같은 줄에 서서 연출한다. */
let lastCraft: { recipeId: string; count: number } | undefined;

function recipeRow(row: CraftShopRow, gold: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "runtime-shop-item-row runtime-craft-row";
  button.dataset.testid = `craft-shop-row-${row.recipeId}`;
  button.setAttribute("role", "option");
  if (row.disabledReason) {
    // 목록에서는 고를 수 있어야 한다(상세에서 왜 못 만드는지 본다). 흐리게만 그린다.
    button.classList.add("is-unaffordable");
    button.dataset.disabled = "true";
  }
  const cost = row.goldCost > 0 ? ` · ${row.goldCost}${gold}` : "";
  button.setAttribute("aria-label", `${row.name}${row.disabledReason ? ` · ${row.disabledReason}` : ` · ${row.maxCrafts}번 가능`}${cost}`);
  button.append(
    shopItemIcon(iconGoods(row.outputItemId, row.name, row.iconResourceId)),
    el("span", { class: "runtime-shop-item-main", children: [
      el("span", { class: "runtime-shop-item-name", text: row.name }),
      el("span", { class: "runtime-shop-item-type", text: row.outputCount > 1 ? `${row.outputCount}개씩` : "제작" }),
    ] }),
    el("span", {
      class: "runtime-shop-item-owned runtime-craft-row-max",
      text: row.maxCrafts > 0 ? `×${row.maxCrafts}` : "—",
      dataset: { testid: `craft-shop-row-${row.recipeId}-max`, count: String(row.maxCrafts) },
    }),
  );
  return button;
}

function detail(row: CraftShopRow | undefined, sessionGold: number, count: number, gold: string): HTMLElement {
  const card = el("div", { class: "runtime-shop-detail runtime-craft-detail", dataset: { testid: "craft-shop-detail" } });
  if (!row) return card;
  const ready = !row.disabledReason;
  card.append(el("div", { class: `runtime-craft-hero${ready ? " is-ready" : ""}`, dataset: { testid: "craft-shop-hero" }, children: [
    el("span", { class: "runtime-craft-hero-frame", children: [
      shopItemIcon(iconGoods(row.outputItemId, row.name, row.iconResourceId), "runtime-craft-hero-icon"),
      ...(row.outputCount * count > 1 ? [el("span", { class: "runtime-craft-hero-yield", text: `×${row.outputCount * count}`, dataset: { testid: "craft-shop-yield" } })] : []),
    ] }),
    el("div", { class: "runtime-craft-hero-copy", children: [
      el("div", { class: "runtime-craft-hero-name", text: row.name }),
      el("div", { class: "runtime-craft-hero-owned", text: `보유 ${row.owned}`, dataset: { testid: "craft-shop-owned" } }),
      ...(row.description ? [el("div", { class: "runtime-craft-desc", text: row.description })] : []),
    ] }),
  ] }));
  const tiles = el("div", { class: "runtime-craft-needs", attrs: { role: "list", "aria-label": "필요한 것" } });
  for (const ingredient of row.ingredients) {
    const need = ingredient.need * count;
    const short = ingredient.have < need;
    tiles.append(el("div", {
      class: `runtime-craft-need${short ? " is-short" : " is-met"}`,
      attrs: { role: "listitem", "aria-label": `${ingredient.name} ${ingredient.have}/${need}${short ? " 모자람" : ""}` },
      dataset: { testid: `craft-shop-need-${ingredient.itemId}`, have: String(ingredient.have), need: String(need), short: short ? "1" : "0" },
      children: [
        shopItemIcon(iconGoods(ingredient.itemId, ingredient.name, ingredient.iconResourceId), "runtime-craft-need-icon"),
        el("span", { class: "runtime-craft-need-name", text: ingredient.name }),
        el("span", { class: "runtime-craft-need-count", text: `${ingredient.have}/${need}` }),
        el("span", { class: "runtime-craft-need-mark", text: short ? "!" : "✓", attrs: { "aria-hidden": "true" } }),
      ],
    }));
  }
  if (row.goldCost > 0) {
    const cost = row.goldCost * count;
    const short = sessionGold < cost;
    tiles.append(el("div", {
      class: `runtime-craft-need runtime-craft-need-gold${short ? " is-short" : " is-met"}`,
      attrs: { role: "listitem", "aria-label": `비용 ${cost}${gold}, 소지 ${sessionGold}${gold}${short ? " 모자람" : ""}` },
      dataset: { testid: "craft-shop-need-gold", have: String(sessionGold), need: String(cost), short: short ? "1" : "0" },
      children: [
        el("span", { class: "runtime-shop-item-icon runtime-craft-need-icon runtime-craft-coin", children: [coinIcon()] }),
        el("span", { class: "runtime-craft-need-name", text: `비용 ${cost}${gold}` }),
        el("span", { class: "runtime-craft-need-count", text: `${sessionGold}/${cost}` }),
        el("span", { class: "runtime-craft-need-mark", text: short ? "!" : "✓", attrs: { "aria-hidden": "true" } }),
      ],
    }));
  }
  card.append(tiles);
  return card;
}

/**
 * 제작 성공 연출: 재료 아이콘이 가운데 산출물 틀로 날아들고, 반짝임(pixelfx pickups/collect-burst)과 함께 산출물이 튕 튀다.
 * 장식일 뿐이라 입력을 막지 않는다. 키·포인터 하나면 바로 걷히고, CRAFT_FX_MS 뒤엔 스스로 걷힌다. 돌려주는 함수는 즉시 걷기.
 */
function celebrate(overlay: HTMLElement, detailSlot: HTMLElement): () => void {
  const frame = detailSlot.querySelector<HTMLElement>(".runtime-craft-hero-frame");
  if (!frame) return () => {};
  overlay.classList.add("is-crafted");
  // 오버레이 안 절대 좌표로 그린다 — 상세 판은 overflow 로 자르고, 오버레이는 등장 애니메이션(transform) 중이라 fixed 가 어긋난다.
  // 플레이 화면이 배율로 확대돼 있으면 화면 좌표를 CSS 좌표로 나눈다.
  const base = overlay.getBoundingClientRect();
  const k = overlay.offsetWidth > 0 ? base.width / overlay.offsetWidth : 1;
  const local = (r: DOMRect) => ({ left: (r.left - base.left) / k, top: (r.top - base.top) / k, width: r.width / k, height: r.height / k });
  const target = local(frame.getBoundingClientRect());
  const cx = target.left + target.width / 2;
  const cy = target.top + target.height / 2;
  const flyers: HTMLElement[] = [];
  for (const [i, icon] of Array.from(detailSlot.querySelectorAll<HTMLElement>(".runtime-craft-need-icon")).entries()) {
    const from = local(icon.getBoundingClientRect());
    if (from.width === 0) continue;
    const x = from.left, y = from.top;
    const ghost = icon.cloneNode(true) as HTMLElement;
    ghost.classList.add("runtime-craft-flyer");
    ghost.removeAttribute("data-testid");
    Object.assign(ghost.style, { left: `${x}px`, top: `${y}px`, width: `${from.width}px`, height: `${from.height}px` });
    overlay.append(ghost);
    flyers.push(ghost);
    ghost.animate?.([
      { transform: "translate(0, 0) scale(1.2)", opacity: 1 },
      { transform: `translate(${cx - x - from.width / 2}px, ${cy - y - from.height / 2}px) scale(0.5)`, opacity: 0.9, offset: 0.85 },
      { transform: `translate(${cx - x - from.width / 2}px, ${cy - y - from.height / 2}px) scale(0.2)`, opacity: 0 },
    ], { duration: 420, delay: 120 + i * 60, easing: "cubic-bezier(.55,0,.7,.2)", fill: "both" });
  }
  const fx = mountPixelFxDom({ effectId: "pickups/collect-burst", palette: ["#1a0f05", "#3d2208", "#70400d", "#b0661a", "#f59a2c", "#ffc35c", "#ffe7b0", "#ffffff"] }, {
    pixelScale: Math.max(1, Math.round(target.width / 48)), maxMs: CRAFT_FX_MS, centered: true,
  });
  fx.element.classList.add("runtime-craft-burst");
  Object.assign(fx.element.style, { left: `${cx}px`, top: `${cy}px` });
  const fxDelay = setTimeout(() => overlay.append(fx.element), 360);
  let done = false;
  const stop = (): void => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    clearTimeout(fxDelay);
    fx.destroy();
    fx.element.remove();
    for (const ghost of flyers) ghost.remove();
    overlay.classList.remove("is-crafted");
    overlay.removeEventListener("keydown", stop, true);
    overlay.removeEventListener("pointerdown", stop, true);
    window.removeEventListener("keydown", stop, true);
  };
  const timer = setTimeout(stop, CRAFT_FX_MS + 360);
  overlay.addEventListener("keydown", stop, true);
  overlay.addEventListener("pointerdown", stop, true);
  window.addEventListener("keydown", stop, true);
  return stop;
}

export async function playCraftShop(scene: PlaySceneContext, step: CraftShopStep): Promise<CraftShopPick | undefined> {
  const host = dialogueHost(scene);
  if (!host) return undefined;
  const gold = "G";
  return new Promise((resolve) => {
    const overlay = createShopOverlay();
    overlay.classList.add("runtime-craft-shop-overlay");
    overlay.dataset.testid = "craft-shop-scene";
    overlay.setAttribute("aria-label", step.title ?? "제작");
    const justMade = step.notice?.ok ? lastCraft : undefined;
    lastCraft = undefined;
    const madeIndex = justMade ? step.rows.findIndex((row) => row.recipeId === justMade.recipeId) : -1;
    let index = madeIndex >= 0 ? madeIndex : Math.max(0, step.rows.findIndex((row) => !row.disabledReason));
    let count = 1;
    const still = craftStill();
    if (still) overlay.classList.add("is-still");

    const rows = step.rows.map((row) => recipeRow(row, gold));
    const detailSlot = el("div", { class: "runtime-shop-slot", dataset: { testid: "craft-shop-detail-slot" } });
    const countValue = el("span", { class: "runtime-craft-count-value", dataset: { testid: "craft-shop-count" }, text: "1" });
    const minus = el("button", { class: "runtime-shop-menu-choice runtime-craft-step", text: "−", attrs: { type: "button", "aria-label": "하나 덜" }, dataset: { testid: "craft-shop-count-minus" }, on: { click: () => step1(-1) } }) as HTMLButtonElement;
    const plus = el("button", { class: "runtime-shop-menu-choice runtime-craft-step", text: "+", attrs: { type: "button", "aria-label": "하나 더" }, dataset: { testid: "craft-shop-count-plus" }, on: { click: () => step1(1) } }) as HTMLButtonElement;
    const quantity = el("div", { class: "runtime-craft-count", dataset: { testid: "craft-shop-quantity" }, children: [
      el("span", { class: "runtime-shop-quantity-label", text: "수량" }), minus, countValue, plus,
    ] });
    const craft = el("button", { class: "runtime-shop-confirm", text: "만들기", attrs: { type: "button" }, dataset: { testid: "craft-shop-craft" }, on: { click: () => craftSelected() } }) as HTMLButtonElement;
    const leave = el("button", { class: "runtime-shop-cancel", text: "나가기", attrs: { type: "button" }, dataset: { testid: "craft-shop-leave" }, on: { click: () => resolveWith(undefined) } }) as HTMLButtonElement;
    const reason = el("span", { class: "runtime-craft-reason", dataset: { testid: "craft-shop-reason" } });
    const status = el("span", {
      class: `runtime-shop-status runtime-craft-status${step.notice ? (step.notice.ok ? " is-ok" : " is-fail") : ""}`,
      text: step.notice?.text ?? "만들 것을 고르세요.",
      attrs: { role: "status", "aria-live": "polite" },
      dataset: { testid: step.notice ? "craft-shop-notice" : "craft-shop-status" },
    });

    const refresh = (): void => {
      const row = step.rows[index];
      const max = row?.maxCrafts ?? 0;
      count = Math.max(1, Math.min(count, Math.max(1, max)));
      detailSlot.replaceChildren(detail(row, step.gold, count, gold));
      countValue.textContent = String(count);
      minus.disabled = count <= 1;
      plus.disabled = count >= max;
      quantity.hidden = max <= 1;
      const why = !row ? "만들 수 있는 제작법이 없다." : row.disabledReason;
      craft.disabled = why !== undefined;
      craft.textContent = count > 1 ? `${count}번 만들기` : "만들기";
      reason.textContent = why ?? "";
      reason.hidden = why === undefined;
      rows.forEach((button, i) => button.setAttribute("aria-selected", i === index ? "true" : "false"));
    };
    function step1(dir: -1 | 1): boolean {
      const max = step.rows[index]?.maxCrafts ?? 0;
      const next = Math.max(1, Math.min(max, count + dir));
      if (max <= 1 || next === count) {
        emitRuntimeJuice({ event: "menu-invalid", project: store.getCurrent(), session: scene.session });
        return true;
      }
      count = next;
      emitRuntimeJuice({ event: "menu-select", project: store.getCurrent(), session: scene.session });
      refresh();
      return true;
    }
    function craftSelected(): void {
      const row = step.rows[index];
      if (!row || row.disabledReason) {
        emitRuntimeJuice({ event: "menu-invalid", target: craft, project: store.getCurrent(), session: scene.session });
        return;
      }
      emitRuntimeJuice({ event: "menu-confirm", cue: "shop", project: store.getCurrent(), session: scene.session });
      lastCraft = { recipeId: row.recipeId, count };
      resolveWith(count > 1 ? [row.recipeId, String(count)] : row.recipeId);
    }
    rows.forEach((button, i) => button.addEventListener("click", () => {
      // 터치: 첫 탭은 고르기, 고른 줄을 다시 누르면 만든다. 키보드 결정·마우스(호버로 이미 골라짐)는 바로 만든다.
      if (i !== index) { button.focus({ preventScroll: true }); index = i; count = 1; refresh(); return; }
      craftSelected();
    }));

    const heading = step.title ?? "제작";
    overlay.append(el("div", {
      class: "runtime-shop-shell runtime-shop-items-shell runtime-craft-shell",
      children: [
        el("div", { class: "runtime-shop-topbar", children: [
          shopBrandBlock(scene, heading, step.speaker ? `${step.speaker} · 재료를 모아 물건을 만든다` : "재료를 모아 물건을 만든다"),
          el("div", { class: "runtime-shop-panel runtime-shop-gold-panel", children: [
            el("div", { class: "runtime-shop-gold", children: [
              coinIcon(),
              el("span", { class: "runtime-shop-gold-label", text: "소지금" }),
              el("span", { class: "runtime-shop-gold-value", text: `${step.gold}${gold}`, dataset: { testid: "craft-shop-gold" } }),
            ] }),
          ] }),
        ] }),
        el("div", { class: "runtime-shop-main", children: [
          el("div", { class: "runtime-shop-panel runtime-shop-list-panel", children: [
            el("div", { class: "runtime-shop-item-list", dataset: { testid: "craft-shop-list" }, attrs: { role: "listbox", "aria-label": "제작법" }, children: rows }),
          ] }),
          el("div", { class: "runtime-shop-side", children: [
            el("div", { class: "runtime-shop-panel runtime-shop-detail-panel", children: [detailSlot] }),
          ] }),
        ] }),
        el("div", { class: "runtime-shop-panel runtime-shop-prompt-panel", children: [
          el("div", { class: "runtime-shop-prompt runtime-craft-prompt", children: [
            el("span", { class: "runtime-craft-status-line", children: [status, reason] }),
            quantity,
            el("div", { class: "runtime-shop-prompt-actions", children: [craft, leave] }),
          ] }),
          keyHints([["↑↓", "고르기"], ["←→", "수량"], [SHOP_CONFIRM_KEY_LABEL, "만들기"], [CANCEL_KEY_LABEL, "나가기"]]),
        ] }),
      ],
    }));
    const layer = host.closest(".play-viewport") ?? host;
    layer.querySelector("[data-testid='craft-shop-scene']")?.remove();
    layer.append(overlay);
    refresh();
    if (step.notice?.ok) playProjectSeCue("itemGet");
    const stopFx = justMade && !still ? celebrate(overlay, detailSlot) : undefined;
    if (step.notice && !step.notice.ok && !still) status.classList.add("is-shake");
    let detachCursor: (() => void) | null = attachCursorMenu(overlay, {
      items: rows,
      cancelEl: leave,
      initialIndex: index,
      sound: true,
      audioContext: { project: store.getCurrent(), session: scene.session },
      freshDom: true,
      onSelect: (next) => { if (next !== index) { index = next; count = 1; } refresh(); },
      onHorizontal: (dir) => step1(dir),
    });

    function resolveWith(pick: CraftShopPick | undefined): void {
      stopFx?.();
      detachCursor?.();
      detachCursor = null;
      overlay.remove();
      resolve(pick);
    }
  });
}
