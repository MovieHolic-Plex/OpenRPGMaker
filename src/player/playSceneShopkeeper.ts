import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import { emitRuntimeJuice } from "@/player/runtimeJuice";
import { dialogueHost } from "@/player/playSceneDom";
import { createShopOverlay, renderShopHaggle, renderShopNotice } from "@/player/playSceneShopDom";
import { shopIsClosed, shopKeyOf, type ShopIdentity } from "@/player/playSceneShopVisit";
import {
  haggleVisitKey,
  normalizeHaggleConfig,
  proposeHaggle,
  resolveHaggleReserve,
  type HaggleSetup,
} from "@/project/haggle";
import { resolveShopSellUnitPrice, shopDayKey } from "@/project/shopPrice";
import {
  generateShopkeeperCustomers,
  reputationAfterVerdict,
  shelfQuantity,
  type ShopkeeperCustomer,
} from "@/project/shopkeeper";
import { changeGold, changeItemsAtomically, GOLD_MAX } from "@/project/session";
import { store } from "@/project/store";
import { resolveTerms } from "@/project/terms";
import { el } from "@/util/dom";
import { isSafeEconomyValue } from "@/project/economyValues";
import type { StepResult } from "@/player/interpreter";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { goodsIndex } from "@/player/playSceneShopGoods";

export function playShopkeeper(
  scene: PlaySceneContext,
  step: Extract<StepResult, { kind: "shop" }>,
  identity?: ShopIdentity,
): Promise<boolean | "failed"> {
  const terms = resolveTerms(store.getCurrent());
  const failedResult = () => (step.branchOnFailedTransaction ? ("failed" as const) : false);
  const closed = shopIsClosed(scene.session, step);
  if (closed) return showNotice(scene, terms.gold, closed).then(failedResult);
  const shopKey = shopKeyOf(step, identity);
  const dayKey = shopDayKey(scene.session);
  const index = goodsIndex(store.getCurrent());
  const itemIds = (step.items ?? step.itemIds.map((itemId) => ({ itemId }))).map((row) => row.itemId);
  ensureShelf(scene, shopKey, itemIds);
  const customers = generateShopkeeperCustomers({ shopKey, dayKey, itemIds }).filter(
    (customer) => shelfQuantity(scene.session.shopShelf?.[shopKey], customer.itemId) > 0 && index.get(customer.itemId),
  );
  if (customers.length === 0) {
    return showNotice(scene, terms.gold, "오늘은 손님이 없습니다.").then(failedResult);
  }
  return new Promise((resolve) => {
    const overlay = createShopOverlay();
    overlay.dataset.testid = "shopkeeper-scene";
    let queue = customers;
    let active: ShopkeeperCustomer | undefined;
    let setup: HaggleSetup | undefined;
    let offer = 0;
    let line = "손님이 물건을 고르는 중.";
    let dealt = false;
    const finish = (result: boolean | "failed") => {
      overlay.remove();
      scene.syncRuntimeState();
      resolve(result);
    };
    const render = () => {
      while (overlay.firstChild) overlay.firstChild.remove();
      if (active && setup) {
        const goods = index.get(active.itemId);
        overlay.append(renderShopHaggle({
          itemName: `${active.name} · ${goods?.name ?? active.itemId}`,
          reference: setup.reference,
          offer,
          patience: setup.patience,
          merchantLine: line,
          goldLabel: terms.gold,
          onDelta: (dir) => { offer = Math.max(0, offer + dir); render(); },
          onPropose: () => propose(),
          onCancel: () => { active = undefined; setup = undefined; render(); },
        }));
        attachCursorMenu(overlay, {
          items: Array.from(overlay.querySelectorAll<HTMLElement>(".runtime-shop-menu-choice, .runtime-shop-confirm")),
          cancelEl: overlay.querySelector<HTMLElement>("[data-testid='shop-haggle-cancel']"),
          sound: true,
        });
        return;
      }
      overlay.append(renderQueue(queue, line, terms.gold, (customer) => start(customer), () => finish(dealt ? true : failedResult())));
      attachCursorMenu(overlay, {
        items: Array.from(overlay.querySelectorAll<HTMLElement>(".runtime-shop-menu-choice")),
        cancelEl: overlay.querySelector<HTMLElement>("[data-testid='shopkeeper-close']"),
        sound: true,
      });
    };
    const start = (customer: ShopkeeperCustomer): void => {
      const goods = index.get(customer.itemId);
      if (!goods) return;
      const cfg = normalizeHaggleConfig(step.economy?.haggle);
      const reference = resolveShopSellUnitPrice(store.getCurrent(), goods.id, goods.price);
      const reserve = resolveHaggleReserve({
        role: "playerSells",
        reference,
        buyPrice: goods.price,
        maxDiscount: cfg.maxDiscount,
        itemId: customer.itemId,
        merchantKey: shopKey,
        dayKey,
        attemptIndex: customer.attemptIndex,
      });
      active = customer;
      setup = {
        role: "playerSells",
        reference,
        reserve,
        patience: cfg.patience,
        insultRatio: cfg.insultRatio,
        buyPrice: goods.price,
      };
      offer = reference;
      line = `${customer.name}: 이거 얼마요?`;
      render();
    };
    const propose = (): void => {
      if (!active || !setup) return;
      const verdict = proposeHaggle(setup, offer);
      const customer = active;
      if (verdict.kind === "accept") {
        if (!takeSale(scene, shopKey, customer.itemId, verdict.price)) {
          emitRuntimeJuice({ event: "menu-invalid" });
          line = "선반에 물건이 없습니다.";
          active = undefined;
          setup = undefined;
          render();
          return;
        }
        bumpReputation(scene, shopKey, "accept");
        dealt = true;
        queue = queue.filter((entry) => entry.id !== customer.id);
        active = undefined;
        setup = undefined;
        line = `${customer.name}: 이 값이면 사겠소.`;
        emitRuntimeJuice({ event: "menu-confirm" });
        render();
        return;
      }
      if (verdict.kind === "broken") {
        bumpReputation(scene, shopKey, "broken");
        writeBroken(scene, shopKey, customer.itemId, dayKey);
        queue = queue.filter((entry) => entry.id !== customer.id);
        active = undefined;
        setup = undefined;
        line = `${customer.name}: 안 사겠소.`;
        render();
        return;
      }
      setup = { ...setup, patience: verdict.patience, reserve: verdict.reserve };
      offer = verdict.price;
      line = `${customer.name}: 더 맞춰 보시오.`;
      render();
    };
    const host = dialogueHost(scene)?.closest(".play-viewport") ?? dialogueHost(scene);
    if (!host) {
      resolve(failedResult());
      return;
    }
    host.append(overlay);
    render();
  });
}

