import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { defaultActorFaceResourceId } from "@/project/actorFaceDefaults";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import {
  EQUIPPABLE_ITEM_TYPES,
  goodsSellPrice,
  itemToGoods,
  SHOP_CATEGORY_LABELS,
  type ShopCategory,
  type ShopGoods,
} from "@/player/playSceneShopGoods";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { ItemRecord } from "@/project/types/database";
import type { ResolvedTerms } from "@/project/terms";

export type ShopMode = "buy" | "sell";

/** 목록에 넣을 수 있는 것 — 신형 ShopGoods 와 구형 ItemRecord 를 모두 받는다. */
export type ShopListing = ShopGoods | ItemRecord;

/** ItemRecord 로 렌더를 부르는 기존 호출부·단위 테스트를 그대로 살리는 좁힘 함수. */
export function toGoods(listing: ShopListing): ShopGoods {
  return "source" in listing ? listing : itemToGoods(listing);
}

export function listingPrice(goods: ShopGoods, mode: ShopMode): number {
  return mode === "sell" ? goodsSellPrice(goods) : goods.price;
}

/* ────────────────────────── 아이콘 ────────────────────────── */

/**
 * 인라인 SVG 아이콘. 이모지는 플랫폼마다 모양·크기가 달라 정렬이 깨지고,
 * 래스터 애셋은 스케일·테마링에 약하다. UI 글리프는 벡터로 그린다.
 */
function svg(paths: string, viewBox = "0 0 24 24"): SVGSVGElement {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  node.setAttribute("viewBox", viewBox);
  node.setAttribute("aria-hidden", "true");
  node.setAttribute("focusable", "false");
  node.innerHTML = paths;
  return node;
}

export function coinIcon(): SVGSVGElement {
  return svg(
    '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
      '<path d="M12 7.6v8.8M9.6 9.9h4.1a1.9 1.9 0 0 1 0 3.8H9.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
  );
}

function purseIcon(): SVGSVGElement {
  return svg(
    '<path d="M6 9h12l1.6 9.4a1.6 1.6 0 0 1-1.6 1.9H6a1.6 1.6 0 0 1-1.6-1.9L6 9Z" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
      '<path d="M9 9V6.6A3 3 0 0 1 15 6.6V9" fill="none" stroke="currentColor" stroke-width="1.6"/>'
  );
}

function lockIcon(): SVGSVGElement {
  return svg(
    '<rect x="5.5" y="10.5" width="13" height="9.5" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
      '<path d="M8.6 10.5V7.9a3.4 3.4 0 0 1 6.8 0v2.6" fill="none" stroke="currentColor" stroke-width="1.6"/>'
  );
}

function caretIcon(direction: "left" | "right"): SVGSVGElement {
  const d = direction === "left" ? "M14.5 6.5 9 12l5.5 5.5" : "M9.5 6.5 15 12l-5.5 5.5";
  return svg(`<path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`);
}

/* ────────────────────────── 상단 바 ────────────────────────── */

/** 가게 문구 + 거래 문장. 파티 얼굴을 상인 초상으로 사용하지 않는다. */
export function shopBrandBlock(_scene: PlaySceneContext, title: string, subtitle: string): HTMLElement {
  const wrap = el("div", { class: "runtime-shop-brand" });
  wrap.append(
    merchantAvatar(),
    el("div", {
      class: "runtime-shop-brand-copy",
      children: [
        el("div", { class: "runtime-shop-brand-title", text: title }),
        el("div", {
          class: "runtime-shop-brand-sub",
          dataset: { testid: "shop-brand-subtitle" },
          text: subtitle,
        }),
      ],
    })
  );
  return wrap;
}

function merchantAvatar(): HTMLElement {
  const avatar = el("div", { class: "runtime-shop-merchant-avatar", attrs: { "aria-hidden": "true" } });
  avatar.append(purseIcon());
  return avatar;
}

