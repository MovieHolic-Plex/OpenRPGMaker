import { newCommand } from "@/editor/eventActions";
import { SHOP_TRANSACTION_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import type { Command, ItemId, Season, ShopMessageType, ShopStockEntry, ShopType } from "@/project/types";
import type { ItemRecord, ItemType } from "@/project/types/database";
import { commandKindSelect, selectedOptionValue } from "./dom";
import { SEASON_OPTIONS } from "./conditionForm";
import { COMMAND_KIND_OPTIONS } from "./options";
import { imageIconOf, recordIconElement } from "./recordPicker";
import type { CommandEditContext } from "./types";

type ShopCommand = Extract<Command, { kind: "shop" }>;
type InnCommand = Extract<Command, { kind: "inn" }>;
type ShopTypeOption = { readonly value: ShopType; readonly label: string; readonly hint: string };
type ShopMessageOption = { readonly value: ShopMessageType; readonly label: string };
type ShopItemList = {
  readonly root: HTMLElement;
  readonly select: HTMLSelectElement;
  get value(): string;
};

const SHOP_TYPE_OPTIONS: readonly ShopTypeOption[] = [
  { value: "normal", label: "구매/판매", hint: "사고팔기 모두 가능" },
  { value: "buyOnly", label: "구매 전용", hint: "플레이어만 구매" },
  { value: "sellOnly", label: "판매 전용", hint: "플레이어만 판매" },
];

const SHOP_MESSAGE_OPTIONS: readonly ShopMessageOption[] = [
  { value: "welcome", label: "A: 어서 오세요" },
  { value: "business", label: "B: 무엇이 필요하신가요?" },
  { value: "direct", label: "C: 아이템을 선택하세요" },
];

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  normalGoods: "일반",
  weapon: "무기",
  shield: "방패",
  body: "갑옷",
  head: "투구",
  accessory: "장신구",
  medicine: "회복",
  book: "서적",
  seed: "씨앗",
  special: "특수",
  switch: "스위치",
};

export function shopBody(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const project = store.getCurrent();
  const wrap = el("div", {
    class: "commerce-command-body shop-processing-command-body",
    dataset: { testid: "shop-command-body" },
  });
  wrap.append(
    shopSettingsCard(context, command),
    shopItemsPanel(context, command, project.database.items),
    shopStockLayersPanel(context, command, project.database.items),
    shopTransactionBranchControls(context, command),
    selectedSummary(project.database.items, command.itemIds),
  );
  return wrap;
}

export function innBody(context: CommandEditContext, command: InnCommand): HTMLElement {
  const wrap = el("div", {
    class: "commerce-command-body commerce-command-body-inline inn-command-body",
    dataset: { testid: "inn-command-body" },
  });
  const price = document.createElement("input");
  price.type = "number";
  price.min = "0";
  price.value = String(command.price);
  price.title = "여관 요금";
  price.dataset.testid = "inn-price-input";
  price.className = "commerce-command-input";
  price.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      kind: "inn",
      price: Number.parseInt(price.value, 10) || 0,
    });
  });
  wrap.append(
    el("div", {
      class: "commerce-command-field",
      children: [
        el("label", { class: "commerce-command-title", text: "여관 요금" }),
        price,
        el("span", { class: "commerce-command-hint", text: "숙박 시 차감할 금액입니다." }),
      ],
    })
  );
  return wrap;
}

function shopSettingsCard(context: CommandEditContext, command: ShopCommand): HTMLElement {
  return el("div", {
    class: "shop-processing-settings",
    children: [
      shopTypeGroup(context, command),
      shopMessageSelect(context, command),
      shopMerchantGoldField(context, command),
      shopBranchOption(context, command),
    ],
  });
}