function renderQueue(
  queue: readonly ShopkeeperCustomer[],
  line: string,
  goldLabel: string,
  onCustomer: (customer: ShopkeeperCustomer) => void,
  onClose: () => void,
): HTMLElement {
  const shell = el("div", { class: "runtime-shop-shell runtime-shop-menu-shell" });
  const menu = el("div", { class: "runtime-shop-menu" });
  menu.append(el("div", { class: "runtime-shop-message", text: line }));
  const choices = el("div", { class: "runtime-shop-menu-choices" });
  for (const customer of queue) {
    choices.append(el("button", {
      class: "runtime-shop-menu-choice",
      text: `${customer.name} · ${customer.itemId}`,
      dataset: { testid: `shopkeeper-${customer.id}` },
      attrs: { type: "button" },
      on: { click: () => onCustomer(customer) },
    }));
  }
  choices.append(el("button", {
    class: "runtime-shop-menu-choice",
    text: `닫기 (${goldLabel})`,
    dataset: { testid: "shopkeeper-close" },
    attrs: { type: "button" },
    on: { click: onClose },
  }));
  menu.append(choices);
  shell.append(menu);
  return shell;
}

function ensureShelf(scene: PlaySceneContext, shopKey: string, itemIds: readonly string[]): void {
  const session = scene.session as typeof scene.session & { shopShelf?: Record<string, Record<string, number>> };
  const current = session.shopShelf?.[shopKey];
  if (current) return;
  const shelf: Record<string, number> = {};
  for (const itemId of itemIds) {
    const qty = scene.session.inventory[itemId] ?? 0;
    if (qty > 0) shelf[itemId] = qty;
  }
  session.shopShelf = { ...(session.shopShelf ?? {}), [shopKey]: shelf };
}

function takeSale(scene: PlaySceneContext, shopKey: string, itemId: string, price: number): boolean {
  if (!isSafeEconomyValue(price) || !isSafeEconomyValue(scene.session.gold) || scene.session.gold + price > GOLD_MAX) {
    return false;
  }
  const session = scene.session as typeof scene.session & { shopShelf?: Record<string, Record<string, number>> };
  const shelf = { ...(session.shopShelf?.[shopKey] ?? {}) };
  if ((shelf[itemId] ?? 0) < 1) return false;
  if (!changeItemsAtomically(scene.session, [{ itemId, op: "-=", amount: 1 }])) return false;
  changeGold(scene.session, "+=", price);
  shelf[itemId] = (shelf[itemId] ?? 0) - 1;
  if (shelf[itemId] <= 0) delete shelf[itemId];
  session.shopShelf = { ...(session.shopShelf ?? {}), [shopKey]: shelf };
  scene.syncRuntimeState();
  return true;
}

function bumpReputation(scene: PlaySceneContext, shopKey: string, kind: "accept" | "broken"): void {
  const session = scene.session as typeof scene.session & { shopReputation?: Record<string, number> };
  const current = session.shopReputation?.[shopKey] ?? 0;
  session.shopReputation = { ...(session.shopReputation ?? {}), [shopKey]: reputationAfterVerdict(current, kind) };
}

function writeBroken(scene: PlaySceneContext, shopKey: string, itemId: string, dayKey: string): void {
  const session = scene.session as typeof scene.session & {
    shopHaggleState?: Record<string, { patience: number; drift: number; attemptIndex: number; broken?: boolean }>;
  };
  const key = haggleVisitKey(shopKey, itemId, dayKey);
  session.shopHaggleState = {
    ...(session.shopHaggleState ?? {}),
    [key]: { patience: 0, drift: 0, attemptIndex: 0, broken: true },
  };
}

function showNotice(scene: PlaySceneContext, _gold: string, message: string): Promise<void> {
  return new Promise((resolve) => {
    const overlay = createShopOverlay();
    const close = () => { overlay.remove(); scene.syncRuntimeState(); resolve(); };
    const host = dialogueHost(scene)?.closest(".play-viewport") ?? dialogueHost(scene);
    if (!host) { resolve(); return; }
    host.append(overlay);
    overlay.append(renderShopNotice(message, resolveTerms(store.getCurrent()), close));
    attachCursorMenu(overlay, {
      items: Array.from(overlay.querySelectorAll<HTMLElement>(".runtime-shop-menu-choice")),
      cancelEl: overlay.querySelector<HTMLElement>("[data-testid='shop-notice-close']"),
      sound: true,
    });
  });
}
