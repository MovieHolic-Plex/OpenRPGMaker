import { startStateOf } from "@/project/session";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { selectWithOptions, selectedOptionValue } from "./dom";
import {
  AMOUNT_OP_SEGMENTS,
  amountStepper,
  facesetIconOf,
  imageIconOf,
  previewAmountAfter,
  previewStrip,
  recordIconElement,
  recordPickerWithPreview,
  segmentedSelect,
} from "./recordPicker";
import type { ActorAmountOp, ActorEquipmentSlot, ActorRecord, Command, Project } from "@/project/types";
import type { CommandEditContext } from "./types";

const AMOUNT_OP_OPTIONS = [
  { value: "=", label: "대입" },
  { value: "+=", label: "증가" },
  { value: "-=", label: "감소" },
] as const;

const PARTY_ACTION_OPTIONS = [
  { value: "add", label: "파티에 추가" },
  { value: "remove", label: "파티에서 제거" },
] as const;

const BATTLE_FLOW_OPTIONS = [
  { value: "inherit", label: "시스템/트룹 설정" },
  { value: "gauge", label: "게이지" },
  { value: "strict", label: "엄격 턴제" },
] as const;

const EQUIPMENT_SLOT_OPTIONS = [
  { value: "weapon", label: "무기" },
  { value: "shield", label: "방패" },
  { value: "armor", label: "갑옷" },
  { value: "helmet", label: "투구" },
  { value: "accessory", label: "장식품" },
] as const satisfies readonly { readonly value: ActorEquipmentSlot; readonly label: string }[];

type ActorAmountCommand = Extract<Command, { kind: "changeExp" | "changeLevel" | "changeActorHp" | "changeActorMp" }>;

export function battleProcessingBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "battleProcessing" }>
): HTMLElement {
  const project = store.getCurrent();
  // 트룹 픽커: 카드 부제에 소속 적 이름을 나열해 어떤 전투인지 즉시 보이게 한다.
  const troop = recordPickerWithPreview({
    records: project.database.troops,
    selectedId: cmd.troopId,
    placeholder: "적 그룹 선택",
    testid: "battle-processing-troop-select",
    iconOf: (record) => {
      const firstEnemyId = record.enemyIds[0];
      const enemy = project.database.enemies.find((entry) => entry.id === firstEnemyId);
      return imageIconOf(project, enemy?.monsterResourceId);
    },
    subtitleOf: (record) => troopMemberNames(project, record.enemyIds),
  });
  const canEscape = checkbox("탈출 허용", cmd.canEscape, "battle-processing-escape-checkbox");
  const canLose = checkbox("패배 허용", cmd.canLose, "battle-processing-lose-checkbox");
  const flow = selectWithOptions(BATTLE_FLOW_OPTIONS, cmd.battleFlow ?? "inherit", "battle-processing-flow-select");
  const apply = () => {
    const battleFlow = selectedOptionValue(flow, BATTLE_FLOW_OPTIONS, "inherit");
    context.actions.replaceCommand(context.path, {
      kind: "battleProcessing",
      troopId: troop.select.value,
      canEscape: canEscape.input.checked,
      canLose: canLose.input.checked,
      battleFlow: battleFlow === "inherit" ? undefined : battleFlow,
    });
  };
  troop.select.addEventListener("change", apply);
  canEscape.input.addEventListener("change", apply);
  canLose.input.addEventListener("change", apply);
  flow.addEventListener("change", apply);
  const wrap = el("span", { class: "rich-command-form" });
  wrap.append(
    el("span", { class: "rich-form-row", children: [troop.root] }),
    el("span", { class: "rich-form-row", children: [canEscape.label, canLose.label, flow] })
  );
  return wrap;
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

export function changeGoldBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeGold" }>): HTMLElement {
  const project = store.getCurrent();
  // 연산 세그먼트(= / + / −). 기존 select(testid)는 세그먼트 안에 숨겨 호환 유지.
  const op = segmentedSelect({ options: AMOUNT_OP_SEGMENTS, value: cmd.op, testid: "change-gold-op-select", ariaLabel: "소지금 연산 선택" });
  const amount = numberInput(cmd.amount, "금액", "change-gold-amount-input");
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
  const wrap = el("span", { class: "rich-command-form" });
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
  const amount = numberInput(cmd.amount, "개수", "change-item-amount-input");
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
  const wrap = el("span", { class: "rich-command-form" });
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

export function changePartyBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeParty" }>): HTMLElement {
  const project = store.getCurrent();
  const actors = project.database.actors;
  const actor = recordPickerWithPreview({
    records: actors,
    selectedId: cmd.actorId,
    placeholder: "주인공 선택",
    testid: "change-party-actor-select",
    iconOf: (record) => facesetIconOf(project, record.faceResourceId),
    subtitleOf: (record) => actorSubtitle(project, record),
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
  const wrap = el("span", { class: "rich-command-form" });
  wrap.append(
    el("span", { class: "rich-form-row", children: [actor.root] }),
    el("span", { class: "rich-form-row", children: [action.root] }),
    preview.root
  );
  return wrap;
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
  const actor = recordPickerWithPreview({
    records: project.database.actors,
    selectedId: cmd.actorId,
    placeholder: "주인공 선택",
    testid: "promote-actor-select",
    iconOf: (record) => facesetIconOf(project, record.faceResourceId),
    subtitleOf: (record) => actorSubtitle(project, record),
  });
  const klass = recordPickerWithPreview({
    records: project.database.classes,
    selectedId: cmd.toClassId ?? "",
    placeholder: "조건 충족 첫 승급",
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
    class: "rich-command-form",
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
  const actor = recordPickerWithPreview({
    records: project.database.actors,
    selectedId: cmd.actorId,
    placeholder: "주인공 선택",
    testid: "change-equipment-actor-select",
    iconOf: (record) => facesetIconOf(project, record.faceResourceId),
    subtitleOf: (record) => actorSubtitle(project, record),
  });
  const slot = selectWithOptions(EQUIPMENT_SLOT_OPTIONS, cmd.slot, "change-equipment-slot-select");
  // 장비 픽커: 아이콘 + 슬롯/주요 스탯 부제. 빈 값은 "장비 해제".
  const equipment = recordPickerWithPreview({
    records: project.database.equipment,
    selectedId: cmd.equipmentId,
    placeholder: "장비 해제",
    testid: "change-equipment-equipment-select",
    iconOf: (record) => imageIconOf(project, record.iconResourceId ?? record.imageResourceId),
    subtitleOf: (record) => {
      const slotLabel = EQUIPMENT_SLOT_OPTIONS.find((option) => option.value === record.slot)?.label ?? record.slot;
      const bonuses: string[] = [];
      if (record.statBonuses.attack !== 0) bonuses.push(`공격 ${signed(record.statBonuses.attack)}`);
      if (record.statBonuses.defense !== 0) bonuses.push(`방어 ${signed(record.statBonuses.defense)}`);
      return bonuses.length > 0 ? `${slotLabel} · ${bonuses.join(" ")}` : slotLabel;
    },
  });
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "changeEquipment",
      actorId: actor.select.value,
      slot: selectedOptionValue(slot, EQUIPMENT_SLOT_OPTIONS, cmd.slot),
      equipmentId: equipment.select.value,
    });
  };
  actor.select.addEventListener("change", apply);
  slot.addEventListener("change", apply);
  equipment.select.addEventListener("change", apply);
  const wrap = el("span", { class: "rich-command-form" });
  wrap.append(
    el("span", { class: "rich-form-row", children: [actor.root, slot] }),
    el("span", { class: "rich-form-row", children: [equipment.root] })
  );
  return wrap;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function enterHeroNameBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "enterHeroName" }>
): HTMLElement {
  const project = store.getCurrent();
  const actor = recordSelect(project.database.actors, cmd.actorId, "주인공 선택", "enter-hero-name-actor-select");
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
      actorId: actor.value,
      maxLength: clampMaxLengthInput(maxLength.value),
      showInitialName: showInitial.checked,
    });
  };
  actor.addEventListener("change", apply);
  maxLength.addEventListener("change", apply);
  showInitial.addEventListener("change", apply);
  const wrap = el("span", {});
  wrap.append(
    actor,
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
  const actor = recordSelect(project.database.actors, cmd.actorId ?? "", "파티 전체", "recover-all-actor-select");
  actor.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      kind: "recoverAll",
      actorId: actor.value,
    });
  });
  return actor;
}