function shopMerchantGoldField(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "1";
  input.value = String(command.merchantGold ?? 100);
  input.className = "commerce-command-input shop-processing-merchant-gold-input";
  input.dataset.testid = "shop-merchant-gold";
  input.title = "상인이 플레이어 물품을 살 때 쓰는 소지금";
  input.addEventListener("change", () => {
    const parsed = Number.parseInt(input.value, 10);
    const merchantGold = Number.isFinite(parsed) ? Math.max(0, parsed) : 100;
    input.value = String(merchantGold);
    context.actions.replaceCommand(context.path, { ...command, merchantGold });
  });
  const fieldset = el("fieldset", { class: "shop-processing-fieldset shop-processing-merchant-gold" });
  fieldset.append(
    el("legend", { text: "상인 소지금" }),
    el("div", {
      class: "shop-processing-merchant-gold-row",
      children: [
        input,
        el("span", { class: "shop-processing-merchant-gold-unit", text: "G" }),
      ],
    }),
    el("p", {
      class: "commerce-command-hint",
      text: "플레이어가 물건을 팔 때 상인이 쓸 수 있는 금액입니다. 기본 100G. 상점이 열릴 때마다 이 값으로 시작합니다.",
    })
  );
  return fieldset;
}

function shopTypeGroup(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const groupName = `shop-type-${context.path.join("-") || "root"}`;
  const fieldset = el("fieldset", { class: "shop-processing-fieldset shop-processing-type" });
  fieldset.append(el("legend", { text: "상점 종류" }));
  const segment = el("div", {
    class: "shop-processing-segment",
    attrs: { role: "radiogroup", "aria-label": "상점 종류" },
  });
  const current = shopTypeValue(command);
  for (const option of SHOP_TYPE_OPTIONS) {
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = groupName;
    radio.value = option.value;
    radio.checked = current === option.value;
    radio.dataset.testid = `shop-type-${option.value}`;
    radio.className = "shop-processing-segment-input";
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      context.actions.replaceCommand(context.path, withShopType(command, option.value));
    });
    const label = el("label", {
      class: `shop-processing-segment-option${current === option.value ? " is-selected" : ""}`,
      attrs: { title: option.hint },
      children: [radio, el("span", { text: option.label })],
    });
    segment.append(label);
  }
  fieldset.append(segment);
  return fieldset;
}

function shopBranchOption(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = command.branchOnTransaction ?? false;
  checkbox.dataset.testid = "shop-branch-on-transaction";
  checkbox.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      ...command,
      branchOnTransaction: checkbox.checked,
      transactionBranch: checkbox.checked ? command.transactionBranch ?? [] : command.transactionBranch,
    });
  });
  const fieldset = el("fieldset", { class: "shop-processing-fieldset shop-processing-option" });
  fieldset.append(
    el("legend", { text: "분기" }),
    el("label", {
      class: "commerce-command-option shop-processing-check",
      children: [checkbox, el("span", { text: "구매/판매했을 때 분기" })],
    }),
    el("p", {
      class: "commerce-command-hint",
      text: "거래가 끝난 뒤 아래 분기 명령을 실행합니다.",
    })
  );
  return fieldset;
}

function shopTransactionBranchControls(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const branchSel = commandKindSelect("text");
  const add = el("button", {
    class: "btn shop-processing-branch-add",
    text: "추가",
    dataset: { testid: "shop-add-transaction-branch-command" },
    attrs: { type: "button" },
    on: {
      click: () => {
        const next = newCommand(selectedOptionValue(branchSel, COMMAND_KIND_OPTIONS, "text"));
        context.actions.addCommand([...context.path, SHOP_TRANSACTION_BRANCH_INDEX], next);
      },
    },
  });
  const hiddenClass = command.branchOnTransaction ? "" : " is-hidden";
  return el("div", {
    class: `shop-processing-branch-controls${hiddenClass}`,
    dataset: { testid: "shop-transaction-branch-controls" },
    children: [
      el("div", {
        class: "shop-processing-branch-head",
        children: [
          el("span", { class: "shop-processing-branch-title", text: "구매/판매 분기" }),
          el("span", {
            class: "commerce-command-hint",
            text: "거래 후 실행할 명령",
          }),
        ],
      }),
      el("div", {
        class: "shop-processing-branch-row",
        children: [branchSel, add],
      }),
    ],
  });
}

