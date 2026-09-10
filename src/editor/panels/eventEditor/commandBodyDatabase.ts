import { expOperandControls } from "./commandBodyExp";
import { equipmentSlots, equipmentSlotLabel } from "@/project/equipmentSlots";
import { battleTroopError } from "@/project/battleAdmission";
﻿import { craftRecipesOf } from "@/project/craftRecipes";
import { openRecordPickerPanel } from "./recordPickerDialog";
import { startStateOf } from "@/project/session";
import { upgradeRulesOf } from "@/project/upgrades";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { selectedOptionValue } from "./dom";
import {
  AMOUNT_OP_SEGMENTS,
  actorPicker,
  amountStepper,
  facesetIconOf,
  imageIconOf,
  previewAmountAfter,
  previewStrip,
  recordIconElement,
  recordPickerWithPreview,
  searchableRecordBrowser,
  segmentedSelect,
} from "./recordPicker";
import { databasePicker } from "./switchVariablePicker";
import type { ActorAmountOp, ActorEquipmentSlot, ActorRecord, Command, EquipmentRecord, Project } from "@/project/types";
import type { CommandEditContext } from "./types";

const AMOUNT_OP_OPTIONS = [
  { value: "=", label: "이 값으로" },
  { value: "+=", label: "더하기" },
  { value: "-=", label: "빼기" },
] as const;

const VITAL_AMOUNT_MODE_SEGMENTS = [
  { value: "flat", key: "flat", label: "고정" },
  { value: "percent", key: "percent", label: "%" },
] as const satisfies readonly { readonly value: "flat" | "percent"; readonly key: string; readonly label: string }[];

const PARTY_ACTION_OPTIONS = [
  { value: "add", label: "파티에 추가" },
  { value: "remove", label: "파티에서 제거" },
] as const;

const MONSTER_MOVE_TARGET_OPTIONS = [
  { value: "party", label: "파티" },
  { value: "box", label: "보관함" },
] as const;

const STORAGE_CHEST_SCOPE_SEGMENTS = [
  { value: "local", key: "local", label: "이 상자 전용" },
  { value: "shared", key: "shared", label: "여러 상자 공유" },
] as const satisfies readonly { readonly value: "local" | "shared"; readonly key: string; readonly label: string }[];

const BATTLE_FLOW_SEGMENTS = [
  { value: "inherit", key: "inherit", label: "시스템 기본" },
  { value: "gauge", key: "gauge", label: "게이지" },
  { value: "strict", key: "strict", label: "엄격 턴제" },
] as const satisfies readonly { readonly value: "inherit" | "gauge" | "strict"; readonly key: string; readonly label: string }[];

const BATTLE_ESCAPE_SEGMENTS = [
  { value: "allow", key: "allow", label: "도망 가능" },
  { value: "deny", key: "deny", label: "도망 불가" },
] as const satisfies readonly { readonly value: "allow" | "deny"; readonly key: string; readonly label: string }[];

const BATTLE_LOSE_SEGMENTS = [
  { value: "gameover", key: "gameover", label: "지면 게임 끝" },
  { value: "allow", key: "allow", label: "패배 허용" },
] as const satisfies readonly { readonly value: "gameover" | "allow"; readonly key: string; readonly label: string }[];

const BATTLE_TROOP_SOURCE_SEGMENTS = [
  { value: "fixed", key: "fixed", label: "이 그룹" },
  { value: "variable", key: "variable", label: "변수" },
] as const satisfies readonly { readonly value: "fixed" | "variable"; readonly key: string; readonly label: string }[];

const BATTLE_PROCESSING_PRESETS = [
  {
    id: "field",
    label: "필드",
    title: "필드 랜덤 전투 — 도망 가능 · 패배 허용",
    canEscape: true,
    canLose: true,
    battleFlow: "inherit" as const,
  },
  {
    id: "story",
    label: "스토리",
    title: "스토리 전투 — 도망 불가 · 지면 게임 끝",
    canEscape: false,
    canLose: false,
    battleFlow: "inherit" as const,
  },
  {
    id: "boss",
    label: "보스",
    title: "보스 전투 — 도망 불가 · 엄격 턴제",
    canEscape: false,
    canLose: false,
    battleFlow: "strict" as const,
  },
] as const;

type ActorAmountCommand = Extract<Command, { kind: "changeExp" | "changeLevel" | "changeActorHp" | "changeActorMp" }>;

function battleProcessingError(project: Project, cmd: Extract<Command, { kind: "battleProcessing" }>): string | undefined {
  if (cmd.troopSource === "variable") {
    return project.variables.some(variable => variable.id === cmd.troopVariableId)
      ? undefined : "적 그룹을 정할 변수를 선택하세요. 전투 시 변수의 값이 유효한 적 그룹을 가리켜야 합니다.";
  }
  return battleTroopError(project, cmd.troopId)?.message;
}

/** Confirm is a button, not native form submit. Recheck live records without replacing the draft. */
export function validateBattleProcessingForm(host: HTMLElement, command: Command): boolean {
  if (command.kind !== "battleProcessing") return true;
  const error = battleProcessingError(store.getCurrent(), command);
  const warning = host.querySelector<HTMLElement>('[data-testid="battle-processing-warning"]');
  if (warning) {
    warning.hidden = !error;
    warning.textContent = error ?? "";
    if (error) warning.focus();
  }
  return !error;
}

