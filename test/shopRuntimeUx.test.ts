// @vitest-environment happy-dom
//
// 런타임 상점 UX 회귀 계약. 실측으로 잡은 결함을 하나씩 고정한다:
//   1) 도움말 창에 아이템 설명이 뜬다 (예전엔 "모든 캐릭터를 회복합니다…" 가 머리글에 박혀 있었다)
//   2) 가격에 통화 단위가 붙고 소지금/상인 소지금 둘 다 라벨이 있다
//   3) 못 사는 행이 눈에 보인다 (예전엔 300G 로 9999G 왕관이 똑같이 그려졌다)
//   4) 수량 입력·합계가 목록 밖(프롬프트 줄)에 있다 (예전엔 목록 마지막 자식 = 화면 밖)
//   5) 파티 칸이 흰 빈 박스가 아니다 (--bg-inset 제거)
//   6) '장비' 줄은 장비 종류에만, 실제 착용 수로 뜬다 (예전엔 상수 0)
//   7) 거래 메시지가 한국어다
//   8) 상태 갱신이 제자리에서 일어난다 (커서·포커스·낭독 유지)
import { describe, expect, it } from "vitest";
import { handleShopTransaction } from "@/player/playSceneShop";
import {
  createShopOverlay,
  refreshShopItemRow,
  removeShopItemRow,
  renderShopItems,
  renderShopNotice,
  updateShopHelpLine,
  updateShopQuantityTotal,
  updateShopStatus,
} from "@/player/playSceneShopDom";
import { createBlankProject } from "@/project/defaults";
import { changeItem, startSession } from "@/project/session";
import { store } from "@/project/store";
import { resolveTerms } from "@/project/terms";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { ShopStep } from "@/player/playSceneShop";
import type { ItemRecord } from "@/project/types/database";

const STEP = { allowSell: true } as ShopStep;
const SELECT_STEP = { allowSell: true, quantityMode: "select" } as ShopStep;

function item(overrides: Partial<ItemRecord> & Pick<ItemRecord, "id" | "name" | "price">): ItemRecord {
  const base = createBlankProject().database.items[0];
  return { ...base, description: "", ...overrides } as ItemRecord;
}

const POTION = item({ id: "item_potion", name: "포션", price: 50, description: "HP를 50 회복한다.", type: "medicine" });
const SWORD = item({ id: "item_sword", name: "청동검", price: 300, description: "공격력 +5", type: "weapon" });

function scene(overrides?: {
  readonly gold?: number;
  readonly inventory?: Record<string, number>;
  readonly partyActorIds?: readonly string[];
  readonly actorEquipment?: Record<string, Record<string, string>>;
}): PlaySceneContext {
  return {
    session: {
      gold: overrides?.gold ?? 250,
      inventory: overrides?.inventory ?? { item_potion: 3 },
      partyActorIds: overrides?.partyActorIds ?? ["actor_1", "actor_2"],
      actorEquipment: overrides?.actorEquipment,
    },
    syncRuntimeState: () => {},
  } as unknown as PlaySceneContext;
}

function render(options?: {
  readonly items?: readonly ItemRecord[];
  readonly mode?: "buy" | "sell";
  readonly step?: ShopStep;
  readonly merchantGold?: number;
  readonly scene?: PlaySceneContext;
}): HTMLElement {
  store.replace(createBlankProject());
  const overlay = createShopOverlay();
  overlay.append(
    renderShopItems({
      scene: options?.scene ?? scene(),
      step: options?.step ?? STEP,
      items: options?.items ?? [POTION, SWORD],
      mode: options?.mode ?? "buy",
      prompt: "무엇을 구매하시겠습니까?",
      terms: resolveTerms(createBlankProject()),
      merchantGold: options?.merchantGold ?? 900,
      setStatus: () => {},
      showMenu: () => {},
      onItem: () => {},
    })
  );
  return overlay;
}