function shopMessageSelect(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const select = document.createElement("select");
  select.dataset.testid = "shop-message-type";
  select.className = "commerce-command-input shop-processing-message-select";
  select.value = messageTypeValue(command);
  for (const option of SHOP_MESSAGE_OPTIONS) {
    const optionNode = document.createElement("option");
    optionNode.value = option.value;
    optionNode.textContent = option.label;
    select.append(optionNode);
  }
  select.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, { ...command, messageType: selectedMessageType(select.value) });
  });
  const fieldset = el("fieldset", { class: "shop-processing-fieldset shop-processing-message" });
  fieldset.append(el("legend", { text: "메시지 유형" }), select);
  return fieldset;
}

function shopItemsPanel(context: CommandEditContext, command: ShopCommand, items: readonly ItemRecord[]): HTMLElement {
  const selectedItems = command.itemIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is ItemRecord => Boolean(item));
  let availableItems = items.filter((item) => !command.itemIds.includes(item.id));

  const commitItems = (itemIds: readonly ItemId[]) => {
    const stock = syncStockWithItemIds(command.stock, itemIds);
    context.actions.replaceCommand(context.path, {
      ...command,
      itemIds: [...itemIds],
      ...(stock ? { stock } : { stock: undefined }),
    });
  };

  const selectedList = shopItemList("shop-selected-items", selectedItems, {
    emptyText: "판매할 아이템을 오른쪽에서 추가하세요.",
    onActivate: (itemId) => commitItems(command.itemIds.filter((id) => id !== itemId)),
  });
  const availableList = shopItemList("shop-available-items", availableItems, {
    emptyText: "추가할 아이템이 없습니다.",
    onActivate: (itemId) => commitItems(addItemId(command.itemIds, itemId)),
  });

  const search = document.createElement("input");
  search.type = "search";
  search.className = "commerce-command-input shop-processing-item-search";
  search.placeholder = "아이템 검색 (이름 · 설명 · id)";
  search.dataset.testid = "shop-item-search";
  search.title = "추가 가능 목록 필터";
  search.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    const filtered = items
      .filter((item) => !command.itemIds.includes(item.id))
      .filter((item) => itemMatchesQuery(item, query));
    availableItems = filtered;
    rebuildShopItemList(availableList, filtered, {
      emptyText: query ? "검색 결과 없음" : "추가할 아이템이 없습니다.",
      onActivate: (itemId) => commitItems(addItemId(command.itemIds, itemId)),
    });
    add.disabled = filtered.length === 0;
  });

  const add = itemMoveButton("추가 →", "shop-add-item", () => {
    if (!availableList.value) return;
    commitItems(addItemId(command.itemIds, availableList.value));
  });
  const remove = itemMoveButton("← 제거", "shop-remove-item", () => {
    if (!selectedList.value) return;
    commitItems(command.itemIds.filter((id) => id !== selectedList.value));
  });
  const moveUp = itemMoveButton("▲", "shop-move-item-up", () => {
    if (!selectedList.value) return;
    commitItems(moveItemId(command.itemIds, selectedList.value, -1));
  });
  const moveDown = itemMoveButton("▼", "shop-move-item-down", () => {
    if (!selectedList.value) return;
    commitItems(moveItemId(command.itemIds, selectedList.value, 1));
  });
  add.disabled = availableItems.length === 0;
  remove.disabled = selectedItems.length === 0;
  moveUp.disabled = selectedItems.length < 2;
  moveDown.disabled = selectedItems.length < 2;

  availableList.select.addEventListener("change", () => {
    highlightListSelection(availableList.root, availableList.select.value);
  });
  selectedList.select.addEventListener("change", () => {
    highlightListSelection(selectedList.root, selectedList.select.value);
  });

  const fieldset = el("fieldset", { class: "shop-processing-fieldset shop-processing-items" });
  fieldset.append(
    el("legend", { text: "판매 아이템" }),
    el("p", {
      class: "commerce-command-hint shop-processing-items-hint",
      text: "판매 목록이 기본 레이어 · 아래 재고 조건이 계절/가격을 덧씌움 · 더블클릭 추가/제거",
    }),
  );
  if (items.length === 0) {
    fieldset.append(
      el("div", {
        class: "commerce-command-empty",
        text: "등록된 아이템이 없습니다. 데이터베이스에서 아이템을 추가하세요.",
      }),
    );
    return fieldset;
  }

  const detail = itemDetailPanel(selectedItems[0] ?? availableItems[0] ?? null);
  const syncDetail = (itemId: string, pool: readonly ItemRecord[]) => {
    const record = pool.find((item) => item.id === itemId) ?? null;
    detail.render(record);
  };
  selectedList.root.addEventListener("shop-item-select", ((event: CustomEvent<{ itemId: string }>) => {
    syncDetail(event.detail.itemId, selectedItems);
  }) as EventListener);
  availableList.root.addEventListener("shop-item-select", ((event: CustomEvent<{ itemId: string }>) => {
    syncDetail(event.detail.itemId, availableItems);
  }) as EventListener);

  const controls = el("div", {
    class: "shop-processing-item-controls",
    children: [add, remove, moveUp, moveDown],
  });

  fieldset.append(
    el("div", {
      class: "shop-processing-search-row",
      children: [
        el("label", { class: "shop-processing-search-label", text: "검색" }),
        search,
      ],
    }),
    el("div", {
      class: "shop-processing-item-grid",
      children: [
        listColumn("판매 목록", selectedItems.length, selectedList.root, "shop-selected-column"),
        controls,
        listColumn("추가 가능", availableItems.length, availableList.root, "shop-available-column"),
      ],
    }),
    detail.root,
  );
  return fieldset;
}