export function battleProcessingBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "battleProcessing" }>
): HTMLElement {
  const project = store.getCurrent();
  let troopSource: "fixed" | "variable" = cmd.troopSource === "variable" ? "variable" : "fixed";
  let troopVariableId = cmd.troopVariableId ?? "";
  let canEscape = cmd.canEscape;
  let canLose = cmd.canLose;
  let battleFlow: "inherit" | "gauge" | "strict" = cmd.battleFlow ?? "inherit";
  let branchOnResult = cmd.branchOnResult === true;

  // 트룹 픽커: 카드 부제에 소속 적 이름을 나열해 어떤 전투인지 즉시 보이게 한다.
  const troop = recordPickerWithPreview({
    records: project.database.troops,
    selectedId: cmd.troopId,
    placeholder: "적 그룹 선택",
    testid: "battle-processing-troop-select",
    iconOf: (record) => {
      const enemyIds = troopEnemyIds(record);
      const firstEnemyId = enemyIds[0];
      const enemy = project.database.enemies.find((entry) => entry.id === firstEnemyId);
      return imageIconOf(project, enemy?.monsterResourceId);
    },
    subtitleOf: (record) => troopMemberNames(project, troopEnemyIds(record)),
  });

  const source = segmentedSelect({
    options: BATTLE_TROOP_SOURCE_SEGMENTS,
    value: troopSource,
    testid: "battle-processing-troop-source",
    ariaLabel: "누구와 싸울까",
  });
  const escape = segmentedSelect({
    options: BATTLE_ESCAPE_SEGMENTS,
    value: canEscape ? "allow" : "deny",
    testid: "battle-processing-escape-select",
    ariaLabel: "도망 규칙",
  });
  const lose = segmentedSelect({
    options: BATTLE_LOSE_SEGMENTS,
    value: canLose ? "allow" : "gameover",
    testid: "battle-processing-lose-select",
    ariaLabel: "패배 규칙",
  });
  const flow = segmentedSelect({
    options: BATTLE_FLOW_SEGMENTS,
    value: battleFlow,
    testid: "battle-processing-flow-select",
    ariaLabel: "전투 방식",
  });

  // e2e/레거시 체크박스 testid 호환 — 세그먼트와 동기화되는 숨김 입력.
  const escapeCheckbox = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "battle-processing-escape-checkbox" },
  }) as HTMLInputElement;
  escapeCheckbox.checked = canEscape;
  escapeCheckbox.hidden = true;
  const loseCheckbox = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "battle-processing-lose-checkbox" },
  }) as HTMLInputElement;
  loseCheckbox.checked = canLose;
  loseCheckbox.hidden = true;

  const warning = el("div", {
    class: "battle-processing-warning is-empty",
    dataset: { testid: "battle-processing-warning" },
    attrs: { role: "alert", tabindex: "-1" },
    text: "적 그룹을 선택하세요. 빈 전투는 실행 시 실패합니다.",
  });
  const hover = el("div", {
    class: "battle-processing-troop-hover",
    dataset: { testid: "battle-processing-troop-hover" },
  });
  const preview = previewStrip("battle-processing-preview", "확인 시 전투 시작 → battleResult 저장");
  const troopField = battleField("적 그룹", troop.root);
  // 변수 모드는 접힌 한 줄: 이름 있는 변수만 옵션에 올린다. 빈 슬롯 덤프 금지.
  const variableControl = namedVariablePicker({
    project,
    selectedId: troopVariableId,
    testid: "battle-processing-troop-variable",
    onChange: (nextId) => {
      troopVariableId = nextId;
      apply();
    },
  });
  const variableField = battleField("어느 변수", variableControl.root);
  // 「누구와 싸울까」 슬롯은 하나다 — 고정/변수 컨트롤이 동시에 붙지 않는다.
  const sourceSlot = el("div", {
    class: "battle-processing-source-slot",
    dataset: { testid: "battle-processing-source-slot" },
  });

  const branchCheckbox = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "battle-processing-branch-on-result" },
  }) as HTMLInputElement;
  branchCheckbox.checked = branchOnResult;
  const branchOption = el("label", {
    class: "battle-processing-branch-option",
    children: [branchCheckbox, el("span", { text: "결과 분기 (승리 / 패배 / 도망)" })],
  });
  const branchHint = el("p", {
    class: "battle-processing-branch-hint",
    dataset: { testid: "battle-processing-branch-hint" },
    text: "켜면 명령 리스트에 승리·패배·도망 마커가 생깁니다. 본문은 마커 아래에서 편집하세요.",
  });
  const branchControls = el("div", {
    class: "battle-processing-branch-controls",
    dataset: { testid: "battle-processing-branch-controls" },
    children: [branchOption, branchHint],
  });

  const presets = el("div", {
    class: "battle-processing-presets",
    dataset: { testid: "battle-processing-presets" },
  });
  for (const preset of BATTLE_PROCESSING_PRESETS) {
    presets.append(
      el("button", {
        class: "btn small battle-processing-preset",
        text: preset.label,
        attrs: { type: "button", title: preset.title },
        dataset: { testid: `battle-processing-preset-${preset.id}` },
        on: {
          click: () => {
            canEscape = preset.canEscape;
            canLose = preset.canLose;
            battleFlow = preset.battleFlow;
            escape.select.value = canEscape ? "allow" : "deny";
            lose.select.value = canLose ? "allow" : "gameover";
            flow.select.value = battleFlow;
            escape.select.dispatchEvent(new Event("change"));
            lose.select.dispatchEvent(new Event("change"));
            flow.select.dispatchEvent(new Event("change"));
            apply();
          },
        },
      })
    );
  }

  const syncVisibility = (): void => {
    const fixed = troopSource === "fixed";
    // hidden 속성은 폼 CSS(display:flex)에 밀린다. 슬롯 자체를 교체해 한 컨트롤만 남긴다.
    sourceSlot.replaceChildren(fixed ? troopField : variableField);
    troopField.hidden = !fixed;
    variableField.hidden = fixed;
    const error = battleProcessingError(store.getCurrent(), { ...cmd, troopSource, troopVariableId, troopId: troop.select.value });
    warning.hidden = !error;
    warning.textContent = error ?? "";
    if (error) warning.classList.add("is-empty");
    else warning.classList.remove("is-empty");
    branchHint.hidden = !branchOnResult;
  };

  const renderHoverAndPreview = (): void => {
    const troopId = troop.select.value.trim();
    const troopRecord = project.database.troops.find((entry) => entry.id === troopId);
    const enemyIds = troopRecord ? troopEnemyIds(troopRecord) : [];
    const reward = troopRewardSummary(project, enemyIds);
    const who = troopSource === "variable"
      ? `변수 ${variableLabelOf(project, troopVariableId)}`
      : (troopRecord?.name ?? (troopId || "(적 그룹 선택)"));
    const members = enemyIds
      .map((id) => project.database.enemies.find((enemy) => enemy.id === id)?.name ?? id)
      .filter(Boolean);
    const memberLine = members.length === 0
      ? "멤버 없음"
      : members.length > 4
        ? `${members.slice(0, 4).join(" · ")} 외 ${members.length - 4}`
        : members.join(" · ");

    hover.replaceChildren(
      el("div", { class: "battle-processing-hover-title", text: who }),
      el("div", { class: "battle-processing-hover-row", text: memberLine }),
      el("div", {
        class: "battle-processing-hover-row",
        text: reward || "보상 정보 없음",
      }),
    );

    preview.body.replaceChildren(
      el("span", { class: "rich-skill-badge ecp-battle-mini-badge", text: "⚔", attrs: { "aria-hidden": "true" } }),
      el("span", { text: who }),
      el("span", { class: "rich-preview-arrow", text: "·" }),
      el("span", {
        class: `rich-preview-after ${canEscape ? "gain" : "loss"}`,
        text: canEscape ? "도망 가능" : "도망 불가",
      }),
      el("span", {
        class: `rich-preview-after ${canLose ? "gain" : ""}`,
        text: canLose ? "패배 허용" : "지면 게임 끝",
      }),
      ...(reward ? [el("span", { class: "rich-preview-caption-inline", text: reward })] : []),
      ...(branchOnResult
        ? [el("span", { class: "rich-preview-caption-inline", text: "결과 분기 켜짐" })]
        : []),
    );
  };

  const apply = (): void => {
    canEscape = escape.select.value === "allow";
    canLose = lose.select.value === "allow";
    battleFlow = (flow.select.value as "inherit" | "gauge" | "strict") || "inherit";
    troopSource = source.select.value === "variable" ? "variable" : "fixed";
    escapeCheckbox.checked = canEscape;
    loseCheckbox.checked = canLose;
    syncVisibility();
    renderHoverAndPreview();
    context.actions.replaceCommand(context.path, {
      kind: "battleProcessing",
      troopId: troop.select.value,
      canEscape,
      canLose,
      battleFlow: battleFlow === "inherit" ? undefined : battleFlow,
      troopSource: troopSource === "variable" ? "variable" : undefined,
      troopVariableId: troopSource === "variable" ? troopVariableId : undefined,
      branchOnResult: branchOnResult ? true : undefined,
      victoryBranch: branchOnResult ? (cmd.victoryBranch ?? []) : cmd.victoryBranch,
      defeatBranch: branchOnResult ? (cmd.defeatBranch ?? []) : cmd.defeatBranch,
      escapeBranch: branchOnResult ? (cmd.escapeBranch ?? []) : cmd.escapeBranch,
    });
  };

  source.select.addEventListener("change", apply);
  troop.select.addEventListener("change", apply);
  escape.select.addEventListener("change", apply);
  lose.select.addEventListener("change", apply);
  flow.select.addEventListener("change", apply);
  escapeCheckbox.addEventListener("change", () => {
    escape.select.value = escapeCheckbox.checked ? "allow" : "deny";
    apply();
  });
  loseCheckbox.addEventListener("change", () => {
    lose.select.value = loseCheckbox.checked ? "allow" : "gameover";
    apply();
  });
  branchCheckbox.addEventListener("change", () => {
    branchOnResult = branchCheckbox.checked;
    apply();
  });

  syncVisibility();
  renderHoverAndPreview();

  const wrap = el("div", {
    class: "rich-command-form cream-command-form battle-processing-command-body actor-amount-command-body",
    dataset: { testid: "event-command-battle-processing-form" },
  });
  wrap.append(
    battleField("의도", el("div", {
      class: "battle-processing-intent",
      text: "이 이벤트에서 전투를 시작합니다",
      dataset: { testid: "battle-processing-intent" },
    })),
    battleField("누구와 싸울까", source.root),
    sourceSlot,
    warning,
    hover,
    battleField("도망", escape.root),
    battleField("패배", lose.root),
    battleField("전투 방식", flow.root),
    battleField("프리셋", presets),
    branchControls,
    preview.root,
    escapeCheckbox,
    loseCheckbox,
  );
  return wrap;
}

// 트룹 소속 적 id (members 우선, 없으면 enemyIds).
function troopEnemyIds(record: { readonly enemyIds: readonly string[]; readonly members?: readonly { readonly enemyId: string }[] }): string[] {
  if (record.members && record.members.length > 0) {
    return record.members.map((member) => member.enemyId);
  }
  return [...record.enemyIds];
}

// 트룹 소속 적 이름 나열 부제(최대 4개 + "외 N").
function troopMemberNames(project: Project, enemyIds: readonly string[]): string | null {
  if (enemyIds.length === 0) return null;
  const names = enemyIds.map(
    (enemyId) => project.database.enemies.find((entry) => entry.id === enemyId)?.name ?? enemyId
  );
  const shown = names.slice(0, 4).join(" · ");
  return names.length > 4 ? `${shown} 외 ${names.length - 4}` : shown;
}

function troopRewardSummary(project: Project, enemyIds: readonly string[]): string {
  let exp = 0;
  let gold = 0;
  const drops: string[] = [];
  for (const enemyId of enemyIds) {
    const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
    if (!enemy) continue;
    exp += enemy.rewards.exp ?? 0;
    gold += enemy.rewards.gold ?? 0;
    if (enemy.rewards.dropItemId) {
      const item = project.database.items.find((entry) => entry.id === enemy.rewards.dropItemId);
      const label = item?.name ?? enemy.rewards.dropItemId;
      if (!drops.includes(label)) drops.push(label);
    }
  }
  const parts: string[] = [];
  if (exp > 0) parts.push(`EXP ${exp}`);
  if (gold > 0) parts.push(`Gold ${gold}`);
  if (drops.length > 0) parts.push(`드롭 ${drops.slice(0, 2).join(" · ")}`);
  return parts.join(" · ");
}

