import { GENERAL_STORE_PRESET_ITEM_IDS } from "@/editor/eventCommands/quickAuthoringDefaults";
import { newCommand } from "@/editor/eventActions";
import { INN_NOT_ENOUGH_BRANCH_INDEX, SHOP_TRANSACTION_BRANCH_INDEX, SHOP_FAILED_TRANSACTION_BRANCH_INDEX } from "@/editor/eventCommandPaths";
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

type ShopEditContext = CommandEditContext;

function latestShop(context: ShopEditContext, fallback: ShopCommand): ShopCommand {
  const current = context.getCurrentCommand?.();
  return current?.kind === "shop" ? current : fallback;
}
type ShopGoodsSection = {
  /** 툴바에 얹는 종류·검색 필터 묶음. */
  readonly filters: HTMLElement;
  /** 판매 중 / 안 담음 두 그룹을 담은, 이 창에서 유일한 스크롤러. */
  readonly goods: HTMLElement;
  readonly detail: HTMLElement;
};

/** 재빌드를 건너 살려야 하는 목록 상태. */
type ShopGoodsView = {
  readonly scrollTop: number;
  readonly searchQuery: string;
  readonly typeFilter: string;
};

const SHOP_SEARCH_DEBOUNCE_MS = 120;

const SEASON_ORDER = ["spring", "summer", "fall", "winter"] as const;
type ShopSeason = (typeof SEASON_ORDER)[number];
const SEASON_LABELS: Record<ShopSeason, string> = {
  spring: "봄",
  summer: "여름",
  fall: "가을",
  winter: "겨울",
};

const SHOP_TYPE_OPTIONS: readonly ShopTypeOption[] = [
  { value: "normal", label: "구매/판매", hint: "플레이어가 사고팔 수 있습니다" },
  { value: "buyOnly", label: "구매 전용", hint: "플레이어만 구매" },
  { value: "sellOnly", label: "판매 전용", hint: "플레이어만 판매" },
];

const SHOP_MESSAGE_OPTIONS: readonly ShopMessageOption[] = [
  { value: "welcome", label: "인사말" },
  { value: "business", label: "둘러보기" },
  { value: "direct", label: "고르기" },
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
  const items = project.database.items;
  const wrap = el("div", {
    class: "commerce-command-body shop-processing-command-body shop-processing-v2 cream-command-form",
    dataset: { testid: "shop-command-body" },
  });
  const section = shopGoodsSection(context, command, items);
  const main = el("div", {
    class: "shop-processing-main",
    children: [
      shopToolbar(context, command, items, shopHeaderBadge(command), section.filters),
      section.goods,
      section.detail,
      shopTransactionBranchControls(context, command),
    ],
  });
  const side = el("div", {
    class: "shop-processing-side",
    dataset: { testid: "shop-options-rail" },
    children: [shopSettingsCard(context, command), shopAdvancedCard(context, command)],
  });
  wrap.append(el("div", { class: "shop-processing-layout", children: [main, side] }));
  return wrap;
}

/** 진열 상황 한 칩 — 개수, 빈 상점, itemIds 에 없는 유령 재고를 알린다. */
function shopHeaderBadge(command: ShopCommand): HTMLElement {
  const orphanCount = (command.stock ?? []).filter((row) => !command.itemIds.includes(row.itemId)).length;
  const state =
    command.itemIds.length === 0
      ? ({ kind: "empty", text: "빈 상점" } as const)
      : orphanCount > 0
        ? ({ kind: "warn", text: `유령 재고 ${orphanCount}` } as const)
        : ({ kind: "ok", text: `${command.itemIds.length}개` } as const);
  return el("span", {
    class: `shop-header-badge shop-header-badge-${state.kind}`,
    dataset: { testid: "shop-header-badge" },
    text: state.text,
    attrs: { title: state.kind === "empty" ? "빈 상점은 플레이에서 목록이 비어 보입니다" : state.text },
  });
}