describe("상점 도움말·통화 표시", () => {
  it("도움말 창이 첫 물건의 설명을 보여주고 커서 이동에 따라 바뀐다", () => {
    const overlay = render();
    const help = overlay.querySelector<HTMLElement>("[data-testid='shop-help-line']");
    expect(help?.textContent).toBe("HP를 50 회복한다.");

    updateShopHelpLine(overlay, STEP, SWORD);
    expect(help?.textContent).toBe("공격력 +5");
  });

  it("설명이 없으면 목록 안내문으로 되돌린다 — 아이템 효과 문장을 머리글에 박지 않는다", () => {
    const blank = item({ id: "item_blank", name: "무명", price: 1 });
    const overlay = render({ items: [blank] });
    const help = overlay.querySelector<HTMLElement>("[data-testid='shop-help-line']");
    expect(help?.textContent).toBe("목록에서 물건을 고르세요.");
    expect(overlay.textContent).not.toContain("모든 캐릭터를 회복합니다");
  });

  it("가격에 통화 단위가 붙고 소지금·상인 소지금 모두 라벨이 있다", () => {
    const overlay = render();
    expect(overlay.querySelector("[data-testid='shop-price-item_potion']")?.textContent).toBe("50G");
    const player = overlay.querySelector<HTMLElement>("[data-testid='shop-player-gold']");
    const merchant = overlay.querySelector<HTMLElement>("[data-testid='shop-merchant-gold']");
    expect(player?.querySelector(".runtime-shop-gold-label")?.textContent).toBe("소지금");
    expect(player?.querySelector(".runtime-shop-gold-value")?.textContent).toBe("250G");
    expect(merchant?.querySelector(".runtime-shop-gold-label")?.textContent).toBe("상인");
    expect(merchant?.querySelector(".runtime-shop-gold-value")?.textContent).toBe("900G");
  });
});

describe("상점 구매 가능 표시", () => {
  it("소지금으로 못 사는 행에 표시와 이유가 붙는다", () => {
    const overlay = render({ scene: scene({ gold: 250 }) });
    const cheap = overlay.querySelector<HTMLElement>("[data-testid='shop-buy-item_potion']");
    const dear = overlay.querySelector<HTMLElement>("[data-testid='shop-buy-item_sword']");

    expect(cheap?.classList.contains("is-unaffordable")).toBe(false);
    expect(dear?.classList.contains("is-unaffordable")).toBe(true);
    expect(dear?.dataset.unaffordable).toBe("1");
    expect(dear?.getAttribute("aria-label")).toContain("소지금 부족");
    // 커서는 얹혀야 한다 — 못 사는 물건도 설명은 읽을 수 있어야 한다.
    expect(dear?.hasAttribute("disabled")).toBe(false);
    expect(dear?.getAttribute("aria-disabled")).toBeNull();
  });

  it("판매에서는 상인이 못 사주는 행에 표시가 붙는다", () => {
    const overlay = render({
      mode: "sell",
      items: [SWORD],
      merchantGold: 10,
      scene: scene({ inventory: { item_sword: 1 } }),
    });
    const row = overlay.querySelector<HTMLElement>("[data-testid='shop-sell-item_sword']");
    expect(row?.classList.contains("is-unaffordable")).toBe(true);
    expect(row?.getAttribute("aria-label")).toContain("상인 소지금 부족");
  });

  it("거래 후 행 표시가 제자리에서 갱신된다", () => {
    const target = scene({ gold: 250, inventory: { item_potion: 3 } });
    const overlay = render({ scene: target });
    const row = overlay.querySelector<HTMLElement>("[data-testid='shop-buy-item_sword']");
    expect(row?.classList.contains("is-unaffordable")).toBe(true);

    (target.session as { gold: number }).gold = 900;
    refreshShopItemRow(overlay, target, SWORD, "buy", resolveTerms(createBlankProject()), 900);
    expect(row?.classList.contains("is-unaffordable")).toBe(false);
  });
});