function battleField(label: string, control: HTMLElement): HTMLElement {
  return el("div", {
    class: "party-member-field battle-processing-field",
    children: [
      el("div", { class: "party-member-field-label", text: label }),
      control,
    ],
  });
}

/** 이름이 지정된 변수만. 반환 순서는 프로젝트 순서를 유지한다. */
export function namedVariablesOf(project: Project): readonly { readonly id: string; readonly name: string }[] {
  return project.variables
    .filter((entry) => entry.name.trim().length > 0)
    .map((entry) => ({ id: entry.id, name: entry.name.trim() }));
}

/** 변수 한 줄 라벨: 이름이 없으면 id 그대로, 비어 있으면 (변수 선택). */
export function variableLabelOf(project: Project, variableId: string): string {
  if (!variableId) return "(변수 선택)";
  const named = project.variables.find((entry) => entry.id === variableId);
  const name = named?.name.trim();
  return name && name.length > 0 ? name : variableId;
}

// 전투 트룹 변수 픽커 — 이름 있는 슬롯만 옵션이다.
// 이름 없는 슬롯 20개를 「(이름 없음)」으로 펼치면 적 그룹 선택이 부힌다.
function namedVariablePicker(options: {
  readonly project: Project;
  readonly selectedId: string;
  readonly testid: string;
  readonly onChange: (id: string) => void;
}): { readonly root: HTMLElement; readonly select: HTMLSelectElement } {
  const named = namedVariablesOf(options.project);
  const select = el("select", {
    class: "battle-processing-variable-select",
    attrs: { "aria-label": "적 그룹 변수" },
  }) as HTMLSelectElement;
  const rebuild = (selectedId: string): void => {
    const optionEls = [el("option", { text: "(변수 선택)", attrs: { value: "" } })];
    for (const entry of named) {
      optionEls.push(el("option", { text: entry.name, attrs: { value: entry.id } }));
    }
    // 이밌 저장된 이름 없는 변수는 id 로 남개놓는다 — 새 덤프는 아니고 유실도 없다.
    if (selectedId && !named.some((entry) => entry.id === selectedId)) {
      optionEls.push(el("option", { text: selectedId, attrs: { value: selectedId } }));
    }
    select.replaceChildren(...optionEls);
    select.value = selectedId;
  };
  rebuild(options.selectedId);
  select.addEventListener("change", () => options.onChange(select.value));

  const browse = el("button", {
    class: "btn small",
    text: "변수 목록",
    attrs: { type: "button", title: "변수 목록에서 고르기 (이름 지정도 여기서)" },
    dataset: { testid: `${options.testid}-browse` },
    on: {
      click: () =>
        openRecordPickerPanel({
          kind: "variable",
          currentId: select.value,
          onSelect: (id) => {
            rebuild(id);
            options.onChange(id);
          },
        }),
    },
  });

  const children: HTMLElement[] = [select, browse];
  if (named.length === 0) {
    children.push(
      el("span", {
        class: "battle-processing-variable-hint",
        dataset: { testid: `${options.testid}-empty-hint` },
        text: "이름 지정된 변수가 없습니다. 변수 목록에서 이름을 적으세요.",
      })
    );
  }
  const root = el("span", {
    class: "event-record-select battle-processing-variable-row",
    dataset: { testid: options.testid },
    children,
  });
  return { root, select };
}

export function changeGoldBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeGold" }>): HTMLElement {
  const project = store.getCurrent();
  // 연산 세그먼트(= / + / −). 기존 select(testid)는 세그먼트 안에 숨겨 호환 유지.
  const op = segmentedSelect({ options: AMOUNT_OP_SEGMENTS, value: cmd.op, testid: "change-gold-op-select", ariaLabel: "소지금 연산 선택" });
  const amount = numberInput(typeof cmd.amount === "number" ? cmd.amount : 0, "금액", "change-gold-amount-input");
  const preview = previewStrip("change-gold-preview", "시작 소지금 기준");
  const startGold = Math.max(0, startStateOf(project).gold ?? 0);
  const goldBadge = () => el("span", { class: "rich-gold-badge", text: "G", attrs: { "aria-hidden": "true" } });
  const renderPreview = () => {
    const after = previewAmountAfter(startGold, selectedOptionValue(op.select, AMOUNT_OP_OPTIONS, cmd.op), parseInt(amount.value, 10) || 0);
    preview.root.dataset.before = String(startGold);
    preview.root.dataset.after = String(after);
    preview.body.replaceChildren(
      goldBadge(),
      el("span", { text: `지금 ${startGold}G` }),
      el("span", { class: "rich-preview-arrow", text: "→" }),
      el("span", { class: `rich-preview-after ${deltaTone(startGold, after)}`, text: `실행 후 ${after}G` })
    );
  };
  const apply = () => {
    renderPreview();
    context.actions.replaceCommand(context.path, {
      kind: "changeGold",
      op: selectedOptionValue(op.select, AMOUNT_OP_OPTIONS, cmd.op),
      amount: parseInt(amount.value, 10) || 0,
    });
  };
  op.select.addEventListener("change", apply);
  amount.addEventListener("change", apply);
  // 타이핑 중에도 프리뷰만 라이브 갱신(저장은 change 시점).
  amount.addEventListener("input", renderPreview);
  renderPreview();
  const wrap = el("span", { class: "rich-command-form cream-command-form" });
  wrap.append(
    el("span", { class: "rich-form-row", children: [op.root, amountStepper(amount, { testidBase: "change-gold-amount" })] }),
    preview.root
  );
  return wrap;
}

export function changeItemBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeItem" }>): HTMLElement {
  const project = store.getCurrent();
  const items = project.database.items;
  const startInventory = startStateOf(project).inventory;
  // 아이템 픽커: 카드에 아이콘 + 이름 + 시작 보유 수량.
  const item = recordPickerWithPreview({
    records: items,
    selectedId: cmd.itemId,
    placeholder: "아이템 선택",
    testid: "change-item-select",
    iconOf: (record) => imageIconOf(project, record.iconResourceId ?? record.imageResourceId),
    subtitleOf: (record) => `시작 보유 ×${startInventory[record.id] ?? 0}`,
  });
  const op = segmentedSelect({ options: AMOUNT_OP_SEGMENTS, value: cmd.op, testid: "change-item-op-select", ariaLabel: "아이템 연산 선택" });
  const amount = numberInput(typeof cmd.amount === "number" ? cmd.amount : 0, "개수", "change-item-amount-input");
  const preview = previewStrip("change-item-preview", "시작 인벤토리 기준");
  const renderPreview = () => {
    const record = items.find((entry) => entry.id === item.select.value);
    if (!record) {
      delete preview.root.dataset.before;
      delete preview.root.dataset.after;
      preview.body.replaceChildren(
        el("span", { class: "rich-preview-hint", text: "아이템을 선택하면 전/후 개수가 표시됩니다." })
      );
      return;
    }
    const before = startInventory[record.id] ?? 0;
    const after = previewAmountAfter(before, selectedOptionValue(op.select, AMOUNT_OP_OPTIONS, cmd.op), parseInt(amount.value, 10) || 0);
    preview.root.dataset.before = String(before);
    preview.root.dataset.after = String(after);
    preview.body.replaceChildren(
      el("span", { text: "지금:" }),
      recordIconElement(imageIconOf(project, record.iconResourceId ?? record.imageResourceId), record.name),
      el("span", { text: `${record.name} ×${before}` }),
      el("span", { class: "rich-preview-arrow", text: "→" }),
      el("span", { class: `rich-preview-after ${deltaTone(before, after)}`, text: `실행 후 ×${after}` })
    );
  };
  const apply = () => {
    renderPreview();
    context.actions.replaceCommand(context.path, {
      kind: "changeItem",
      itemId: item.select.value,
      op: selectedOptionValue(op.select, AMOUNT_OP_OPTIONS, cmd.op),
      amount: parseInt(amount.value, 10) || 0,
    });
  };
  item.select.addEventListener("change", apply);
  op.select.addEventListener("change", apply);
  amount.addEventListener("change", apply);
  amount.addEventListener("input", renderPreview);
  renderPreview();
  const wrap = el("span", { class: "rich-command-form cream-command-form" });
  wrap.append(
    el("span", { class: "rich-form-row", children: [item.root] }),
    el("span", { class: "rich-form-row", children: [op.root, amountStepper(amount, { testidBase: "change-item-amount" })] }),
    preview.root
  );
  return wrap;
}

// 전/후 값 변화 색조: 증가 gain(성공색) / 감소 loss(위험색) / 동일 none.
function deltaTone(before: number, after: number): string {
  if (after > before) return "gain";
  if (after < before) return "loss";
  return "";
}


