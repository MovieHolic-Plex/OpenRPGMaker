// @vitest-environment happy-dom
//
// RM2003 System SE 계약 + 수량 상한 계약.
//
// 근거는 EasyRPG Player(RM2000/2003 정본 재구현)에서 확인했다:
//   - scene_shop.cpp  : 무효한 거래에 SFX_Buzzer, 확정에 SFX_Decision, 취소에 SFX_Cancel
//   - window_shopbuy.cpp : CheckEnable = 소지금 AND 소지 한도
//   - scene_shop.cpp  : 수량 상한 = std::min(max, gold / price)
//
// 베끼지 않은 것: RM 의 소지 한도 99. 이 저장소의 한도는 ITEM_QUANTITY_MAX(9,999,999)
// 이고 99로 낮추면 아이템을 다루는 전 시스템에 걸친 회귀가 된다.
import { beforeEach, describe, expect, it } from "vitest";
import { affordableQuantityMax, shopQuantityMaxIn, SHOP_QUANTITY_HARD_MAX } from "@/player/playSceneShopParts";
import { adjustShopQuantity, createShopOverlay, renderShopItems, updateShopQuantityTotal } from "@/player/playSceneShopDom";
import { emitRuntimeJuice, runtimeJuiceLog } from "@/player/runtimeJuice";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import { toGoods } from "@/player/playSceneShopParts";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resolveTerms } from "@/project/terms";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { ShopStep } from "@/player/playSceneShop";
import type { ItemRecord } from "@/project/types/database";

const SELECT_STEP = { allowSell: true, quantityMode: "select" } as ShopStep;

function item(overrides: Partial<ItemRecord> & Pick<ItemRecord, "id" | "name" | "price">): ItemRecord {
  const base = createBlankProject().database.items[0];
  return { ...base, description: "", ...overrides } as ItemRecord;
}

const POTION = item({ id: "item_potion", name: "포션", price: 12, description: "HP 회복", type: "medicine" });
const CROWN = item({ id: "item_crown", name: "왕관", price: 9999, description: "비싸다", type: "normalGoods" });
const FREEBIE = item({ id: "item_free", name: "전단지", price: 0, description: "공짜", type: "normalGoods" });

function scene(gold: number, inventory: Record<string, number> = {}): PlaySceneContext {
  return {
    session: { gold, inventory, partyActorIds: ["actor_1"] },
    syncRuntimeState: () => {},
  } as unknown as PlaySceneContext;
}

function render(options: {
  readonly gold: number;
  readonly items: readonly ItemRecord[];
  readonly mode?: "buy" | "sell";
  readonly merchantGold?: number;
  readonly inventory?: Record<string, number>;
}): HTMLElement {
  store.replace(createBlankProject());
  const overlay = createShopOverlay();
  overlay.append(
    renderShopItems({
      scene: scene(options.gold, options.inventory ?? {}),
      step: SELECT_STEP,
      items: options.items,
      mode: options.mode ?? "buy",
      prompt: "무엇을 구매하시겠습니까?",
      terms: resolveTerms(createBlankProject()),
      merchantGold: options.merchantGold ?? 900,
      setStatus: () => {},
      showMenu: () => {},
      onItem: () => {},
    })
  );
  document.body.append(overlay);
  return overlay;
}

function lastJuice(): string | undefined {
  return runtimeJuiceLog().at(-1)?.event;
}

function clearJuice(): void {
  const host = window as Window & { __oprnRuntimeJuice?: { log: unknown[] } };
  host.__oprnRuntimeJuice = { log: [] };
}

beforeEach(() => {
  document.body.innerHTML = "";
  clearJuice();
});

describe("수량 상한 — RM2003 std::min(max, gold / price)", () => {
  it("살 수 있는 개수까지만 올라간다", () => {
    // 200G / 12G = 16개. 예전에는 99까지 올라간 뒤 결정 시점에 거절당했다.
    const goods = toGoods(POTION);
    expect(affordableQuantityMax(goods, "buy", 200, 900, 0)).toBe(16);
  });

  it("한 개도 못 사면 0을 반환한다 — 목록에서 막지는 않는다", () => {
    expect(affordableQuantityMax(toGoods(CROWN), "buy", 200, 900, 0)).toBe(0);
  });

  it("공짜 물건은 소지금이 상한을 만들지 못한다", () => {
    expect(affordableQuantityMax(toGoods(FREEBIE), "buy", 0, 900, 0)).toBe(SHOP_QUANTITY_HARD_MAX);
  });

  it("절대 상한 99를 넘지 않는다 — 소지금이 아무리 많아도", () => {
    expect(affordableQuantityMax(toGoods(POTION), "buy", 9_999_999, 900, 0)).toBe(99);
  });

  it("판매는 가진 개수가 먼저 상한이고 상인 지갑이 그다음이다", () => {
    // listingPrice reads the active project sell helper; keep the fixture item authoritative.
    const project = createBlankProject();
    project.database.items = [...project.database.items.filter((entry) => entry.id !== POTION.id), POTION];
    project.system.sellPrices = (project.system.sellPrices ?? []).filter((entry) => entry.itemId !== POTION.id);
    store.replace(project);
    const goods = toGoods(POTION);
    // 5개 보유, 상인 지갑 넉넉 → 5
    expect(affordableQuantityMax(goods, "sell", 0, 900, 5)).toBe(5);
    // 5개 보유지만 상인이 판매가(6G) 2개분만 있음 → 2
    expect(affordableQuantityMax(goods, "sell", 0, 13, 5)).toBe(2);
  });

  it("행에 상한이 실려서 오버레이가 읽어간다", () => {
    const overlay = render({ gold: 200, items: [POTION] });
    const row = overlay.querySelector<HTMLElement>("[data-testid='shop-buy-item_potion']");
    expect(row?.dataset.maxQty).toBe("16");
    expect(shopQuantityMaxIn(overlay)).toBe(16);
  });

  it("한 개도 못 사는 행에서도 수량칸은 1을 보인다(거절은 결정 시점의 몫)", () => {
    const overlay = render({ gold: 200, items: [CROWN] });
    expect(overlay.querySelector<HTMLElement>("[data-testid='shop-buy-item_crown']")?.dataset.maxQty).toBe("0");
    expect(shopQuantityMaxIn(overlay)).toBe(1);
  });
});

