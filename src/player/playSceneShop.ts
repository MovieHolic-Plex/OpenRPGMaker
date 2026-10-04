import { changeGold, changeItemsAtomically, GOLD_MAX } from "@/project/session";
import {
  isSafeEconomyRecord,
  isSafeEconomyValue,
  isSafeShopTradeCountsRecord,
} from "@/project/economyValues";
import type { Project } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import { store } from "@/project/store";
import { resolveTerms, type ResolvedTerms } from "@/project/terms";
import { dialogueHost } from "@/player/playSceneDom";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import { attachShopDecisionInput } from "@/player/shopDecisionInput";
import { previewShopEquipment } from "@/player/shopEquipmentPreview";
import { renderShopComparison, shopComparisonSummary, shopRecoverySummary } from "@/player/shopComparisonDom";
import { emitRuntimeJuice } from "@/player/runtimeJuice";
import {
  adjustShopQuantity,
  createShopOverlay,
  defaultShopMode,
  flashGoldDelta,
  refreshShopItemRow,
  removeShopItemRow,
  renderShopHaggle,
  renderShopItems,
  renderShopMenu,
  renderShopNotice,
  shopItemRowEl,
  shopPromptText,
  updateShopGoldPanel,
  updateShopHaggleOffer,
  updateShopHelpLine,
  updateShopOwnedPanel,
  updateShopPartyCards,
  updateShopQuantityTotal,
  updateShopStatus,
  shopUiPresetOf,
  type ShopMode,
  type ShopView,
} from "@/player/playSceneShopDom";
import {
  beginShopVisit,
  endShopVisit,
  shopIsClosed,
  shopKeyOf,
  type ShopIdentity,
} from "@/player/playSceneShopVisit";
import { playShopkeeper } from "@/player/playSceneShopkeeper";
import {
  haggleVisitKey,
  normalizeHaggleConfig,
  proposeHaggle,
  resolveHaggleReserve,
  type HaggleSetup,
} from "@/project/haggle";
import { resolveShopSellUnitPrice, shopDayKey } from "@/project/shopPrice";
import type { ShopHaggleVisitState } from "@/project/economyValues";
import type { StepResult } from "@/player/interpreter";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { goodsIndex, type ShopCategory, type ShopGoods } from "@/player/playSceneShopGoods";
import { bestFitActorId, partyFit, recoveryPreview } from "@/player/shopPartyFit";
import { shopPartyWalker } from "@/player/playSceneShopParts";
import { clampLevel, normalizeActorRecord } from "@/project/actorModel";

export type ShopStep = Extract<StepResult, { kind: "shop" }>;