/** Empty string / undefined omits the property. Non-empty IDs are kept exact (no trim). */
function optionalResultVariableId(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === "") return undefined;
  return raw;
}

function resultVariableClearButton(
  testid: string,
  onClear: () => void,
): HTMLButtonElement {
  return el("button", {
    class: "btn small",
    text: "해제",
    attrs: {
      type: "button",
      title: "결과 변수 선택 해제",
      "aria-label": "결과 변수 선택 해제",
    },
    dataset: { testid },
    on: { click: () => onClear() },
  }) as HTMLButtonElement;
}

export function craftRecipeBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "craftRecipe" }>
): HTMLElement {
  const project = store.getCurrent();
  const recipes = craftRecipesOf(project).map((recipe) => ({
    id: recipe.id,
    name: recipe.name?.trim() || recipe.id,
    outputItemId: recipe.outputItemId,
    goldCost: recipe.goldCost ?? 0,
    ingredientCount: recipe.ingredients.length,
  }));
  let resultVariableId = optionalResultVariableId(cmd.resultVariableId);
  const recipe = recordPickerWithPreview({
    records: recipes,
    selectedId: cmd.recipeId,
    placeholder: "레시피 선택",
    testid: "craft-recipe-select",
    iconOf: (record) => {
      const item = project.database.items.find((entry) => entry.id === record.outputItemId);
      return imageIconOf(project, item?.iconResourceId ?? item?.imageResourceId);
    },
    subtitleOf: (record) => {
      const item = project.database.items.find((entry) => entry.id === record.outputItemId);
      const out = item?.name ?? record.outputItemId;
      const gold = record.goldCost > 0 ? ` · ${record.goldCost}G` : "";
      return `산출 ${out} · 재료 ${record.ingredientCount}종${gold}`;
    },
  });
  const apply = () => {
    const nextResult = optionalResultVariableId(resultVariableId);
    context.actions.replaceCommand(context.path, {
      kind: "craftRecipe",
      recipeId: recipe.select.value,
      ...(nextResult !== undefined ? { resultVariableId: nextResult } : {}),
    });
  };
  const resultVariable = databasePicker(
    "variable",
    resultVariableId ?? "",
    (variableId) => {
      resultVariableId = optionalResultVariableId(variableId);
      apply();
    },
    "craft-recipe-result-variable",
  );
  const clearResult = resultVariableClearButton("craft-recipe-result-variable-clear", () => {
    resultVariableId = undefined;
    const select = resultVariable.querySelector("select");
    if (select) select.value = "";
    const trigger = resultVariable.querySelector<HTMLElement>('[data-testid="event-variable-picker-open"]');
    if (trigger) trigger.textContent = "(선택)";
    apply();
  });
  recipe.select.addEventListener("change", apply);
  const wrap = el("span", { class: "rich-command-form cream-command-form" });
  wrap.append(el("span", { class: "rich-form-row", children: [recipe.root] }));
  wrap.append(
    el("label", {
      class: "inline-field rich-form-row",
      children: [el("span", { text: "결과 변수 (선택)" }), resultVariable, clearResult],
    }),
  );
  if (recipes.length === 0) {
    wrap.append(
      el("span", {
        class: "rich-form-hint",
        text: "등록된 레시피가 없습니다. 시스템에서 레시피를 먼저 만드세요.",
      })
    );
  }
  return wrap;
}

export function applyItemUpgradeBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "applyItemUpgrade" }>
): HTMLElement {
  const project = store.getCurrent();
  const rules = upgradeRulesOf(project).map((rule) => {
    const from = project.database.items.find((entry) => entry.id === rule.fromItemId)?.name.trim() || rule.fromItemId.replace(/^item_/, "").replace(/_/g, " ");
    const to = project.database.items.find((entry) => entry.id === rule.toItemId)?.name.trim() || rule.toItemId.replace(/^item_/, "").replace(/_/g, " ");
    return {
      id: rule.id,
      name: `${from} → ${to}`,
      fromItemId: rule.fromItemId,
      toItemId: rule.toItemId,
      goldCost: rule.goldCost ?? 0,
    };
  });
  let resultVariableId = optionalResultVariableId(cmd.resultVariableId);
  const upgrade = recordPickerWithPreview({
    records: rules,
    selectedId: cmd.upgradeId,
    placeholder: "업그레이드 규칙 선택",
    testid: "apply-item-upgrade-select",
    iconOf: (record) => {
      const item = project.database.items.find((entry) => entry.id === record.toItemId);
      return imageIconOf(project, item?.iconResourceId ?? item?.imageResourceId);
    },
    subtitleOf: (record) => {
      const from = project.database.items.find((entry) => entry.id === record.fromItemId)?.name ?? record.fromItemId;
      const to = project.database.items.find((entry) => entry.id === record.toItemId)?.name ?? record.toItemId;
      const gold = record.goldCost > 0 ? ` · ${record.goldCost}G` : "";
      return `${from} → ${to}${gold}`;
    },
  });
  const apply = () => {
    const nextResult = optionalResultVariableId(resultVariableId);
    context.actions.replaceCommand(context.path, {
      kind: "applyItemUpgrade",
      upgradeId: upgrade.select.value,
      ...(nextResult !== undefined ? { resultVariableId: nextResult } : {}),
    });
  };
  const resultVariable = databasePicker(
    "variable",
    resultVariableId ?? "",
    (variableId) => {
      resultVariableId = optionalResultVariableId(variableId);
      apply();
    },
    "apply-item-upgrade-result-variable",
  );
  const clearResult = resultVariableClearButton("apply-item-upgrade-result-variable-clear", () => {
    resultVariableId = undefined;
    const select = resultVariable.querySelector("select");
    if (select) select.value = "";
    const trigger = resultVariable.querySelector<HTMLElement>('[data-testid="event-variable-picker-open"]');
    if (trigger) trigger.textContent = "(선택)";
    apply();
  });
  upgrade.select.addEventListener("change", apply);
  const wrap = el("span", { class: "rich-command-form cream-command-form" });
  wrap.append(el("span", { class: "rich-form-row", children: [upgrade.root] }));
  wrap.append(
    el("label", {
      class: "inline-field rich-form-row",
      children: [el("span", { text: "결과 변수 (선택)" }), resultVariable, clearResult],
    }),
  );
  if (rules.length === 0) {
    wrap.append(
      el("span", {
        class: "rich-form-hint",
        text: "등록된 업그레이드가 없습니다. 시스템에서 규칙을 먼저 만드세요.",
      })
    );
  }
  return wrap;
}

export function equipToolBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "equipTool" }>
): HTMLElement {
  const project = store.getCurrent();
  const toolItems = project.database.items.filter((item) => Boolean(item.farmTool));
  const records = toolItems.length > 0 ? toolItems : project.database.items;
  const item = recordPickerWithPreview({
    records,
    selectedId: cmd.itemId ?? "",
    placeholder: "도구 해제",
    testid: "equip-tool-item-select",
    iconOf: (record) => imageIconOf(project, record.iconResourceId ?? record.imageResourceId),
    subtitleOf: (record) => (record.farmTool ? `농사 도구 · ${record.farmTool}` : (record.description ?? null)),
  });
  const apply = () => {
    const itemId = item.select.value.trim();
    context.actions.replaceCommand(context.path, {
      kind: "equipTool",
      ...(itemId ? { itemId } : {}),
    });
  };
  item.select.addEventListener("change", apply);
  const wrap = el("span", { class: "rich-command-form cream-command-form" });
  wrap.append(el("span", { class: "rich-form-row", children: [item.root] }));
  wrap.append(
    el("span", {
      class: "rich-form-hint",
      text: "비우면 손에 든 도구를 내려놓습니다.",
    })
  );
  return wrap;
}

