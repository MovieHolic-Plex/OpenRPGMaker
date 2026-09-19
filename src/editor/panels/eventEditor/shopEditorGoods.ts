import { GENERAL_STORE_PRESET_ITEM_IDS } from "@/editor/eventCommands/quickAuthoringDefaults";
import { store } from "@/project/store";
import { startSession } from "@/project/session";
import { stockEntryPrice } from "@/project/shopStock";
import type { ItemRecord } from "@/project/types/database";
import { el } from "@/util/dom";
import { imageIconOf, recordIconElement } from "./recordPicker";
import { openEventSubdialog } from "./subdialog";
import type { CommandEditContext } from "./types";
import {
  latestShop, SHOP_ITEM_TYPES, SHOP_SEASONS, SHOP_SEASON_LABELS, shopPriceLabel, withShopItems,
  type ShopCommand, type ShopEditorView, type ShopSeason,
} from "./shopEditorModel";

type StockEntry = NonNullable<ShopCommand["stock"]>[number];

export function createShopGoods(context: CommandEditContext, command: ShopCommand, items: readonly ItemRecord[], view: ShopEditorView): HTMLElement {
  const current = () => latestShop(context, command);
  const byId = new Map(items.map((item) => [item.id, item]));
  const layout = el("div", { class: "shop-editor-goods" });
  const main = el("section", { class: "shop-editor-listing" });
  const count = el("span", { class: "shop-editor-count", dataset: { testid: "shop-header-badge" } });
  const rows = el("div", { class: "shop-editor-rows", dataset: { testid: "shop-sale-list" } });
  const scroller = el("div", { class: "shop-editor-list-scroll", dataset: { testid: "shop-item-catalog" }, children: [rows] });
  scroller.addEventListener("scroll", () => { view.scrollTop = scroller.scrollTop; });
  const detail = el("div", { class: "shop-editor-item-detail", dataset: { testid: "shop-item-detail" } });
  const preview = el("div", { class: "shop-editor-preview-slot", dataset: { testid: "shop-preview-slot" } });
  const select = (id: string, focus: boolean) => {
    view.selectedId = id; renderRows(); renderDetail();
    if (focus) focusRow(id);
  };
  const focusRow = (id: string) => {
    const row = Array.from(rows.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.dataset.itemId === id);
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: "nearest" });
  };
  const commitItems = (ids: readonly string[]) => {
    view.scrollTop = scroller.scrollTop;
    context.actions.replaceCommand(context.path, withShopItems(current(), ids));
    if (!ids.includes(view.selectedId ?? "")) view.selectedId = ids[0] ?? null;
    renderRows(); renderDetail();
  };
  const add = el("button", {
    class: "btn primary", text: "+ 상품 추가", attrs: { type: "button" }, dataset: { testid: "shop-add-goods" },
    on: { click: () => openShopCatalog(items, current, (ids) => {
      view.selectedId = ids[0] ?? view.selectedId;
      commitItems([...new Set([...current().itemIds, ...ids])]);
    }) },
  });

  const renderRows = () => {
    const c = current();
    const season = editorShopSeason();
    const top = view.scrollTop;
    count.textContent = `${c.itemIds.length}개`;
    if (!c.itemIds.includes(view.selectedId ?? "")) view.selectedId = c.itemIds[0] ?? null;
    rows.replaceChildren();
    for (const [index, id] of c.itemIds.entries()) {
      const item = byId.get(id);
      const stock = c.stock?.find((entry) => entry.itemId === id);
      const selected = view.selectedId === id;
      const effectivePrice = stock ? stockEntryPrice(stock, season) ?? item?.price : item?.price;
      const button = el("button", {
        class: `shop-editor-goods-row${selected ? " is-selected" : ""}`,
        attrs: { type: "button", "aria-pressed": String(selected) },
        dataset: { testid: `shop-item-row-${id}`, itemId: id },
        children: [
          el("span", { class: "shop-editor-goods-name", children: [
            ...(item ? [goodsIcon(item)] : []),
            el("span", { children: [el("strong", { text: item?.name ?? "찾을 수 없는 상품" }), el("small", { text: item ? SHOP_ITEM_TYPES[item.type] : "자료집에서 삭제된 상품" })] }),
          ] }),
          el("span", { class: "shop-editor-goods-price", children: [
            el("span", { text: item && effectivePrice !== undefined ? shopPriceLabel(effectivePrice) : "—" }),
            ...(stock?.priceBySeason && season && stock.priceBySeason[season] !== undefined ? [el("small", { text: `${SHOP_SEASON_LABELS[season]} 가격` })] : stock?.priceBySeason ? [el("small", { text: "계절별 가격 있음" })] : stock?.priceOverride !== undefined ? [el("small", { text: "직접 지정" })] : []),
          ] }),
          el("span", { class: "shop-editor-goods-season", text: stock?.seasons?.length ? stock.seasons.map((season) => SHOP_SEASON_LABELS[season]).join(" · ") : "사계절" }),
        ],
        on: { click: () => select(id, true) },
      });
      button.addEventListener("keydown", (event) => {
        const delta = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
        if (!delta && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        const target = event.key === "Home" ? 0 : event.key === "End" ? c.itemIds.length - 1 : Math.max(0, Math.min(c.itemIds.length - 1, index + delta));
        select(c.itemIds[target]!, true);
      });
      rows.append(button);
    }
    if (!c.itemIds.length) rows.append(el("p", { class: "shop-editor-empty", text: "아직 진열한 상품이 없습니다. 상품 추가에서 판매할 물건을 골라 주세요." }));
    scroller.scrollTop = top;
  };

  const renderDetail = () => {
    detail.replaceChildren();
    const id = view.selectedId;
    if (!id) { detail.append(el("p", { class: "shop-editor-empty", text: "진열한 상품을 선택하면 가격과 판매 시기를 편집할 수 있습니다." })); return; }
    const item = byId.get(id);
    if (item) {
      detail.append(el("div", { class: "shop-editor-item-hero", children: [goodsIcon(item), el("div", { children: [
        el("h3", { text: item.name }), el("span", { class: "shop-editor-muted", text: `${SHOP_ITEM_TYPES[item.type]} · ${item.consumable ? "소모품" : "비소모품"}` }),
      ] })] }), el("p", { class: "shop-editor-description", text: item.description?.trim() || "등록된 설명이 없습니다." }));
      detail.append(stockEditor(context, command, item, renderRows));
    } else detail.append(el("p", { text: "자료집에 없는 상품입니다. 진열에서 뺀 뒤 다른 상품을 추가해 주세요." }));
    const actions = el("div", { class: "shop-editor-item-actions" });
    const index = current().itemIds.indexOf(id);
    for (const [delta, label] of [[-1, "↑ 위로"], [1, "↓ 아래로"]] as const) {
      const button = el("button", { class: "btn small", text: label, attrs: { type: "button", "aria-label": `${item?.name ?? "상품"} ${delta < 0 ? "위로" : "아래로"}` },
        dataset: { testid: `shop-move-${delta < 0 ? "up" : "down"}-${id}` },
        on: { click: () => {
          const ids = [...current().itemIds]; const from = ids.indexOf(id); const to = from + delta;
          if (from < 0 || to < 0 || to >= ids.length) return;
          [ids[from], ids[to]] = [ids[to]!, ids[from]!];
          commitItems(ids); focusRow(id);
        } },
      }) as HTMLButtonElement;
      button.disabled = index + delta < 0 || index + delta >= current().itemIds.length;
      actions.append(button);
    }
    actions.append(el("button", { class: "btn small shop-editor-remove", text: "진열에서 빼기", attrs: { type: "button" }, dataset: { testid: "shop-remove-goods" },
      on: { click: () => { commitItems(current().itemIds.filter((itemId) => itemId !== id)); if (view.selectedId) focusRow(view.selectedId); else add.focus(); } },
    }));
    detail.append(actions);
  };

  main.append(el("div", { class: "shop-editor-list-head", children: [el("h3", { children: [el("span", { text: "진열 상품" }), count] }), add] }),
    el("div", { class: "shop-editor-column-head", attrs: { "aria-hidden": "true" }, children: [el("span", { text: "상품" }), el("span", { text: "판매 가격" }), el("span", { text: "판매 시기" })] }),
    scroller, el("p", { class: "shop-editor-list-note", text: "이 순서대로 게임에 표시됩니다." }));
  layout.append(main, el("aside", { class: "shop-editor-inspector", children: [detail, preview] }));
  renderRows(); renderDetail();
  return layout;
}