export function playShop(
  scene: PlaySceneContext,
  step: ShopStep,
  identity?: ShopIdentity,
): Promise<boolean | "failed"> {
  if (step.economy?.shopkeeperEnabled === true) {
    return playShopkeeper(scene, step, identity);
  }
  const closed = shopIsClosed(scene.session, step);
  const stockItems = shopItems(step);
  const terms = resolveTerms(store.getCurrent());
  const failedResult = () => (step.branchOnFailedTransaction ? ("failed" as const) : false);
  if (closed) {
    return showShopNotice(scene, terms, closed).then(failedResult);
  }
  // 수리/감정: 빈 풀은 “거래 불가”로 간주 (빈 풀에 수리비 청구 방지)
  const svc = step.shopServiceKind;
  const appraisalPool = step.appraisalUnidentifiedPool;
  if ((svc === "appraisal" && (!appraisalPool || appraisalPool.length === 0)) || (svc === "repair" && stockItems.length === 0)) {
    // 실패로 간주 — 골드 환불 전제(수리비는 handleShopTransaction 이전이므로 차감 없음)
    return showShopNotice(scene, terms, "지금은 해 드릴 일이 없습니다.").then(failedResult);
  }
  // 빈 상점도 안내는 띄운다 — 예전에는 아무것도 안 보여줘서 이벤트가 조용히 지나갔다(유령 상점).
  if (stockItems.length === 0) {
    return showShopNotice(scene, terms, "지금은 팔 물건이 없습니다.").then(failedResult);
  }
  // 방문마다 상인 소지금을 명령값(기본 100G) × 투자 레벨 배수로 초기화. 방문 중 매입/매도로 증감.
  let merchantGold = beginShopVisit(scene, step, identity);
  return new Promise((resolve) => {
    const overlay = createShopOverlay();
    const preset = shopUiPresetOf(step);
    overlay.classList.add(`runtime-shop-preset-${preset}`);
    let view: ShopView = "menu";
    let mode: ShopMode = defaultShopMode(step);
    let haggleItem: (typeof stockItems)[number] | undefined;
    let haggleOffer = 0;
    let haggleCount = 1;
    let haggleSetup: HaggleSetup | undefined;
    let haggleLine = "";
    // 흥정 버튼 커서 — 재렌더(제시 거절) 후에도 제시 버튼에 남도록 보존한다. undefined 면 「제시」.
    let haggleCursor: number | undefined;

    // 판매는 소지품 목록이다 — 진열품을 그대로 보여주면 보유 0 인 행을 눌러 실패만 한다.
    let viewItems: ShopGoods[] = stockItems;
    let statusText = shopPromptText(step, mode, terms);
    let transactionCompleted = false;
    // 카테고리 칩 상태. 진열이 30줄쯤 되면 "약만 보기"가 없으면 못 찾는다.
    // 필터는 저작 순서를 흐트러뜨리지 않는다(itemIds 순서 유지).
    let category: ShopCategory | "all" = "all";
    // 커서 메뉴는 매 렌더마다 재부착한다(뷰/상태 변경 시 overlay 전체 재빌드).
    // 커서 위치는 뷰별 인덱스로 보존해 상태 메시지 갱신에도 자리를 유지한다.
    let detachCursor: (() => void) | null = null;
    let menuCursor = 0;
    let itemCursor = 0;
    let comparisonActor: string | undefined;
    let comparisonSlot: string | undefined;
    // 상세 창에서 동료·부위를 직접 고른 뒤에는 그 선택을 존중한다. 그 전까지 도트 비교 상점은
    // 물건마다 가장 이득 보는 동료를 기준으로 요약한다(검사 기준으로 지팡이를 보면 늘 「장비 불가」였다).
    let comparisonPinned = false;
    let detailController: AbortController | undefined;
    let detailOpener: HTMLElement | undefined;
    const comparison = (goods: ShopGoods) => {
      const project = store.getCurrent();
      const autoPick = preset === "pixel" && !comparisonPinned;
      const picked = autoPick ? bestFitActorId(partyFit(project, scene.session, goods)) : comparisonActor;
      const actorId = scene.session.partyActorIds.includes(picked ?? "") ? picked : undefined;
      const preview = previewShopEquipment({ project, session: scene.session, goods, actorId, slot: autoPick ? undefined : comparisonSlot });
      if (preview.kind !== "unavailable") {
        comparisonActor = preview.actorId;
        comparisonSlot = preview.slot;
      }
      return preview;
    };
    const updateComparison = () => {
      const host = overlay.querySelector<HTMLElement>("[data-testid='shop-stat-slot']");
      const goods = viewItems[itemCursor];
      const preview = goods ? comparison(goods) : undefined;
      host?.replaceChildren(...(goods && preview ? [summaryFor(goods, preview)] : []));
      updateShopPartyCards(overlay, scene, goods, preview && preview.kind !== "unavailable" ? preview.actorId : undefined);
    };
    /** 도트 비교 상점에서 장비가 아닌 물건은 「비교 불가」 문장 대신 회복량을, 그것도 없으면 설명만 둔다. */
    const summaryFor = (goods: ShopGoods, preview: ReturnType<typeof comparison>): HTMLElement => {
      const project = store.getCurrent();
      if (preset !== "pixel") return shopComparisonSummary(project, preview);
      if (preview.kind === "unavailable" && preview.reason === "notEquipment") {
        const rows = recoveryPreview(project, scene.session, goods);
        if (rows?.length) return shopRecoverySummary(rows, new Map(preview.targets.map(target => [target.actorId, target.name])));
        const empty = document.createElement("span");
        empty.hidden = true;
        return empty;
      }
      const actorId = preview.kind === "unavailable" ? undefined : preview.actorId;
      const actor = actorId ? project.database.actors.find(entry => entry.id === actorId) : undefined;
      const name = actor ? scene.session.actorNames?.[actor.id] ?? actor.name : "";
      return shopComparisonSummary(project, preview, false, { statement: {
        portrait: actorId ? shopPartyWalker(scene, actorId, name) : null,
        level: actor ? clampLevel(scene.session.actorLevels[actor.id] ?? normalizeActorRecord(actor).initialLevel) : undefined,
      } });
    };
    const closeDetail = () => {
      detailController?.abort();
      detailController = undefined;
      overlay.querySelector("[data-testid='shop-comparison']")?.remove();
      const stock = overlay.querySelector<HTMLElement>(".runtime-shop-items-shell");
      if (stock) { stock.hidden = false; stock.style.removeProperty("display"); }
      updateComparison();
      detailOpener?.focus({ preventScroll: true });
      detailOpener = undefined;
    };
    const openDetail = (focusId?: string) => {
      const goods = viewItems[itemCursor];
      if (!goods) return;
      detailOpener ??= overlay.querySelector<HTMLElement>("[data-testid='shop-detail-open']") ?? undefined;
      detailController?.abort();
      detailController = new AbortController();
      const preview = comparison(goods);
      const panel = renderShopComparison({ project: store.getCurrent(), goods, preview,
        signal: detailController.signal, onClose: closeDetail,
        onActor: id => { comparisonActor = id; comparisonPinned = true; openDetail(`shop-actor-${id}`); },
        onSlot: id => { comparisonSlot = id; comparisonPinned = true; openDetail(`shop-slot-${id}`); },
      });
      overlay.querySelector("[data-testid='shop-comparison']")?.remove();
      const stock = overlay.querySelector<HTMLElement>(".runtime-shop-items-shell");
      if (stock) { stock.hidden = true; stock.style.display = "none"; }
      overlay.append(panel);
      const initial = focusId ?? (preview.kind === "unavailable" ? "shop-detail-scroll" : `shop-actor-${preview.actorId}`);
      const target = panel.querySelector<HTMLElement>(`[data-testid='${initial}']`);
      target?.focus({ preventScroll: true });
      // Actor/slot focus rebuilds this panel; scroll the replacement, not the detached opener.
      target?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    };
    const teardownCursor = (): void => {
      if (detailController) closeDetail();
      detachCursor?.();
      detachCursor = null;
    };
    const finish = () => {
      teardownCursor();
      endShopVisit(scene, step, merchantGold, identity);
      finishCommerce(scene, overlay, resolve, transactionCompleted ? true : failedResult());
    };
    /** 제시가는 제자리 갱신 — 재렌더할 필요가 없어서 커서도 그대로다. */
    const adjustHaggleOffer = (delta: number): void => {
      const next = Math.max(0, haggleOffer + delta);
      if (next === haggleOffer) {
        emitRuntimeJuice({ event: "menu-invalid", project: store.getCurrent(), session: scene.session });
        return;
      }
      haggleOffer = next;
      emitRuntimeJuice({ event: "menu-select", project: store.getCurrent(), session: scene.session });
      updateShopHaggleOffer(overlay, haggleOffer, haggleCount, terms.gold, mode);
    };
    const attachShopCursor = (): (() => void) => {
      if (view === "haggle") {
        return attachCursorMenu(overlay, {
          // 그만두기(runtime-shop-cancel)도 커서로 닿아야 한다 — 예전 셀렉터는
          // Esc로만 닫을 수 있어 ↑↓로는 영원히 도달 못 하는 버튼이었다.
          items: Array.from(overlay.querySelectorAll<HTMLElement>(".runtime-shop-menu-choice, .runtime-shop-confirm, .runtime-shop-cancel")),
          cancelEl: overlay.querySelector<HTMLElement>("[data-testid='shop-haggle-cancel']"),
          // [-10][+10][제시][그만두기] — 첫 진입은 제시 버튼(2번)에서 시작한다.
          initialIndex: haggleCursor ?? 2,
          onSelect: (index) => { haggleCursor = index; },
          // ←→ 는 어디서든 제시가 ±1. 버튼 간 이동은 ↑↓ 가 담당한다.
          onHorizontal: (dir) => { adjustHaggleOffer(dir); return true; },
          sound: true, audioContext: { project: store.getCurrent(), session: scene.session },
        });
      }
      if (view === "menu") {
        // 구입/판매/취소 — ←→ 또는 ↑↓ 로 이동(1D), Z/Enter 결정, X/Esc(=취소).
        return attachCursorMenu(overlay, {
          items: Array.from(overlay.querySelectorAll<HTMLElement>(".runtime-shop-menu-choice")),
          cancelEl: overlay.querySelector<HTMLElement>("[data-testid='shop-menu-cancel']"),
          initialIndex: menuCursor,
          // renderShop 이 overlay 를 비우고 새로 그린 직후에만 불린다(attachShopCursor 호출부 두 곳 중 판매 후
          // 재부착은 items 뷰라 이 분기를 타지 않는다).
          freshDom: true,
          sound: true, audioContext: { project: store.getCurrent(), session: scene.session },
          onSelect: (index) => {
            menuCursor = index;
          },
        });
      }
      return attachShopDecisionInput(overlay, {
        initialIndex: itemCursor,
        onSelect: (index) => {
          itemCursor = index;
          updateShopOwnedPanel(overlay, scene, viewItems[index]);
          updateShopHelpLine(overlay, step, viewItems[index]);
          updateComparison();
          updateShopQuantityTotal(overlay);
        },
        onQuantity: dir => { adjustShopQuantity(overlay, dir, { project: store.getCurrent(), session: scene.session }); },
      });
    };
    const renderShop = (focusId?: string) => {
      teardownCursor();
      clearElement(overlay);
      if (view === "items") viewItems = listForMode(mode);
      if (view === "haggle" && haggleItem && haggleSetup) {
        overlay.append(renderShopHaggle({
          itemName: haggleItem.name,
          reference: haggleSetup.reference,
          offer: haggleOffer,
          patience: haggleSetup.patience,
          merchantLine: haggleLine || "가격을 불러 보시오.",
          goldLabel: terms.gold,
          playerGold: scene.session.gold,
          count: haggleCount,
          mode,
          onAdjust: adjustHaggleOffer,
          onPropose: () => proposeCurrentHaggle(),
          onCancel: () => {
            view = "items";
            haggleItem = undefined;
            haggleSetup = undefined;
            haggleCursor = undefined;
            renderShop();
          },
        }));
      } else overlay.append(
        view === "menu"
          ? renderShopMenu(step, terms, showItems, finish, scene)
          : renderShopItems({
              scene,
              step,
              items: viewItems,
              mode,
              prompt: statusText,
              terms,
              merchantGold,
              setStatus,
              showMenu,
              category,
              categorySource: baseForMode(mode),
              onDetail: preset === "collector" ? undefined : () => openDetail(),
              // 파티 카드 — 이후 커서를 옮겨도 이 동료 기준으로 비교한다(상세 창에서 고른 것과 같다).
              onActor: preset === "pixel" ? (actorId) => {
                comparisonActor = actorId;
                comparisonSlot = undefined;
                comparisonPinned = true;
                emitRuntimeJuice({ event: "menu-select", project: store.getCurrent(), session: scene.session });
                updateComparison();
              } : undefined,
              onCategory: (next) => {
                category = next;
                itemCursor = 0;
                renderShop(`shop-category-${next}`);
              },
              // 입구 메뉴로 되돌아가지 않고 그 자리에서 구매/판매를 바꾼다.
              onMode: (next) => {
                if (next !== mode) showItems(next, `shop-tab-${next}`);
              },
              onItem: (item, nextMode, count) => {
                if (step.economy?.haggleEnabled === true) {
                  const dayKey = shopDayKey(scene.session);
                  const visitKey = haggleVisitKey(shopKeyOf(step, identity), item.id, dayKey);
                  const visit = (scene.session as { shopHaggleState?: Record<string, ShopHaggleVisitState> }).shopHaggleState?.[visitKey];
                  if (visit?.broken !== true) {
                    beginHaggle(item, nextMode, count);
                    return;
                  }
                }
                settleShopDeal(item, nextMode, count);
              },
            })
      );
      detachCursor = attachShopCursor();
      if (view === "items") updateShopQuantityTotal(overlay);
      if (focusId) overlay.querySelector<HTMLElement>(`[data-testid='${focusId}']`)?.focus({ preventScroll: true });
    };
    const settleShopDeal = (
      item: (typeof stockItems)[number],
      nextMode: ShopMode,
      count: number,
      agreed?: number,
    ): void => {
      const result = handleShopTransaction(scene, item, nextMode, count, merchantGold, agreed);
      if (!result.ok) {
        emitRuntimeJuice({ event: "menu-invalid", target: shopItemRowEl(overlay, item.id, nextMode), project: store.getCurrent(), session: scene.session });
        setStatus(result.status);
        return;
      }
      emitRuntimeJuice({ event: "menu-confirm", project: store.getCurrent(), session: scene.session });
      merchantGold = result.merchantGold;
      const qty = clampQuantity(count);
      const unit = agreed ?? (nextMode === "buy"
        ? item.price
        : resolveShopSellUnitPrice(store.getCurrent(), item.id, item.price));
      if (nextMode === "buy") {
        accrueShopLoyalty(scene, step, unit * qty);
      }
      if (nextMode === "sell" && step.shopServiceKind === "pawn") {
        recordPawnOnSell(scene, step, item.id, unit);
      }
      transactionCompleted = true;
      const delta = nextMode === "buy" ? -unit * qty : unit * qty;
      flashGoldDelta(overlay, delta, terms.gold);
      applyTransactionResult(item, nextMode, result.status);
    };
    const beginHaggle = (item: (typeof stockItems)[number], nextMode: ShopMode, count: number): void => {
      const cfg = normalizeHaggleConfig(step.economy?.haggle);
      const dayKey = shopDayKey(scene.session);
      const visitKey = haggleVisitKey(shopKeyOf(step, identity), item.id, dayKey);
      const ledgers = scene.session as { shopHaggleState?: Record<string, ShopHaggleVisitState> };
      const visit = ledgers.shopHaggleState?.[visitKey];
      const role = nextMode === "buy" ? "playerBuys" as const : "playerSells" as const;
      const reference = nextMode === "buy"
        ? item.price
        : resolveShopSellUnitPrice(store.getCurrent(), item.id, item.price);
      const reserve = resolveHaggleReserve({
        role,
        reference,
        buyPrice: item.price,
        maxDiscount: cfg.maxDiscount,
        itemId: item.id,
        merchantKey: shopKeyOf(step, identity),
        dayKey,
        attemptIndex: visit?.attemptIndex ?? 0,
        drift: visit?.drift ?? 0,
      });
      haggleItem = item;
      haggleCount = count;
      mode = nextMode;
      haggleSetup = {
        role,
        reference,
        reserve,
        patience: visit?.patience ?? cfg.patience,
        insultRatio: cfg.insultRatio,
        buyPrice: item.price,
      };
      haggleOffer = reference;
      haggleLine = "가격을 불러 보시오.";
      haggleCursor = undefined;
      view = "haggle";
      renderShop();
    };
    const writeHaggleVisit = (itemId: string, next: ShopHaggleVisitState): void => {
      const ledgers = scene.session as { shopHaggleState?: Record<string, ShopHaggleVisitState> };
      const visitKey = haggleVisitKey(shopKeyOf(step, identity), itemId, shopDayKey(scene.session));
      ledgers.shopHaggleState = { ...(ledgers.shopHaggleState ?? {}), [visitKey]: next };
    };
    const proposeCurrentHaggle = (): void => {
      if (!haggleItem || !haggleSetup) return;
      const verdict = proposeHaggle(haggleSetup, haggleOffer);
      if (verdict.kind === "accept") {
        const item = haggleItem;
        const nextMode = mode;
        haggleItem = undefined;
        haggleSetup = undefined;
        view = "items";
        settleShopDeal(item, nextMode, haggleCount, verdict.price);
        return;
      }
      if (verdict.kind === "broken") {
        writeHaggleVisit(haggleItem.id, {
          patience: 0,
          drift: 0,
          attemptIndex: (haggleSetup.patience ?? 0),
          broken: true,
        });
        haggleLine = verdict.reason === "insulted" ? "모욕적이오. 이 물건은 정가만 받겠소." : "더 흥정할 마음이 없소.";
        view = "items";
        haggleItem = undefined;
        haggleSetup = undefined;
        statusText = haggleLine;
        renderShop();
        return;
      }
      haggleSetup = { ...haggleSetup, patience: verdict.patience, reserve: verdict.reserve };
      writeHaggleVisit(haggleItem.id, {
        patience: verdict.patience,
        drift: verdict.reserve - haggleSetup.reference,
        attemptIndex: 0,
      });
      haggleLine = verdict.mood === "cold" ? "턱도 없는 값이오." : verdict.mood === "wary" ? "조금 더 맞춰 보시오." : "음… 조금 더.";
      haggleOffer = verdict.price;
      renderShop();
    };
    const showMenu = () => {
      view = "menu";
      renderShop();
    };
    const showItems = (nextMode: ShopMode, focusId?: string) => {
      mode = nextMode;
      view = "items";
      itemCursor = 0;
      // 구매 목록과 판매 목록의 구성이 다르므로 필터는 모드 전환 때 초기화한다.
      category = "all";
      viewItems = listForMode(nextMode);
      statusText = viewItems.length === 0 ? emptyListText(nextMode) : shopPromptText(step, mode, terms);
      renderShop(focusId);
    };
    /** 실패 메시지는 제자리에서만 바꾼다 — 전체 재렌더는 커서·포커스를 날리고 낭독도 끊는다. */
    const setStatus = (text: string) => {
      statusText = text;
      updateShopStatus(overlay, statusText);
    };
    /** 거래 성공 후 화면 반영. 판매로 0개가 된 행은 목록에서 빼고 커서를 다시 잡는다. */
    const applyTransactionResult = (item: ShopGoods, txMode: ShopMode, status: string) => {
      statusText = status;
      if (txMode === "sell" && (scene.session.inventory[item.id] ?? 0) <= 0) {
        viewItems = viewItems.filter((entry) => entry.id !== item.id);
        removeShopItemRow(overlay, item.id, txMode);
        if (viewItems.length === 0) {
          renderShop();
          return;
        }
        teardownCursor();
        detachCursor = attachShopCursor();
      }
      updateShopStatus(overlay, statusText);
      updateShopGoldPanel(overlay, scene, terms, merchantGold, mode);
      for (const entry of viewItems) refreshShopItemRow(overlay, scene, entry, mode, terms, merchantGold);
      updateShopOwnedPanel(overlay, scene, viewItems[itemCursor]);
      updateComparison();
      updateShopQuantityTotal(overlay);
    };
    /** 필터를 걸지 않은 이 모드의 전체 진열. 카테고리 칩은 늘 이 목록으로 만든다. */
    const baseForMode = (nextMode: ShopMode): ShopGoods[] =>
      nextMode === "sell" ? sellableItems(scene, stockItems) : stockItems;
    const listForMode = (nextMode: ShopMode): ShopGoods[] => {
      const base = baseForMode(nextMode);
      return category === "all" ? base : base.filter((goods) => goods.category === category);
    };
    // 먼저 마운트한 뒤 렌더해야 첫 커서 focus/scrollIntoView 가 연결된 노드에서 동작한다.
    mountCommerceOverlay(scene, overlay);
    renderShop();
  });
}