/** 구매/판매 탭. 입구 메뉴로 돌아가지 않고 그 자리에서 모드를 바꾼다(모던 상점의 기본). */
export function shopModeTabs(
  modes: readonly ShopMode[],
  active: ShopMode,
  terms: ResolvedTerms,
  onMode: (mode: ShopMode) => void
): HTMLElement {
  const wrap = el("div", { class: "runtime-shop-tabs", attrs: { role: "tablist", "aria-label": "거래 방식" } });
  for (const mode of modes) {
    const tab = el("button", {
      class: `runtime-shop-tab${mode === active ? " is-active" : ""}`,
      text: mode === "buy" ? terms.shopBuy : terms.shopSell,
      dataset: { testid: `shop-tab-${mode}` },
      attrs: { type: "button", role: "tab", "aria-selected": mode === active ? "true" : "false" },
      on: { click: () => onMode(mode) },
    });
    wrap.append(tab);
  }
  return wrap;
}

/* ────────────────────────── 소지금 ────────────────────────── */

export function goldPanel(
  scene: PlaySceneContext,
  terms: ResolvedTerms,
  merchantGold: number,
  mode: ShopMode
): HTMLElement {
  const wrap = el("div", { class: "runtime-shop-gold", dataset: { testid: "shop-gold-panel" } });
  wrap.append(
    goldLine("소지금", `${scene.session.gold}${terms.gold}`, "shop-player-gold", { primary: true }),
    goldLine("상인", `${merchantGold}${terms.gold}`, "shop-merchant-gold", {
      className: "runtime-shop-merchant-gold",
      hint:
        mode === "sell"
          ? "상인이 플레이어 물품을 살 때 남은 소지금"
          : "상인 소지금(플레이어 구매 시 증가)",
    })
  );
  return wrap;
}

/**
 * 입구 화면용 지갑 한 줄. 무엇을 살지 고르기 전에 얼마 있는지 보여야 한다 —
 * 예전 입구에는 소지금이 아예 없어서 「구입」을 누른 뒤에야 알 수 있었다.
 */
export function entryPurse(scene: PlaySceneContext, terms: ResolvedTerms): HTMLElement {
  return el("div", {
    class: "runtime-shop-entry-purse",
    children: [goldLine("소지금", `${scene.session.gold}${terms.gold}`, "shop-player-gold", { primary: true })],
  });
}

function goldLine(
  label: string,
  value: string,
  testid: string,
  options?: { readonly className?: string; readonly hint?: string; readonly primary?: boolean }
): HTMLElement {
  const line = el("div", {
    class: `runtime-shop-gold-line${options?.className ? ` ${options.className}` : ""}${options?.primary ? " is-primary" : ""}`,
    dataset: { testid },
    attrs: options?.hint ? { "aria-label": `${label} ${value} — ${options.hint}` } : undefined,
  });
  if (options?.primary) line.append(coinIcon());
  line.append(
    el("span", { class: "runtime-shop-gold-label", text: label }),
    el("span", { class: "runtime-shop-gold-value", text: value })
  );
  return line;
}

/**
 * 소지금 변화를 눈에 보이게 한다 — 숫자만 조용히 바뀌면 무엇이 일어났는지 놓친다.
 * 값 위로 +4G / -24G 가 떠올랐다 사라지고, 값 자체가 한 번 반짝인다.
 */
export function flashGoldDelta(overlay: HTMLElement, delta: number, unit: string): void {
  const host = overlay.querySelector<HTMLElement>("[data-testid='shop-player-gold']");
  if (!host || delta === 0) return;
  const toast = el("span", {
    class: `runtime-shop-gold-delta ${delta > 0 ? "is-gain" : "is-loss"}`,
    text: `${delta > 0 ? "+" : "-"}${Math.abs(delta)}${unit}`,
    dataset: { testid: "shop-gold-delta" },
    attrs: { "aria-hidden": "true" },
  });
  host.append(toast);
  const value = host.querySelector<HTMLElement>(".runtime-shop-gold-value");
  value?.classList.remove("is-bumped");
  // reflow 를 한 번 강제해야 같은 클래스를 다시 붙였을 때 애니메이션이 재생된다.
  void value?.offsetWidth;
  value?.classList.add("is-bumped");
  window.setTimeout(() => toast.remove(), 900);
}

/* ────────────────────────── 카테고리 칩 ────────────────────────── */