function editorShopSeason(): ShopSeason | undefined {
  const project = store.getCurrent();
  if (!project.system.timeSystem?.enabled) return undefined;
  return startSession(project).gameTime?.season;
}

function goodsIcon(item: ItemRecord): HTMLElement {
  return el("span", { class: "shop-editor-icon", attrs: { "aria-hidden": "true" }, children: [
    recordIconElement(imageIconOf(store.getCurrent(), item.iconResourceId ?? item.imageResourceId), item.name),
  ] });
}

function stockEditor(context: CommandEditContext, command: ShopCommand, item: ItemRecord, refreshRows: () => void): HTMLElement {
  const current = () => latestShop(context, command);
  const entry = () => current().stock?.find((row) => row.itemId === item.id);
  const patch = (fields: Partial<StockEntry>) => {
    const c = current();
    if (!c.itemIds.includes(item.id)) return;
    const next = { ...entry(), itemId: item.id, ...fields };
    const present = Object.entries(next).some(([key, value]) => key !== "itemId" && value !== undefined);
    const stock = (c.stock ?? []).filter((row) => row.itemId !== item.id);
    if (present) stock.push(next);
    const byId = new Map(stock.map((row) => [row.itemId, row]));
    context.actions.replaceCommand(context.path, { ...c, stock: stock.length ? c.itemIds.map((id) => byId.get(id)).filter((row): row is StockEntry => Boolean(row)) : undefined });
    refreshRows();
  };
  const root = el("div", { class: "shop-editor-stock", dataset: { testid: "shop-stock-editor" } });
  const priceGroup = el("fieldset", { class: "shop-editor-fieldset", children: [el("legend", { text: "판매 가격" })] });
  const base = el("input", { attrs: { type: "radio", name: `shop-price-${item.id}` }, dataset: { testid: "shop-stock-price-base" } }) as HTMLInputElement;
  const custom = el("input", { attrs: { type: "radio", name: `shop-price-${item.id}` }, dataset: { testid: "shop-stock-price-custom" } }) as HTMLInputElement;
  const price = el("input", { class: "commerce-command-input shop-editor-price-input", attrs: { type: "number", min: "0", step: "1", "aria-label": "직접 지정 가격" }, dataset: { testid: "shop-stock-price-override" } }) as HTMLInputElement;
  const warning = el("p", { class: "shop-editor-price-warning", dataset: { testid: "shop-stock-price-warning" }, attrs: { role: "status" } });
  const syncPrice = () => {
    const override = entry()?.priceOverride;
    base.checked = override === undefined; custom.checked = !base.checked; price.disabled = base.checked;
    price.value = String(override ?? item.price);
    const floor = Math.floor(item.price / 2);
    warning.textContent = override !== undefined && override < floor ? `매입가 ${floor}G보다 낮습니다. 게임에서는 ${floor}G 이상으로 보정됩니다.` : "";
    warning.hidden = !warning.textContent;
  };
  base.addEventListener("change", () => { if (base.checked) { patch({ priceOverride: undefined }); syncPrice(); } });
  custom.addEventListener("change", () => { if (custom.checked) { patch({ priceOverride: entry()?.priceOverride ?? item.price }); syncPrice(); price.focus(); } });
  price.addEventListener("change", () => {
    const raw = price.value.trim(); const value = Number(raw);
    if (raw && Number.isFinite(value)) patch({ priceOverride: Math.max(0, Math.floor(value)) });
    syncPrice();
  });
  priceGroup.append(el("label", { class: "shop-editor-choice", children: [base, el("span", { text: `기본 가격 사용 · ${shopPriceLabel(item.price)}` })] }),
    el("div", { class: "shop-editor-price-row", children: [el("label", { class: "shop-editor-choice", children: [custom, el("span", { text: "직접 지정" })] }), price, el("span", { text: "G" })] }), warning);
  if (entry()?.priceBySeason) priceGroup.append(el("p", { class: "shop-editor-muted", text: "설정된 계절별 가격이 기본 판매 가격보다 우선 적용됩니다." }));
  const seasonGroup = el("fieldset", { class: "shop-editor-fieldset", children: [el("legend", { text: "판매 시기" })] });
  const all = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "shop-stock-all-seasons" } }) as HTMLInputElement;
  const chips = el("div", { class: "shop-editor-seasons" });
  const syncSeasons = () => {
    const seasons = entry()?.seasons ?? [];
    all.checked = seasons.length === 0 || seasons.length === 4;
    for (const button of Array.from(chips.children) as HTMLButtonElement[]) button.setAttribute("aria-pressed", String(!all.checked && seasons.includes(button.dataset.season as ShopSeason)));
  };
  all.addEventListener("change", () => { patch({ seasons: all.checked ? undefined : ["spring"] }); syncSeasons(); });
  for (const season of SHOP_SEASONS) chips.append(el("button", {
    class: "btn small", text: SHOP_SEASON_LABELS[season], attrs: { type: "button" }, dataset: { testid: `shop-stock-season-${season}`, season },
    on: { click: () => {
      const previous = all.checked ? [] : entry()?.seasons ?? [];
      const next = SHOP_SEASONS.filter((value) => value === season ? !previous.includes(value) : previous.includes(value));
      patch({ seasons: next.length && next.length < 4 ? next : undefined }); syncSeasons();
    } },
  }));
  seasonGroup.append(el("label", { class: "shop-editor-choice", children: [all, el("span", { text: "사계절 내내 판매" })] }), chips,
    el("p", { class: "shop-editor-muted", text: store.getCurrent().system.timeSystem?.enabled ? "특정 계절을 선택하면 그때만 판매합니다." : "시간 시스템을 켜면 계절별 판매 조건이 적용됩니다." }));
  root.append(priceGroup, seasonGroup); syncPrice(); syncSeasons(); return root;
}