function shopStockLayersPanel(
  context: CommandEditContext,
  command: ShopCommand,
  items: readonly ItemRecord[],
  focusItemId?: string,
): HTMLElement {
  const selectedId = focusItemId && command.itemIds.includes(focusItemId)
    ? focusItemId
    : (command.itemIds[0] ?? "");
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const entry = stockEntryFor(command.stock, selectedId);

  const fieldset = el("fieldset", {
    class: "shop-processing-fieldset shop-processing-stock-layers",
    dataset: { testid: "shop-stock-layers" },
  });
  fieldset.append(
    el("legend", { text: "재고 · 조건 레이어" }),
    el("p", {
      class: "commerce-command-hint",
      text: "판매 목록 위에 계절 노출/가격을 겹칩니다. 시간대·스위치 개점은 이벤트 페이지 조건을 쓰세요.",
    }),
  );

  if (!selectedItem) {
    fieldset.append(
      el("div", {
        class: "commerce-command-empty",
        text: "판매 목록에 아이템을 넣으면 재고 조건을 편집할 수 있습니다.",
      }),
    );
    return fieldset;
  }

  const itemSelect = document.createElement("select");
  itemSelect.className = "commerce-command-input shop-processing-stock-item-select";
  itemSelect.dataset.testid = "shop-stock-item-select";
  for (const itemId of command.itemIds) {
    const item = items.find((entryItem) => entryItem.id === itemId);
    const option = document.createElement("option");
    option.value = itemId;
    option.textContent = item ? `${item.name} · ${formatPrice(item.price)}` : itemId;
    itemSelect.append(option);
  }
  itemSelect.value = selectedId;
  itemSelect.addEventListener("change", () => {
    const next = shopStockLayersPanel(context, command, items, itemSelect.value);
    fieldset.replaceWith(next);
  });

  const seasons = new Set(entry?.seasons ?? []);
  const seasonRow = el("div", {
    class: "shop-processing-season-row",
    dataset: { testid: "shop-stock-seasons" },
  });
  for (const option of SEASON_OPTIONS) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = seasons.size === 0 ? true : seasons.has(option.value);
    checkbox.dataset.season = option.value;
    checkbox.dataset.testid = `shop-stock-season-${option.value}`;
    checkbox.addEventListener("change", () => {
      const nextSeasons = SEASON_OPTIONS
        .map((seasonOption) => seasonOption.value)
        .filter((season) => {
          const box = seasonRow.querySelector<HTMLInputElement>(`input[data-season="${season}"]`);
          return box?.checked === true;
        });
      // 전부 체크 = 제한 없음(빈 seasons)
      const unlimited = nextSeasons.length === SEASON_OPTIONS.length || nextSeasons.length === 0;
      commitStockEntry(context, command, selectedItem.id, {
        seasons: unlimited ? undefined : nextSeasons,
      });
    });
    seasonRow.append(
      el("label", {
        class: "shop-processing-season-chip",
        children: [checkbox, el("span", { text: option.label })],
      }),
    );
  }

  const priceInput = document.createElement("input");
  priceInput.type = "number";
  priceInput.min = "0";
  priceInput.step = "1";
  priceInput.className = "commerce-command-input shop-processing-stock-price";
  priceInput.dataset.testid = "shop-stock-price-override";
  priceInput.placeholder = String(selectedItem.price);
  priceInput.value = entry?.priceOverride !== undefined ? String(entry.priceOverride) : "";
  priceInput.title = "비우면 DB 기본 가격";
  priceInput.addEventListener("change", () => {
    const raw = priceInput.value.trim();
    if (!raw) {
      commitStockEntry(context, command, selectedItem.id, { priceOverride: undefined });
      return;
    }
    const parsed = Number.parseInt(raw, 10);
    const priceOverride = Number.isFinite(parsed) ? Math.max(0, parsed) : undefined;
    priceInput.value = priceOverride === undefined ? "" : String(priceOverride);
    commitStockEntry(context, command, selectedItem.id, { priceOverride });
  });

  const layerNote = el("div", {
    class: "shop-processing-layer-note",
    dataset: { testid: "shop-layer-note" },
    children: [
      el("strong", { text: "레이어" }),
      el("span", { text: "1) 이벤트 페이지 조건 = 개점(시간대·계절·스위치)" }),
      el("span", { text: "2) 판매 목록 = 기본 재고" }),
      el("span", { text: "3) 이 패널 = 아이템별 계절/가격 덧씌움" }),
    ],
  });

  fieldset.append(
    el("div", {
      class: "shop-processing-stock-grid",
      children: [
        el("label", {
          class: "shop-processing-stock-field",
          children: [
            el("span", { class: "shop-processing-stock-label", text: "대상 아이템" }),
            itemSelect,
          ],
        }),
        el("div", {
          class: "shop-processing-stock-field",
          children: [
            el("span", { class: "shop-processing-stock-label", text: "판매 계절" }),
            seasonRow,
            el("span", {
              class: "commerce-command-hint",
              text: "전부 체크 = 사계절. 일부만 체크하면 해당 계절에만 진열.",
            }),
          ],
        }),
        el("label", {
          class: "shop-processing-stock-field",
          children: [
            el("span", { class: "shop-processing-stock-label", text: "가격 덮어쓰기" }),
            el("div", {
              class: "shop-processing-stock-price-row",
              children: [
                priceInput,
                el("span", { class: "shop-processing-merchant-gold-unit", text: "G" }),
              ],
            }),
          ],
        }),
      ],
    }),
    layerNote,
  );
  return fieldset;
}