/** 진열 상황·프리셋·필터를 한 줄로 모은 상단 툴바 — 설명 문단 없이 컨트롤만 둔다. */
function shopToolbar(
  context: CommandEditContext,
  command: ShopCommand,
  items: readonly ItemRecord[],
  badge: HTMLElement,
  filters: HTMLElement
): HTMLElement {
  return el("div", {
    class: "shop-processing-intent shop-intent-header shop-processing-toolbar",
    dataset: { testid: "shop-intent-card" },
    children: [
      badge,
      shopPresetsBar(context, command, items),
      filters,
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
    itemIds: GENERAL_STORE_PRESET_ITEM_IDS,
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
          const latest = latestShop(context, command);
          const shopType = preset.shopType ?? latest.shopType ?? "normal";
          context.actions.replaceCommand(context.path, {
            ...latest,
            itemIds: [...matched],
            shopType,
            stock: (latest.stock ?? []).filter((entry) => matched.includes(entry.itemId)),
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
    price: normalizeInnPrice(command.price),
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
    class: "commerce-command-body commerce-command-body-inline inn-command-body cream-command-form",
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
  restDuration.title = "암전 연출";
  restDuration.dataset.testid = "inn-rest-duration-input";
  restDuration.className = "commerce-command-input";

  const wakeDuration = document.createElement("input");
  wakeDuration.type = "number";
  wakeDuration.min = "0";
  wakeDuration.step = "50";
  wakeDuration.value = String(draft.wakeDurationMs ?? 750);
  wakeDuration.title = "기상 메시지";
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
      price: normalizeInnPrice(next.price),
      note: cleanOptionalText(next.note),
      question: cleanOptionalText(next.question),
      recoverMp: next.recoverMp === false ? false : undefined,
      advanceToMorning: next.advanceToMorning === true ? true : undefined,
      restDurationMs: normalizeDuration(next.restDurationMs, 500),
      wakeDurationMs: normalizeDuration(next.wakeDurationMs, 750),
      branchOnNotEnoughGold: next.branchOnNotEnoughGold === true ? true : undefined,
      notEnoughBranch: next.branchOnNotEnoughGold ? next.notEnoughBranch ?? [] : next.notEnoughBranch,
    };
    price.value = typeof draft.price === "number" ? String(draft.price) : "";
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
          el("span", { class: "inn-command-dialog-choice selected", text: "숙박" }),
          el("span", { class: "inn-command-dialog-choice", text: "거절" }),
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
                el("label", { class: "commerce-command-title", text: "암전" }),
                restDuration,
              ],
            }),
            el("div", {
              class: "commerce-command-field",
              children: [
                el("label", { class: "commerce-command-title", text: "기상" }),
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

function normalizeInnPrice(price: InnCommand["price"]): InnCommand["price"] {
  if (typeof price === "number") return Math.max(0, Math.min(999999, Math.trunc(price)) || 0);
  if (price && typeof price === "object" && (price as { kind?: string }).kind === "var") return price;
  return 0;
}

function innPriceHint(command: Pick<InnCommand, "price" | "recoverMp">): string {
  const recover = command.recoverMp === false ? "HP만 회복" : "파티 전원 회복";
  const priceLabel = typeof command.price === "number" ? command.price.toLocaleString("ko-KR") : `변수 ${(command.price as { id: string }).id}`;
  if (typeof command.price === "number" && command.price <= 0) return `0G면 무료 숙박 · ${recover}`;
  if (typeof command.price !== "number") return `숙박 시 ${priceLabel} G 차감 · ${recover} · 변수 요금`;
  return `숙박 시 ${priceLabel}G 차감 · ${recover}`;
}

function innNoteText(command: Pick<InnCommand, "note">): string {
  return command.note?.trim() || "어서 오세요. 편히 쉬어가시겠어요?";
}

function innQuestionText(command: Pick<InnCommand, "price" | "question">): string {
  if (command.question?.trim()) return command.question.trim();
  if (typeof command.price !== "number") return `하룻밤 묵는 데 변수 ${(command.price as { id: string }).id} G 입니다. 묵으시겠습니까?`;
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

/**
 * 드물게 쓰는 서비스·투자·마일리지는 접어 둔다. `<details>` 대신 button + hidden 으로 만든다 —
 * 이 창에서 `<details>` 는 UA `::details-content` 때문에 레이아웃이 새기 때문이다.
 */
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

function shopSettingsCard(context: CommandEditContext, command: ShopCommand): HTMLElement {
  return el("div", {
    class: "shop-processing-settings shop-processing-settings-compact",
    children: [
      shopTypeGroup(context, command),
      shopQuantityModeGroup(context, command),
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
      el("label", { class: "commerce-command-title", text: "상인 소지금" }),
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
      el("label", { class: "commerce-command-title", text: "상점 종류" }),
      select,
    ],
  });
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
  });
  const fieldset = el("fieldset", { class: "shop-processing-fieldset shop-processing-option shop-branch-card" });
  fieldset.append(
    el("legend", { text: "거래 후 분기" }),
    el("label", {
      class: "commerce-command-option shop-processing-check",
      children: [checkbox, el("span", { text: "구매/판매했을 때 분기" })],
    }),
    el("label", {
      class: "commerce-command-option shop-processing-check",
      children: [failCheckbox, el("span", { text: "빈 상점/거래 없음일 때 분기" })],
    })
  );
  return fieldset;
}

const SHOP_FAILED_BRANCH_INDEX = SHOP_FAILED_TRANSACTION_BRANCH_INDEX;
const SHOP_MESSAGE_PREVIEWS: Record<ShopMessageType, string> = {
  welcome: "어서 오세요! 무엇이 필요하신가요?",
  business: "무엇이 필요하신가요?",
  direct: "물건을 고르세요.",
  festival: "축제 한정 특가! 오늘만 이 가격!",
  closingSale: "마감 세일 중! 15% 할인!",
  vip: "VIP 고객님, 특별 혜택을 확인하세요.",
};

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
        children: [el("span", { class: "shop-processing-branch-title", text: "구매/판매 분기" })],
      }),
      el("div", {
        class: `shop-processing-branch-row${txHidden}`,
        dataset: { testid: "shop-transaction-branch-row" },
        children: [branchSel, add],
      }),
      el("div", {
        class: `shop-processing-branch-head${failHidden}`,
        children: [el("span", { class: "shop-processing-branch-title", text: "빈 상점/취소 분기" })],
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
  select.className = "commerce-command-input shop-processing-message-select";
  for (const option of SHOP_MESSAGE_OPTIONS) {
    const optionNode = document.createElement("option");
    optionNode.value = option.value;
    optionNode.textContent = option.label;
    optionNode.title = SHOP_MESSAGE_PREVIEWS[option.value] ?? "";
    if (option.value === current) optionNode.selected = true;
    select.append(optionNode);
  }
  // 옵션을 붙인 뒤에 값을 잡는다 — 빈 select 에 value 를 쓰면 무시돼 저장값이 안 보였다.
  select.value = current;
  select.title = SHOP_MESSAGE_PREVIEWS[current] ?? "";
  select.addEventListener("change", () => {
    const next = selectedMessageType(select.value);
    select.title = SHOP_MESSAGE_PREVIEWS[next] ?? "";
    context.actions.replaceCommand(context.path, { ...latestShop(context, command), messageType: next });
  });
  // 컨트롤 하나짜리는 fieldset+legend 가 아니라 다른 레일 항목과 같은 label+컨트롤로 간다 —
  // fieldset 은 관련 컨트롤 묶음용이고, 섞어 쓰면 레일에 테두리 박스가 들쭉날쭉 생긴다.
  return el("div", {
    class: "commerce-command-field shop-processing-message",
    children: [el("label", { class: "commerce-command-title", text: "메시지 유형" }), select],
  });
}

/**
 * 상품 목록 한 판. 진열/자료집 두 목록을 **체크박스 단일 목록**으로 합친다.
 *
 * `<details>` 는 쓰지 않는다 — Chromium 131+ 는 summary 외 자식을 UA `::details-content`
 * (`display:block`, 콘텐츠 높이) 로 감싸므로 자식에 준 `flex:1/overflow:auto` 가 레이아웃에
 * 참여하지 못하고 목록이 잘린 채 스크롤도 안 됐다. 스크롤러는 평범한 `<div>` 하나뿐이다.
 */
function shopGoodsSection(
  context: CommandEditContext,
  command: ShopCommand,
  items: readonly ItemRecord[]
): ShopGoodsSection {
  // 폼은 itemIds 가 바뀌면 통째로 재빌드된다(commandEditDialog.shouldRerenderCommandForm).
  // 그래서 이 클로저가 사는 동안 판매 여부는 고정이고, 필터·검색만 목록을 다시 그린다.
  const stockedItems = command.itemIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is ItemRecord => Boolean(item));
  const poolItems = items.filter((item) => !command.itemIds.includes(item.id));
  const stockByItem = new Map((command.stock ?? []).map((row) => [row.itemId, row] as const));

  let typeFilter: ItemType | "all" = "all";
  let searchQuery = "";
  let selectedItemId: string | null = stockedItems[0]?.id ?? poolItems[0]?.id ?? null;

  const commitItems = (itemIds: readonly ItemId[]) => {
    // 단일 진실원: itemIds가 정답, stock는 커스텀(계절/가격) 있을 때만 유지. 순서도 itemIds에 맞춤.
    const latest = latestShop(context, command);
    const byId = new Map((latest.stock ?? []).map((e) => [e.itemId, e] as const));
    const reorderedStock = itemIds
      .map((id) => byId.get(id))
      .filter((e): e is NonNullable<typeof e> => Boolean(e));
    context.actions.replaceCommand(context.path, {
      ...latest,
      itemIds: [...itemIds],
      ...(reorderedStock.length > 0 ? { stock: reorderedStock } : latest.stock ? { stock: undefined } : {}),
    });
  };

  const goods = el("div", {
    class: "shop-goods",
    dataset: { testid: "shop-item-catalog" },
    attrs: { role: "group", "aria-label": "상점 상품" },
  });

  const detail = itemDetailPanel(null, {
    command,
    onStockChange: (nextStock) => {
      const latest = latestShop(context, command);
      // stock에 생긴 id가 itemIds에 없으면(수동 편집 잔재) itemIds에도 추가해 이중기록 해소
      const known = new Set(latest.itemIds);
      const missingIds = nextStock.map((e) => e.itemId).filter((id) => !known.has(id));
      const nextItemIds = missingIds.length > 0 ? [...latest.itemIds, ...missingIds] : latest.itemIds;
      const byId = new Map(nextStock.map((e) => [e.itemId, e] as const));
      const orderedStock = nextItemIds.map((id) => byId.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e));
      context.actions.replaceCommand(context.path, {
        ...latest,
        itemIds: nextItemIds,
        ...(orderedStock.length > 0 ? { stock: orderedStock } : { stock: undefined }),
      });
    },
  });

  const selectItem = (itemId: string) => {
    selectedItemId = itemId;
    for (const row of goods.querySelectorAll<HTMLElement>(".shop-goods-row")) {
      row.classList.toggle("is-selected", row.dataset.itemId === itemId);
    }
    detail.render(items.find((item) => item.id === itemId) ?? null);
  };

  /**
   * 담기/빼기는 폼을 통째로 재빌드한다. 179행 목록에서 스크롤 위치가 맨 위로 튀면 연달아 담을 수
   * 없으므로, 토글 직전 위치를 재고 재빌드된 새 DOM 에 그대로 되돌린다. 포커스는 `preventScroll`
   * 로 옮겨서 키보드 사용자는 방금 만진 행에 남고 마우스 사용자는 보던 자리를 지킨다.
   */
  const toggleItem = (itemId: string, nextInShop: boolean) => {
    const view: ShopGoodsView = { scrollTop: goods.scrollTop, searchQuery, typeFilter: String(typeFilter) };
    commitItems(
      nextInShop ? addItemId(command.itemIds, itemId) : command.itemIds.filter((id) => id !== itemId)
    );
    restoreGoodsView(view, itemId);
  };

  const rowFor = (item: ItemRecord, inShop: boolean, orderIndex: number, orderCount: number): HTMLElement => {
    const check = el("input", {
      class: "shop-goods-check",
      attrs: { type: "checkbox", "aria-label": `${item.name} 판매` },
    }) as HTMLInputElement;
    check.checked = inShop;
    check.dataset.testid = `shop-item-check-${item.id}`;
    check.addEventListener("change", () => toggleItem(item.id, check.checked));

    const entry = stockByItem.get(item.id);
    const seasons = (entry?.seasons ?? []).filter((season): season is ShopSeason => SEASON_ORDER.includes(season));
    const priced = entry?.priceOverride;
    const facts = [
      itemTypeLabel(item.type),
      typeof priced === "number" ? formatPrice(priced) : formatPrice(item.price),
      ...(seasons.length > 0 ? [seasons.map((season) => SEASON_LABELS[season]).join(" ")] : []),
    ];
    const pick = el("button", {
      class: "shop-goods-pick",
      attrs: { type: "button", title: itemDetailTitle(item) },
      children: [
        el("span", { class: "shop-goods-name", text: item.name }),
        el("span", {
          class: `shop-goods-facts${typeof priced === "number" ? " is-overridden" : ""}`,
          text: facts.join(" · "),
        }),
      ],
      on: { click: () => selectItem(item.id) },
    });

    const children: HTMLElement[] = [check, pick];
    if (inShop) {
      children.push(
        moveRowButton("▲", `shop-move-up-${item.id}`, `${item.name} 위로`, orderIndex === 0, () =>
          commitItems(moveItemId(command.itemIds, item.id, -1))
        ),
        moveRowButton("▼", `shop-move-down-${item.id}`, `${item.name} 아래로`, orderIndex >= orderCount - 1, () =>
          commitItems(moveItemId(command.itemIds, item.id, 1))
        )
      );
    }
    return el("li", {
      class: `shop-goods-row${inShop ? " is-stocked" : ""}${item.id === selectedItemId ? " is-selected" : ""}`,
      dataset: { testid: `shop-item-row-${item.id}`, itemId: item.id },
      children,
    });
  };

  const groupFor = (
    testId: string,
    label: string,
    all: readonly ItemRecord[],
    visible: readonly ItemRecord[],
    inShop: boolean,
    emptyText: string
  ): HTMLElement => {
    const count = visible.length === all.length ? String(all.length) : `${visible.length} / ${all.length}`;
    const body =
      visible.length === 0
        ? el("p", { class: "shop-goods-empty", text: emptyText })
        : el("ul", {
            class: "shop-goods-rows",
            children: visible.map((item, index) => rowFor(item, inShop, index, visible.length)),
          });
    return el("div", {
      class: "shop-goods-group",
      dataset: { testid: testId },
      children: [
        el("div", {
          class: "shop-goods-head",
          children: [
            el("span", { class: "shop-goods-head-label", text: label }),
            el("span", { class: "shop-goods-head-count", text: count }),
          ],
        }),
        body,
      ],
    });
  };

  const matches = (item: ItemRecord): boolean =>
    (typeFilter === "all" || item.type === typeFilter) && itemMatchesQuery(item, searchQuery);

  const rebuild = () => {
    const filtering = Boolean(searchQuery) || typeFilter !== "all";
    const visibleStocked = stockedItems.filter(matches);
    const visiblePool = poolItems.filter(matches);
    goods.replaceChildren(
      groupFor(
        "shop-sale-list",
        "판매 중",
        stockedItems,
        visibleStocked,
        true,
        stockedItems.length === 0 ? "아직 담은 물건이 없습니다." : "필터에 맞는 물건이 없습니다."
      ),
      groupFor(
        "shop-stock-pool",
        "안 담음",
        poolItems,
        visiblePool,
        false,
        poolItems.length === 0 ? "더 담을 물건이 없습니다." : "필터에 맞는 물건이 없습니다."
      )
    );
    if (filtering && visibleStocked.length === 0 && visiblePool.length === 0) {
      goods.append(el("p", { class: "shop-goods-empty shop-goods-empty-all", text: "필터에 맞는 물건이 없습니다." }));
    }
  };

  const search = document.createElement("input");
  search.type = "search";
  search.className = "commerce-command-input shop-processing-item-search";
  search.placeholder = "이름 · 설명 검색";
  search.dataset.testid = "shop-item-search";
  search.title = "이름·설명·종류·id 로 상품을 찾습니다";
  const applySearch = () => {
    const next = search.value.trim().toLowerCase();
    if (next === searchQuery) return;
    searchQuery = next;
    rebuild();
  };
  // 179행을 키 입력마다 다시 그리지 않도록 타이핑은 눌러 모으고, 확정 입력은 곧바로 반영한다.
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  search.addEventListener("input", () => {
    if (searchTimer !== undefined) clearTimeout(searchTimer);
    searchTimer = setTimeout(applySearch, SHOP_SEARCH_DEBOUNCE_MS);
  });
  search.addEventListener("change", () => {
    if (searchTimer !== undefined) clearTimeout(searchTimer);
    applySearch();
  });

  // 카테고리 = ItemRecord.type (데이터베이스 아이템 종류)
  const typeSelect = document.createElement("select");
  typeSelect.className = "commerce-command-input shop-processing-item-type-filter";
  typeSelect.dataset.testid = "shop-item-type-filter";
  typeSelect.title = "데이터베이스 아이템 종류 필터";
  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "전체 종류";
  typeSelect.append(allOpt);
  const presentTypes = new Set(items.map((item) => item.type));
  for (const type of Object.keys(ITEM_TYPE_LABELS) as ItemType[]) {
    if (!presentTypes.has(type)) continue;
    const opt = document.createElement("option");
    opt.value = type;
    const count = items.filter((item) => item.type === type).length;
    opt.textContent = `${ITEM_TYPE_LABELS[type]} (${count})`;
    typeSelect.append(opt);
  }
  typeSelect.addEventListener("change", () => {
    typeFilter = typeSelect.value === "all" ? "all" : (typeSelect.value as ItemType);
    rebuild();
  });

  const filters = el("div", {
    class: "shop-processing-filter-bar",
    dataset: { testid: "shop-item-filter-bar" },
    children: [
      el("label", {
        class: "shop-processing-filter-field",
        children: [el("span", { class: "shop-processing-filter-label", text: "종류" }), typeSelect],
      }),
      el("label", {
        class: "shop-processing-filter-field shop-processing-filter-search",
        children: [el("span", { class: "shop-processing-filter-label", text: "검색" }), search],
      }),
    ],
  });

  if (items.length === 0) {
    goods.append(
      el("p", {
        class: "shop-goods-empty",
        text: "등록된 아이템이 없습니다. 데이터베이스 → 아이템에서 추가하세요.",
      })
    );
    return { filters, goods, detail: detail.root };
  }

  rebuild();
  if (selectedItemId) selectItem(selectedItemId);
  return { filters, goods, detail: detail.root };
}

function moveRowButton(
  glyph: string,
  testId: string,
  label: string,
  disabled: boolean,
  click: () => void
): HTMLButtonElement {
  const button = el("button", {
    class: "shop-goods-move",
    text: glyph,
    attrs: { type: "button", "aria-label": label, title: label },
    dataset: { testid: testId },
    on: { click },
  }) as HTMLButtonElement;
  button.disabled = disabled;
  return button;
}

/**
 * 재빌드된 폼에서 목록 위치·필터·포커스를 되돌린다. 재빌드는 `replaceCommand` 안에서
 * 동기로 끝나므로 호출 시점엔 새 DOM 이 이미 문서에 붙어 있다.
 */
function restoreGoodsView(view: ShopGoodsView, focusItemId: string | null): void {
  const scope = typeof document === "undefined" ? null : document;
  const goods = scope?.querySelector<HTMLElement>('[data-testid="shop-item-catalog"]');
  if (!goods) return;
  const form = goods.closest<HTMLElement>(".shop-processing-command-body") ?? goods;
  if (view.typeFilter !== "all") {
    const typeSelect = form.querySelector<HTMLSelectElement>('[data-testid="shop-item-type-filter"]');
    if (typeSelect) {
      typeSelect.value = view.typeFilter;
      typeSelect.dispatchEvent(new Event("change"));
    }
  }
  if (view.searchQuery) {
    const search = form.querySelector<HTMLInputElement>('[data-testid="shop-item-search"]');
    if (search) {
      search.value = view.searchQuery;
      search.dispatchEvent(new Event("change"));
    }
  }
  goods.scrollTop = view.scrollTop;
  if (!focusItemId) return;
  const check = form.querySelector<HTMLInputElement>(`[data-testid="shop-item-check-${focusItemId}"]`);
  check?.focus({ preventScroll: true });
}

function itemMatchesQuery(item: ItemRecord, query: string): boolean {
  if (!query) return true;
  const hay = `${item.name} ${item.description ?? ""} ${item.id} ${itemTypeLabel(item.type)}`.toLowerCase();
  return hay.includes(query);
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
    // 고른 게 없으면 아무것도 그리지 않는다 — 빈 안내문 대신 칸 자체가 접힌다(CSS `:empty`).
    if (!item) return;
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
              ...(item.description?.trim()
                ? [el("p", { class: "shop-processing-item-detail-desc", text: item.description.trim() })]
                : []),
            ],
          }),
        ],
      })
    );

    if (!options) return;
    const command = options.command;
    // 안 담은 아이템도 상세는 보여준다. 계절·가격은 담긴 뒤에만 의미가 있으므로 잠가 둔다.
    const stocked = command.itemIds.includes(item.id);
    const lockedTitle = "판매 목록에 담으면 편집할 수 있습니다";

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
    priceInput.disabled = !stocked;
    if (!stocked) priceInput.title = lockedTitle;

    const sellFloor = Math.floor(item.price / 2);
    const stockWarning = el("p", {
      class: "commerce-command-hint shop-stock-warning",
      dataset: { testid: "shop-stock-price-warning" },
      text: "",
    });
    stockWarning.style.display = "none";
    stockWarning.style.color = "var(--rzzu-danger, #c0392b)";
    const refreshStockWarning = () => {
      const raw = priceInput.value.trim();
      if (raw === "") {
        stockWarning.style.display = "none";
        stockWarning.textContent = "";
        return;
      }
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed)) {
        stockWarning.style.display = "none";
        return;
      }
      const v = Math.max(0, parsed);
      if (v < sellFloor) {
        stockWarning.textContent = `⚠ 매입가 ${sellFloor}G 보다 싸게 팔면 되팔아 돈이 생깁니다. 런타임은 ${sellFloor}G로 보정됩니다.`;
        stockWarning.style.display = "";
      } else {
        stockWarning.style.display = "none";
        stockWarning.textContent = "";
      }
    };
    const commitStock = () => {
      const nextSeasons = SEASON_ORDER.filter((s) => seasons.has(s));
      const raw = priceInput.value.trim();
      const parsed = raw === "" ? undefined : Number.parseInt(raw, 10);
      const priceOverride =
        parsed !== undefined && Number.isFinite(parsed) ? Math.max(0, parsed) : undefined;
      refreshStockWarning();
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
    refreshStockWarning();

    priceInput.addEventListener("change", commitStock);

    const chips = el("div", {
      class: "shop-stock-season-chips",
      dataset: { testid: "shop-stock-season-chips" },
    });
    for (const season of SEASON_ORDER) {
      const active = seasons.has(season);
      const chip = el("button", {
        class: "btn small shop-stock-season-chip" + (active ? " is-active" : ""),
        text: SEASON_LABELS[season],
        attrs: {
          type: "button",
          "aria-pressed": active ? "true" : "false",
          title: stocked ? "고른 계절에만 판매합니다 (하나도 안 고르면 사계절)" : lockedTitle,
        },
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
      }) as HTMLButtonElement;
      chip.disabled = !stocked;
      chips.append(chip);
    }

    root.append(
      el("div", {
        class: `shop-stock-editor${stocked ? "" : " is-locked"}`,
        dataset: { testid: "shop-stock-editor" },
        children: [
          chips,
          el("label", {
            class: "shop-stock-price-field",
            children: [el("span", { text: "가격" }), priceInput],
          }),
          stockWarning,
        ],
      })
    );
  };

  render(initial);
  return { root, render };
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
  return "normal";
}

function withShopType(command: ShopCommand, shopType: ShopType): ShopCommand {
  const { allowSell: _legacyAllowSell, ...rest } = command as ShopCommand & Record<string, unknown>;
  void _legacyAllowSell;
  return {
    ...rest,
    shopType,
  } as ShopCommand;
}

function messageTypeValue(command: ShopCommand): ShopMessageType {
  return command.messageType ?? "welcome";
}

function selectedMessageType(value: string): ShopMessageType {
  const option = SHOP_MESSAGE_OPTIONS.find((entry) => entry.value === value);
  return option?.value ?? "welcome";
}

