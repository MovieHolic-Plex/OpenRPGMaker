import { store } from "@/project/store";
import { resolveTerms } from "@/project/terms";
import type { Command, VariableOperand } from "@/project/types";
import { el } from "@/util/dom";
import { databasePicker } from "./conditionForm";
import { segmentedSelect, type SegmentOption } from "./recordPicker";
import type { CommandEditContext } from "./types";
export { shopBody } from "./commandBodyShop";

type InnCommand = Extract<Command, { kind: "inn" }>;
type PriceSource = "fixed" | "variable";

const PRICE_SOURCE_SEGMENTS = [
  { value: "fixed", key: "fixed", label: "고정 요금" },
  { value: "variable", key: "variable", label: "변수 요금" },
] as const satisfies readonly SegmentOption<PriceSource>[];

const INN_PRICE_PRESETS = [
  { price: 0, label: "무료", title: "0 · 무료 숙박" },
  { price: 10, label: "10", title: "저렴한 여관" },
  { price: 20, label: "20", title: "기본 요금" },
  { price: 50, label: "50", title: "고급 여관" },
  { price: 100, label: "100", title: "최고급 숙소" },
] as const;

const DEFAULT_REST_MS = 1500;
const DEFAULT_WAKE_MS = 1100;

export function innBody(context: CommandEditContext, command: InnCommand): HTMLElement {
  const project = store.getCurrent();
  const terms = resolveTerms(project);
  const goldUnit = terms.gold.trim() || "G";
  const timeSystemEnabled = project.system.timeSystem?.enabled === true;

  let draft: InnCommand = normalizeInnCommand(command);
  let cachedFixedPrice = typeof draft.price === "number" ? draft.price : 20;
  let cachedVariableId = typeof draft.price === "number" ? "" : draft.price.id;

  const latestBranches = (): Pick<InnCommand, "stayedBranch" | "cancelledBranch" | "notEnoughBranch"> => {
    const current = context.getCurrentCommand?.();
    if (current?.kind === "inn") {
      return {
        stayedBranch: current.stayedBranch,
        cancelledBranch: current.cancelledBranch,
        notEnoughBranch: current.notEnoughBranch,
      };
    }
    return {
      stayedBranch: draft.stayedBranch,
      cancelledBranch: draft.cancelledBranch,
      notEnoughBranch: draft.notEnoughBranch,
    };
  };

  const wrap = el("div", {
    class: "commerce-command-body commerce-command-body-inline inn-command-body cream-command-form",
    dataset: { testid: "inn-command-body" },
  });

  const priceSource = segmentedSelect({
    options: PRICE_SOURCE_SEGMENTS,
    value: typeof draft.price === "number" ? "fixed" : "variable",
    testid: "inn-price-source",
    ariaLabel: "요금 방식",
  });

  const price = document.createElement("input");
  price.type = "number";
  price.min = "0";
  price.max = "999999";
  price.step = "1";
  price.value = String(cachedFixedPrice);
  price.title = "여관 요금";
  price.dataset.testid = "inn-price-input";
  price.className = "commerce-command-input";

  const priceVariable = databasePicker(
    "variable",
    cachedVariableId,
    (variableId) => {
      cachedVariableId = variableId;
      commit({ ...draft, price: { kind: "var", id: variableId } });
    },
    "inn-price-variable"
  );

  const priceVariableError = el("p", {
    class: "event-command-variable-error",
    text: "요금으로 사용할 변수를 선택하세요.",
    dataset: { testid: "inn-price-variable-error" },
  });

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
  question.placeholder = `비우면 요금 기반 기본 질문 (${goldUnit})`;
  question.title = "숙박 질문";
  question.dataset.testid = "inn-question-input";
  question.className = "commerce-command-input";

  const restDuration = document.createElement("input");
  restDuration.type = "number";
  restDuration.min = "0";
  restDuration.max = "10000";
  restDuration.step = "50";
  restDuration.value = String(draft.restDurationMs ?? DEFAULT_REST_MS);
  restDuration.title = "암전 연출 시간 (ms)";
  restDuration.dataset.testid = "inn-rest-duration-input";
  restDuration.className = "commerce-command-input";

  const wakeDuration = document.createElement("input");
  wakeDuration.type = "number";
  wakeDuration.min = "0";
  wakeDuration.max = "10000";
  wakeDuration.step = "50";
  wakeDuration.value = String(draft.wakeDurationMs ?? DEFAULT_WAKE_MS);
  wakeDuration.title = "기상 메시지 표시 시간 (ms)";
  wakeDuration.dataset.testid = "inn-wake-duration-input";
  wakeDuration.className = "commerce-command-input";

  const priceHint = el("span", {
    class: "commerce-command-hint",
    dataset: { testid: "inn-price-hint" },
    text: innPriceHint(draft, goldUnit),
  });

  const presets = el("div", {
    class: "inn-command-presets",
    dataset: { testid: "inn-price-presets" },
  });
  const presetButtons: HTMLButtonElement[] = [];
  for (const preset of INN_PRICE_PRESETS) {
    const label = preset.price === 0 ? preset.label : `${preset.label}${goldUnit}`;
    const button = el("button", {
      class: "btn small inn-command-preset",
      text: label,
      attrs: { type: "button", title: preset.title },
      dataset: { testid: `inn-price-preset-${preset.price}`, innPrice: String(preset.price) },
      on: {
        click: () => {
          cachedFixedPrice = preset.price;
          price.value = String(preset.price);
          commit({ ...draft, price: preset.price });
        },
      },
    }) as HTMLButtonElement;
    presetButtons.push(button);
    presets.append(button);
  }

  const fixedPriceField = el("div", {
    class: "commerce-command-field",
    children: [
      el("label", { class: "commerce-command-title", text: `여관 요금 (${goldUnit})` }),
      price,
      priceHint,
    ],
  });

  const variablePriceField = el("div", {
    class: "commerce-command-field",
    children: [
      el("label", { class: "commerce-command-title", text: "요금 변수" }),
      priceVariable,
    ],
  });

  const recoverMp = document.createElement("input");
  recoverMp.type = "checkbox";
  recoverMp.checked = draft.recoverMp !== false;
  recoverMp.dataset.testid = "inn-recover-mp";

  const advanceMorning = document.createElement("input");
  advanceMorning.type = "checkbox";
  advanceMorning.checked = draft.advanceToMorning === true;
  advanceMorning.dataset.testid = "inn-advance-morning";

  const branchOnStay = document.createElement("input");
  branchOnStay.type = "checkbox";
  branchOnStay.checked = draft.branchOnStay === true;
  branchOnStay.dataset.testid = "inn-branch-on-stay";

  const branchOnCancel = document.createElement("input");
  branchOnCancel.type = "checkbox";
  branchOnCancel.checked = draft.branchOnCancel === true;
  branchOnCancel.dataset.testid = "inn-branch-on-cancel";

  const branchNotEnough = document.createElement("input");
  branchNotEnough.type = "checkbox";
  branchNotEnough.checked = draft.branchOnNotEnoughGold === true;
  branchNotEnough.dataset.testid = "inn-branch-not-enough";

  const branchSummary = el("div", {
    class: "commerce-command-hint inn-command-branch-summary",
    dataset: { testid: "inn-branch-summary" },
  });

  const syncPresetActive = () => {
    for (const button of presetButtons) {
      button.classList.toggle(
        "active",
        typeof draft.price === "number" && Number(button.dataset.innPrice) === draft.price
      );
    }
  };

  const syncPriceMode = () => {
    const isVar = priceSource.select.value === "variable";
    fixedPriceField.hidden = isVar;
    presets.hidden = isVar;
    variablePriceField.hidden = !isVar;
    priceVariableError.hidden = !isVar || Boolean(cachedVariableId.trim());
  };

  const syncBranchSummary = () => {
    const active: string[] = [];
    if (draft.branchOnStay) active.push(`숙박했을 때 (${draft.stayedBranch?.length ?? 0}개)`);
    if (draft.branchOnCancel) active.push(`거절했을 때 (${draft.cancelledBranch?.length ?? 0}개)`);
    if (draft.branchOnNotEnoughGold) active.push(`골드 부족할 때 (${draft.notEnoughBranch?.length ?? 0}개)`);
    if (active.length === 0) {
      branchSummary.hidden = true;
      branchSummary.textContent = "";
      return;
    }
    branchSummary.hidden = false;
    branchSummary.textContent = `열린 분기: ${active.join(" · ")} — 확인 후 메인 이벤트 목록에서 각 분기 명령을 편집합니다.`;
  };

  const commit = (next: InnCommand) => {
    const branches = latestBranches();
    draft = normalizeInnCommand({
      ...next,
      stayedBranch: next.stayedBranch ?? branches.stayedBranch,
      cancelledBranch: next.cancelledBranch ?? branches.cancelledBranch,
      notEnoughBranch: next.notEnoughBranch ?? branches.notEnoughBranch,
    });
    if (typeof draft.price === "number") cachedFixedPrice = draft.price;
    else cachedVariableId = draft.price.id;
    priceHint.textContent = innPriceHint(draft, goldUnit);
    syncPresetActive();
    syncPriceMode();
    syncBranchSummary();
    context.actions.replaceCommand(context.path, draft);
  };

  priceSource.select.addEventListener("change", () => {
    const isVar = priceSource.select.value === "variable";
    if (isVar) {
      commit({ ...draft, price: { kind: "var", id: cachedVariableId } });
    } else {
      price.value = String(cachedFixedPrice);
      commit({ ...draft, price: cachedFixedPrice });
    }
  });

  // 입력 중에는 input.value 를 덮어쓰지 않는다 — 한글 IME 조합·띄어쓰기·숫자 지우기가 깨지지 않는다.
  const onFixedPriceEdit = (normalizeField: boolean) => {
    const parsed = parseFixedPrice(price.value);
    cachedFixedPrice = parsed;
    if (normalizeField) price.value = String(parsed);
    commit({ ...draft, price: parsed });
  };
  price.addEventListener("input", () => onFixedPriceEdit(false));
  price.addEventListener("change", () => onFixedPriceEdit(true));
  price.addEventListener("blur", () => onFixedPriceEdit(true));

  note.addEventListener("input", () => commit({ ...draft, note: note.value }));
  note.addEventListener("change", () => commit({ ...draft, note: note.value }));

  question.addEventListener("input", () => commit({ ...draft, question: question.value }));
  question.addEventListener("change", () => commit({ ...draft, question: question.value }));

  const onRestDurationEdit = (normalizeField: boolean) => {
    const parsed = parseDurationInput(restDuration.value, DEFAULT_REST_MS);
    if (normalizeField) restDuration.value = String(parsed ?? DEFAULT_REST_MS);
    commit({ ...draft, restDurationMs: parsed });
  };
  restDuration.addEventListener("input", () => onRestDurationEdit(false));
  restDuration.addEventListener("change", () => onRestDurationEdit(true));
  restDuration.addEventListener("blur", () => onRestDurationEdit(true));

  const onWakeDurationEdit = (normalizeField: boolean) => {
    const parsed = parseDurationInput(wakeDuration.value, DEFAULT_WAKE_MS);
    if (normalizeField) wakeDuration.value = String(parsed ?? DEFAULT_WAKE_MS);
    commit({ ...draft, wakeDurationMs: parsed });
  };
  wakeDuration.addEventListener("input", () => onWakeDurationEdit(false));
  wakeDuration.addEventListener("change", () => onWakeDurationEdit(true));
  wakeDuration.addEventListener("blur", () => onWakeDurationEdit(true));

  recoverMp.addEventListener("change", () =>
    commit({ ...draft, recoverMp: recoverMp.checked ? undefined : false })
  );
  advanceMorning.addEventListener("change", () =>
    commit({ ...draft, advanceToMorning: advanceMorning.checked ? true : undefined })
  );
  branchOnStay.addEventListener("change", () => {
    const branches = latestBranches();
    commit({
      ...draft,
      branchOnStay: branchOnStay.checked ? true : undefined,
      stayedBranch: branchOnStay.checked ? branches.stayedBranch ?? [] : branches.stayedBranch,
    });
  });
  branchOnCancel.addEventListener("change", () => {
    const branches = latestBranches();
    commit({
      ...draft,
      branchOnCancel: branchOnCancel.checked ? true : undefined,
      cancelledBranch: branchOnCancel.checked ? branches.cancelledBranch ?? [] : branches.cancelledBranch,
    });
  });
  branchNotEnough.addEventListener("change", () => {
    const branches = latestBranches();
    commit({
      ...draft,
      branchOnNotEnoughGold: branchNotEnough.checked ? true : undefined,
      notEnoughBranch: branchNotEnough.checked ? branches.notEnoughBranch ?? [] : branches.notEnoughBranch,
    });
  });

  syncPresetActive();
  syncPriceMode();
  syncBranchSummary();

  const timeSystemHint = !timeSystemEnabled
    ? el("p", {
        class: "commerce-command-hint",
        text: "현재 프로젝트의 시간 시스템이 꺼져 있어, 아침 이동은 시간 시스템을 켰을 때 적용됩니다.",
      })
    : null;

  wrap.append(
    el("div", {
      class: "inn-command-card",
      children: [
        el("div", {
          class: "commerce-command-field",
          children: [
            el("label", { class: "commerce-command-title", text: "요금 방식" }),
            priceSource.root,
          ],
        }),
        fixedPriceField,
        presets,
        variablePriceField,
        priceVariableError,
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
            el("label", { class: "commerce-command-title", text: "숙박 질문" }),
            question,
          ],
        }),
        el("div", {
          class: "inn-command-options",
          dataset: { testid: "inn-options" },
          children: [
            el("label", {
              class: "commerce-command-option",
              children: [recoverMp, el("span", { text: "MP도 함께 회복 (끄면 HP·상태이상만 회복)" })],
            }),
            el("label", {
              class: "commerce-command-option",
              children: [advanceMorning, el("span", { text: "숙박 후 아침으로 시간 이동" })],
            }),
            ...(timeSystemHint ? [timeSystemHint] : []),
          ],
        }),
        el("div", {
          class: "inn-command-timing",
          dataset: { testid: "inn-timing" },
          children: [
            el("div", {
              class: "commerce-command-field",
              children: [
                el("label", { class: "commerce-command-title", text: "암전 연출 (ms)" }),
                restDuration,
              ],
            }),
            el("div", {
              class: "commerce-command-field",
              children: [
                el("label", { class: "commerce-command-title", text: "기상 표시 (ms)" }),
                wakeDuration,
              ],
            }),
          ],
        }),
        el("p", {
          class: "commerce-command-hint",
          text: "숙박 시 배경음을 낮추고 여관 휴식 멜로디(또는 프로젝트 innRest 효과음)·밤하늘 연출·기상 차임을 재생합니다.",
        }),
      ],
    }),
    el("div", {
      class: "inn-command-card",
      dataset: { testid: "inn-branch-options" },
      children: [
        el("div", {
          class: "shop-processing-branch-head",
          children: [
            el("span", { class: "shop-processing-branch-title", text: "결과별 분기" }),
            el("span", {
              class: "commerce-command-hint",
              text: "필요한 결과만 켜면 이벤트 목록에 분기가 생깁니다",
            }),
          ],
        }),
        el("div", {
          class: "inn-command-options",
          children: [
            el("label", {
              class: "commerce-command-option",
              children: [branchOnStay, el("span", { text: "숙박했을 때 분기" })],
            }),
            el("label", {
              class: "commerce-command-option",
              children: [branchOnCancel, el("span", { text: "거절했을 때 분기" })],
            }),
            el("label", {
              class: "commerce-command-option",
              children: [branchNotEnough, el("span", { text: "골드가 부족할 때 분기" })],
            }),
          ],
        }),
        branchSummary,
      ],
    })
  );
  return wrap;
}