export function shopCategoryBar(
  items: readonly ShopGoods[],
  active: ShopCategory | "all",
  onPick: (next: ShopCategory | "all") => void
): HTMLElement | null {
  const present: ShopCategory[] = [];
  for (const goods of items) if (!present.includes(goods.category)) present.push(goods.category);
  // 한 종류뿐이면 칩이 정보를 주지 않는다 — 줄만 잡아먹으므로 만들지 않는다.
  if (present.length < 2) return null;
  const bar = el("div", { class: "runtime-shop-catbar", dataset: { testid: "shop-category-bar" } });
  const chip = (key: ShopCategory | "all", label: string, count: number) =>
    el("button", {
      class: `runtime-shop-chip${key === active ? " is-active" : ""}`,
      dataset: { testid: `shop-category-${key}` },
      attrs: { type: "button", "aria-pressed": key === active ? "true" : "false" },
      children: [
        el("span", { class: "runtime-shop-chip-label", text: label }),
        el("span", { class: "runtime-shop-chip-count", text: String(count) }),
      ],
      on: { click: () => onPick(key) },
    });
  bar.append(chip("all", "전체", items.length));
  for (const key of present) {
    bar.append(chip(key, SHOP_CATEGORY_LABELS[key], items.filter((goods) => goods.category === key).length));
  }
  return bar;
}

/* ────────────────────────── 목록 행 ────────────────────────── */

export function shopItemRow(options: {
  readonly goods: ShopGoods;
  readonly scene: PlaySceneContext;
  readonly mode: ShopMode;
  readonly terms: ResolvedTerms;
  readonly merchantGold: number;
  readonly selected: boolean;
  readonly onActivate: () => void;
}): HTMLButtonElement {
  const { goods, scene, mode, terms, merchantGold, selected, onActivate } = options;
  const price = listingPrice(goods, mode);
  const owned = scene.session.inventory[goods.id] ?? 0;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "runtime-shop-item-row";
  button.dataset.testid = `shop-${mode}-${goods.id}`;
  button.dataset.category = goods.category;
  // 합계 계산이 선택 행의 단가를 읽어간다.
  button.dataset.unitPrice = String(price);
  // 수량 상한도 행에 싣는다. 스테퍼·입력칸·합계가 각자 99를 하드코딩하고 있어서
  // 살 수 없는 수량까지 올라간 뒤 거절당하는 막다른 길이 생겼다(RM2003 은 애초에
  // std::min(max, gold / price) 로 못 고르게 한다).
  button.dataset.maxQty = String(affordableQuantityMax(goods, mode, scene.session.gold, merchantGold, owned));
  button.setAttribute("role", "listitem");
  button.append(
    shopItemIcon(goods),
    el("span", {
      class: "runtime-shop-item-main",
      children: [
        el("span", { class: "runtime-shop-item-name", text: goods.name }),
        el("span", { class: "runtime-shop-item-type", text: goods.typeLabel }),
      ],
    }),
    el("span", {
      class: "runtime-shop-item-owned",
      text: `x${owned}`,
      dataset: { testid: `shop-owned-${goods.id}` },
    }),
    el("span", {
      class: "runtime-shop-item-price",
      // 값만 있으면 단위를 알 수 없다 — 소지금 패널과 같은 단위를 붙인다.
      text: `${price}${terms.gold}`,
      dataset: { testid: `shop-price-${goods.id}` },
    })
  );
  applyAffordability(button, goods, mode, terms, scene.session.gold, merchantGold, owned);
  if (selected) button.classList.add("selected");
  button.addEventListener("click", onActivate);
  return button;
}

/** 수량 스테퍼가 올라갈 수 있는 절대 상한(RM2003 과 동일). 소지 한도와는 별개다. */
export const SHOP_QUANTITY_HARD_MAX = 99;

/**
 * 상한을 수량 입력칸에 반영한다. 세 곳(생성 시점·clamp·합계 갱신)이 같은 문구를
 * 써야 하므로 한 곳에 모았다.
 *
 * 조작 힌트는 title 이 아니라 aria-label 에 담는다 — title 은 스크린리더 낭독이
 * 보장되지 않는다. 상한은 행마다 다르니 "1~99" 로 고정하면 16개까지만 살 수 있는
 * 물건에서 거짓 안내가 된다.
 */