describe("상점 수량 입력", () => {
  it("수량 입력과 합계가 목록이 아니라 프롬프트 줄에 있다", () => {
    const overlay = render({ step: SELECT_STEP });
    const input = overlay.querySelector<HTMLElement>("[data-testid='shop-quantity-input']");
    expect(input).not.toBeNull();
    // 예전에는 18행 목록의 마지막 자식이라 접힘선 밖으로 밀려났다.
    expect(input?.closest(".runtime-shop-item-list")).toBeNull();
    expect(input?.closest(".runtime-shop-prompt")).not.toBeNull();
  });

  it("합계가 선택 행의 단가 × 수량으로 갱신된다", () => {
    const overlay = render({ step: SELECT_STEP });
    const total = overlay.querySelector<HTMLElement>("[data-testid='shop-quantity-total']");
    expect(total?.textContent).toBe("합계 50G");

    const input = overlay.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
    if (input) input.value = "3";
    updateShopQuantityTotal(overlay);
    expect(total?.textContent).toBe("합계 150G");
  });

  it("수량 모드가 아니면 입력칸을 만들지 않는다", () => {
    const overlay = render();
    expect(overlay.querySelector("[data-testid='shop-quantity-input']")).toBeNull();
  });
});

describe("상점 사이드 패널", () => {
  it("파티 칸이 에디터 밝은 회색 빈 박스가 아니다", () => {
    const overlay = render();
    const sprites = overlay.querySelectorAll<HTMLElement>(".runtime-shop-party-sprite");
    expect(sprites.length).toBe(2);
    for (const sprite of sprites) {
      expect(sprite.style.background).not.toContain("--bg-inset");
      // 얼굴이 없으면 이름 첫 글자라도 있어야 한다 — 빈 사각형은 금지.
      const hasFace = sprite.style.backgroundImage.length > 0;
      expect(hasFace || (sprite.textContent ?? "").length > 0).toBe(true);
      expect(sprite.getAttribute("aria-label")).toBeTruthy();
    }
  });

  it("'장비' 줄은 장비 종류에만 뜨고 실제 착용 수를 센다", () => {
    const equipped = scene({
      inventory: { item_sword: 1 },
      partyActorIds: ["actor_1", "actor_2"],
      actorEquipment: { actor_1: { weapon: "item_sword" }, actor_2: { weapon: "item_other" } },
    });
    const overlay = render({ items: [SWORD], scene: equipped });
    const lines = Array.from(overlay.querySelectorAll(".runtime-shop-stat-line")).map((n) => n.textContent);
    expect(lines.some((text) => text?.startsWith("장비") && text?.endsWith("1"))).toBe(true);

    // 잡화에는 '장비' 줄이 없다 — 항상 0 인 줄은 잡음이다.
    const goods = render({ items: [POTION] });
    const goodsLines = Array.from(goods.querySelectorAll(".runtime-shop-stat-line")).map((n) => n.textContent);
    expect(goodsLines.some((text) => text?.startsWith("장비"))).toBe(false);
  });
});