function commitStockEntry(
  context: CommandEditContext,
  command: ShopCommand,
  itemId: string,
  patch: { readonly seasons?: readonly Season[]; readonly priceOverride?: number },
): void {
  const base = syncStockWithItemIds(command.stock, command.itemIds) ?? command.itemIds.map((id) => ({ itemId: id }));
  const next = base.map((entry): ShopStockEntry => {
    if (entry.itemId !== itemId) return entry;
    const seasons = patch.seasons !== undefined
      ? (patch.seasons.length > 0 ? [...patch.seasons] : undefined)
      : entry.seasons;
    const priceOverride = "priceOverride" in patch ? patch.priceOverride : entry.priceOverride;
    return {
      itemId: entry.itemId,
      ...(seasons ? { seasons } : {}),
      ...(priceOverride !== undefined ? { priceOverride } : {}),
      ...(entry.priceBySeason ? { priceBySeason: entry.priceBySeason } : {}),
    };
  });
  const meaningful = next.some((entry) => entry.seasons?.length || entry.priceOverride !== undefined || entry.priceBySeason);
  context.actions.replaceCommand(context.path, {
    ...command,
    stock: meaningful ? next : undefined,
  });
}

function stockEntryFor(stock: readonly ShopStockEntry[] | undefined, itemId: string): ShopStockEntry | undefined {
  return stock?.find((entry) => entry.itemId === itemId);
}