function applyQuantityMaxTo(input: HTMLInputElement, max: number): void {
  input.max = String(max);
  input.setAttribute("aria-label", `수량 — ←/→ 로 1~${max} 조절`);
}

/**
 * 이 물건을 지금 몇 개까지 거래할 수 있는가.
 *
 * RM2003 은 `std::min(max, gold / price)` 로 수량 자체를 못 올리게 한다(scene_shop.cpp).
 * 소지 한도(RM 은 99)는 베끼지 않았다 — 이 저장소의 한도는 ITEM_QUANTITY_MAX(9,999,999)
 * 이고, 99로 낮추면 전 시스템에 걸친 회귀가 된다.
 *
 * 0을 반환할 수 있다(한 개도 못 산다). 그 경우 행은 이미 흐림·자물쇠로 표시돼 있고
 * 결정하면 버저가 울린다 — 커서는 얹히게 둔다.
 */
export function affordableQuantityMax(
  goods: ShopGoods,
  mode: ShopMode,
  gold: number,
  merchantGold: number,
  owned: number
): number {
  const price = listingPrice(goods, mode);
  if (mode === "sell") {
    // 판매는 가진 개수가 먼저 상한이고, 상인 지갑이 그다음이다.
    const byOwned = Math.max(0, Math.trunc(owned));
    if (price <= 0) return Math.min(SHOP_QUANTITY_HARD_MAX, byOwned);
    return Math.min(SHOP_QUANTITY_HARD_MAX, byOwned, Math.floor(Math.max(0, merchantGold) / price));
  }
  // 공짜 물건은 소지금이 상한을 만들지 못한다.
  if (price <= 0) return SHOP_QUANTITY_HARD_MAX;
  return Math.min(SHOP_QUANTITY_HARD_MAX, Math.floor(Math.max(0, gold) / price));
}

/**
 * 오버레이의 현재 선택 행이 허용하는 수량 상한. 행에 실린 값이 없으면 하드 상한으로 돈다.
 * 최소 1을 보장하는 이유: 한 개도 못 사는 물건도 수량칸은 1을 보여야 하고, 거절은
 * 결정 시점의 버저가 담당한다(RM2003 도 목록에서 못 고르게 막지 않는다).
 */
export function shopQuantityMaxIn(overlay: HTMLElement): number {
  const row = overlay.querySelector<HTMLElement>(".runtime-shop-item-row.selected")
    ?? overlay.querySelector<HTMLElement>(".runtime-shop-item-row");
  const raw = Number.parseInt(row?.dataset.maxQty ?? "", 10);
  if (!Number.isFinite(raw)) return SHOP_QUANTITY_HARD_MAX;
  return Math.min(SHOP_QUANTITY_HARD_MAX, Math.max(1, raw));
}

/**
 * 살 수 있는지/팔 수 있는지를 행에 표시한다. disabled 로 막지 않는 이유: 커서가 못 얹히면
 * 비싼 물건의 설명조차 볼 수 없다(RM2003 도 커서는 얹히고 결정만 거절한다).
 */
export function applyAffordability(
  row: HTMLElement,
  goods: ShopGoods,
  mode: ShopMode,
  terms: ResolvedTerms,
  gold: number,
  merchantGold: number,
  owned: number
): void {
  const price = listingPrice(goods, mode);
  const blocked = mode === "sell" ? merchantGold < price : gold < price;
  const reason = mode === "sell" ? "상인 소지금 부족" : "소지금 부족";
  row.classList.toggle("is-unaffordable", blocked);
  if (blocked) row.dataset.unaffordable = "1";
  else delete row.dataset.unaffordable;
  const existing = row.querySelector(".runtime-shop-item-lock");
  if (blocked && !existing) {
    const lock = el("span", { class: "runtime-shop-item-lock", attrs: { "aria-hidden": "true" } });
    lock.append(lockIcon());
    row.append(lock);
  } else if (!blocked) {
    existing?.remove();
  }
  const label = `${goods.name} · ${price}${terms.gold} · 보유 ${owned}개`;
  row.setAttribute("aria-label", blocked ? `${label} · ${reason}` : label);
}