function openShopCatalog(items: readonly ItemRecord[], current: () => ShopCommand, onAdd: (ids: readonly string[]) => void): void {
  openEventSubdialog({
    title: "상품 추가", subtitle: "판매할 상품을 여러 개 골라 한 번에 추가합니다.", testId: "shop-catalog-dialog", width: "wide",
    render: (body, close) => {
      const selected = new Set<string>();
      const wrap = el("div", { class: "shop-catalog-picker" });
      const search = el("input", { class: "commerce-command-input", attrs: { type: "search", placeholder: "이름 · 설명 검색", "aria-label": "상품 검색" }, dataset: { testid: "shop-item-search" } }) as HTMLInputElement;
      const type = el("select", { class: "commerce-command-input", attrs: { "aria-label": "상품 종류" }, dataset: { testid: "shop-item-type-filter" } }) as HTMLSelectElement;
      type.append(el("option", { text: "전체 종류", attrs: { value: "all" } }));
      for (const [value, label] of Object.entries(SHOP_ITEM_TYPES)) if (items.some((item) => item.type === value)) type.append(el("option", { text: label, attrs: { value } }));
      type.value = "all";
      const list = el("div", { class: "shop-catalog-list", dataset: { testid: "shop-catalog-list" }, attrs: { role: "group", "aria-label": "추가할 상품" } });
      const add = el("button", { class: "btn primary", attrs: { type: "button" }, dataset: { testid: "shop-catalog-add" }, on: { click: () => {
        const ids = items.filter((item) => selected.has(item.id) && !current().itemIds.includes(item.id)).map((item) => item.id);
        if (!ids.length) return;
        onAdd(ids); close();
      } } }) as HTMLButtonElement;
      const updateCount = () => { add.disabled = selected.size === 0; add.textContent = selected.size ? `${selected.size}개 상품 추가` : "상품 선택"; };
      const render = () => {
        const query = search.value.trim().toLocaleLowerCase();
        const visible = items.filter((item) => (type.value === "all" || item.type === type.value) && `${item.name} ${item.description ?? ""} ${item.id} ${SHOP_ITEM_TYPES[item.type]}`.toLocaleLowerCase().includes(query));
        const scrollTop = list.scrollTop;
        list.replaceChildren();
        for (const item of visible) {
          const stocked = current().itemIds.includes(item.id);
          const check = el("input", { attrs: { type: "checkbox", "aria-label": `${item.name} 추가` }, dataset: { testid: `shop-item-check-${item.id}` } }) as HTMLInputElement;
          check.checked = stocked || selected.has(item.id); check.disabled = stocked;
          check.addEventListener("change", () => { if (check.checked) selected.add(item.id); else selected.delete(item.id); updateCount(); });
          list.append(el("label", { class: `shop-catalog-row${stocked ? " is-stocked" : ""}`, dataset: { testid: `shop-catalog-item-${item.id}` }, children: [
            check, goodsIcon(item), el("span", { class: "shop-catalog-name", children: [el("strong", { text: item.name }), el("small", { text: stocked ? "진열 중" : SHOP_ITEM_TYPES[item.type] })] }),
            el("span", { text: shopPriceLabel(item.price) }),
          ] }));
        }
        if (!visible.length) list.append(el("p", { class: "shop-editor-empty", text: items.length ? "검색 결과가 없습니다." : "등록된 상품이 없습니다. 데이터베이스에서 아이템이나 장비를 추가해 주세요." }));
        list.scrollTop = scrollTop; updateCount();
      };
      search.addEventListener("input", render); search.addEventListener("change", render); type.addEventListener("change", render);
      const presets = el("div", { class: "shop-catalog-presets", dataset: { testid: "shop-presets" }, children: [el("span", { text: "빠른 선택" })] });
      for (const [id, label, ids] of [
        ["general", "잡화점", GENERAL_STORE_PRESET_ITEM_IDS],
        ["season-seeds", "시즌 씨앗", ["item_potato_seed", "item_strawberry_seed", "item_tomato_seed", "item_corn_seed"]],
        ["friendly", "프렌들리숍", ["item_capture_orb", "item_potion", "item_antidote"]],
      ] as const) {
        const candidates = items.filter((item) => ids.some((id) => id === item.id) && !current().itemIds.includes(item.id));
        const button = el("button", { class: "btn small", text: label, attrs: { type: "button" }, dataset: { testid: `shop-preset-${id}` }, on: { click: () => { candidates.forEach((item) => selected.add(item.id)); render(); } } }) as HTMLButtonElement;
        button.disabled = candidates.length === 0; presets.append(button);
      }
      wrap.append(el("div", { class: "shop-catalog-filters", children: [type, search] }), presets, list,
        el("div", { class: "shop-catalog-actions", children: [el("button", { class: "btn", text: "취소", attrs: { type: "button" }, dataset: { testid: "shop-catalog-cancel" }, on: { click: close } }), add] }));
      body.append(wrap); render(); search.focus();
    },
  });
}