export function openChestBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "openChest" }>
): HTMLElement {
  const scope = segmentedSelect({
    options: STORAGE_CHEST_SCOPE_SEGMENTS,
    value: cmd.chestId?.trim() ? "shared" : "local",
    testid: "open-chest-scope-select",
    ariaLabel: "보관 상자 연결 방식",
  });
  const chestId = el("input", {
    class: "storage-chest-shared-id",
    attrs: {
      type: "text",
      title: "같은 이름을 사용하는 상자끼리 보관 내용을 공유합니다",
      placeholder: "예: 마을 공동 창고",
      autocomplete: "off",
      spellcheck: "false",
    },
    value: cmd.chestId ?? "",
    dataset: { testid: "open-chest-id-input" },
  }) as HTMLInputElement;
  const scopeHint = el("span", {
    class: "storage-chest-scope-hint",
    dataset: { testid: "open-chest-scope-hint" },
  });
  const sharedSettings = el("div", {
    class: "storage-chest-shared-settings",
    dataset: { testid: "open-chest-shared-settings" },
    children: [
      labeledControl("공유 보관함 이름", chestId),
      el("span", {
        class: "rich-form-hint",
        text: "같은 이름을 지정한 다른 상자에서도 동일한 아이템을 꺼낼 수 있습니다.",
      }),
    ],
  });
  const syncScopeUi = () => {
    const shared = scope.select.value === "shared";
    sharedSettings.dataset.active = String(shared);
    sharedSettings.setAttribute("aria-hidden", String(!shared));
    chestId.disabled = !shared;
    scopeHint.textContent = shared
      ? "마을 공동 창고처럼 여러 상자가 하나의 보관 내용을 함께 엽니다."
      : "현재 이벤트가 있는 이 상자에만 아이템을 보관합니다. 가장 간단한 설정입니다.";
  };
  const apply = () => {
    const shared = scope.select.value === "shared";
    if (shared && !chestId.value.trim()) chestId.value = "shared_storage";
    const value = shared ? chestId.value.trim() : "";
    context.actions.replaceCommand(context.path, {
      kind: "openChest",
      ...(value ? { chestId: value } : {}),
    });
  };
  scope.select.addEventListener("change", () => {
    syncScopeUi();
    apply();
  });
  chestId.addEventListener("change", apply);
  chestId.addEventListener("input", apply);
  syncScopeUi();
  const wrap = el("div", {
    class: "rich-command-form cream-command-form storage-chest-command-body",
    dataset: { testid: "open-chest-command-body" },
  });
  wrap.append(
    el("div", {
      class: "storage-chest-purpose-card",
      dataset: { testid: "open-chest-purpose-card" },
      children: [
        el("span", {
          class: "storage-chest-glyph",
          attrs: { "aria-hidden": "true" },
          children: [
            el("span", { class: "storage-chest-glyph-lid" }),
            el("span", { class: "storage-chest-glyph-body" }),
          ],
        }),
        el("span", {
          class: "storage-chest-purpose-copy",
          children: [
            el("strong", { text: "아이템을 맡기고 다시 찾는 상자" }),
            el("span", { text: "플레이어가 소지품을 넣고 다시 꺼낼 수 있습니다." }),
          ],
        }),
        el("span", { class: "storage-chest-purpose-badge", text: "입출고" }),
      ],
    }),
    el("div", {
      class: "storage-chest-scope-section",
      children: [
        el("strong", { class: "storage-chest-section-label", text: "보관 내용 연결" }),
        scope.root,
        scopeHint,
      ],
    }),
    sharedSettings,
    el("div", {
      class: "storage-chest-treasure-note",
      children: [
        el("strong", { text: "아이템을 바로 주는 보물상자와는 다릅니다." }),
        el("span", { text: "한 번 지급하는 상자는 ‘아이템 변경’ 명령으로 만드세요." }),
      ],
    }),
  );
  return wrap;
}

export function changePartyBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeParty" }>): HTMLElement {
  const project = store.getCurrent();
  const actors = project.database.actors;
  const actor = actorPicker({
    project,
    selectedId: cmd.actorId,
    testid: "change-party-actor-select",
  });
  // 추가/제거 세그먼트(기존 select 는 숨김 호환 유지).
  const action = segmentedSelect({
    options: [
      { value: "add", label: "파티에 추가", key: "add" },
      { value: "remove", label: "파티에서 제거", key: "remove" },
    ],
    value: cmd.action,
    testid: "change-party-action-select",
    ariaLabel: "파티 동작 선택",
  });
  const preview = previewStrip("change-party-preview", "시작 파티 기준");
  const renderPreview = () => {
    const record = actors.find((entry) => entry.id === actor.select.value);
    if (!record) {
      delete preview.root.dataset.beforeIn;
      delete preview.root.dataset.afterIn;
      preview.body.replaceChildren(
        el("span", { class: "rich-preview-hint", text: "주인공을 선택하면 전/후 파티 상태가 표시됩니다." })
      );
      return;
    }
    const beforeIn = startStateOf(project).partyActorIds.includes(record.id);
    const afterIn = selectedOptionValue(action.select, PARTY_ACTION_OPTIONS, cmd.action) === "add";
    preview.root.dataset.beforeIn = String(beforeIn);
    preview.root.dataset.afterIn = String(afterIn);
    preview.body.replaceChildren(
      recordIconElement(facesetIconOf(project, record.faceResourceId), record.name),
      el("span", { text: `${record.name} — 지금: ${beforeIn ? "파티에 있음" : "파티에 없음"}` }),
      el("span", { class: "rich-preview-arrow", text: "→" }),
      el("span", {
        class: `rich-preview-after ${afterIn === beforeIn ? "" : afterIn ? "gain" : "loss"}`,
        text: `실행 후: ${afterIn ? "파티에 있음" : "파티에 없음"}`,
      })
    );
  };
  const apply = () => {
    renderPreview();
    context.actions.replaceCommand(context.path, {
      kind: "changeParty",
      actorId: actor.select.value,
      action: selectedOptionValue(action.select, PARTY_ACTION_OPTIONS, cmd.action),
    });
  };
  actor.select.addEventListener("change", apply);
  action.select.addEventListener("change", apply);
  renderPreview();
  const wrap = el("span", { class: "rich-command-form cream-command-form" });
  wrap.append(
    el("span", { class: "rich-form-row", children: [actor.root] }),
    el("span", { class: "rich-form-row", children: [action.root] }),
    preview.root
  );
  return wrap;
}

export function giveMonsterBody(context: CommandEditContext, cmd: Extract<Command, { kind: "giveMonster" }>): HTMLElement {
  const project = store.getCurrent();
  const speciesRecords = project.database.monsterSpecies ?? [];
  const species = recordPickerWithPreview({
    records: speciesRecords,
    selectedId: cmd.speciesId,
    placeholder: "species 선택",
    testid: "give-monster-species-select",
    iconOf: (record) => imageIconOf(project, record.graphic.monsterResourceId),
    subtitleOf: (record) => `포획률 ${Math.round(record.captureRate * 100)}% · HP ${record.baseStats.maxHp}`,
  });
  const level = numberInput(cmd.level, "레벨", "give-monster-level-input");
  level.min = "1";
  level.max = "99";
  const nickname = el("input", {
    attrs: { type: "text", placeholder: "별명(선택)" },
    value: cmd.nickname ?? "",
    dataset: { testid: "give-monster-nickname-input" },
  }) as HTMLInputElement;
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "giveMonster",
      speciesId: species.select.value,
      level: Math.max(1, Math.min(99, parseInt(level.value, 10) || 1)),
      nickname: nickname.value.trim() || undefined,
    });
  };
  species.select.addEventListener("change", apply);
  level.addEventListener("change", apply);
  nickname.addEventListener("change", apply);
  const wrap = el("span", { class: "rich-command-form cream-command-form" });
  wrap.append(
    el("span", { class: "rich-form-row", children: [species.root] }),
    el("span", { class: "rich-form-row", children: [
      el("label", { class: "inline-field", children: [el("span", { text: "레벨" }), amountStepper(level, { testidBase: "give-monster-level" })] }),
      el("label", { class: "inline-field", children: [el("span", { text: "별명" }), nickname] }),
    ] })
  );
  return wrap;
}

export function moveMonsterBody(context: CommandEditContext, cmd: Extract<Command, { kind: "moveMonster" }>): HTMLElement {
  const instanceId = el("input", {
    attrs: { type: "text", placeholder: "몬스터" },
    value: cmd.instanceId,
    dataset: { testid: "move-monster-instance-input" },
  }) as HTMLInputElement;
  const target = segmentedSelect({
    options: [
      { value: "party", label: "파티", key: "party" },
      { value: "box", label: "보관함", key: "box" },
    ],
    value: cmd.to,
    testid: "move-monster-target-select",
    ariaLabel: "몬스터 이동 대상",
  });
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "moveMonster",
      instanceId: instanceId.value.trim(),
      to: selectedOptionValue(target.select, MONSTER_MOVE_TARGET_OPTIONS, cmd.to),
    });
  };
  instanceId.addEventListener("change", apply);
  target.select.addEventListener("change", apply);
  const wrap = el("span", { class: "rich-command-form cream-command-form" });
  wrap.append(
    el("span", { class: "rich-form-row", children: [instanceId] }),
    el("span", { class: "rich-form-row", children: [target.root] })
  );
  return wrap;
}

