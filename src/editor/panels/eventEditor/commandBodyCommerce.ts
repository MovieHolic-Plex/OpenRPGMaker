import { newCommand } from "@/editor/eventActions";
import { INN_NOT_ENOUGH_BRANCH_INDEX, SHOP_TRANSACTION_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import type { Command, ItemId, ShopMessageType, ShopType } from "@/project/types";
import type { ItemRecord, ItemType } from "@/project/types/database";
import { commandKindSelect, selectedOptionValue } from "./dom";
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
    class: "commerce-command-body shop-processing-command-body shop-processing-v2",
    dataset: { testid: "shop-command-body" },
  });
  const emptyWarn =
    command.itemIds.length === 0
      ? el("div", {
          class: "shop-processing-empty-banner",
          dataset: { testid: "shop-empty-banner" },
          text: "상품이 없습니다. 왼쪽 목록에서 아이템을 추가하세요. 빈 상점은 플레이에서 목록이 비어 보입니다.",
        })
      : null;
  const main = el("div", {
    class: "shop-processing-main",
    children: [
      shopIntentCard(),
      ...(emptyWarn ? [emptyWarn] : []),
      shopPresetsBar(context, command, project.database.items),
      shopItemsPanel(context, command, project.database.items),
      shopTransactionBranchControls(context, command),
    ],
  });
  const side = el("div", {
    class: "shop-processing-side",
    children: [shopSettingsCard(context, command)],
  });
  wrap.append(
    el("div", { class: "shop-processing-layout", children: [main, side] }),
    selectedSummary(project.database.items, command.itemIds)
  );
  return wrap;
}

function shopIntentCard(): HTMLElement {
  return el("div", {
    class: "shop-processing-intent shop-processing-intent-compact",
    dataset: { testid: "shop-intent" },
    children: [
      el("div", { class: "shop-processing-intent-title", text: "상점 처리" }),
      el("div", {
        class: "shop-processing-intent-flow",
        text: "판매 목록 → 규칙(종류·소지금) → 미리보기",
      }),
    ],
  });
}

type ShopPreset = {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly itemIds: readonly string[];
  readonly shopType?: ShopType;
};

const SHOP_PRESETS: readonly ShopPreset[] = [
  {
    id: "general",
    label: "잡화점",
    title: "회복약·마력약·해독초",
    itemIds: ["item_potion", "item_ether", "item_antidote"],
    shopType: "normal",
  },
  {
    id: "season-seeds",
    label: "시즌 씨앗",
    title: "감자·딸기·토마토·옥수수 씨앗",
    itemIds: ["item_potato_seed", "item_strawberry_seed", "item_tomato_seed", "item_corn_seed"],
    shopType: "buyOnly",
  },
  {
    id: "friendly",
    label: "프렌들리숍",
    title: "구매 전용 · 포획 구슬·회복약",
    itemIds: ["item_capture_orb", "item_potion", "item_antidote"],
    shopType: "buyOnly",
  },
];

function shopPresetsBar(
  context: CommandEditContext,
  command: ShopCommand,
  catalog: readonly ItemRecord[]
): HTMLElement {
  const catalogIds = new Set(catalog.map((item) => item.id));
  const row = el("div", {
    class: "shop-processing-presets",
    dataset: { testid: "shop-presets" },
  });
  row.append(el("span", { class: "shop-processing-presets-label", text: "프리셋" }));
  for (const preset of SHOP_PRESETS) {
    const matched = preset.itemIds.filter((id) => catalogIds.has(id));
    const missingTitle = preset.title + " (이 프로젝트 DB에 해당 아이템 없음)";
    const okTitle = preset.title + " · " + String(matched.length) + "개 적용";
    const button = el("button", {
      class: "btn small shop-processing-preset-btn",
      text: preset.label,
      attrs: {
        type: "button",
        title: matched.length === 0 ? missingTitle : okTitle,
      },
      dataset: { testid: "shop-preset-" + preset.id },
      on: {
        click: () => {
          if (matched.length === 0) return;
          const shopType = preset.shopType ?? command.shopType ?? "normal";
          context.actions.replaceCommand(context.path, {
            ...command,
            itemIds: [...matched],
            shopType,
            allowSell: shopType !== "buyOnly",
            stock: (command.stock ?? []).filter((entry) => matched.includes(entry.itemId)),
          });
        },
      },
    }) as HTMLButtonElement;
    if (matched.length === 0) button.disabled = true;
    row.append(button);
  }
  return row;
}