function syncStockWithItemIds(
  stock: readonly ShopStockEntry[] | undefined,
  itemIds: readonly ItemId[],
): ShopStockEntry[] | undefined {
  if (!stock?.length) return undefined;
  const byId = new Map(stock.map((entry) => [entry.itemId, entry] as const));
  const next = itemIds.map((itemId) => byId.get(itemId) ?? { itemId });
  const meaningful = next.some((entry) => entry.seasons?.length || entry.priceOverride !== undefined || entry.priceBySeason);
  return meaningful ? next : undefined;
}

function itemMatchesQuery(item: ItemRecord, query: string): boolean {
  if (!query) return true;
  const haystack = `${item.name} ${item.description ?? ""} ${item.id} ${item.type}`.toLowerCase();
  return haystack.includes(query);
}

function rebuildShopItemList(
  listHandle: ShopItemList,
  items: readonly ItemRecord[],
  options: { readonly emptyText: string; readonly onActivate: (itemId: string) => void },
): void {
  const project = store.getCurrent();
  const { select } = listHandle;
  const list = listHandle.root.querySelector(".shop-processing-item-list");
  if (!(list instanceof HTMLElement)) return;

  select.replaceChildren();
  for (const item of items) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.name}  ·  ${formatPrice(item.price)}`;
    option.dataset.testid = `shop-list-item-${item.id}`;
    select.append(option);
  }
  select.size = Math.max(2, items.length || 2);
  if (items.length > 0) {
    select.selectedIndex = 0;
    select.value = items[0]!.id;
  } else {
    select.value = "";
  }

  list.replaceChildren();
  if (items.length === 0) {
    list.append(el("div", { class: "shop-processing-item-empty", text: options.emptyText }));
    return;
  }
  for (const item of items) {
    const selected = item.id === select.value;
    const row = el("button", {
      class: `shop-processing-item-row${selected ? " is-selected" : ""}`,
      attrs: {
        type: "button",
        role: "option",
        "aria-selected": selected ? "true" : "false",
        title: itemDetailTitle(item),
      },
      dataset: { testid: `shop-item-row-${item.id}`, itemId: item.id },
    });
    row.append(
      el("div", {
        class: "shop-processing-item-icon",
        children: [recordIconElement(imageIconOf(project, item.iconResourceId ?? item.imageResourceId), item.name)],
      }),
      el("div", {
        class: "shop-processing-item-copy",
        children: [
          el("div", {
            class: "shop-processing-item-topline",
            children: [
              el("span", { class: "shop-processing-item-name", text: item.name }),
              el("span", { class: "shop-processing-item-price", text: formatPrice(item.price) }),
            ],
          }),
          el("div", {
            class: "shop-processing-item-meta",
            children: [
              el("span", { class: "shop-processing-item-type", text: itemTypeLabel(item.type) }),
              el("span", {
                class: "shop-processing-item-desc",
                text: item.description?.trim() || "설명 없음",
              }),
            ],
          }),
        ],
      }),
    );
    row.addEventListener("click", () => {
      select.value = item.id;
      highlightListSelection(list, item.id);
      list.dispatchEvent(new CustomEvent("shop-item-select", { detail: { itemId: item.id }, bubbles: true }));
    });
    row.addEventListener("dblclick", (event) => {
      event.preventDefault();
      options.onActivate(item.id);
    });
    list.append(row);
  }
}


function listColumn(title: string, count: number, listRoot: HTMLElement, testId: string): HTMLElement {
  return el("div", {
    class: "shop-processing-list-column",
    dataset: { testid: testId },
    children: [
      el("div", {
        class: "shop-processing-list-head",
        children: [
          el("span", { class: "shop-processing-list-title", text: title }),
          el("span", { class: "shop-processing-list-count", text: `${count}` }),
        ],
      }),
      listRoot,
    ],
  });
}

function shopItemList(
  testId: string,
  items: readonly ItemRecord[],
  options: { readonly emptyText: string; readonly onActivate: (itemId: string) => void },
): ShopItemList {
  const project = store.getCurrent();
  const select = document.createElement("select");
  select.className = "shop-processing-native-select";
  select.dataset.testid = testId;
  select.size = Math.max(2, items.length || 2);
  select.multiple = false;
  for (const item of items) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.name}  ·  ${formatPrice(item.price)}`;
    option.dataset.testid = `shop-list-item-${item.id}`;
    select.append(option);
  }
  if (items.length > 0) {
    select.selectedIndex = 0;
    select.value = items[0]!.id;
  }

  const list = el("div", {
    class: "shop-processing-item-list",
    attrs: { role: "listbox", "aria-label": testId },
  });

  if (items.length === 0) {
    list.append(el("div", { class: "shop-processing-item-empty", text: options.emptyText }));
  } else {
    for (const item of items) {
      const selected = item.id === select.value;
      const row = el("button", {
        class: `shop-processing-item-row${selected ? " is-selected" : ""}`,
        attrs: {
          type: "button",
          role: "option",
          "aria-selected": selected ? "true" : "false",
          title: itemDetailTitle(item),
        },
        dataset: { testid: `shop-item-row-${item.id}`, itemId: item.id },
      });
      row.append(
        el("div", {
          class: "shop-processing-item-icon",
          children: [recordIconElement(imageIconOf(project, item.iconResourceId ?? item.imageResourceId), item.name)],
        }),
        el("div", {
          class: "shop-processing-item-copy",
          children: [
            el("div", {
              class: "shop-processing-item-topline",
              children: [
                el("span", { class: "shop-processing-item-name", text: item.name }),
                el("span", { class: "shop-processing-item-price", text: formatPrice(item.price) }),
              ],
            }),
            el("div", {
              class: "shop-processing-item-meta",
              children: [
                el("span", { class: "shop-processing-item-type", text: itemTypeLabel(item.type) }),
                el("span", {
                  class: "shop-processing-item-desc",
                  text: item.description?.trim() || "설명 없음",
                }),
              ],
            }),
          ],
        }),
      );
      row.addEventListener("click", () => {
        select.value = item.id;
        highlightListSelection(list, item.id);
        list.dispatchEvent(new CustomEvent("shop-item-select", { detail: { itemId: item.id }, bubbles: true }));
      });
      row.addEventListener("dblclick", (event) => {
        event.preventDefault();
        options.onActivate(item.id);
      });
      list.append(row);
    }
  }

  const root = el("div", {
    class: "shop-processing-item-list-shell",
    children: [select, list],
  });

  return {
    root,
    select,
    get value() {
      return select.value;
    },
  };
}

