import { newCommand } from "@/editor/eventActions";
import { SHOP_TRANSACTION_BRANCH_INDEX, SHOP_FAILED_TRANSACTION_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { store } from "@/project/store";
import { SHOP_MESSAGE_LABELS, SHOP_MESSAGE_TYPES, shopGreetingText, shopListHeaderText, shopBuyPromptText } from "@/project/shopMessages";
import { resolveTerms } from "@/project/terms";
import { DEFAULT_SHOP_UI_PRESET, effectiveShopUiPreset } from "@/project/shopUiPresets";
import type { ShopMessageType, ShopType, ShopUiPreset } from "@/project/types";
import { el } from "@/util/dom";
import { commandKindSelect, selectedOptionValue } from "./dom";
import { COMMAND_KIND_OPTIONS } from "./options";
import type { CommandEditContext, CommandListActions } from "./types";
import { shopEconomyCard } from "./commandBodyShopEconomy";
import { createShopGoods } from "./shopEditorGoods";
import { latestShop, shopCatalogRecords, type ShopCommand, type ShopEditorView, type ShopTab } from "./shopEditorModel";

const SHOP_TYPE_OPTIONS: readonly { value: ShopType; label: string; hint: string }[] = [
  { value: "normal", label: "구매·판매 가능", hint: "플레이어가 사고팔 수 있습니다" },
  { value: "buyOnly", label: "구매만 가능", hint: "플레이어가 상점에서 물건을 삽니다" },
  { value: "sellOnly", label: "판매만 가능", hint: "플레이어가 상점에 물건을 팝니다" },
];
const SHOP_MESSAGE_OPTIONS = SHOP_MESSAGE_TYPES.map((value) => ({ value, label: SHOP_MESSAGE_LABELS[value] }));
const SHOP_UI_PRESET_OPTIONS: readonly { value: ShopUiPreset; label: string; hint: string }[] = [
  { value: "collector", label: "수집 게임 · 흰 창 도구점", hint: "상품·가격·보유 수량·설명과 수량 선택을 흰 도트 창에 표시합니다" },
  { value: "pixel", label: "도트 비교 상점 (기본)", hint: "도트 창에 파티원별 능력치 변화와 회복량을 바로 보여줍니다" },
  { value: "classic", label: "단순 목록 상점", hint: "상품명·가격·소지금 중심의 전통 상점" },
  { value: "tabs", label: "카테고리·일일 재고", hint: "카테고리와 오늘의 판매 목록을 함께 보여줍니다" },
  { value: "grid", label: "진열 카드 상점", hint: "상품 카드와 상세 설명을 중심으로 보여줍니다" },
  { value: "compare", label: "장비 비교 상점", hint: "현재 장비와 구매 후 능력치를 나란히 비교합니다" },
  { value: "split", label: "구매·개조·판매·교환", hint: "거래 서비스를 독립 메뉴로 나눕니다" },
  { value: "cart", label: "양측 인벤토리 거래", hint: "플레이어와 상인의 물품을 동시에 비교합니다" },
  { value: "stock", label: "재고·흥정 상점", hint: "한정 재고·가격·할인·상인 예산을 강조합니다" },
  { value: "story", label: "대화 중심 상점", hint: "상인 대화와 추천 상품을 먼저 보여줍니다" },
  { value: "baram", label: "바람의 나라식 간결 메뉴", hint: "작은 메뉴창과 짧은 문구로 빠르게 거래합니다" },
];
// Dialog actions survive a staged branch edit; weak ownership releases view state when the dialog closes.
const views = new WeakMap<CommandListActions, Map<string, ShopEditorView>>();
let panelSequence = 0;

export function shopBody(context: CommandEditContext, command: ShopCommand): HTMLElement {
  let byPath = views.get(context.actions);
  if (!byPath) { byPath = new Map(); views.set(context.actions, byPath); }
  const key = JSON.stringify(context.path);
  let view = byPath.get(key);
  if (!view) { view = { tab: "goods", selectedId: command.itemIds[0] ?? null, scrollTop: 0 }; byPath.set(key, view); }
  const state = view;
  let draft = command;
  const current = () => latestShop(context, draft);
  const wrap = el("div", { class: "commerce-command-body shop-processing-command-body shop-editor cream-command-form", dataset: { testid: "shop-command-body" } });
  const summary = el("p", { class: "shop-editor-summary", dataset: { testid: "shop-header-summary" } });
  const panelId = `shop-editor-panel-${++panelSequence}`;
  const panel = el("div", { class: "shop-editor-panel", attrs: { id: panelId, role: "tabpanel" } });
  const tabs = el("div", { class: "shop-editor-tabs", attrs: { role: "tablist", "aria-label": "상점 편집" } });
  const editContext: CommandEditContext = {
    ...context,
    getCurrentCommand: current,
    actions: { ...context.actions, replaceCommand: (path, next) => {
      if (next.kind === "shop") draft = next;
      context.actions.replaceCommand(path, next);
      syncSummary();
      const budget = panel.querySelector<HTMLElement>('[data-testid="shop-merchant-budget"]');
      if (budget) budget.hidden = current().shopType === "buyOnly";
      refreshMessages();
    } },
  };
  const syncSummary = () => {
    const c = current();
    const mode = SHOP_TYPE_OPTIONS.find((option) => option.value === (c.shopType ?? "normal"))!.label;
    const project=store.getCurrent();const effective=SHOP_UI_PRESET_OPTIONS.find(option=>option.value===effectiveShopUiPreset(c,project))?.label;
    summary.textContent = `${mode} · 진열 상품 ${c.itemIds.length}개 · ${effective}${project.meta.oprnShopPreset?" (프로젝트 지정)":""} · 흥정 ${c.economy?.haggleEnabled ? "사용" : "사용 안 함"}`;
  };
  const refreshMessages = () => {
    const c = current();
    const values = [shopGreetingText(c.messageType, resolveTerms(store.getCurrent())), shopListHeaderText(c.messageType), shopBuyPromptText(c.messageType)];
    for (let index = 0; index < values.length; index++) {
      const node = panel.querySelector<HTMLElement>(`[data-testid="shop-message-example-${index}"]`);
      if (node) node.textContent = values[index]!;
    }
  };
  const renderTab = () => {
    const c = current();
    panel.replaceChildren();
    panel.dataset.shopTab = state.tab;
    for (const button of Array.from(tabs.children) as HTMLButtonElement[]) {
      const active = button.dataset.shopTab === state.tab;
      button.setAttribute("aria-selected", String(active)); button.tabIndex = active ? 0 : -1;
      if (active) panel.setAttribute("aria-labelledby", button.id);
    }
    if (state.tab === "goods") panel.append(createShopGoods(editContext, c, shopCatalogRecords(store.getCurrent()), state));
    else {
      const settings = el("div", { class: "shop-editor-settings", dataset: { testid: `shop-${state.tab}-panel` } });
      if (state.tab === "rules") {
        const budget = shopMerchantGoldField(editContext, c);
        budget.dataset.testid = "shop-merchant-budget"; budget.hidden = c.shopType === "buyOnly";
        settings.append(shopTypeGroup(editContext, c), shopUiPresetGroup(editContext, c), shopQuantityModeGroup(editContext, c), budget,
          shopEconomyCard(editContext, c), shopAdvancedCard(editContext, c));
      } else if (state.tab === "messages") {
        settings.append(shopMessageSelect(editContext, c));
        ["입장할 때", "상품을 고를 때", "구매할 때"].forEach((label, index) => settings.append(el("section", { class: "shop-message-example", children: [
          el("h4", { text: label }), el("p", { dataset: { testid: `shop-message-example-${index}` } }),
        ] })));
      } else settings.append(shopBranchOption(editContext, c), shopTransactionBranchControls(editContext, c),
        el("p", { class: "commerce-command-hint", text: "분기 안의 행동은 상점 설정을 적용한 뒤 이벤트 목록에서 편집합니다." }));
      panel.append(settings);
    }
    refreshMessages();
    // The host attaches its existing preview to the goods inspector after a tab change.
    wrap.dispatchEvent(new Event("shop-tab-change", { bubbles: true }));
  };
  const entries: readonly [ShopTab, string][] = [["goods", "상품"], ["rules", "거래 규칙"], ["messages", "상인 대사"], ["branches", "거래 후 행동"]];
  entries.forEach(([id, label], index) => {
    const button = el("button", { class: "shop-editor-tab", text: label,
      attrs: { type: "button", role: "tab", id: `${panelId}-${id}`, "aria-controls": panelId },
      dataset: { testid: `shop-tab-${id}`, shopTab: id },
      on: { click: () => { state.tab = id; renderTab(); } },
    });
    button.addEventListener("keydown", (event) => {
      const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!offset && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : (index + offset + entries.length) % entries.length;
      (tabs.children[next] as HTMLButtonElement).click();
      (tabs.children[next] as HTMLButtonElement).focus();
    });
    tabs.append(button);
  });
  wrap.append(summary, tabs, panel);
  syncSummary(); renderTab();
  return wrap;
}

function shopAdvancedCard(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const row = (label: string, input: HTMLElement) =>
    el("label", { class: "shop-advanced-row", children: [el("span", { class: "shop-advanced-label", text: label }), input] });

  const serviceSel = el("select", {
    class: "commerce-command-input",
    dataset: { testid: "shop-serviceKind" },
    children: [
      el("option", { text: "없음", attrs: { value: "" } }),
      el("option", { text: "수리", attrs: { value: "repair" } }),
      el("option", { text: "감정", attrs: { value: "appraisal" } }),
      el("option", { text: "전당포", attrs: { value: "pawn" } }),
    ],
  }) as HTMLSelectElement;
  serviceSel.title = "축제·행상은 이벤트 조건(fork)으로 감싸세요 — 이 상점이 닫혔을 때 보이지 않게 됩니다.";
  serviceSel.value = command.shopServiceKind ?? "";
  serviceSel.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      ...latestShop(context, command),
      shopServiceKind: (serviceSel.value || undefined) as ShopCommand["shopServiceKind"],
    });
  });

  const invest = el("input", {
    class: "commerce-command-input",
    attrs: { type: "number", min: "0", max: "5", step: "1", title: "투자 단계 0~5 — 진열 가격에 반영됩니다" },
    dataset: { testid: "shop-investmentLevel" },
  }) as HTMLInputElement;
  invest.value = String(command.investmentLevel ?? 0);
  invest.addEventListener("change", () => {
    const parsed = Math.max(0, Math.min(5, Math.floor(Number(invest.value) || 0)));
    invest.value = String(parsed);
    context.actions.replaceCommand(context.path, { ...latestShop(context, command), investmentLevel: parsed });
  });

  const mileage = el("input", {
    class: "commerce-command-input",
    attrs: { type: "number", min: "0", max: "0.1", step: "0.01", title: "마일리지 적립률 0~0.1" },
    dataset: { testid: "shop-mileageRate" },
  }) as HTMLInputElement;
  mileage.value = command.mileageRate === undefined ? "" : String(command.mileageRate);
  mileage.addEventListener("change", () => {
    const parsed = Number(mileage.value);
    context.actions.replaceCommand(context.path, {
      ...latestShop(context, command),
      mileageRate: mileage.value.trim() !== "" && Number.isFinite(parsed) ? Math.max(0, Math.min(0.1, parsed)) : undefined,
    });
  });

  const body = el("div", {
    class: "shop-advanced-body",
    dataset: { testid: "shop-advanced-body" },
    children: [row("서비스", serviceSel), row("투자 Lv", invest), row("마일리지", mileage)],
  });
  body.hidden = true;
  const toggle = el("button", {
    class: "shop-advanced-toggle",
    text: "고급",
    attrs: { type: "button", "aria-expanded": "false" },
    dataset: { testid: "shop-advanced-toggle" },
  }) as HTMLButtonElement;
  toggle.addEventListener("click", () => {
    const open = body.hidden;
    body.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  return el("div", { class: "shop-advanced", dataset: { testid: "shop-sab-extra" }, children: [toggle, body] });
}

function shopMerchantGoldField(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const input = document.createElement("input");
  input.setAttribute("aria-label", "상인의 매입 예산");
  input.type = "number";
  input.min = "0";
  input.step = "1";
  const hasGold = command.merchantGold !== undefined;
  input.value = hasGold ? String(command.merchantGold) : "";
  input.placeholder = "비우면 100G";
  input.className = "commerce-command-input shop-processing-merchant-gold-input";
  input.dataset.testid = "shop-merchant-gold";
  input.title = "상인이 플레이어 물품을 살 때 쓰는 소지금 (0이면 매입 불가, 판매 시 예산 소모) — 비우면 기본 100G";
  input.addEventListener("change", () => {
    const raw = input.value.trim();
    if (raw === "") {
      input.value = "";
      const { merchantGold: _omit, ...rest } = latestShop(context, command) as ShopCommand & Record<string, unknown>;
      void _omit;
      context.actions.replaceCommand(context.path, rest as ShopCommand);
      return;
    }
    const parsed = Number.parseInt(raw, 10);
    const merchantGold = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 999999)) : 100;
    input.value = String(merchantGold);
    context.actions.replaceCommand(context.path, { ...latestShop(context, command), merchantGold });
  });
  return el("div", {
    class: "commerce-command-field shop-processing-merchant-gold",
    children: [
      el("label", { class: "commerce-command-title", text: "상인의 매입 예산" }),
      el("div", {
        class: "shop-processing-merchant-gold-row",
        children: [input, el("span", { class: "shop-processing-merchant-gold-unit", text: "G" })],
      }),
    ],
  });
}