describe("수량 스테퍼가 상한에 부딪히면 버저", () => {
  it("상한까지는 조용히 올라간다", () => {
    const overlay = render({ gold: 200, items: [POTION] });
    const input = overlay.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
    adjustShopQuantity(overlay, 1);
    expect(input?.value).toBe("2");
    expect(lastJuice()).toBeUndefined();
  });

  it("상한을 넘기려 하면 값이 그대로고 버저가 울린다", () => {
    const overlay = render({ gold: 200, items: [POTION] });
    const input = overlay.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
    if (input) input.value = "16";
    clearJuice();
    adjustShopQuantity(overlay, 1);
    expect(input?.value).toBe("16");
    expect(lastJuice()).toBe("menu-invalid");
  });

  it("1에서 더 줄이려 하면 버저가 울린다", () => {
    const overlay = render({ gold: 200, items: [POTION] });
    adjustShopQuantity(overlay, -1);
    expect(overlay.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']")?.value).toBe("1");
    expect(lastJuice()).toBe("menu-invalid");
  });

  it("input 의 max 속성과 안내 문구가 상한을 따라간다", () => {
    const overlay = render({ gold: 200, items: [POTION] });
    updateShopQuantityTotal(overlay);
    const input = overlay.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
    expect(input?.max).toBe("16");
    // 낭독되는 라벨이 실제 상한을 말해야 한다 — "1~99" 고정이면 16개까지만 살 수 있는
    // 물건에서 거짓 안내가 된다. 안내는 title 이 아니라 aria-label 에만 담는다: title 은
    // 낭독이 보장되지 않고 키보드 전용 출하 표면에서는 마우스에만 뜨는 장식이다
    // (runtimeDomTitleGuard 가 출하 런타임의 title 쓰기를 금지한다).
    expect(input?.title).toBe("");
    expect(input?.getAttribute("aria-label")).toBe("수량 — ←/→ 로 1~16 조절");
  });

  it("마운트 전에도 라벨이 있다 — 첫 렌더에 aria-label 이 비지 않는다", () => {
    const overlay = render({ gold: 200, items: [POTION] });
    const input = overlay.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
    expect(input?.getAttribute("aria-label")).toMatch(/^수량 — ←\/→ 로 1~\d+ 조절$/);
  });
});

describe("커서음 — 키보드에만 울린다", () => {
  function menu(): { root: HTMLElement; items: HTMLElement[] } {
    const root = document.createElement("div");
    const items = ["a", "b", "c"].map((id) => {
      const button = document.createElement("button");
      button.dataset.testid = id;
      root.append(button);
      return button;
    });
    document.body.append(root);
    return { root, items };
  }

  it("방향키 이동에 커서음이 울린다", () => {
    const { root, items } = menu();
    const detach = attachCursorMenu(root, { items, sound: true });
    clearJuice();
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(lastJuice()).toBe("menu-select");
    detach();
  });

  it("마우스 호버에는 울리지 않는다 — 스칠 때마다 삑삑거리면 못 쓴다", () => {
    const { root, items } = menu();
    const detach = attachCursorMenu(root, { items, sound: true });
    clearJuice();
    items[1]?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
    expect(runtimeJuiceLog()).toHaveLength(0);
    detach();
  });

  it("sound 를 켜지 않으면 아무 소리도 울리지 않는다(기본 꺼짐)", () => {
    const { root, items } = menu();
    const detach = attachCursorMenu(root, { items });
    clearJuice();
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(runtimeJuiceLog()).toHaveLength(0);
    detach();
  });

  it("취소키에 취소음이 울린다", () => {
    const { root, items } = menu();
    const cancelEl = document.createElement("button");
    root.append(cancelEl);
    const detach = attachCursorMenu(root, { items, cancelEl, sound: true });
    clearJuice();
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(lastJuice()).toBe("menu-back");
    detach();
  });

  it("cancelEl 이 없으면 취소음도 울리지 않는다 — 빈 약속 금지", () => {
    const { root, items } = menu();
    const detach = attachCursorMenu(root, { items, sound: true });
    clearJuice();
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(runtimeJuiceLog()).toHaveLength(0);
    detach();
  });

  it("결정키에는 커서 메뉴가 소리를 내지 않는다 — 성공/거절 판단은 도메인 몫", () => {
    const { root, items } = menu();
    const detach = attachCursorMenu(root, { items, sound: true });
    clearJuice();
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(runtimeJuiceLog()).toHaveLength(0);
    detach();
  });
});

describe("모션 클래스가 실제로 얹힌다", () => {
  it("거절 대상에 juice-menu-invalid 가 붙는다", async () => {
    const target = document.createElement("div");
    document.body.append(target);
    emitRuntimeJuice({ event: "menu-invalid", target });
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect(target.classList.contains("juice-menu-invalid")).toBe(true);
  });
});