/**
 * 자료집이 이미 저작해 둔 아이콘을 가게 목록에 그린다(상태 메뉴와 같은 우선순위:
 * iconResourceId → imageResourceId). 글자만 있는 목록은 '무엇을 파는 가게'인지 안 보인다.
 */
export function shopItemIcon(goods: ShopGoods, extraClass = ""): HTMLElement {
  const icon = el("span", {
    class: `runtime-shop-item-icon${extraClass ? ` ${extraClass}` : ""}`,
    dataset: { testid: `shop-item-icon-${goods.id}` },
  });
  const url = goods.iconResourceId ? resolveAssetResourceUrl(goods.iconResourceId) : undefined;
  if (url) {
    icon.style.backgroundImage = `url("${url}")`;
    icon.dataset.itemIconResource = goods.iconResourceId ?? "";
  } else {
    // 아이콘이 없는 아이템은 이름 첫 글자 칩 — 빈 칸보다 읽힌다.
    icon.classList.add("runtime-shop-item-icon-fallback");
    icon.textContent = goods.name.trim().slice(0, 1) || "?";
  }
  return icon;
}

/* ────────────────────────── 상세 카드 ────────────────────────── */

/** 커서가 얹힌 물건의 큰 아이콘. 목록의 12px 아이콘만으로는 무엇인지 안 읽힌다. */
export function detailHero(goods: ShopGoods | undefined): HTMLElement {
  const hero = el("div", { class: "runtime-shop-detail-hero", dataset: { testid: "shop-detail-hero" } });
  if (!goods) return hero;
  hero.dataset.category = goods.category;
  hero.append(
    shopItemIcon(goods, "runtime-shop-detail-icon"),
    el("div", {
      class: "runtime-shop-detail-heading",
      children: [
        el("div", { class: "runtime-shop-detail-name", text: goods.name }),
        el("div", { class: "runtime-shop-detail-type", text: goods.typeLabel }),
      ],
    })
  );
  return hero;
}

const STAT_LABELS: readonly (readonly [keyof NonNullable<ShopGoods["statBonuses"]>, string])[] = [
  ["attack", "공격"],
  ["defense", "방어"],
  ["mind", "정신"],
  ["agility", "민첩"],
];

/**
 * 장비 능력치 격자. 예전에는 장비를 상점에 담을 수조차 없어서 이런 줄이 필요 없었다 —
 * 이제 무기점에서 "이걸 사면 뭐가 얼마나 오르나"를 사기 전에 본다.
 */
export function detailStatGrid(goods: ShopGoods | undefined): HTMLElement | null {
  const bonuses = goods?.statBonuses;
  if (!bonuses) return null;
  const entries = STAT_LABELS.filter(([key]) => (bonuses[key] ?? 0) !== 0);
  if (entries.length === 0) return null;
  return el("div", {
    class: "runtime-shop-statgrid",
    dataset: { testid: "shop-detail-stats" },
    children: entries.map(([key, label]) => {
      const value = bonuses[key] ?? 0;
      return el("div", {
        class: `runtime-shop-stat${value > 0 ? " is-up" : " is-down"}`,
        children: [
          el("span", { class: "runtime-shop-stat-key", text: label }),
          el("span", { class: "runtime-shop-stat-value", text: `${value > 0 ? "▲" : "▼"}${Math.abs(value)}` }),
        ],
      });
    }),
  });
}

export function ownedPanel(scene: PlaySceneContext, goods: ShopGoods | undefined): HTMLElement {
  const owned = goods ? scene.session.inventory[goods.id] ?? 0 : 0;
  const children: HTMLElement[] = [statLine("보유", owned)];
  // '장비' 는 장비 종류에만 붙인다 — 예전에는 종류와 무관하게 상수 0 이었다.
  const equippable = goods
    ? goods.source === "equipment" || (goods.itemType !== undefined && EQUIPPABLE_ITEM_TYPES.has(goods.itemType))
    : false;
  if (goods && equippable) children.push(statLine("장비", equippedCount(scene, goods.id)));
  return el("div", {
    class: "runtime-shop-owned",
    dataset: { testid: "shop-owned-panel" },
    children,
  });
}