function shopQuantityModeGroup(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const current = command.quantityMode === "select" ? "select" : "single";
  const select = document.createElement("select");
  select.dataset.testid = "shop-quantity-mode";
  select.setAttribute("aria-label", "구매 수량");
  select.className = "commerce-command-input";
  for (const [value, label] of [
    ["single", "수량 1개씩"],
    ["select", "수량 선택 가능"],
  ] as const) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    if (value === current) opt.selected = true;
    select.append(opt);
  }
  select.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      ...latestShop(context, command),
      quantityMode: select.value === "select" ? "select" : "single"
    });
  });
  return el("div", {
    class: "commerce-command-field",
    children: [
      el("label", { class: "commerce-command-title", text: "구매 수량" }),
      select,
    ]
  });
}

function shopTypeGroup(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const current = shopTypeValue(command);
  const select = document.createElement("select");
  select.className = "commerce-command-input shop-processing-type-select";
  select.dataset.testid = "shop-type-select";
  select.setAttribute("aria-label", "거래 방식");
  for (const option of SHOP_TYPE_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label;
    opt.title = option.hint;
    opt.dataset.testid = `shop-type-${option.value}`;
    if (option.value === current) opt.selected = true;
    select.append(opt);
  }
  select.title = SHOP_TYPE_OPTIONS.find((entry) => entry.value === current)?.hint ?? "상점 종류";
  select.addEventListener("change", () => {
    const next = SHOP_TYPE_OPTIONS.find((entry) => entry.value === select.value) ?? SHOP_TYPE_OPTIONS[0]!;
    select.title = next.hint;
    context.actions.replaceCommand(context.path, withShopType(latestShop(context, command), next.value));
  });
  return el("div", {
    class: "commerce-command-field shop-processing-type-field",
    children: [
      el("label", { class: "commerce-command-title", text: "거래 방식" }),
      select,
    ],
  });
}