describe("상점 접근성·제자리 갱신", () => {
  it("오버레이가 모달 대화창 시맨틱을 갖는다", () => {
    const overlay = createShopOverlay();
    expect(overlay.getAttribute("role")).toBe("dialog");
    expect(overlay.getAttribute("aria-modal")).toBe("true");
    expect(overlay.getAttribute("aria-label")).toBe("상점");
  });

  it("상태 문구가 live region 이고 제자리에서 바뀐다", () => {
    const overlay = render();
    const status = overlay.querySelector<HTMLElement>("[data-testid='shop-status-text']");
    expect(status?.getAttribute("role")).toBe("status");
    expect(status?.getAttribute("aria-live")).toBe("polite");

    const before = overlay.querySelector("[data-testid='shop-buy-item_potion']");
    updateShopStatus(overlay, "포션 구매 — -50G");
    expect(status?.textContent).toBe("포션 구매 — -50G");
    // 같은 노드가 살아 있어야 커서·포커스·낭독이 끊기지 않는다.
    expect(overlay.querySelector("[data-testid='shop-buy-item_potion']")).toBe(before);
  });

  it("목록에 list 시맨틱이 있다", () => {
    const overlay = render();
    expect(overlay.querySelector(".runtime-shop-item-list")?.getAttribute("role")).toBe("list");
    expect(overlay.querySelector("[data-testid='shop-buy-item_potion']")?.getAttribute("role")).toBe("listitem");
  });

  it("다 팔린 행은 목록에서 빠진다", () => {
    const overlay = render({ mode: "sell", items: [POTION, SWORD], scene: scene({ inventory: { item_potion: 1, item_sword: 1 } }) });
    expect(overlay.querySelector("[data-testid='shop-sell-item_potion']")).not.toBeNull();
    removeShopItemRow(overlay, "item_potion", "sell");
    expect(overlay.querySelector("[data-testid='shop-sell-item_potion']")).toBeNull();
    expect(overlay.querySelector("[data-testid='shop-sell-item_sword']")).not.toBeNull();
  });
});

describe("상점 빈 목록", () => {
  it("모드에 맞는 빈 목록 안내가 한국어로 뜬다", () => {
    expect(render({ items: [], mode: "buy" }).querySelector("[data-testid='shop-item-list-empty']")?.textContent).toBe(
      "파는 물건이 없습니다."
    );
    expect(render({ items: [], mode: "sell" }).querySelector("[data-testid='shop-item-list-empty']")?.textContent).toBe(
      "팔 물건이 없습니다."
    );
  });

  it("거래할 게 없는 상점도 닫을 수 있는 안내 창을 띄운다", () => {
    let closed = false;
    const shell = renderShopNotice("지금은 팔 물건이 없습니다.", resolveTerms(createBlankProject()), () => {
      closed = true;
    });
    expect(shell.textContent).toContain("지금은 팔 물건이 없습니다.");
    const close = shell.querySelector<HTMLButtonElement>("[data-testid='shop-notice-close']");
    expect(close).not.toBeNull();
    close?.click();
    expect(closed).toBe(true);
  });
});

describe("상점 거래 메시지", () => {
  it("성공·실패 메시지가 모두 한국어이고 금액을 알려준다", () => {
    const project = createBlankProject();
    const potion = item({ id: "item_potion", name: "포션", price: 40, type: "medicine" });
    // Shop helper resolves sell from the active project row/item, not a detached price alone.
    project.database.items = [...project.database.items.filter((entry) => entry.id !== potion.id), potion];
    project.system.sellPrices = (project.system.sellPrices ?? []).filter((entry) => entry.itemId !== potion.id);
    store.replace(project);
    const session = startSession(project);
    session.gold = 100;
    const target = { session, syncRuntimeState: () => {} } as unknown as PlaySceneContext;

    const bought = handleShopTransaction(target, potion, "buy", 2, 100);
    expect(bought.ok).toBe(true);
    expect(bought.status).toBe("포션 구매 — -80G");

    const broke = handleShopTransaction(target, item({ id: "item_gem", name: "원석", price: 9999 }), "buy", 1, 100);
    expect(broke.status).toBe("소지금이 부족합니다.");

    changeItem(session, potion.id, "+=", 1);
    const sold = handleShopTransaction(target, potion, "sell", 1, 500);
    expect(sold.ok).toBe(true);
    expect(sold.status).toBe("포션 판매 — +20G");

    const notOwned = handleShopTransaction(target, item({ id: "item_none", name: "없음", price: 10 }), "sell", 1, 500);
    expect(notOwned.status).toBe("가진 개수가 부족합니다.");

    // 영어 문구가 하나도 남아 있지 않다.
    for (const status of [bought.status, broke.status, sold.status, notOwned.status]) {
      expect(status).not.toMatch(/[A-Za-z]{3,}/);
    }
  });
});