/** 파티가 지금 차고 있는 개수. */
function equippedCount(scene: PlaySceneContext, itemId: string): number {
  const equipment = scene.session.actorEquipment;
  if (!equipment) return 0;
  let count = 0;
  for (const actorId of scene.session.partyActorIds) {
    const slots = equipment[actorId];
    if (!slots) continue;
    for (const value of Object.values(slots)) if (value === itemId) count += 1;
  }
  return count;
}

function statLine(label: string, value: number): HTMLElement {
  return el("div", {
    class: "runtime-shop-stat-line",
    children: [el("span", { text: label }), el("span", { text: String(value) })],
  });
}

/* ────────────────────────── 파티 ────────────────────────── */

/**
 * 파티 얼굴. 예전에는 스프라이트를 넣는 코드가 없어 --bg-inset(에디터 밝은 회색) 로 칠한
 * 빈 사각형이 갈색 창틀 위에 흰 박스로 떠 있었다.
 */
export function partyPreview(scene: PlaySceneContext): HTMLElement {
  const wrap = el("div", { class: "runtime-shop-party" });
  // 캡션이 없으면 얼굴 한두 장이 넓은 빈 상자에 떠 있어 무슨 칸인지 읽히지 않는다.
  wrap.append(el("span", { class: "runtime-shop-party-caption", text: "파티" }));
  const project = store.getCurrent();
  const actorIds = scene.session.partyActorIds.length
    ? scene.session.partyActorIds
    : ["actor_1", "actor_2", "actor_3", "actor_4"];
  for (const [index, actorId] of actorIds.slice(0, 4).entries()) {
    const record = project.database.actors.find((entry) => entry.id === actorId);
    const name = record?.name ?? actorId;
    const sprite = el("span", {
      class: "runtime-shop-party-sprite",
      dataset: { testid: `shop-party-sprite-${actorId}` },
      attrs: { role: "img", "aria-label": name },
    });
    sprite.dataset.actorSlot = String(index);
    const resourceId = scene.session.actorFaceResourceIds?.[actorId]
      ?? record?.faceResourceId
      ?? (record ? defaultActorFaceResourceId(record) : undefined);
    const url = resourceId ? resolveAssetResourceUrl(resourceId, { project }) : undefined;
    if (url) {
      sprite.style.backgroundImage = `url("${url}")`;
      sprite.dataset.faceResourceId = resourceId ?? "";
    } else {
      // 얼굴이 없으면 이름 첫 글자 — 빈 흰 박스보다 읽힌다.
      sprite.classList.add("runtime-shop-party-sprite-fallback");
      sprite.textContent = name.trim().slice(0, 1) || "?";
    }
    wrap.append(sprite);
  }
  return wrap;
}

/* ────────────────────────── 수량 · 조작 힌트 ────────────────────────── */

/**
 * 수량 스테퍼 + 합계. 예전에는 18행 목록의 마지막 자식이라 화면 밖에 있었다(1280x800 실측:
 * 입력칸 y=760, 목록 접힘선 밖). 프롬프트 줄로 올려 항상 보이게 한다.
 */