function shopUiPresetGroup(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const current = command.shopUiPreset ?? DEFAULT_SHOP_UI_PRESET;
  const select = document.createElement("select");
  select.className = "commerce-command-input shop-ui-preset-select";
  select.dataset.testid = "shop-ui-preset-select";
  select.setAttribute("aria-label", "상점 UI 프리셋");
  for (const option of SHOP_UI_PRESET_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = option.value; opt.textContent = option.label; opt.title = option.hint;
    if (option.value === current) opt.selected = true;
    select.append(opt);
  }
  select.title = SHOP_UI_PRESET_OPTIONS.find((option) => option.value === current)?.hint ?? "상점 UI 프리셋";
  select.addEventListener("change", () => {
    const preset = (select.value as ShopUiPreset) || DEFAULT_SHOP_UI_PRESET;
    select.title = SHOP_UI_PRESET_OPTIONS.find((option) => option.value === preset)?.hint ?? "상점 UI 프리셋";
    context.actions.replaceCommand(context.path, { ...latestShop(context, command), shopUiPreset: preset });
  });
  return el("div", { class: "commerce-command-field shop-ui-preset-field", children: [
    el("label", { class: "commerce-command-title", text: "상점 UI" }), select,
  ] });
}

function shopBranchOption(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = command.branchOnTransaction ?? false;
  checkbox.dataset.testid = "shop-branch-on-transaction";
  checkbox.addEventListener("change", () => {
    const latest = latestShop(context, command);
    context.actions.replaceCommand(context.path, {
      ...latest,
      branchOnTransaction: checkbox.checked,
      transactionBranch: checkbox.checked ? latest.transactionBranch ?? [] : latest.transactionBranch
    });
    refreshBranchControls(checkbox, context, command);
  });
  const failCheckbox = document.createElement("input");
  failCheckbox.type = "checkbox";
  failCheckbox.checked = command.branchOnFailedTransaction ?? false;
  failCheckbox.dataset.testid = "shop-branch-on-failed-transaction";
  failCheckbox.addEventListener("change", () => {
    const latest = latestShop(context, command);
    context.actions.replaceCommand(context.path, {
      ...latest,
      branchOnFailedTransaction: failCheckbox.checked,
      failedTransactionBranch: failCheckbox.checked ? latest.failedTransactionBranch ?? [] : latest.failedTransactionBranch
    });
    refreshBranchControls(failCheckbox, context, command);
  });
  const fieldset = el("fieldset", { class: "shop-processing-fieldset shop-processing-option shop-branch-card" });
  fieldset.append(
    el("legend", { text: "거래 후 행동" }),
    el("label", {
      class: "commerce-command-option shop-processing-check",
      children: [checkbox, el("span", { text: "물건을 사고팔았을 때" })],
    }),
    el("label", {
      class: "commerce-command-option shop-processing-check",
      children: [failCheckbox, el("span", { text: "거래 없이 나왔을 때" })],
    })
  );
  return fieldset;
}