function emptyListText(mode: ShopMode): string {
  return mode === "sell" ? "팔 물건이 없습니다." : "파는 물건이 없습니다.";
}

export function clampQuantity(count: number): number {
  return Math.min(99, Math.max(1, Math.floor(count) || 1));
}

/**
 * 마일리지·누적 지출 적립. 예전에는 `pause` 가 mileageRate/loyaltyTierId 를 넘기지 않아
 * 이 계산이 늘 0 이었고(적립 null), 티어 키도 항상 "global" 로만 쌓였다.
 */

function recordPawnOnSell(
  scene: PlaySceneContext,
  step: ShopStep,
  itemId: string,
  pawnPrice: number,
  identity?: ShopIdentity,
): void {
  const session = scene.session as typeof scene.session & {
    shopPawnTickets?: Record<string, { itemId: string; pawnPrice: number; dueDayKey: string }>;
  };
  const tickets = session.shopPawnTickets ?? {};
  const id = `${shopKeyOf(step, identity)}:${itemId}:${shopDayKey(scene.session)}`;
  tickets[id] = { itemId, pawnPrice, dueDayKey: shopDayKey(scene.session) };
  session.shopPawnTickets = tickets;
}

export function accrueShopLoyalty(scene: Pick<PlaySceneContext, "session" | "syncRuntimeState">, step: ShopStep, cost: number): void {
  const session = scene.session as typeof scene.session & {
    shopLoyaltySpend?: Record<string, number>;
    shopMileagePoints?: number;
  };
  const tierKey = step.loyaltyTierId ?? "global";
  const spend = session.shopLoyaltySpend ?? {};
  session.shopLoyaltySpend = spend;
  spend[tierKey] = (spend[tierKey] ?? 0) + cost;
  const rate = step.mileageRate;
  if (typeof rate === "number" && rate > 0) {
    const earned = cost * Math.min(0.1, Math.max(0, rate));
    session.shopMileagePoints = Math.floor((session.shopMileagePoints ?? 0) + earned);
  }
  scene.syncRuntimeState();
}