export function innBody(context: CommandEditContext, command: InnCommand): HTMLElement {
  let draft: InnCommand = {
    kind: "inn",
    price: Math.max(0, Math.trunc(command.price) || 0),
    note: command.note,
    question: command.question,
    recoverMp: command.recoverMp,
    advanceToMorning: command.advanceToMorning,
    restDurationMs: command.restDurationMs,
    wakeDurationMs: command.wakeDurationMs,
    branchOnNotEnoughGold: command.branchOnNotEnoughGold,
    notEnoughBranch: command.notEnoughBranch,
  };

  const wrap = el("div", {
    class: "commerce-command-body commerce-command-body-inline inn-command-body",
    dataset: { testid: "inn-command-body" },
  });

  const price = document.createElement("input");
  price.type = "number";
  price.min = "0";
  price.step = "1";
  price.value = String(draft.price);
  price.title = "여관 요금";
  price.dataset.testid = "inn-price-input";
  price.className = "commerce-command-input";

  const note = document.createElement("input");
  note.type = "text";
  note.value = draft.note ?? "";
  note.placeholder = "어서 오세요. 편히 쉬어가시겠어요?";
  note.title = "인사말";
  note.dataset.testid = "inn-note-input";
  note.className = "commerce-command-input";

  const question = document.createElement("input");
  question.type = "text";
  question.value = draft.question ?? "";
  question.placeholder = "요금 기반 기본 질문";
  question.title = "숙박 질문";
  question.dataset.testid = "inn-question-input";
  question.className = "commerce-command-input";

  const restDuration = document.createElement("input");
  restDuration.type = "number";
  restDuration.min = "0";
  restDuration.step = "50";
  restDuration.value = String(draft.restDurationMs ?? 500);
  restDuration.title = "암전 연출(ms)";
  restDuration.dataset.testid = "inn-rest-duration-input";
  restDuration.className = "commerce-command-input";

  const wakeDuration = document.createElement("input");
  wakeDuration.type = "number";
  wakeDuration.min = "0";
  wakeDuration.step = "50";
  wakeDuration.value = String(draft.wakeDurationMs ?? 750);
  wakeDuration.title = "기상 메시지(ms)";
  wakeDuration.dataset.testid = "inn-wake-duration-input";
  wakeDuration.className = "commerce-command-input";

  const priceHint = el("span", {
    class: "commerce-command-hint",
    dataset: { testid: "inn-price-hint" },
    text: innPriceHint(draft),
  });

  const previewNote = el("div", {
    class: "inn-command-dialog-note",
    dataset: { testid: "inn-dialog-note" },
    text: innNoteText(draft),
  });
  const previewQuestion = el("div", {
    class: "inn-command-dialog-question",
    dataset: { testid: "inn-dialog-question" },
    text: innQuestionText(draft),
  });

  const commit = (next: InnCommand) => {
    draft = {
      kind: "inn",
      price: Math.max(0, Math.trunc(next.price) || 0),
      note: cleanOptionalText(next.note),
      question: cleanOptionalText(next.question),
      recoverMp: next.recoverMp === false ? false : undefined,
      advanceToMorning: next.advanceToMorning === true ? true : undefined,
      restDurationMs: normalizeDuration(next.restDurationMs, 500),
      wakeDurationMs: normalizeDuration(next.wakeDurationMs, 750),
      branchOnNotEnoughGold: next.branchOnNotEnoughGold === true ? true : undefined,
      notEnoughBranch: next.branchOnNotEnoughGold ? next.notEnoughBranch ?? [] : next.notEnoughBranch,
    };
    price.value = String(draft.price);
    note.value = draft.note ?? "";
    question.value = draft.question ?? "";
    restDuration.value = String(draft.restDurationMs ?? 500);
    wakeDuration.value = String(draft.wakeDurationMs ?? 750);
    priceHint.textContent = innPriceHint(draft);
    previewNote.textContent = innNoteText(draft);
    previewQuestion.textContent = innQuestionText(draft);
    syncPresetActive();
    branchControls.classList.toggle("is-hidden", !draft.branchOnNotEnoughGold);
    context.actions.replaceCommand(context.path, draft);
  };

  const onPriceInput = () => commit({ ...draft, price: Number.parseInt(price.value, 10) || 0 });
  price.addEventListener("change", onPriceInput);
  price.addEventListener("input", onPriceInput);
  note.addEventListener("change", () => commit({ ...draft, note: note.value }));
  note.addEventListener("input", () => commit({ ...draft, note: note.value }));
  question.addEventListener("change", () => commit({ ...draft, question: question.value }));
  question.addEventListener("input", () => commit({ ...draft, question: question.value }));
  restDuration.addEventListener("change", () =>
    commit({ ...draft, restDurationMs: Number.parseInt(restDuration.value, 10) || 0 })
  );
  wakeDuration.addEventListener("change", () =>
    commit({ ...draft, wakeDurationMs: Number.parseInt(wakeDuration.value, 10) || 0 })
  );

  const presets = el("div", {
    class: "inn-command-presets",
    dataset: { testid: "inn-price-presets" },
  });
  const presetButtons: HTMLButtonElement[] = [];
  for (const preset of INN_PRICE_PRESETS) {
    const button = el("button", {
      class: "btn small inn-command-preset",
      text: preset.label,
      attrs: { type: "button", title: preset.title },
      dataset: { testid: `inn-price-preset-${preset.price}`, innPrice: String(preset.price) },
      on: {
        click: () => commit({ ...draft, price: preset.price }),
      },
    }) as HTMLButtonElement;
    presetButtons.push(button);
    presets.append(button);
  }
  const syncPresetActive = () => {
    for (const button of presetButtons) {
      button.classList.toggle("active", Number(button.dataset.innPrice) === draft.price);
    }
  };
  syncPresetActive();

  const recoverMp = document.createElement("input");
  recoverMp.type = "checkbox";
  recoverMp.checked = draft.recoverMp !== false;
  recoverMp.dataset.testid = "inn-recover-mp";
  recoverMp.addEventListener("change", () => commit({ ...draft, recoverMp: recoverMp.checked ? undefined : false }));

  const advanceMorning = document.createElement("input");
  advanceMorning.type = "checkbox";
  advanceMorning.checked = draft.advanceToMorning === true;
  advanceMorning.dataset.testid = "inn-advance-morning";
  advanceMorning.addEventListener("change", () =>
    commit({ ...draft, advanceToMorning: advanceMorning.checked ? true : undefined })
  );

  const branchNotEnough = document.createElement("input");
  branchNotEnough.type = "checkbox";
  branchNotEnough.checked = draft.branchOnNotEnoughGold === true;
  branchNotEnough.dataset.testid = "inn-branch-not-enough";
  branchNotEnough.addEventListener("change", () =>
    commit({
      ...draft,
      branchOnNotEnoughGold: branchNotEnough.checked ? true : undefined,
      notEnoughBranch: branchNotEnough.checked ? draft.notEnoughBranch ?? [] : draft.notEnoughBranch,
    })
  );

  const dialogMock = el("div", {
    class: "inn-command-dialog-mock",
    dataset: { testid: "inn-dialog-mock" },
    children: [
      el("div", { class: "inn-command-dialog-title", text: "여관" }),
      previewNote,
      previewQuestion,
      el("div", {
        class: "inn-command-dialog-actions",
        children: [
          el("span", { class: "inn-command-dialog-choice selected", text: "예" }),
          el("span", { class: "inn-command-dialog-choice", text: "아니오" }),
        ],
      }),
    ],
  });

  const branchControls = innNotEnoughBranchControls(context, draft);

  wrap.append(
    el("div", {
      class: "inn-command-card",
      children: [
        el("div", {
          class: "commerce-command-field",
          children: [
            el("label", { class: "commerce-command-title", text: "여관 요금" }),
            price,
            priceHint,
          ],
        }),
        presets,
        el("div", {
          class: "commerce-command-field",
          children: [
            el("label", { class: "commerce-command-title", text: "인사말" }),
            note,
          ],
        }),
        el("div", {
          class: "commerce-command-field",
          children: [
            el("label", { class: "commerce-command-title", text: "질문" }),
            question,
          ],
        }),
        el("div", {
          class: "inn-command-options",
          dataset: { testid: "inn-options" },
          children: [
            el("label", {
              class: "commerce-command-option",
              children: [recoverMp, el("span", { text: "MP도 회복" })],
            }),
            el("label", {
              class: "commerce-command-option",
              children: [advanceMorning, el("span", { text: "아침으로 시간 이동" })],
            }),
            el("label", {
              class: "commerce-command-option",
              children: [branchNotEnough, el("span", { text: "골드 부족 시 분기" })],
            }),
          ],
        }),
        el("div", {
          class: "inn-command-timing",
          dataset: { testid: "inn-timing" },
          children: [
            el("div", {
              class: "commerce-command-field",
              children: [
                el("label", { class: "commerce-command-title", text: "암전(ms)" }),
                restDuration,
              ],
            }),
            el("div", {
              class: "commerce-command-field",
              children: [
                el("label", { class: "commerce-command-title", text: "기상(ms)" }),
                wakeDuration,
              ],
            }),
          ],
        }),
        el("p", {
          class: "commerce-command-hint",
          text: "숙박 시 골드 차감 후 파티를 회복합니다. 부족 분기는 메인 목록에 펼쳐집니다.",
        }),
      ],
    }),
    dialogMock,
    branchControls
  );
  return wrap;
}