const SHOP_FAILED_BRANCH_INDEX = SHOP_FAILED_TRANSACTION_BRANCH_INDEX;

/** 미리보기는 런타임과 같은 함수를 부른다 — 문구를 두 곳에 적으면 반드시 갈라진다. */
function shopMessagePreview(messageType: ShopMessageType): string {
  return shopGreetingText(messageType, resolveTerms(store.getCurrent()));
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
  const failedBranch = command.branchOnFailedTransaction ?? false;
  const hiddenClass = command.branchOnTransaction || failedBranch ? "" : " is-hidden";
  const txHidden = command.branchOnTransaction ? "" : " is-hidden";
  const failHidden = failedBranch ? "" : " is-hidden";
  const failedSel = commandKindSelect("text");
  const failedAdd = el("button", {
    class: "btn shop-processing-branch-add",
    text: "추가",
    dataset: { testid: "shop-add-failed-branch-command" },
    attrs: { type: "button" },
    on: { click: () => {
      const n = newCommand(selectedOptionValue(failedSel, COMMAND_KIND_OPTIONS, "text"));
      context.actions.addCommand([...context.path, SHOP_FAILED_BRANCH_INDEX], n);
    }},
  });
  return el("div", {
    class: `shop-processing-branch-controls${hiddenClass}`,
    dataset: { testid: "shop-transaction-branch-controls" },
    // 두 분기 줄은 「제목 + (명령 select | 추가)」로 모양이 같다. 예전에는 실패 분기만
    // 제목까지 같은 행에 넣어 select 와 버튼 폭이 위아래로 어긋나 보였다.
    children: [
      el("div", {
        class: `shop-processing-branch-head${txHidden}`,
        children: [el("span", { class: "shop-processing-branch-title", text: "물건을 사고팔았을 때" })],
      }),
      el("div", {
        class: `shop-processing-branch-row${txHidden}`,
        dataset: { testid: "shop-transaction-branch-row" },
        children: [branchSel, add],
      }),
      el("div", {
        class: `shop-processing-branch-head${failHidden}`,
        children: [el("span", { class: "shop-processing-branch-title", text: "거래 없이 나왔을 때" })],
      }),
      el("div", {
        class: `shop-processing-branch-row shop-processing-failed-branch-row${failHidden}`,
        dataset: { testid: "shop-failed-branch-row" },
        children: [failedSel, failedAdd],
      }),
    ],
  });
}