/**
 * 판매 목록 = 지금 가진 물건. 진열품이면 상점이 매긴 가격을 그대로 써서 되팔기 값을 낸다.
 *
 * 아이템과 장비를 함께 훑는다(장비도 같은 `session.inventory` 에 담긴다). id 중복 프로젝트에서
 * 같은 물건이 두 줄로 나오던 문제를 goodsIndex 가 id 유일성으로 막는다.
 */
function sellableItems(scene: PlaySceneContext, stockItems: readonly ShopGoods[]): ShopGoods[] {
  const priced = new Map(stockItems.map((item) => [item.id, item]));
  const owned: ShopGoods[] = [];
  for (const goods of goodsIndex(store.getCurrent()).values()) {
    if ((scene.session.inventory[goods.id] ?? 0) <= 0) continue;
    owned.push(priced.get(goods.id) ?? goods);
  }
  return owned;
}

/** 거래할 게 없는 상점도 창은 띄운다 — 안내를 읽고 닫는 것까지가 한 흐름이다. */
function showShopNotice(scene: PlaySceneContext, terms: ResolvedTerms, message: string): Promise<void> {
  return new Promise((resolve) => {
    const overlay = createShopOverlay();
    let detach: (() => void) | null = null;
    const close = () => {
      detach?.();
      detach = null;
      overlay.remove();
      scene.syncRuntimeState();
      resolve();
    };
    mountCommerceOverlay(scene, overlay);
    overlay.append(renderShopNotice(message, terms, close));
    detach = attachCursorMenu(overlay, {
      items: Array.from(overlay.querySelectorAll<HTMLElement>(".runtime-shop-menu-choice")),
      cancelEl: overlay.querySelector<HTMLElement>("[data-testid='shop-notice-close']"),
      sound: true, audioContext: { project: store.getCurrent(), session: scene.session },
    });
  });
}