function highlightListSelection(listRoot: HTMLElement, itemId: string): void {
  const list = listRoot.classList.contains("shop-processing-item-list")
    ? listRoot
    : listRoot.querySelector(".shop-processing-item-list");
  if (!(list instanceof HTMLElement)) return;
  for (const row of list.querySelectorAll<HTMLElement>(".shop-processing-item-row")) {
    const selected = row.dataset.itemId === itemId;
    row.classList.toggle("is-selected", selected);
    row.setAttribute("aria-selected", selected ? "true" : "false");
  }
}

function itemDetailPanel(initial: ItemRecord | null): { root: HTMLElement; render: (item: ItemRecord | null) => void } {
  const project = store.getCurrent();
  const root = el("div", {
    class: "shop-processing-item-detail",
    dataset: { testid: "shop-item-detail" },
  });

  const render = (item: ItemRecord | null) => {
    root.replaceChildren();
    if (!item) {
      root.append(el("div", { class: "shop-processing-item-detail-empty", text: "아이템을 선택하면 상세 정보가 표시됩니다." }));
      return;
    }
    const icon = recordIconElement(imageIconOf(project, item.iconResourceId ?? item.imageResourceId), item.name);
    icon.classList.add("shop-processing-item-detail-icon");
    root.append(
      el("div", {
        class: "shop-processing-item-detail-main",
        children: [
          el("div", { class: "shop-processing-item-detail-icon-wrap", children: [icon] }),
          el("div", {
            class: "shop-processing-item-detail-copy",
            children: [
              el("div", {
                class: "shop-processing-item-detail-title",
                children: [
                  el("strong", { text: item.name }),
                  el("span", { class: "shop-processing-item-detail-price", text: formatPrice(item.price) }),
                ],
              }),
              el("div", {
                class: "shop-processing-item-detail-badges",
                children: [
                  el("span", { class: "shop-processing-badge", text: itemTypeLabel(item.type) }),
                  el("span", { class: "shop-processing-badge", text: item.consumable ? "소모품" : "비소모" }),
                  el("span", { class: "shop-processing-badge", text: occasionLabel(item) }),
                ],
              }),
              el("p", {
                class: "shop-processing-item-detail-desc",
                text: item.description?.trim() || "설명이 없습니다.",
              }),
            ],
          }),
        ],
      }),
    );
  };

  render(initial);
  return { root, render };
}