const INN_PRICE_PRESETS = [
  { price: 0, label: "무료", title: "0G · 무료 숙박" },
  { price: 10, label: "10G", title: "저렴한 여관" },
  { price: 20, label: "20G", title: "기본 요금" },
  { price: 50, label: "50G", title: "고급 여관" },
  { price: 100, label: "100G", title: "최고급 숙소" },
] as const;

function innNotEnoughBranchControls(context: CommandEditContext, command: InnCommand): HTMLElement {
  const branchSel = commandKindSelect("text");
  const add = el("button", {
    class: "btn shop-processing-branch-add",
    text: "추가",
    dataset: { testid: "inn-add-not-enough-branch-command" },
    attrs: { type: "button" },
    on: {
      click: () => {
        const next = newCommand(selectedOptionValue(branchSel, COMMAND_KIND_OPTIONS, "text"));
        context.actions.addCommand([...context.path, INN_NOT_ENOUGH_BRANCH_INDEX], next);
      },
    },
  });
  const hiddenClass = command.branchOnNotEnoughGold ? "" : " is-hidden";
  return el("div", {
    class: `shop-processing-branch-controls inn-not-enough-branch-controls${hiddenClass}`,
    dataset: { testid: "inn-not-enough-branch-controls" },
    children: [
      el("div", {
        class: "shop-processing-branch-head",
        children: [
          el("span", { class: "shop-processing-branch-title", text: "골드 부족 분기" }),
          el("span", {
            class: "commerce-command-hint",
            text: "돈이 부족할 때 실행",
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

function innPriceHint(command: Pick<InnCommand, "price" | "recoverMp">): string {
  const recover = command.recoverMp === false ? "HP만 회복" : "파티 전원 회복";
  if (command.price <= 0) return `0G면 무료 숙박 · ${recover}`;
  return `숙박 시 ${command.price.toLocaleString("ko-KR")}G 차감 · ${recover}`;
}

function innNoteText(command: Pick<InnCommand, "note">): string {
  return command.note?.trim() || "어서 오세요. 편히 쉬어가시겠어요?";
}

function innQuestionText(command: Pick<InnCommand, "price" | "question">): string {
  if (command.question?.trim()) return command.question.trim();
  if (command.price <= 0) return "하룻밤 묵으시겠습니까? (무료)";
  return `하룻밤 묵는 데 ${command.price.toLocaleString("ko-KR")} G 입니다. 묵으시겠습니까?`;
}

function cleanOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeDuration(value: number | undefined, fallback: number): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const next = Math.max(0, Math.min(10_000, Math.trunc(value)));
  return next === fallback ? undefined : next;
}

function shopSettingsCard(context: CommandEditContext, command: ShopCommand): HTMLElement {
  return el("div", {
    class: "shop-processing-settings shop-processing-settings-compact",
    children: [
      shopTypeGroup(context, command),
      shopQuantityModeGroup(context, command),
      shopMessageSelect(context, command),
      shopMerchantGoldField(context, command),
      shopBranchOption(context, command),
      shopStockSummary(command),
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


function shopQuantityModeGroup(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const current = command.quantityMode === "select" ? "select" : "single";
  const select = document.createElement("select");
  select.dataset.testid = "shop-quantity-mode";
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
      ...command,
      quantityMode: select.value === "select" ? "select" : "single",
    });
  });
  return el("div", {
    class: "commerce-command-field",
    children: [
      el("label", { class: "commerce-command-title", text: "구매 수량" }),
      select,
      el("span", { class: "commerce-command-hint", text: "select면 플레이어가 수량을 고릅니다." }),
    ],
  });
}

function shopStockSummary(command: ShopCommand): HTMLElement {
  const stock = command.stock ?? [];
  const text =
    stock.length === 0
      ? "계절 재고(stock) 없음 — 판매 목록 행을 선택한 뒤 아래에서 계절·가격을 넣을 수 있습니다."
      : `계절 재고 ${stock.length}건. 행 선택 후 상세에서 계절 칩·가격 오버라이드를 편집하세요.`;
  return el("div", {
    class: "commerce-command-hint",
    text,
    dataset: { testid: "shop-stock-summary" },
  });
}

function shopTypeGroup(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const current = shopTypeValue(command);
  const select = document.createElement("select");
  select.className = "commerce-command-input shop-processing-type-select";
  select.dataset.testid = "shop-type-select";
  select.title = "상점 종류";
  for (const option of SHOP_TYPE_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = `${option.label} — ${option.hint}`;
    opt.dataset.testid = `shop-type-${option.value}`;
    if (option.value === current) opt.selected = true;
    select.append(opt);
  }
  // e2e/구 UI 호환: 숨은 radio 유지 (shop-type-normal 등)
  const legacy = el("div", {
    class: "shop-processing-type-legacy",
    attrs: { "aria-hidden": "true" },
  });
  for (const option of SHOP_TYPE_OPTIONS) {
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = `shop-type-${context.path.join("-") || "root"}`;
    radio.value = option.value;
    radio.checked = current === option.value;
    radio.dataset.testid = `shop-type-${option.value}`;
    radio.className = "shop-processing-segment-input";
    radio.tabIndex = -1;
    legacy.append(radio);
  }
  select.addEventListener("change", () => {
    const next = SHOP_TYPE_OPTIONS.find((entry) => entry.value === select.value)?.value ?? "normal";
    for (const radio of legacy.querySelectorAll<HTMLInputElement>("input[type=radio]")) {
      radio.checked = radio.value === next;
    }
    context.actions.replaceCommand(context.path, withShopType(command, next));
  });
  return el("div", {
    class: "commerce-command-field shop-processing-type-field",
    children: [
      el("label", { class: "commerce-command-title", text: "상점 종류" }),
      select,
      legacy,
    ],
  });
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
  const availableItems = items.filter((item) => !command.itemIds.includes(item.id));

  const commitItems = (itemIds: readonly ItemId[]) => {
    context.actions.replaceCommand(context.path, { ...command, itemIds: [...itemIds] });
  };

  const selectedList = shopItemList("shop-selected-items", selectedItems, {
    emptyText: "판매할 아이템을 오른쪽에서 추가하세요.",
    onActivate: (itemId) => commitItems(command.itemIds.filter((id) => id !== itemId)),
  });
  const availableList = shopItemList("shop-available-items", availableItems, {
    emptyText: "추가할 아이템이 없습니다.",
    onActivate: (itemId) => commitItems(addItemId(command.itemIds, itemId)),
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

  // 네이티브 select 변경(e2e selectOption)도 커밋에 연결
  availableList.select.addEventListener("change", () => {
    highlightListSelection(availableList.root, availableList.select.value);
  });
  selectedList.select.addEventListener("change", () => {
    highlightListSelection(selectedList.root, selectedList.select.value);
  });

  const fieldset = el("fieldset", { class: "shop-processing-fieldset shop-processing-items" });
  fieldset.append(
    el("legend", { text: "① 판매 목록" }),
    el("p", {
      class: "commerce-command-hint shop-processing-items-hint",
      text:
        command.itemIds.length === 0
          ? "첫 상품을 추가하세요. 행 클릭=선택, 더블클릭 또는 버튼으로 추가/제거."
          : "행 클릭=선택 · 더블클릭=추가/제거 · ▲▼=순서",
    })
  );
  if (items.length === 0) {
    fieldset.append(
      el("div", {
        class: "commerce-command-empty",
        text: "등록된 아이템이 없습니다. 데이터베이스에서 아이템을 추가하세요.",
      })
    );
    return fieldset;
  }

  const detail = itemDetailPanel(selectedItems[0] ?? availableItems[0] ?? null, {
    command,
    onStockChange: (nextStock) => {
      context.actions.replaceCommand(context.path, { ...command, stock: nextStock });
    },
  });
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
      class: "shop-processing-item-grid",
      children: [
        listColumn("판매 중", selectedItems.length, selectedList.root, "shop-selected-column"),
        controls,
        listColumn("추가 가능", availableItems.length, availableList.root, "shop-available-column"),
      ],
    }),
    detail.root
  );
  return fieldset;
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
  options: { readonly emptyText: string; readonly onActivate: (itemId: string) => void }
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
        })
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

function itemDetailPanel(
  initial: ItemRecord | null,
  options?: {
    readonly command: ShopCommand;
    readonly onStockChange: (stock: NonNullable<ShopCommand["stock"]>) => void;
  }
): { root: HTMLElement; render: (item: ItemRecord | null) => void } {
  const project = store.getCurrent();
  const root = el("div", {
    class: "shop-processing-item-detail",
    dataset: { testid: "shop-item-detail" },
  });

  const render = (item: ItemRecord | null) => {
    root.replaceChildren();
    if (!item) {
      root.append(
        el("div", {
          class: "shop-processing-item-detail-empty",
          text: "아이템을 선택하면 상세 정보와 계절 재고를 편집할 수 있습니다.",
        })
      );
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
      })
    );

    if (!options) return;
    const command = options.command;
    if (!command.itemIds.includes(item.id)) {
      root.append(
        el("p", {
          class: "commerce-command-hint",
          text: "판매 목록에 추가된 아이템만 계절 재고를 편집할 수 있습니다.",
        })
      );
      return;
    }

    const entry = (command.stock ?? []).find((row) => row.itemId === item.id);
    const seasons = new Set(entry?.seasons ?? []);
    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.min = "0";
    priceInput.step = "1";
    priceInput.className = "commerce-command-input shop-stock-price-input";
    priceInput.dataset.testid = "shop-stock-price-override";
    priceInput.placeholder = "DB " + String(item.price);
    if (typeof entry?.priceOverride === "number") priceInput.value = String(entry.priceOverride);

    const seasonOrder = ["spring", "summer", "fall", "winter"] as const;
    const seasonLabels: Record<(typeof seasonOrder)[number], string> = {
      spring: "봄",
      summer: "여름",
      fall: "가을",
      winter: "겨울",
    };

    const commitStock = () => {
      const nextSeasons = seasonOrder.filter((s) => seasons.has(s));
      const raw = priceInput.value.trim();
      const parsed = raw === "" ? undefined : Number.parseInt(raw, 10);
      const priceOverride =
        parsed !== undefined && Number.isFinite(parsed) ? Math.max(0, parsed) : undefined;
      const others = (command.stock ?? []).filter((row) => row.itemId !== item.id);
      const hasAny = nextSeasons.length > 0 || priceOverride !== undefined;
      const nextStock = hasAny
        ? [
            ...others,
            {
              itemId: item.id,
              ...(nextSeasons.length > 0 ? { seasons: [...nextSeasons] } : {}),
              ...(priceOverride !== undefined ? { priceOverride } : {}),
            },
          ]
        : others;
      options.onStockChange(nextStock);
    };

    priceInput.addEventListener("change", commitStock);

    const chips = el("div", {
      class: "shop-stock-season-chips",
      dataset: { testid: "shop-stock-season-chips" },
    });
    for (const season of seasonOrder) {
      const active = seasons.has(season);
      chips.append(
        el("button", {
          class: "btn small shop-stock-season-chip" + (active ? " is-active" : ""),
          text: seasonLabels[season],
          attrs: { type: "button", "aria-pressed": active ? "true" : "false" },
          dataset: { testid: "shop-stock-season-" + season, season },
          on: {
            click: (event) => {
              const btn = event.currentTarget as HTMLButtonElement;
              if (seasons.has(season)) seasons.delete(season);
              else seasons.add(season);
              const on = seasons.has(season);
              btn.classList.toggle("is-active", on);
              btn.setAttribute("aria-pressed", on ? "true" : "false");
              commitStock();
            },
          },
        })
      );
    }

    root.append(
      el("div", {
        class: "shop-stock-editor",
        dataset: { testid: "shop-stock-editor" },
        children: [
          el("div", { class: "shop-stock-editor-title", text: "계절 재고 · 가격 오버라이드" }),
          el("p", {
            class: "commerce-command-hint",
            text: "계절을 하나도 고르지 않으면 사계절 판매. 가격 칸을 비우면 DB 가격을 씁니다.",
          }),
          chips,
          el("label", {
            class: "shop-stock-price-field",
            children: [el("span", { text: "가격 오버라이드 (G)" }), priceInput],
          }),
        ],
      })
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