/**
 * 진열 목록을 해석한다. 아이템 탭과 장비 탭을 함께 본다 —
 * 예전에는 `database.items` 만 봐서 장비 id 는 조용히 사라졌고(무기점 불가),
 * 아이템 탭에 무기 타입 레코드를 새로 만들어 우회해도 장비 메뉴가 못 찾아 장착이 안 됐다.
 */
export function shopItems(step: ShopStep, project: Project = store.getCurrent()): ShopGoods[] {
  const index = goodsIndex(project);
  const rows: readonly { readonly itemId: string; readonly price?: number }[] =
    step.items ?? step.itemIds.map((itemId) => ({ itemId }));
  const resolved: ShopGoods[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.itemId)) continue;
    const goods = index.get(row.itemId);
    if (!goods) continue;
    seen.add(row.itemId);
    resolved.push(row.price === undefined ? goods : { ...goods, price: row.price });
  }
  return resolved;
}

type ShopTransactionResult =
  | { readonly ok: false; readonly status: string }
  | { readonly ok: true; readonly status: string; readonly merchantGold: number };

/**
 * 거래에 필요한 최소 정보. ItemRecord·EquipmentRecord·ShopGoods 가 모두 이 모양을 만족하므로
 * 아이템만 다루던 기존 호출부와 단위 테스트를 그대로 두고 장비까지 거래할 수 있다.
 */