function itemMoveButton(text: string, testId: string, click: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn shop-processing-move-button";
  button.textContent = text;
  button.dataset.testid = testId;
  button.addEventListener("click", click);
  return button;
}

function itemTypeLabel(type: ItemType): string {
  return ITEM_TYPE_LABELS[type] ?? type;
}

function occasionLabel(item: ItemRecord): string {
  if (item.occasion === "battle") return "전투 전용";
  if (item.occasion === "field") return "필드 전용";
  if (item.occasion === "never") return "사용 불가";
  if (item.occasionBattle && !item.occasionField) return "전투 위주";
  if (item.occasionField && !item.occasionBattle) return "필드 위주";
  return "언제든";
}


function itemDetailTitle(item: ItemRecord): string {
  const desc = item.description?.trim() || "설명 없음";
  return `${item.name} (${formatPrice(item.price)})\n${itemTypeLabel(item.type)} · ${desc}`;
}

function formatPrice(price: number): string {
  return `${price.toLocaleString("ko-KR")} G`;
}

function addItemId(current: readonly ItemId[], itemId: string): ItemId[] {
  return current.includes(itemId) ? [...current] : [...current, itemId];
}

function moveItemId(current: readonly ItemId[], itemId: string, delta: -1 | 1): ItemId[] {
  const index = current.indexOf(itemId);
  if (index < 0) return [...current];
  const target = index + delta;
  if (target < 0 || target >= current.length) return [...current];
  const next = [...current];
  const [moved] = next.splice(index, 1);
  if (!moved) return [...current];
  next.splice(target, 0, moved);
  return next;
}

function shopTypeValue(command: ShopCommand): ShopType {
  if (command.shopType) return command.shopType;
  return command.allowSell ? "normal" : "buyOnly";
}

function withShopType(command: ShopCommand, shopType: ShopType): ShopCommand {
  return {
    ...command,
    shopType,
    allowSell: shopType !== "buyOnly",
  };
}

function messageTypeValue(command: ShopCommand): ShopMessageType {
  return command.messageType ?? "welcome";
}

function selectedMessageType(value: string): ShopMessageType {
  const option = SHOP_MESSAGE_OPTIONS.find((entry) => entry.value === value);
  return option?.value ?? "welcome";
}

function selectedSummary(items: readonly ItemRecord[], itemIds: readonly string[]): HTMLElement {
  const selectedItems = itemIds
    .map((id) => items.find((item) => item.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  return el("div", {
    class: "commerce-command-summary",
    text: selectedItems.length ? `선택한 아이템: ${selectedItems.join(", ")}` : "선택한 아이템: 없음",
    dataset: { testid: "shop-selection-summary" },
  });
}