export function evolveMonsterBody(context: CommandEditContext, cmd: Extract<Command, { kind: "evolveMonster" }>): HTMLElement {
  const project = store.getCurrent();
  const instanceId = el("input", {
    attrs: { type: "text", placeholder: "몬스터" },
    value: cmd.instanceId,
    dataset: { testid: "evolve-monster-instance-input" },
  }) as HTMLInputElement;
  const species = recordPickerWithPreview({
    records: project.database.monsterSpecies ?? [],
    selectedId: cmd.toSpeciesId ?? "",
    placeholder: "맞는 첫 진화",
    testid: "evolve-monster-species-select",
    iconOf: (record) => imageIconOf(project, record.graphic.monsterResourceId),
    subtitleOf: (record) => `HP ${record.baseStats.maxHp} · 포획률 ${Math.round(record.captureRate * 100)}%`,
  });
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "evolveMonster",
      instanceId: instanceId.value.trim(),
      toSpeciesId: species.select.value || undefined,
      successBranch: cmd.successBranch ?? [],
      failureBranch: cmd.failureBranch ?? [],
    });
  };
  instanceId.addEventListener("change", apply);
  species.select.addEventListener("change", apply);
  return el("span", {
    class: "rich-command-form cream-command-form",
    children: [
      el("span", { class: "rich-form-row", children: [instanceId] }),
      el("span", { class: "rich-form-row", children: [species.root] }),
    ],
  });
}

// 액터 카드 부제: 직업 이름(+ 초기 레벨). (learnSkill 등 다른 폼에서도 재사용)
export function actorSubtitle(project: Project, record: ActorRecord): string | null {
  const className = project.database.classes.find((entry) => entry.id === record.classId)?.name;
  const level = `Lv.${record.initialLevel}`;
  return className ? `${className} · ${level}` : level;
}

export function changeExpBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeExp" }>): HTMLElement {
  return actorAmountBody(context, cmd);
}

export function changeLevelBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeLevel" }>): HTMLElement {
  return actorAmountBody(context, cmd);
}

export function promoteActorBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "promoteActor" }>
): HTMLElement {
  const project = store.getCurrent();
  const actor = actorPicker({
    project,
    selectedId: cmd.actorId,
    testid: "promote-actor-select",
  });
  const klass = recordPickerWithPreview({
    records: project.database.classes,
    selectedId: cmd.toClassId ?? "",
    placeholder: "맞는 첫 승급",
    testid: "promote-class-select",
    subtitleOf: (record) => {
      const from = project.database.classes.find((source) => (source.promotions ?? []).some((promotion) => promotion.toClassId === record.id));
      return from ? `${from.name}에서 승급 가능` : "수동 목표";
    },
  });
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "promoteActor",
      actorId: actor.select.value,
      toClassId: klass.select.value || undefined,
      successBranch: cmd.successBranch ?? [],
      failureBranch: cmd.failureBranch ?? [],
    });
  };
  actor.select.addEventListener("change", apply);
  klass.select.addEventListener("change", apply);
  return el("span", {
    class: "rich-command-form cream-command-form",
    children: [
      el("span", { class: "rich-form-row", children: [actor.root] }),
      el("span", { class: "rich-form-row", children: [klass.root] }),
    ],
  });
}

export function changeActorHpBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeActorHp" }>): HTMLElement {
  return actorAmountBody(context, cmd);
}

export function changeActorMpBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeActorMp" }>): HTMLElement {
  return actorAmountBody(context, cmd);
}

export function changeEquipmentBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "changeEquipment" }>
): HTMLElement {
  const project = store.getCurrent();
  const equipmentCatalog = project.database.equipment;
  let currentSlot: ActorEquipmentSlot = cmd.slot;
  const slotOptions = equipmentSlots(project).map(({ id, label }) => ({ value: id, key: id, label }));

  const actor = actorPicker({
    project,
    selectedId: cmd.actorId,
    testid: "change-equipment-actor-select",
  });
  const slot = segmentedSelect({
    options: slotOptions,
    value: currentSlot,
    testid: "change-equipment-slot-select",
    ariaLabel: "장비 위치",
  });

  const equipmentBrowser = searchableRecordBrowser({
    records: equipmentForSlot(equipmentCatalog, currentSlot),
    selectedId: cmd.equipmentId,
    testidPrefix: "change-equipment",
    selectTestId: "change-equipment-equipment-select",
    selectedCardAliasTestId: "change-equipment-equipment-select-card",
    label: "장비",
    searchPlaceholder: "장비 이름·능력치 검색",
    emptySelectionLabel: "장비 해제",
    emptySelectionMeta: () => `${slotLabel(currentSlot)} 비우기`,
    noneCardLabel: "장비 해제",
    noneCardMeta: "벗기기",
    clearLabel: "해제",
    allowNone: true,
    includeNoneCard: false,
    iconOf: (record) => imageIconOf(project, record.iconResourceId ?? record.imageResourceId),
    subtitleOf: (record) => equipmentSubtitle(record),
    searchTextOf: (record) =>
      [record.name, record.id, record.description, equipmentSubtitle(record) ?? "", ...equipmentBonusLines(record)].join(" "),
    onChange: (equipmentId) => {
      commit(equipmentId);
    },
  });

  const preview = el("div", {
    class: "change-equipment-preview",
    dataset: { testid: "change-equipment-preview" },
  });
  const warning = el("p", {
    class: "change-equipment-warning",
    dataset: { testid: "change-equipment-warning" },
  });

  const commit = (equipmentId = equipmentBrowser.getSelectedId()) => {
    currentSlot = selectedOptionValue(slot.select, slotOptions, currentSlot);
    context.actions.replaceCommand(context.path, {
      kind: "changeEquipment",
      actorId: actor.select.value,
      slot: currentSlot,
      equipmentId,
    });
    renderPreview();
    renderWarning();
  };

  const renderPreview = () => {
    const actorRecord = project.database.actors.find((entry) => entry.id === actor.select.value);
    const selectedId = equipmentBrowser.getSelectedId();
    const selected = equipmentCatalog.find((entry) => entry.id === selectedId);
    const beforeId = actorRecord?.initialEquipment[currentSlot];
    const before = beforeId ? equipmentCatalog.find((entry) => entry.id === beforeId) : undefined;

    if (!actorRecord) {
      preview.replaceChildren(
        el("p", { class: "change-equipment-preview-empty", text: "주인공을 선택하면 장착 전/후가 표시됩니다." })
      );
      return;
    }

    const beforeCell = previewEquipmentCell("현재", before, project);
    const afterCell = selected
      ? previewEquipmentCell("변경 후", selected, project)
      : el("div", {
          class: "change-equipment-preview-cell is-unequip",
          children: [
            el("div", { class: "change-equipment-preview-cell-label", text: "변경 후" }),
            el("div", {
              class: "change-equipment-preview-cell-main",
              children: [
                el("span", { class: "record-browser-card-icon empty", text: "×" }),
                el("div", {
                  class: "change-equipment-preview-copy",
                  children: [
                    el("strong", { text: "장비 해제" }),
                    el("span", { class: "change-equipment-preview-bonuses", text: `${slotLabel(currentSlot)} 비우기` }),
                  ],
                }),
              ],
            }),
          ],
        });

    preview.replaceChildren(
      el("div", {
        class: "change-equipment-preview-head",
        children: [
          el("div", {
            class: "change-equipment-preview-actor",
            children: [
              recordIconElement(facesetIconOf(project, actorRecord.faceResourceId), actorRecord.name),
              el("div", {
                class: "change-equipment-preview-copy",
                children: [
                  el("strong", { text: actorRecord.name }),
                  el("span", { class: "change-equipment-preview-caption", text: slotLabel(currentSlot) }),
                ],
              }),
            ],
          }),
        ],
      }),
      el("div", {
        class: "change-equipment-preview-swap",
        children: [beforeCell, el("span", { class: "rich-preview-arrow", text: "→" }), afterCell],
      })
    );
  };

  const renderWarning = () => {
    const actorRecord = project.database.actors.find((entry) => entry.id === actor.select.value);
    const selectedId = equipmentBrowser.getSelectedId();
    const selected = selectedId ? equipmentCatalog.find((entry) => entry.id === selectedId) : undefined;
    if (!actorRecord || !selected) {
      warning.hidden = true;
      warning.textContent = "";
      return;
    }
    const actorBlocked =
      selected.equippableActorIds.length > 0 && !selected.equippableActorIds.includes(actorRecord.id);
    const classBlocked =
      selected.equippableClassIds.length > 0 && !selected.equippableClassIds.includes(actorRecord.classId);
    if (!actorBlocked && !classBlocked) {
      warning.hidden = true;
      warning.textContent = "";
      return;
    }
    const reasons: string[] = [];
    if (actorBlocked) reasons.push("이 주인공은 장착 불가");
    if (classBlocked) reasons.push("현재 직업은 장착 불가");
    warning.hidden = false;
    warning.textContent = `주의: ${reasons.join(" · ")} (DB 제한). 이벤트는 그대로 저장됩니다.`;
  };

  actor.select.addEventListener("change", () => commit());
  slot.select.addEventListener("change", () => {
    currentSlot = selectedOptionValue(slot.select, slotOptions, currentSlot);
    const filtered = equipmentForSlot(equipmentCatalog, currentSlot);
    equipmentBrowser.setRecords(filtered);
    const selectedId = equipmentBrowser.getSelectedId();
    const stillValid = selectedId !== "" && filtered.some((entry) => entry.id === selectedId);
    if (!stillValid) equipmentBrowser.setSelectedId("");
    commit(equipmentBrowser.getSelectedId());
  });

  renderPreview();
  renderWarning();

  const wrap = el("div", {
    class: "rich-command-form cream-command-form change-equipment-command-body",
    dataset: { testid: "change-equipment-command-body" },
  });
  wrap.append(
    el("div", {
      class: "party-member-intent",
      dataset: { testid: "change-equipment-intent" },
      children: [
        el("div", { class: "party-member-intent-title", text: "장비 변경" }),
        el("p", {
          class: "party-member-intent-body",
          text: "주인공의 장비를 갈아입히거나 벗깁니다. 바꾸기 전후를 바로 볼 수 있습니다.",
        }),
      ],
    }),
    el("div", {
      class: "change-equipment-layout",
      children: [
        el("div", {
          class: "change-equipment-toolbar",
          children: [
            equipmentField("주인공", actor.root),
            equipmentField("어디", slot.root),
          ],
        }),
        preview,
        equipmentBrowser.root,
        warning,
      ],
    })
  );
  return wrap;
}