export type ShopTradeable = { readonly id: string; readonly name: string; readonly price: number };

/** 구매 환불(마일리지 차감) — 성공 시에만 적립했으므로 환불 시 차감한다. */
export function refundShopMileage(session: PlaySessionLike, cost: number, mileageRate: number | undefined): void {
  if (typeof mileageRate !== "number" || mileageRate <= 0 || cost <= 0) return;
  const s = session as unknown as { shopMileagePoints?: number };
  const delta = Math.floor(cost * Math.min(0.1, Math.max(0, mileageRate)));
  s.shopMileagePoints = Math.max(0, (s.shopMileagePoints ?? 0) - delta);
}

/** 거래 메시지에 붙는 통화 단위. 자료집 용어를 따라간다(소지금 패널과 같은 단위). */
function goldUnit(): string {
  return resolveTerms(store.getCurrent()).gold;
}

/** 순수 거래 규칙 — 상인 소지금 한도를 포함. 단위 테스트용 export. */
export function handleShopTransaction(
  scene: Pick<PlaySceneContext, "session" | "syncRuntimeState">,
  item: ShopTradeable,
  mode: ShopMode,
  count: number,
  merchantGold: number,
  agreedPrice?: number,
): ShopTransactionResult {
  const qty = clampQuantity(count);
  if (mode === "sell") {
    const owned = scene.session.inventory[item.id] ?? 0;
    if (owned < qty) {
      scene.syncRuntimeState();
      return { ok: false, status: "가진 개수가 부족합니다." };
    }
    const listSell = resolveShopSellUnitPrice(store.getCurrent(), item.id, item.price);
    const unit = agreedPrice ?? listSell;
    if (unit < listSell || (item.price > listSell && unit >= item.price)) {
      scene.syncRuntimeState();
      return { ok: false, status: "거래를 처리할 수 없습니다." };
    }
    const payout = unit * qty;
    const economy = scene.session as typeof scene.session & {
      shopLoyaltySpend?: Record<string, number>;
      shopTradeCounts?: Record<string, { sold: number; bought: number }>;
      shopMileagePoints?: number;
    };
    const tc = economy.shopTradeCounts ?? {};
    const currentTrade = tc[item.id] ?? { sold: 0, bought: 0 };
    if (!isSafeEconomyValue(payout)
      || !isSafeEconomyValue(scene.session.gold)
      || scene.session.gold + payout > GOLD_MAX
      || !isSafeEconomyValue(merchantGold)
      || (economy.shopLoyaltySpend !== undefined && !isSafeEconomyRecord(economy.shopLoyaltySpend))
      || (economy.shopTradeCounts !== undefined && !isSafeShopTradeCountsRecord(economy.shopTradeCounts))
      || (economy.shopMileagePoints !== undefined && !isSafeEconomyValue(economy.shopMileagePoints))
      || currentTrade.sold + qty > GOLD_MAX) {
      scene.syncRuntimeState();
      return { ok: false, status: "거래를 처리할 수 없습니다." };
    }
    if (merchantGold < payout) {
      scene.syncRuntimeState();
      return { ok: false, status: "상인의 돈이 부족합니다." };
    }
    if (!changeItemsAtomically(scene.session, [{ itemId: item.id, op: "-=", amount: qty }])) {
      scene.syncRuntimeState();
      return { ok: false, status: "거래를 처리할 수 없습니다." };
    }
    changeGold(scene.session, "+=", payout);
    {
      economy.shopTradeCounts = tc;
      tc[item.id] = { sold: currentTrade.sold + qty, bought: currentTrade.bought };
      // 환불 시 마일리지 차감(성공 시에만 적립했으므로 판매 시 차감 대상 아님 — 구매 환불 경로에서만 차감)
      // 판매(sell)는 “되팔기”이므로 마일리지 차감 없음. 구매 환불은 handleShopTransaction 밖에서 처리.
    }
    scene.syncRuntimeState();
    return { ok: true, status: `${item.name} 판매 — +${payout}${goldUnit()}`, merchantGold: merchantGold - payout };
  }
  const listBuy = item.price;
  const unitBuy = agreedPrice ?? listBuy;
  if (unitBuy > listBuy || unitBuy < Math.floor(listBuy / 2)) {
    scene.syncRuntimeState();
    return { ok: false, status: "거래를 처리할 수 없습니다." };
  }
  const cost = unitBuy * qty;
  if (!isSafeEconomyValue(cost) || !isSafeEconomyValue(scene.session.gold) || !isSafeEconomyValue(merchantGold) || merchantGold + cost > GOLD_MAX) {
    scene.syncRuntimeState();
    return { ok: false, status: "거래를 처리할 수 없습니다." };
  }
  if (scene.session.gold < cost) {
    scene.syncRuntimeState();
    return { ok: false, status: "소지금이 부족합니다." };
  }
  const tc = ((scene.session as unknown as { shopTradeCounts?: Record<string, { sold: number; bought: number }> }).shopTradeCounts ?? {}) as Record<string, { sold: number; bought: number }>;
  const currentTrade = tc[item.id] ?? { sold: 0, bought: 0 };
  if (!isSafeEconomyValue(currentTrade.sold) || !isSafeEconomyValue(currentTrade.bought) || currentTrade.bought + qty > GOLD_MAX) {
    scene.syncRuntimeState();
    return { ok: false, status: "거래를 처리할 수 없습니다." };
  }
  if (!changeItemsAtomically(scene.session, [{ itemId: item.id, op: "+=", amount: qty }])) {
    scene.syncRuntimeState();
    return { ok: false, status: "가방이 꽉 찼습니다." };
  }
  changeGold(scene.session, "-=", cost);
  {
    (scene.session as unknown as { shopTradeCounts?: Record<string, { sold: number; bought: number }> }).shopTradeCounts = tc;
    tc[item.id] = { sold: currentTrade.sold, bought: currentTrade.bought + qty };
  }
  scene.syncRuntimeState();
  // 플레이어 구매금은 상인 소지금으로 들어간다(이후 매입 여력 증가).
  return { ok: true, status: `${item.name} 구매 — -${cost}${goldUnit()}`, merchantGold: merchantGold + cost };
}

function mountCommerceOverlay(scene: PlaySceneContext, overlay: HTMLElement): void {
  const host = dialogueHost(scene);
  if (!host) return;
  // dialogueHost(.play-stage)는 transform: scale 이라 절대배치 자식이 보이는 영역 밖(위쪽)으로 튄다.
  // 스케일 밖의 .play-viewport 레이어에 올려 보이는 게임 영역 기준으로 상점 창을 배치한다.
  const layer = host.closest(".play-viewport") ?? host;
  layer.querySelector(`[data-testid='${overlay.dataset.testid ?? ""}']`)?.remove();
  layer.append(overlay);
}

function finishCommerce(
  scene: PlaySceneContext,
  overlay: HTMLElement,
  resolve: (result: boolean | "failed") => void,
  result: boolean | "failed"
): void {
  overlay.remove();
  scene.syncRuntimeState();
  resolve(result);
}

function clearElement(node: HTMLElement): void {
  while (node.firstChild) node.firstChild.remove();
}
