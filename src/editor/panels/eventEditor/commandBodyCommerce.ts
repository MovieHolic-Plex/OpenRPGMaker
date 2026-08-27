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
  const wrap = el("div", {
    class: "commerce-command-body shop-processing-command-body shop-processing-v2 cream-command-form",
    dataset: { testid: "shop-command-body" },
  });
  const badgeState = (() => {
    const orphanCount = (command.stock ?? []).filter((row) => !command.itemIds.includes(row.itemId)).length;
    if (command.itemIds.length === 0) return { kind: "empty", text: "빈 상점" } as const;
    if (orphanCount > 0) return { kind: "warn", text: `유령 재고 ${orphanCount}` } as const;
    return { kind: "ok", text: `${command.itemIds.length}개` } as const;
  })();
  const headerBadge = el("span", {
    class: `shop-header-badge shop-header-badge-${badgeState.kind}`,
    dataset: { testid: "shop-header-badge" },
    text: badgeState.text,
    attrs: { title: badgeState.kind === "empty" ? "빈 상점은 플레이에서 목록이 비어 보입니다" : badgeState.text },
  });
  const emptyWarn =
    command.itemIds.length === 0
      ? el("div", {
          class: "shop-empty-illust",
          dataset: { testid: "shop-empty-banner" },
          children: [
            el("div", { class: "shop-empty-illust-icon", text: "🛒", attrs: { "aria-hidden": "true" } }),
            el("div", {
              class: "shop-empty-illust-copy",
              children: [
                el("div", { class: "shop-empty-illust-title", text: "아직 파는 물건이 없어요" }),
                el("div", { class: "shop-empty-illust-sub", text: "오른쪽 목록에서 아이템을 고르거나 프리셋을 불러오세요." }),
              ],
            }),
            el("div", { class: "shop-empty-illust-cta", text: "+ 아래 목록에서 선택" }),
          ],
        })
      : null;
  const main = el("div", {
    class: "shop-processing-main",
    children: [
      (() => {
        const h = shopIntentCard();
        h.append(headerBadge);
        h.classList.add("shop-intent-header");
        return h;
      })(),
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
  try { side.append(shopSabExtraCard(context, command)); } catch {}
  wrap.append(
    el("div", { class: "shop-processing-layout", children: [main, side] }),
    selectedSummary(project.database.items, command.itemIds)
  );
  return wrap;
}

function shopIntentCard(): HTMLElement {
  return el("div", {
    class: "shop-processing-intent shop-processing-intent-compact",
    dataset: { testid: "shop-intent-card" },
    children: [
      el("div", { class: "shop-processing-intent-title", text: "상점" }),
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

function shopSabExtraCard(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const ext = command as unknown as Record<string, unknown>;
  const row = (label: string, input: HTMLElement) => el("div", { class: "shop-sab-row", children: [el("span", { class: "shop-sab-label", text: label }), input] });
  const wrap = el("div", { class: "shop-sab-extra", dataset: { testid: "shop-sab-extra" }, children: [el("div", { class: "shop-sab-title", text: "추가 서비스" })] });
  const serviceSel = el("select", { dataset: { testid: "shop-serviceKind" }, children: [el("option", { text: "없음", attrs: { value: "" } }), el("option", { text: "수리", attrs: { value: "repair" } }), el("option", { text: "감정", attrs: { value: "appraisal" } }), el("option", { text: "전당포", attrs: { value: "pawn" } })] }) as HTMLSelectElement;
  serviceSel.title = "축제·행상은 이벤트 조건(fork)으로 감싸세요 — 이 상점이 닫혔을 때 보이지 않게 됩니다.";
  (serviceSel as HTMLSelectElement).value = String(ext.shopServiceKind ?? "");
  serviceSel.addEventListener("change", () => { const v = (serviceSel as HTMLSelectElement).value || undefined; context.actions.replaceCommand(context.path, { ...(latestShop(context, command) as unknown as Record<string, unknown>), shopServiceKind: v } as unknown as Command); });
  const invest = el("input", { attrs: { type: "number", min: "0", max: "5", step: "1" }, dataset: { testid: "shop-investmentLevel" } }) as HTMLInputElement;
  (invest as HTMLInputElement).value = String((ext.investmentLevel as number) ?? 0);
  invest.addEventListener("change", () => { const n = Math.max(0, Math.min(5, Math.floor(Number((invest as HTMLInputElement).value)||0))); context.actions.replaceCommand(context.path, { ...(latestShop(context, command) as unknown as Record<string, unknown>), investmentLevel: n } as unknown as Command); });
  const mileage = el("input", { attrs: { type: "number", min: "0", max: "0.1", step: "0.01" }, dataset: { testid: "shop-mileageRate" } }) as HTMLInputElement;
  (mileage as HTMLInputElement).value = String((ext.mileageRate as number) ?? "");
  mileage.addEventListener("change", () => { const n = Number((mileage as HTMLInputElement).value); context.actions.replaceCommand(context.path, { ...(latestShop(context, command) as unknown as Record<string, unknown>), mileageRate: Number.isFinite(n) ? Math.max(0, Math.min(0.1, n)) : undefined } as unknown as Command); });
  wrap.append(row("서비스", serviceSel), row("투자 Lv 0..5", invest), row("마일리지 0..0.1", mileage));
  return wrap;
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
      text: "플레이어가 물건을 팔 때 상인이 쓸 수 있는 금액입니다. 기본 100G(비우면 100G), 0이면 매입 불가. 방문마다 리셋됩니다.",
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
      ...latestShop(context, command),
      quantityMode: select.value === "select" ? "select" : "single",
    });
  });
  return el("div", {
    class: "commerce-command-field",
    children: [
      el("label", { class: "commerce-command-title", text: "구매 수량" }),
      select,
      el("span", { class: "commerce-command-hint", text: "플레이어가 1~99 수량을 고릅니다 (←/→ 키 가능, 단일은 1개 고정)." }),
    ],
  });
}

function shopStockSummary(command: ShopCommand): HTMLElement {
  const stock = command.stock ?? [];
  const free = stock.filter((row) => !row.seasons || row.seasons.length === 0).length;
  const seasonal = stock.length - free;
  const text =
    stock.length === 0
      ? "계절 재고(stock) 없음 — 행 선택 후 아래에서 계절·가격을 넣으세요. 비워두면 itemIds 판매 목록만으로 동작합니다."
      : `계절 재고 ${stock.length}건(사계절 ${free} · 계절한정 ${seasonal}). stock이 있으면 itemIds 대신 stock 기준으로 판매합니다.`;
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
    context.actions.replaceCommand(context.path, withShopType(latestShop(context, command), next));
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
    const latest = latestShop(context, command);
    context.actions.replaceCommand(context.path, {
      ...latest,
      branchOnTransaction: checkbox.checked,
      transactionBranch: checkbox.checked ? latest.transactionBranch ?? [] : latest.transactionBranch,
    });
  });
  const failCheckbox = document.createElement("input");
  failCheckbox.type = "checkbox";
  failCheckbox.checked = (command as unknown as { branchOnFailedTransaction?: boolean }).branchOnFailedTransaction ?? false;
  failCheckbox.dataset.testid = "shop-branch-on-failed-transaction";
  failCheckbox.addEventListener("change", () => {
    const latest = latestShop(context, command) as unknown as ShopCommand & { branchOnFailedTransaction?: boolean; failedTransactionBranch?: Command[] };
    context.actions.replaceCommand(context.path, {
      ...latest,
      branchOnFailedTransaction: failCheckbox.checked,
      failedTransactionBranch: failCheckbox.checked ? latest.failedTransactionBranch ?? [] : latest.failedTransactionBranch,
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
    }),
    el("p", {
      class: "commerce-command-hint",
      text: "거래 성공→첫 분기, 빈 상점/취소→두 번째 분기. 여관의 ‘돈 없을 때 분기’와 대칭.",
    })
  );
  return fieldset;
}

const SHOP_FAILED_BRANCH_INDEX = SHOP_FAILED_TRANSACTION_BRANCH_INDEX;
const SHOP_MESSAGE_PREVIEWS: Record<ShopMessageType, string> = {
  welcome: "어심 오세요! 무엇이 필요하신가요?",
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
  const failedBranch = (command as unknown as { branchOnFailedTransaction?: boolean }).branchOnFailedTransaction ?? false;
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
    children: [
      el("div", {
        class: "shop-processing-branch-head",
        children: [
          el("span", { class: "shop-processing-branch-title", text: "구매/판매 분기" }),
          el("span", { class: "commerce-command-hint", text: "거래 후 실행할 명령" }),
        ],
      }),
      el("div", {
        class: `shop-processing-branch-row${txHidden}`,
        dataset: { testid: "shop-transaction-branch-row" },
        children: [branchSel, add],
      }),
      el("div", {
        class: `shop-processing-branch-row shop-processing-failed-branch-row${failHidden}`,
        dataset: { testid: "shop-failed-branch-row" },
        children: [el("span", { class: "shop-processing-branch-title", text: "빈 상점/취소 분기" }), failedSel, failedAdd],
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
    context.actions.replaceCommand(context.path, {
      ...latestShop(context, command),
      messageType: selectedMessageType(select.value),
    });
  });
  const preview = el("p", {
    class: "commerce-command-hint shop-message-preview",
    dataset: { testid: "shop-message-preview" },
    text: SHOP_MESSAGE_PREVIEWS[messageTypeValue(command)] ?? "",
  });
  select.addEventListener("change", () => {
    preview.textContent = SHOP_MESSAGE_PREVIEWS[selectedMessageType(select.value)] ?? "";
  });
  const fieldset = el("fieldset", { class: "shop-processing-fieldset shop-processing-message" });
  fieldset.append(el("legend", { text: "메시지 유형" }), select, preview);
  return fieldset;
}

function shopItemsPanel(context: CommandEditContext, command: ShopCommand, items: readonly ItemRecord[]): HTMLElement {
  const selectedItems = command.itemIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is ItemRecord => Boolean(item));
  const notInShop = () => items.filter((item) => !command.itemIds.includes(item.id));

  let typeFilter: ItemType | "all" = "all";
  let searchQuery = "";

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

  const selectedList = shopItemList("shop-selected-items", selectedItems, {
    emptyText: "아직 담은 물건이 없습니다.",
    onActivate: (itemId) => commitItems(command.itemIds.filter((id) => id !== itemId)),
  });
  const availableList = shopItemList("shop-available-items", notInShop(), {
    emptyText: "더 담을 물건이 없습니다.",
    onActivate: (itemId) => commitItems(addItemId(command.itemIds, itemId)),
  });

  const countBadge = el("span", {
    class: "shop-processing-list-count",
    text: `${selectedItems.length}/${items.length}`,
    dataset: { testid: "shop-available-count" },
  });
  const catalog = el("div", {
    class: "shop-processing-catalog",
    dataset: { testid: "shop-item-catalog" },
    attrs: { role: "listbox", "aria-label": "상점 상품" },
  });

  const applyAvailableFilter = () => {
    const filtered = notInShop().filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      return itemMatchesQuery(item, searchQuery);
    });
    rebuildShopItemList(availableList, filtered, {
      emptyText:
        notInShop().length === 0
          ? "더 담을 물건이 없습니다."
          : searchQuery || typeFilter !== "all"
            ? "필터에 맞는 아이템 없음"
            : "더 담을 물건이 없습니다.",
      onActivate: (itemId) => commitItems(addItemId(command.itemIds, itemId)),
    });
    countBadge.textContent = `${command.itemIds.length}/${items.length}`;
    add.disabled = filtered.length === 0;
    rebuildShopCatalog(catalog, items, command.itemIds, {
      typeFilter,
      searchQuery,
      onToggle: (itemId, nextInShop) => {
        commitItems(nextInShop ? addItemId(command.itemIds, itemId) : command.itemIds.filter((id) => id !== itemId));
      },
      onSelect: (itemId) => {
        const inShop = command.itemIds.includes(itemId);
        if (inShop) selectedList.select.value = itemId;
        else availableList.select.value = itemId;
        syncDetail(itemId, items);
      },
    });
  };

  const search = document.createElement("input");
  search.type = "search";
  search.className = "commerce-command-input shop-processing-item-search";
  search.placeholder = "이름 · 설명 검색";
  search.dataset.testid = "shop-item-search";
  search.title = "상품 검색";
  search.addEventListener("input", () => {
    searchQuery = search.value.trim().toLowerCase();
    applyAvailableFilter();
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
    applyAvailableFilter();
  });

  const add = itemMoveButton("담기", "shop-add-item", () => {
    if (!availableList.value) return;
    commitItems(addItemId(command.itemIds, availableList.value));
  });
  const remove = itemMoveButton("빼기", "shop-remove-item", () => {
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
  add.disabled = notInShop().length === 0;
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
    el("legend", { text: "판매 목록" }),
    el("p", {
      class: "commerce-command-hint shop-processing-items-hint",
      text: "체크한 물건이 상점에 나갑니다. ▲▼로 진열 순서를 바꿉니다.",
    }),
  );
  if (items.length === 0) {
    fieldset.append(
      el("div", {
        class: "commerce-command-empty",
        text: "등록된 아이템이 없습니다. 데이터베이스 → 아이템에서 추가하세요.",
      }),
    );
    return fieldset;
  }

  const detail = itemDetailPanel(selectedItems[0] ?? notInShop()[0] ?? null, {
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
  const syncDetail = (itemId: string, pool: readonly ItemRecord[]) => {
    const record = pool.find((item) => item.id === itemId) ?? null;
    detail.render(record);
  };
  selectedList.root.addEventListener("shop-item-select", ((event: CustomEvent<{ itemId: string }>) => {
    syncDetail(event.detail.itemId, selectedItems);
  }) as EventListener);
  availableList.root.addEventListener("shop-item-select", ((event: CustomEvent<{ itemId: string }>) => {
    syncDetail(event.detail.itemId, notInShop());
  }) as EventListener);

  const controls = el("div", {
    class: "shop-processing-item-controls",
    children: [add, remove, moveUp, moveDown],
  });

  const filterBar = el("div", {
    class: "shop-processing-filter-bar",
    dataset: { testid: "shop-item-filter-bar" },
    children: [
      el("label", {
        class: "shop-processing-filter-field",
        children: [
          el("span", { class: "shop-processing-filter-label", text: "종류" }),
          typeSelect,
        ],
      }),
      el("label", {
        class: "shop-processing-filter-field shop-processing-filter-search",
        children: [
          el("span", { class: "shop-processing-filter-label", text: "검색" }),
          search,
        ],
      }),
      el("span", {
        class: "commerce-command-hint shop-processing-filter-source",
        text: `DB ${items.length}개`,
        dataset: { testid: "shop-item-db-count" },
      }),
    ],
  });

  const catalogFold = el("details", {
    class: "shop-processing-catalog-fold",
    dataset: { testid: "shop-item-catalog-fold" },
  });
  catalogFold.append(
    el("summary", {
      class: "shop-processing-catalog-fold-summary",
      text: `DB 전체 목록 (${items.length})·필터·검색`,
    }),
    filterBar,
    catalog,
  );
  selectedList.root.classList.add("shop-processing-sale-list");
  selectedList.root.dataset.testid = "shop-sale-list";
  fieldset.append(
    selectedList.root,
    catalogFold,
    el("div", {
      class: "shop-processing-e2e-tray",
      attrs: { "aria-hidden": "true" },
      children: [availableList.root, add, remove],
    }),
    controls,
    detail.root,
  );
  applyAvailableFilter();
  return fieldset;
}

function rebuildShopCatalog(
  host: HTMLElement,
  items: readonly ItemRecord[],
  selectedIds: readonly string[],
  options: {
    readonly typeFilter: string;
    readonly searchQuery: string;
    readonly onToggle: (itemId: string, nextInShop: boolean) => void;
    readonly onSelect: (itemId: string) => void;
  },
): void {
  const selected = new Set(selectedIds);
  const visible = items.filter((item) => {
    if (options.typeFilter !== "all" && item.type !== options.typeFilter) return false;
    return itemMatchesQuery(item, options.searchQuery);
  });
  const ordered = [
    ...selectedIds.map((id) => visible.find((item) => item.id === id)).filter((item): item is ItemRecord => Boolean(item)),
    ...visible.filter((item) => !selected.has(item.id)),
  ];
  host.replaceChildren();
  if (ordered.length === 0) {
    host.append(el("div", { class: "shop-processing-item-empty", text: "필터에 맞는 물건이 없습니다." }));
    return;
  }
  for (const item of ordered) {
    const inShop = selected.has(item.id);
    const check = el("input", {
      attrs: { type: "checkbox", "aria-label": `${item.name} 판매` },
    }) as HTMLInputElement;
    check.checked = inShop;
    check.addEventListener("click", (event) => event.stopPropagation());
    check.addEventListener("change", () => options.onToggle(item.id, check.checked));
    host.append(el("button", {
      class: `shop-processing-catalog-row${inShop ? " is-stocked" : ""}`,
      attrs: { type: "button", role: "option", "aria-selected": inShop ? "true" : "false" },
      dataset: { testid: `shop-catalog-row-${item.id}` },
      on: {
        click: () => options.onSelect(item.id),
        dblclick: () => options.onToggle(item.id, !inShop),
      },
      children: [
        check,
        el("span", { class: "shop-processing-catalog-name", text: item.name }),
        el("span", { class: "shop-processing-catalog-price", text: formatPrice(item.price) }),
        el("span", { class: "shop-processing-catalog-state", text: inShop ? "판매 중" : "안 담음" }),
      ],
    }));
  }
}

function itemMatchesQuery(item: ItemRecord, query: string): boolean {
  if (!query) return true;
  const hay = `${item.name} ${item.description ?? ""} ${item.id} ${itemTypeLabel(item.type)}`.toLowerCase();
  return hay.includes(query);
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
        stockWarning.textContent = `⚠ 매입가(${sellFloor}G)보다 싸게 팔면(H-02 차익) 되팔아 돈이 생깁니다. 런타임은 ${sellFloor}G로 보정됩니다.`;
        stockWarning.style.display = "";
      } else {
        stockWarning.style.display = "none";
        stockWarning.textContent = "";
      }
    };
    const commitStock = () => {
      const nextSeasons = seasonOrder.filter((s) => seasons.has(s));
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
          stockWarning,
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