function normalizeInnCommand(command: InnCommand): InnCommand {
  return {
    kind: "inn",
    price: normalizeInnPrice(command.price),
    note: cleanOptionalText(command.note),
    question: cleanOptionalText(command.question),
    recoverMp: command.recoverMp === false ? false : undefined,
    advanceToMorning: command.advanceToMorning === true ? true : undefined,
    restDurationMs: normalizeDuration(command.restDurationMs, DEFAULT_REST_MS),
    wakeDurationMs: normalizeDuration(command.wakeDurationMs, DEFAULT_WAKE_MS),
    branchOnStay: command.branchOnStay === true ? true : undefined,
    stayedBranch: command.branchOnStay ? command.stayedBranch ?? [] : command.stayedBranch,
    branchOnCancel: command.branchOnCancel === true ? true : undefined,
    cancelledBranch: command.branchOnCancel ? command.cancelledBranch ?? [] : command.cancelledBranch,
    branchOnNotEnoughGold: command.branchOnNotEnoughGold === true ? true : undefined,
    notEnoughBranch: command.branchOnNotEnoughGold ? command.notEnoughBranch ?? [] : command.notEnoughBranch,
  };
}

function normalizeInnPrice(price: InnCommand["price"]): VariableOperand {
  if (typeof price === "number") return Math.max(0, Math.min(999999, Math.trunc(price)) || 0);
  if (price && typeof price === "object" && price.kind === "var") {
    return { kind: "var", id: typeof price.id === "string" ? price.id : "" };
  }
  return 0;
}

function parseFixedPrice(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(999999, Math.trunc(parsed)));
}

function parseDurationInput(raw: string, fallback: number): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return normalizeDuration(parsed, fallback);
}

function innPriceHint(command: Pick<InnCommand, "price" | "recoverMp">, goldUnit: string): string {
  const recover = command.recoverMp === false ? "HP·상태이상 회복" : "파티 전원 HP·MP·상태이상 회복";
  if (typeof command.price !== "number") {
    const label = variableDisplayName(command.price.id);
    return label
      ? `숙박 시 변수 「${label}」 ${goldUnit} 차감 · ${recover}`
      : `요금 변수를 선택하세요 · ${recover}`;
  }
  if (command.price <= 0) return `0${goldUnit}면 무료 숙박 · ${recover}`;
  return `숙박 시 ${command.price.toLocaleString("ko-KR")}${goldUnit} 차감 · ${recover}`;
}

function variableDisplayName(variableId: string): string {
  const trimmed = variableId.trim();
  if (!trimmed) return "";
  const entry = store.getCurrent().variables.find((item) => item.id === trimmed);
  return entry?.name?.trim() || trimmed;
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