function actorAmountBody(context: CommandEditContext, cmd: ActorAmountCommand): HTMLElement {
  const project = store.getCurrent();
  const labels = actorAmountLabels(cmd.kind);
  const actor = recordSelect(project.database.actors, cmd.actorId, "주인공 선택", labels.actorTestId);
  const op = selectWithOptions(AMOUNT_OP_OPTIONS, cmd.op, labels.opTestId);
  const amount = numberInput(cmd.amount, labels.amountTitle, labels.amountTestId);
  const apply = () => {
    const next = actorAmountCommand(
      cmd.kind,
      actor.value,
      selectedOptionValue(op, AMOUNT_OP_OPTIONS, cmd.op),
      parseInt(amount.value, 10) || 0
    );
    context.actions.replaceCommand(context.path, next);
  };
  actor.addEventListener("change", apply);
  op.addEventListener("change", apply);
  amount.addEventListener("change", apply);
  const wrap = el("span", {});
  wrap.append(actor, op, amount);
  return wrap;
}

function actorAmountCommand(
  kind: ActorAmountCommand["kind"],
  actorId: string,
  op: ActorAmountOp,
  amount: number
): ActorAmountCommand {
  switch (kind) {
    case "changeExp":
      return { kind, actorId, op, amount };
    case "changeLevel":
      return { kind, actorId, op, amount };
    case "changeActorHp":
      return { kind, actorId, op, amount };
    case "changeActorMp":
      return { kind, actorId, op, amount };
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

function recordSelect(
  records: readonly { readonly id: string; readonly name: string }[],
  currentId: string,
  placeholder: string,
  testId: string
): HTMLSelectElement {
  const select = el("select", { dataset: { testid: testId } }) as HTMLSelectElement;
  select.append(el("option", { text: `(${placeholder})`, attrs: { value: "" } }));
  for (const [index, record] of records.entries()) {
    select.append(el("option", { text: `${String(index + 1).padStart(4, "0")}: ${record.name}`, attrs: { value: record.id } }));
  }
  select.value = currentId;
  return select;
}

function numberInput(value: number, title: string, testId: string): HTMLInputElement {
  return el("input", {
    attrs: { type: "number", min: "0", title },
    value: String(value),
    dataset: { testid: testId },
  }) as HTMLInputElement;
}

function checkbox(text: string, checked: boolean, testId: string): { label: HTMLLabelElement; input: HTMLInputElement } {
  const input = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: testId },
  }) as HTMLInputElement;
  input.checked = checked;
  const label = el("label", { text }) as HTMLLabelElement;
  label.prepend(input);
  return { label, input };
}