function equipmentForSlot(records: readonly EquipmentRecord[], slot: ActorEquipmentSlot): EquipmentRecord[] {
  return records.filter((record) => record.slot === slot);
}

function slotLabel(slot: ActorEquipmentSlot): string {
  return equipmentSlotLabel(store.getCurrent(), slot);
}

function equipmentSubtitle(record: EquipmentRecord): string | null {
  const bonuses = equipmentBonusLines(record);
  const base = slotLabel(record.slot);
  return bonuses.length > 0 ? `${base} · ${bonuses.join(" ")}` : base;
}

function equipmentBonusLines(record: EquipmentRecord): string[] {
  const bonuses: string[] = [];
  if (record.statBonuses.attack !== 0) bonuses.push(`공격 ${signed(record.statBonuses.attack)}`);
  if (record.statBonuses.defense !== 0) bonuses.push(`방어 ${signed(record.statBonuses.defense)}`);
  if (record.statBonuses.mind !== 0) bonuses.push(`정신 ${signed(record.statBonuses.mind)}`);
  if (record.statBonuses.agility !== 0) bonuses.push(`민첩 ${signed(record.statBonuses.agility)}`);
  return bonuses;
}

function previewEquipmentCell(
  label: string,
  record: EquipmentRecord | undefined,
  project: Project
): HTMLElement {
  if (!record) {
    return el("div", {
      class: "change-equipment-preview-cell is-unequip",
      children: [
        el("div", { class: "change-equipment-preview-cell-label", text: label }),
        el("div", {
          class: "change-equipment-preview-cell-main",
          children: [
            el("span", { class: "record-browser-card-icon empty", text: "×" }),
            el("div", {
              class: "change-equipment-preview-copy",
              children: [
                el("strong", { text: "없음" }),
                el("span", { class: "change-equipment-preview-bonuses", text: "미장착" }),
              ],
            }),
          ],
        }),
      ],
    });
  }
  const bonuses = equipmentBonusLines(record);
  return el("div", {
    class: "change-equipment-preview-cell",
    children: [
      el("div", { class: "change-equipment-preview-cell-label", text: label }),
      el("div", {
        class: "change-equipment-preview-cell-main",
        children: [
          recordIconElement(imageIconOf(project, record.iconResourceId ?? record.imageResourceId), record.name),
          el("div", {
            class: "change-equipment-preview-copy",
            children: [
              el("strong", { text: record.name }),
              el("span", {
                class: "change-equipment-preview-bonuses",
                text: bonuses.length > 0 ? bonuses.join(" ") : slotLabel(record.slot),
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function equipmentField(label: string, control: HTMLElement): HTMLElement {
  return el("div", {
    class: "change-equipment-field",
    children: [el("div", { class: "change-equipment-field-label", text: label }), control],
  });
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function enterHeroNameBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "enterHeroName" }>
): HTMLElement {
  const project = store.getCurrent();
  const actor = actorPicker({
    project,
    selectedId: cmd.actorId,
    testid: "enter-hero-name-actor-select",
  });
  const maxLength = el("input", {
    attrs: { type: "number", min: "1", max: "12", title: "최대 글자 수" },
    value: String(cmd.maxLength),
    dataset: { testid: "enter-hero-name-max-length" },
  }) as HTMLInputElement;
  const showInitial = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "enter-hero-name-show-initial" } }) as HTMLInputElement;
  showInitial.checked = cmd.showInitialName;

  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "enterHeroName",
      actorId: actor.select.value,
      maxLength: clampMaxLengthInput(maxLength.value),
      showInitialName: showInitial.checked,
    });
  };
  actor.select.addEventListener("change", apply);
  maxLength.addEventListener("change", apply);
  showInitial.addEventListener("change", apply);
  const wrap = el("span", {});
  wrap.append(
    actor.root,
    labeledControl("최대 글자", maxLength),
    labeledControl("초기 이름 표시", showInitial)
  );
  return wrap;
}

function labeledControl(label: string, control: HTMLElement): HTMLElement {
  return el("label", { class: "inline-field", children: [el("span", { text: label }), control] });
}

function clampMaxLengthInput(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 6;
  return Math.max(1, Math.min(12, parsed));
}

export function recoverAllBody(context: CommandEditContext, cmd: Extract<Command, { kind: "recoverAll" }>): HTMLElement {
  const project = store.getCurrent();
  const actor = actorPicker({
    project,
    selectedId: cmd.actorId ?? "",
    placeholder: "파티 전체",
    testid: "recover-all-actor-select",
  });
  actor.select.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      kind: "recoverAll",
      actorId: actor.select.value,
    });
  });
  return actor.root;
}

function actorAmountBody(context: CommandEditContext, cmd: ActorAmountCommand): HTMLElement {
  const project = store.getCurrent();
  const labels = actorAmountLabels(cmd.kind);
  const supportsPercent = cmd.kind === "changeActorHp" || cmd.kind === "changeActorMp";
  const actor = actorPicker({
    project,
    selectedId: cmd.actorId,
    testid: labels.actorTestId,
  });
  const op = segmentedSelect({
    options: AMOUNT_OP_SEGMENTS,
    value: cmd.op,
    testid: labels.opTestId,
    ariaLabel: `${labels.amountTitle} 연산`,
  });
  const amountModeValue: "flat" | "percent" =
    supportsPercent && "amountMode" in cmd && cmd.amountMode === "percent" ? "percent" : "flat";
  const amountMode = supportsPercent
    ? segmentedSelect({
        options: VITAL_AMOUNT_MODE_SEGMENTS,
        value: amountModeValue,
        testid: cmd.kind === "changeActorHp" ? "change-actor-hp-amount-mode" : "change-actor-mp-amount-mode",
        ariaLabel: `${labels.amountTitle} 단위`,
      })
    : null;
  const amount = numberInput(typeof cmd.amount === "number" ? cmd.amount : 0, labels.amountTitle, labels.amountTestId);
  const stepper = amountStepper(amount, { testidBase: labels.amountTestId.replace(/-input$/, "") });
  // Neutral wrappers preserve native hidden behavior despite the controls' flex display rules.
  const amountField = cmd.kind === "changeExp" ? el("span", { children: [stepper] }) : stepper;
  const actorField = cmd.kind === "changeExp" ? el("span", { children: [actor.root] }) : actor.root;
  const exp = cmd.kind === "changeExp" ? expOperandControls(cmd, () => apply()) : null;
  const presetsHost = supportsPercent
    ? el("div", {
        class: "actor-amount-presets",
        dataset: {
          testid: cmd.kind === "changeActorHp" ? "change-actor-hp-amount-presets" : "change-actor-mp-amount-presets",
        },
      })
    : null;
  const preview = previewStrip(
    cmd.kind === "changeActorHp"
      ? "change-actor-hp-preview"
      : cmd.kind === "changeActorMp"
        ? "change-actor-mp-preview"
        : "change-level-preview",
    supportsPercent ? "고정 또는 최대치 %" : cmd.kind === "changeExp" ? "실행할 경험치 조작" : "시작값 기준"
  );

  const currentMode = (): "flat" | "percent" => {
    if (!amountMode) return "flat";
    return amountMode.select.value === "percent" ? "percent" : "flat";
  };
  const resolveAmount = (): number => {
    const raw = Math.max(0, Math.trunc(Number.parseInt(amount.value, 10) || 0));
    return currentMode() === "percent" ? Math.min(100, raw) : raw;
  };
  const baselineOf = (record: ActorRecord): number => {
    if (cmd.kind === "changeLevel" || cmd.kind === "changeExp") return record.initialLevel;
    const curves = record.parameterCurves;
    const idx = Math.max(0, record.initialLevel - 1);
    if (cmd.kind === "changeActorHp") return Math.max(1, curves?.maxHp?.[idx] ?? curves?.maxHp?.[0] ?? 1);
    if (cmd.kind === "changeActorMp") return Math.max(0, curves?.maxMp?.[idx] ?? curves?.maxMp?.[0] ?? 0);
    return 0;
  };
  const renderPreview = () => {
    const record = project.database.actors.find((entry) => entry.id === actor.select.value);
    if (exp) {
      const operand = exp.amount(resolveAmount());
      const amountLabel = typeof operand === "number" ? String(operand)
        : project.variables.find((variable) => variable.id === operand.id)?.name || operand.id;
      preview.body.replaceChildren(el("span", {
        class: "rich-preview-hint",
        text: `${exp.actorId(actor.select.value) ? record?.name ?? "주인공" : "파티 전체"} · 경험치 ${op.select.value} ${amountLabel}`,
      }));
      return;
    }
    if (!record) {
      preview.body.replaceChildren(el("span", { class: "rich-preview-hint", text: "주인공을 선택하면 전/후 값이 표시됩니다." }));
      return;
    }
    const opValue = selectedOptionValue(op.select, AMOUNT_OP_OPTIONS, cmd.op);
    const amountValue = resolveAmount();
    const before = baselineOf(record);
    const effective = currentMode() === "percent" ? Math.trunc((Math.max(0, before) * amountValue) / 100) : amountValue;
    const after = previewAmountAfter(before, opValue, effective);
    const unit = currentMode() === "percent" ? `${amountValue}% (${effective})` : String(amountValue);
    preview.body.replaceChildren(
      recordIconElement(facesetIconOf(project, record.faceResourceId), record.name),
      el("span", { text: `${record.name} · ${labels.amountTitle} ${before}` }),
      el("span", { class: "rich-preview-arrow", text: "→" }),
      el("span", { class: "rich-preview-after", text: String(after) }),
      el("span", { class: "rich-preview-hint", text: unit })
    );
  };
  const apply = () => {
    if (currentMode() === "percent" && (Number.parseInt(amount.value, 10) || 0) > 100) amount.value = "100";
    renderPreview();
    const next = actorAmountCommand(
      cmd.kind,
      actor.select.value,
      selectedOptionValue(op.select, AMOUNT_OP_OPTIONS, cmd.op),
      resolveAmount(),
      supportsPercent ? currentMode() : undefined
    );
    exp?.sync(actorField, amountField);
    context.actions.replaceCommand(context.path, exp ? {
      kind: "changeExp",
      actorId: exp.actorId(actor.select.value),
      op: selectedOptionValue(op.select, AMOUNT_OP_OPTIONS, cmd.op),
      amount: exp.amount(resolveAmount()),
    } : next);
  };

  if (presetsHost && amountMode) {
    const prefix = cmd.kind === "changeActorHp" ? "change-actor-hp-amount" : "change-actor-mp-amount";
    const items: readonly { id: string; label: string; run: () => void }[] = [
      {
        id: "heal-full",
        label: "완전 회복",
        run: () => {
          op.select.value = "=";
          amountMode.select.value = "percent";
          amount.value = "100";
          op.select.dispatchEvent(new Event("change"));
          amountMode.select.dispatchEvent(new Event("change"));
          apply();
        },
      },
      {
        id: "heal-50",
        label: "+50%",
        run: () => {
          op.select.value = "+=";
          amountMode.select.value = "percent";
          amount.value = "50";
          op.select.dispatchEvent(new Event("change"));
          amountMode.select.dispatchEvent(new Event("change"));
          apply();
        },
      },
      {
        id: "heal-25",
        label: "+25%",
        run: () => {
          op.select.value = "+=";
          amountMode.select.value = "percent";
          amount.value = "25";
          op.select.dispatchEvent(new Event("change"));
          amountMode.select.dispatchEvent(new Event("change"));
          apply();
        },
      },
      {
        id: "dmg-25",
        label: "-25%",
        run: () => {
          op.select.value = "-=";
          amountMode.select.value = "percent";
          amount.value = "25";
          op.select.dispatchEvent(new Event("change"));
          amountMode.select.dispatchEvent(new Event("change"));
          apply();
        },
      },
      {
        id: "flat-10",
        label: "+10",
        run: () => {
          op.select.value = "+=";
          amountMode.select.value = "flat";
          amount.value = "10";
          op.select.dispatchEvent(new Event("change"));
          amountMode.select.dispatchEvent(new Event("change"));
          apply();
        },
      },
    ];
    for (const item of items) {
      presetsHost.append(
        el("button", {
          class: "btn small actor-amount-preset-btn",
          text: item.label,
          attrs: { type: "button" },
          dataset: { testid: `${prefix}-preset-${item.id}` },
          on: { click: () => item.run() },
        })
      );
    }
  }

  actor.select.addEventListener("change", apply);
  op.select.addEventListener("change", apply);
  amountMode?.select.addEventListener("change", apply);
  amount.addEventListener("change", apply);
  amount.addEventListener("input", renderPreview);
  exp?.sync(actorField, amountField);
  renderPreview();

  return el("div", {
    class: "rich-command-form cream-command-form actor-amount-command-body",
    dataset: {
      testid:
        cmd.kind === "changeActorHp"
          ? "change-actor-hp-command-body"
          : cmd.kind === "changeActorMp"
            ? "change-actor-mp-command-body"
            : cmd.kind === "changeExp" ? "event-command-exp-form" : "change-level-command-body",
    },
    children: [
      el("div", {
        class: "party-member-intent",
        children: [
          el("div", {
            class: "party-member-intent-title",
            text: labels.amountTitle === "HP" ? "HP 변경" : labels.amountTitle === "MP" ? "MP 변경" : `${labels.amountTitle} 변경`,
          }),
          el("p", {
            class: "party-member-intent-body",
            text: supportsPercent
              ? `${labels.amountTitle}${objectParticle(labels.amountTitle)} 고정값 또는 최대치 %로 가감합니다.`
              : `${labels.amountTitle}${objectParticle(labels.amountTitle)} 이벤트에서 가감합니다.`,
          }),
        ],
      }),
      ...(exp ? [exp.target] : []),
      el("div", { class: "rich-form-row", children: [actorField] }),
      el("div", {
        class: "rich-form-row actor-amount-controls",
        children: [
          op.root,
          ...(amountMode ? [amountMode.root] : []),
          ...(exp ? [exp.source] : []),
          amountField,
          ...(exp ? [exp.variable] : []),
        ],
      }),
      ...(presetsHost ? [presetsHost] : []),
      preview.root,
    ],
  });
}

function actorAmountCommand(
  kind: ActorAmountCommand["kind"],
  actorId: string,
  op: ActorAmountOp,
  amount: number,
  amountMode?: "flat" | "percent"
): ActorAmountCommand {
  switch (kind) {
    case "changeExp":
      return { kind, actorId, op, amount };
    case "changeLevel":
      return { kind, actorId, op, amount };
    case "changeActorHp":
      return amountMode && amountMode !== "flat" ? { kind, actorId, op, amount, amountMode } : { kind, actorId, op, amount };
    case "changeActorMp":
      return amountMode && amountMode !== "flat" ? { kind, actorId, op, amount, amountMode } : { kind, actorId, op, amount };
  }
}

function actorAmountLabels(kind: ActorAmountCommand["kind"]): {
  readonly actorTestId: string;
  readonly opTestId: string;
  readonly amountTestId: string;
  readonly amountTitle: string;
} {
  switch (kind) {
    case "changeExp":
      return {
        actorTestId: "change-exp-actor-select",
        opTestId: "change-exp-op-select",
        amountTestId: "change-exp-amount-input",
        amountTitle: "경험치",
      };
    case "changeLevel":
      return {
        actorTestId: "change-level-actor-select",
        opTestId: "change-level-op-select",
        amountTestId: "change-level-amount-input",
        amountTitle: "레벨",
      };
    case "changeActorHp":
      return {
        actorTestId: "change-actor-hp-actor-select",
        opTestId: "change-actor-hp-op-select",
        amountTestId: "change-actor-hp-amount-input",
        amountTitle: "HP",
      };
    case "changeActorMp":
      return {
        actorTestId: "change-actor-mp-actor-select",
        opTestId: "change-actor-mp-op-select",
        amountTestId: "change-actor-mp-amount-input",
        amountTitle: "MP",
      };
  }
}
/** 끝음절 받침에 맞는 목적격 조사 — "레벨를" 같은 오기를 막는다(HP/MP는 받침 없음 → 를). */
function objectParticle(word: string): string {
  const lastChar = word.at(-1) ?? "";
  const code = lastChar.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "를";
  return (code - 0xac00) % 28 !== 0 ? "을" : "를";
}

function numberInput(value: number, title: string, testId: string): HTMLInputElement {
  return el("input", {
    attrs: { type: "number", min: "0", title },
    value: String(value),
    dataset: { testid: testId },
  }) as HTMLInputElement;
}