export function quantityControl(
  terms: ResolvedTerms,
  goods: ShopGoods | undefined,
  mode: ShopMode,
  onStep: (dir: -1 | 1) => void
): HTMLElement {
  const wrap = el("div", { class: "runtime-commerce-quantity-wrap runtime-shop-quantity-wrap" });
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.max = "99";
  input.value = "1";
  input.className = "runtime-commerce-quantity-input";
  input.dataset.testid = "shop-quantity-input";
  // 상한은 선택 행에 따라 바뀐다. 붙는 시점에 오버레이가 아직 없을 수 있어 기본값을 두고
  // clamp() 가 매번 다시 읽는다.
  const currentMax = (): number => {
    const overlay = input.closest<HTMLElement>(".runtime-shop-overlay");
    return overlay ? shopQuantityMaxIn(overlay) : SHOP_QUANTITY_HARD_MAX;
  };
  const clamp = () => {
    const max = currentMax();
    applyQuantityMaxTo(input, max);
    const raw = Number.parseInt(input.value, 10);
    const clamped = Math.min(max, Math.max(1, Number.isFinite(raw) ? raw : 1));
    if (String(clamped) !== input.value.trim()) input.value = String(clamped);
  };
  // 붙는 시점에 한 번 적용한다 — 안 하면 첫 렌더에 aria-label 이 없다(main 에서 온
  // 접근성 개선이 사라진다). 이때는 오버레이가 없어 99가 들어가고, 마운트 후
  // updateShopQuantityTotalIn 이 실제 상한으로 고쳐 쓴다.
  applyQuantityMaxTo(input, SHOP_QUANTITY_HARD_MAX);
  input.addEventListener("input", () => {
    clamp();
    bubbleTotal(input);
  });
  input.addEventListener("change", () => {
    clamp();
    bubbleTotal(input);
  });
  const stepper = (dir: -1 | 1) => {
    const button = el("button", {
      class: "runtime-shop-step",
      dataset: { testid: `shop-quantity-${dir < 0 ? "dec" : "inc"}` },
      attrs: { type: "button", "aria-label": dir < 0 ? "수량 줄이기" : "수량 늘리기", tabindex: "-1" },
      on: { click: () => onStep(dir) },
    });
    button.append(caretIcon(dir < 0 ? "left" : "right"));
    return button;
  };
  const unitPrice = goods ? listingPrice(goods, mode) : 0;
  const total = el("span", {
    class: "runtime-shop-quantity-total",
    dataset: { testid: "shop-quantity-total", goldUnit: terms.gold },
    text: `합계 ${unitPrice}${terms.gold}`,
  });
  wrap.append(
    el("span", { class: "runtime-shop-quantity-label", text: "수량" }),
    stepper(-1),
    input,
    stepper(1),
    total
  );
  return wrap;
}

function bubbleTotal(node: HTMLElement): void {
  const overlay = node.closest<HTMLElement>(".runtime-shop-overlay");
  if (overlay) updateShopQuantityTotalIn(overlay);
}

/** 수량 × 단가 합계. 커서 이동·수량 변경마다 다시 계산한다(합계가 없으면 얼마 나갈지 모른다). */
export function updateShopQuantityTotalIn(overlay: HTMLElement): void {
  const total = overlay.querySelector<HTMLElement>("[data-testid='shop-quantity-total']");
  if (!total) return;
  const input = overlay.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
  // 커서가 다른 행으로 옮겨가면 상한도 함께 바뀐다. 예전 행에서 올려 둔 수량이 새 행의
  // 상한을 넘으면 여기서 끌어내린다 — 안 하면 합계가 못 살 금액을 보여준다.
  const max = shopQuantityMaxIn(overlay);
  const qty = Math.min(max, Math.max(1, Number.parseInt(input?.value ?? "1", 10) || 1));
  if (input) {
    applyQuantityMaxTo(input, max);
    if (String(qty) !== input.value.trim()) input.value = String(qty);
  }
  const row = overlay.querySelector<HTMLElement>(".runtime-shop-item-row.selected")
    ?? overlay.querySelector<HTMLElement>(".runtime-shop-item-row");
  const unit = Math.max(0, Number.parseInt(row?.dataset.unitPrice ?? "0", 10) || 0);
  total.textContent = `합계 ${unit * qty}${total.dataset.goldUnit ?? ""}`;
}

/** 조작 힌트 줄 — 키보드로 도는 화면인데 어떤 키가 먹는지 화면에 없으면 알 수 없다. */
export function keyHints(hints: readonly (readonly [string, string])[]): HTMLElement {
  return el("div", {
    class: "runtime-shop-keyhints",
    dataset: { testid: "shop-key-hints" },
    children: hints.map(([keys, label]) =>
      el("span", {
        class: "runtime-shop-keyhint",
        children: [
          el("kbd", { class: "runtime-shop-key", text: keys }),
          el("span", { class: "runtime-shop-keyhint-label", text: label }),
        ],
      })
    ),
  });
}