function shopMessageSelect(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const current = messageTypeValue(command);
  const select = document.createElement("select");
  select.dataset.testid = "shop-message-type";
  select.setAttribute("aria-label", "대사 유형");
  select.className = "commerce-command-input shop-processing-message-select";
  for (const option of SHOP_MESSAGE_OPTIONS) {
    const optionNode = document.createElement("option");
    optionNode.value = option.value;
    optionNode.textContent = option.label;
    optionNode.title = shopMessagePreview(option.value);
    if (option.value === current) optionNode.selected = true;
    select.append(optionNode);
  }
  // 옵션을 붙인 뒤에 값을 잡는다 — 빈 select 에 value 를 쓰면 무시돼 저장값이 안 보였다.
  select.value = current;
  select.title = shopMessagePreview(current);
  select.addEventListener("change", () => {
    const next = selectedMessageType(select.value);
    select.title = shopMessagePreview(next);
    context.actions.replaceCommand(context.path, { ...latestShop(context, command), messageType: next });
  });
  // 컨트롤 하나짜리는 fieldset+legend 가 아니라 다른 레일 항목과 같은 label+컨트롤로 간다 —
  // fieldset 은 관련 컨트롤 묶음용이고, 섞어 쓰면 레일에 테두리 박스가 들쭉날쭉 생긴다.
  return el("div", {
    class: "commerce-command-field shop-processing-message",
    children: [el("label", { class: "commerce-command-title", text: "대사 유형" }), select],
  });
}


function refreshBranchControls(from: HTMLElement, context: CommandEditContext, command: ShopCommand): void {
  const old = from.closest(".shop-editor-settings")?.querySelector('[data-testid="shop-transaction-branch-controls"]');
  old?.replaceWith(shopTransactionBranchControls(context, latestShop(context, command)));
}
function shopTypeValue(command: ShopCommand): ShopType { return command.shopType ?? "normal"; }
function withShopType(command: ShopCommand, shopType: ShopType): ShopCommand {
  const { allowSell: _legacyAllowSell, ...rest } = command as ShopCommand & { allowSell?: boolean };
  void _legacyAllowSell;
  return { ...rest, shopType };
}
function messageTypeValue(command: ShopCommand): ShopMessageType { return command.messageType ?? "welcome"; }
function selectedMessageType(value: string): ShopMessageType { return SHOP_MESSAGE_OPTIONS.find((entry) => entry.value === value)?.value ?? "welcome"; }
