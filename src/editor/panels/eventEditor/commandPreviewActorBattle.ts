/**
 * 동료 · 전투 저작면 프리뷰.
 *
 * 계획: `.omo/plans/event-editor-actor-battle-adversarial-review.md`
 * - 파티는 얼굴 칩으로 보인다(전/후). 이름 한 줄이 아니다.
 * - HP/MP/EXP/레벨/능력치는 게이지·숫자다. `HP -= 10` 문장 카드는 프리뷰가 아니다.
 * - 얼굴 변경 프리뷰는 faceset 크롭이다. 요약 폴백은 실패로 본다.
 */
import { el } from "@/util/dom";
import { store } from "@/project/store";
import { normalizeActorRecord, parameterValueAtLevel, totalExpForLevel } from "@/project/actorModel";
import { syncActorVitals, type ActorVitals } from "@/project/sessionVitals";
import type { ActorRecord, Command, Project, VariableOperand } from "@/project/types";
import { renderFacesetCrop } from "./facesetPreview";

type M2Command = Extract<Command, { kind: "m2Command" }>;
type VitalKind = "hp" | "mp";
type GaugeKind = VitalKind | "exp" | "level" | "param";

export type ActorBattlePreviewDeps = {
  /** 아이콘 리소스를 그리는 공용 헬퍼(commandPreview 의 heroIcon). */
  readonly icon: (resourceId: string | undefined, name: string, size: number) => HTMLElement;
  /** 변수 이름 표기(commandPreview 의 variablePreviewName). */
  readonly variableName: (variableId: string) => string;
  /** 미리보기 시뮬레이션이 있으면 현재 파티. */
  readonly simPartyActorIds?: readonly string[];
};

/** 파티 지정(빈 값/"party"/"all")이면 시작 파티 전원, 아니면 지정 배우 한 명. */
function previewActorTargets(project: Project, actorId: string | undefined): readonly ActorRecord[] {
  const wantsParty = !actorId || actorId === "party" || actorId === "all";
  if (!wantsParty) {
    const one = project.database.actors.find((actor) => actor.id === actorId);
    return one ? [one] : [];
  }
  const party = (project.session?.partyActorIds ?? [])
    .flatMap((id) => project.database.actors.find((actor) => actor.id === id) ?? []);
  return party.length > 0 ? party : project.database.actors.slice(0, 1);
}

function previewActorVitals(project: Project, actor: ActorRecord): ActorVitals {
  const vitals: Record<string, ActorVitals> = {};
  syncActorVitals(project, vitals, actor.id);
  const found = vitals[actor.id];
  if (found) return found;
  const normalized = normalizeActorRecord(actor);
  const maxHp = parameterValueAtLevel(normalized.parameterCurves.maxHp, normalized.initialLevel);
  const maxMp = parameterValueAtLevel(normalized.parameterCurves.maxMp, normalized.initialLevel);
  return { hp: maxHp, mp: maxMp, maxHp, maxMp };
}

/** 얼굴 칩 — 배우를 이름이 아니라 얼굴로 식별한다. */
export function actorFaceChip(
  actor: ActorRecord | undefined,
  options: {
    readonly caption?: string;
    readonly state?: "join" | "leave";
    readonly size?: number;
  } = {}
): HTMLElement {
  const chip = el("div", {
    class: `ecp-party-chip${options.state ? ` is-${options.state}` : ""}`,
    dataset: { testid: "ecp-party-chip", ...(options.state ? { chipState: options.state } : {}) },
  });
  chip.append(
    renderFacesetCrop({
      resourceId: actor?.faceResourceId ?? "",
      displaySize: options.size ?? 56,
    })
  );
  chip.append(el("span", { class: "ecp-party-chip-name", text: actor?.name ?? "(주인공 선택)" }));
  if (options.caption) chip.append(el("span", { class: "ecp-party-chip-caption", text: options.caption }));
  return chip;
}

function partyChipRow(actors: readonly ActorRecord[], testId: string): HTMLElement {
  const row = el("div", { class: "ecp-party-chip-row", dataset: { testid: testId } });
  if (actors.length === 0) {
    row.append(el("div", { class: "ecp-party-chip-empty", text: "파티 없음" }));
    return row;
  }
  for (const actor of actors.slice(0, 4)) row.append(actorFaceChip(actor));
  if (actors.length > 4) row.append(el("div", { class: "ecp-party-chip-more", text: `+${actors.length - 4}` }));
  return row;
}

/** 파티 넣기/빼기 — 전/후 파티를 얼굴로 보여 준다. */
export function partyChipStage(
  cmd: Extract<Command, { kind: "changeParty" }>,
  deps: ActorBattlePreviewDeps
): HTMLElement {
  const project = store.getCurrent();
  const target = project.database.actors.find((actor) => actor.id === cmd.actorId);
  const currentIds = deps.simPartyActorIds ?? project.session?.partyActorIds ?? [];
  const before = currentIds.flatMap((id) => project.database.actors.find((actor) => actor.id === id) ?? []);
  const joining = cmd.action === "add";
  const after = joining
    ? [...before.filter((actor) => actor.id !== cmd.actorId), ...(target ? [target] : [])]
    : before.filter((actor) => actor.id !== cmd.actorId);
  const stage = el("div", {
    class: "ecp-stage ecp-party-stage",
    dataset: { testid: "ecp-party-stage", partyAction: joining ? "add" : "remove" },
  });
  stage.append(
    el("div", {
      class: "ecp-party-focus",
      children: [
        actorFaceChip(target, {
          caption: joining ? "합류" : "이탈",
          state: joining ? "join" : "leave",
          size: 72,
        }),
      ],
    }),
    el("div", {
      class: "ecp-party-before-after",
      children: [
        el("div", {
          class: "ecp-party-column",
          children: [
            el("div", { class: "ecp-party-column-title", text: "지금 파티" }),
            partyChipRow(before, "ecp-party-before"),
          ],
        }),
        el("div", { class: "ecp-party-arrow", text: "→", attrs: { "aria-hidden": "true" } }),
        el("div", {
          class: "ecp-party-column",
          children: [
            el("div", { class: "ecp-party-column-title", text: joining ? "합류 후" : "이탈 후" }),
            partyChipRow(after, "ecp-party-after"),
          ],
        }),
      ],
    })
  );
  return stage;
}

/** 게이지 한 줄. before/after 를 같은 트랙에 겹쳐 그려 변화량이 눈에 보인다. */
function gaugeRow(options: {
  readonly kind: GaugeKind;
  readonly label: string;
  readonly before: number;
  readonly after: number;
  readonly max: number;
  readonly valueText?: string;
}): HTMLElement {
  const max = Math.max(1, Math.round(options.max));
  const before = clampGauge(options.before, max);
  const after = clampGauge(options.after, max);
  const row = el("div", {
    class: `ecp-gauge ecp-gauge-${options.kind}${after < before ? " is-loss" : after > before ? " is-gain" : ""}`,
    dataset: { testid: `ecp-gauge-${options.kind}`, gauge: options.kind },
  });
  const track = el("div", { class: "ecp-gauge-track", attrs: { "aria-hidden": "true" } });
  const ghost = el("div", { class: "ecp-gauge-ghost" });
  ghost.style.setProperty("width", `${percentOf(before, max)}%`);
  const fill = el("div", { class: "ecp-gauge-fill" });
  fill.style.setProperty("width", `${percentOf(after, max)}%`);
  track.append(ghost, fill);
  row.append(
    el("div", { class: "ecp-gauge-label", text: options.label }),
    track,
    el("div", {
      class: "ecp-gauge-numbers",
      dataset: { testid: `ecp-gauge-numbers-${options.kind}` },
      text: options.valueText ?? `${before} → ${after} / ${max}`,
    })
  );
  return row;
}

function clampGauge(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.round(value)));
}

function percentOf(value: number, max: number): number {
  return Math.max(0, Math.min(100, Math.round((value / Math.max(1, max)) * 100)));
}

function applyAmountOp(current: number, op: "=" | "+=" | "-=", amount: number): number {
  if (op === "=") return amount;
  if (op === "+=") return current + amount;
  return current - amount;
}

function actorGaugeStage(
  testId: string,
  targets: readonly ActorRecord[],
  buildGauges: (actor: ActorRecord) => readonly HTMLElement[],
  caption: string
): HTMLElement {
  const stage = el("div", { class: "ecp-stage ecp-actor-gauge-stage", dataset: { testid: testId } });
  if (targets.length === 0) {
    stage.append(
      el("div", {
        class: "ecp-actor-gauge-empty",
        dataset: { testid: "ecp-actor-gauge-empty" },
        text: "주인공을 고르면 게이지가 보입니다",
      }),
      el("div", { class: "ecp-gauge-caption", dataset: { testid: "ecp-gauge-caption" }, text: caption })
    );
    return stage;
  }
  for (const actor of targets.slice(0, 4)) {
    stage.append(
      el("div", {
        class: "ecp-actor-gauge-card",
        dataset: { testid: "ecp-actor-gauge-card", actorId: actor.id },
        children: [
          actorFaceChip(actor, { size: 56 }),
          el("div", { class: "ecp-actor-gauge-bars", children: [...buildGauges(actor)] }),
        ],
      })
    );
  }
  stage.append(
    el("div", { class: "ecp-gauge-caption", dataset: { testid: "ecp-gauge-caption" }, text: caption })
  );
  return stage;
}

/** HP/MP 변경 — 게이지 전/후. */
export function vitalGaugeStage(
  cmd: Extract<Command, { kind: "changeActorHp" | "changeActorMp" }>,
  kind: VitalKind
): HTMLElement {
  const project = store.getCurrent();
  const percentMode = cmd.amountMode === "percent";
  const label = kind === "hp" ? "HP" : "MP";
  const amountText = percentMode ? `${cmd.amount}%` : String(cmd.amount);
  return actorGaugeStage(
    `ecp-${kind}-gauge-stage`,
    previewActorTargets(project, cmd.actorId),
    (actor) => {
      const vitals = previewActorVitals(project, actor);
      const max = kind === "hp" ? vitals.maxHp : vitals.maxMp;
      const before = kind === "hp" ? vitals.hp : vitals.mp;
      const delta = percentMode ? Math.round((max * cmd.amount) / 100) : cmd.amount;
      return [gaugeRow({ kind, label, before, after: applyAmountOp(before, cmd.op, delta), max })];
    },
    `${label} ${cmd.op} ${amountText}${percentMode ? " · 최대치 비율" : ""}`
  );
}

/** 경험치 변경 — 다음 레벨까지의 진행 게이지. */
export function expGaugeStage(
  cmd: Extract<Command, { kind: "changeExp" }>,
  deps: ActorBattlePreviewDeps
): HTMLElement {
  const project = store.getCurrent();
  const amountNumber = typeof cmd.amount === "number" ? cmd.amount : null;
  return actorGaugeStage(
    "ecp-exp-gauge-stage",
    previewActorTargets(project, cmd.actorId),
    (actor) => {
      const normalized = normalizeActorRecord(actor);
      const level = normalized.initialLevel;
      const base = totalExpForLevel(normalized.expCurve, level);
      const next = totalExpForLevel(normalized.expCurve, Math.min(normalized.maxLevel, level + 1));
      const need = Math.max(1, next - base);
      const after = amountNumber === null
        ? 0
        : cmd.op === "="
          ? amountNumber - base
          : applyAmountOp(0, cmd.op, amountNumber);
      return [
        gaugeRow({
          kind: "exp",
          label: `EXP · Lv.${level}`,
          before: 0,
          after,
          max: need,
          valueText: amountNumber === null
            ? `${operandLabel(cmd.amount, deps)} · 다음 레벨까지 ${need}`
            : `${clampGauge(after, need)} / ${need} · 다음 레벨까지 ${need}`,
        }),
      ];
    },
    `경험치 ${cmd.op} ${operandLabel(cmd.amount, deps)}`
  );
}

function operandLabel(amount: VariableOperand, deps: ActorBattlePreviewDeps): string {
  return typeof amount === "number" ? String(amount) : `변수 ${deps.variableName(amount.id)}`;
}

/** 레벨 변경 — 레벨 게이지 + 최대 HP 성장. */
export function levelGaugeStage(cmd: Extract<Command, { kind: "changeLevel" }>): HTMLElement {
  const project = store.getCurrent();
  return actorGaugeStage(
    "ecp-level-gauge-stage",
    previewActorTargets(project, cmd.actorId),
    (actor) => {
      const normalized = normalizeActorRecord(actor);
      const before = normalized.initialLevel;
      const after = Math.max(1, Math.min(normalized.maxLevel, applyAmountOp(before, cmd.op, cmd.amount)));
      const hpBefore = parameterValueAtLevel(normalized.parameterCurves.maxHp, before);
      const hpAfter = parameterValueAtLevel(normalized.parameterCurves.maxHp, after);
      return [
        gaugeRow({ kind: "level", label: "레벨", before, after, max: normalized.maxLevel }),
        gaugeRow({ kind: "hp", label: "최대 HP", before: hpBefore, after: hpAfter, max: Math.max(hpBefore, hpAfter) }),
      ];
    },
    `레벨 ${cmd.op} ${cmd.amount}`
  );
}

/** 전체 회복 — HP/MP 게이지가 가득 찬다. */
export function recoverAllGaugeStage(cmd: Extract<Command, { kind: "recoverAll" }>): HTMLElement {
  const project = store.getCurrent();
  return actorGaugeStage(
    "ecp-recover-all-stage",
    previewActorTargets(project, cmd.actorId),
    (actor) => {
      const vitals = previewActorVitals(project, actor);
      return [
        gaugeRow({ kind: "hp", label: "HP", before: Math.round(vitals.maxHp * 0.4), after: vitals.maxHp, max: vitals.maxHp }),
        gaugeRow({ kind: "mp", label: "MP", before: Math.round(vitals.maxMp * 0.4), after: vitals.maxMp, max: vitals.maxMp }),
      ];
    },
    cmd.actorId ? "이 주인공을 완전 회복" : "파티 전원을 완전 회복"
  );
}

/** 장비 변경 — 얼굴 칩 + 장비 아이콘. 요약 문장 카드로 폴백하지 않는다. */
export function equipmentStage(
  cmd: Extract<Command, { kind: "changeEquipment" }>,
  deps: ActorBattlePreviewDeps
): HTMLElement {
  const project = store.getCurrent();
  const actor = project.database.actors.find((entry) => entry.id === cmd.actorId);
  const record = project.database.equipment.find((entry) => entry.id === cmd.equipmentId);
  const stage = el("div", { class: "ecp-stage ecp-equipment-stage", dataset: { testid: "ecp-equipment-stage" } });
  stage.append(
    el("div", {
      class: "ecp-equipment-row",
      children: [
        actorFaceChip(actor, { size: 64 }),
        el("div", { class: "ecp-equipment-arrow", text: "←", attrs: { "aria-hidden": "true" } }),
        el("div", {
          class: "ecp-equipment-item",
          children: [
            deps.icon(record?.iconResourceId, record?.name ?? cmd.equipmentId, 40),
            el("span", {
              class: "ecp-equipment-item-name",
              text: record?.name ?? (cmd.equipmentId || "(장비 해제)"),
            }),
          ],
        }),
      ],
    }),
    el("div", { class: "ecp-gauge-caption", text: `${equipmentSlotLabel(cmd.slot)} 슬롯` })
  );
  return stage;
}

function equipmentSlotLabel(slot: Extract<Command, { kind: "changeEquipment" }>["slot"]): string {
  switch (slot) {
    case "weapon":
      return "무기";
    case "shield":
      return "방패";
    case "armor":
      return "갑옷";
    case "helmet":
      return "투구";
    case "accessory":
      return "장식";
  }
}

/** m2 배우 계열(능력치·상태·데미지·얼굴·모습·이름·직업). 해당 없으면 undefined. */
export function actorBattleM2Preview(
  cmd: M2Command,
  title: string | undefined,
  deps: ActorBattlePreviewDeps
): HTMLElement | undefined {
  switch (title) {
    case "Change Parameters":
      return parameterGaugeStage(cmd, deps);
    case "Damage Processing":
      return damageGaugeStage(cmd, deps);
    case "Change State":
      return stateChipStage(cmd);
    case "Change Actor Faceset":
      return facesetChangeStage(cmd);
    case "Change Actor Graphic":
      return actorGraphicChangeStage(cmd, deps);
    case "Change Actor Name":
      return actorNameChangeStage(cmd, "이름");
    case "Change Actor Nickname":
      return actorNameChangeStage(cmd, "별명");
    case "Change Actor Class":
      return actorClassChangeStage(cmd);
    default:
      return undefined;
  }
}

const M2_PARAM_LABELS: Readonly<Record<string, string>> = {
  maxHp: "최대 HP",
  maxMp: "최대 MP",
  attack: "공격",
  defense: "방어",
  mind: "정신",
  agility: "민첩",
};

function m2ActorTargets(cmd: M2Command): readonly ActorRecord[] {
  const raw = String(cmd.fields?.target ?? "").trim();
  return previewActorTargets(store.getCurrent(), raw);
}

function m2Amount(cmd: M2Command, deps: ActorBattlePreviewDeps): { readonly value: number | null; readonly text: string } {
  if (String(cmd.fields?.valueSource ?? "number") === "variable") {
    const variableId = String(cmd.fields?.valueVariableId ?? "");
    return { value: null, text: `변수 ${deps.variableName(variableId)}` };
  }
  const raw = Number(cmd.fields?.value ?? 0);
  const value = Number.isFinite(raw) ? Math.trunc(raw) : 0;
  return { value, text: String(value) };
}

/** 능력치 변경 — 고른 능력치의 전/후 막대. */
function parameterGaugeStage(cmd: M2Command, deps: ActorBattlePreviewDeps): HTMLElement {
  const parameterKey = String(cmd.fields?.parameter ?? "maxHp");
  const label = M2_PARAM_LABELS[parameterKey] ?? parameterKey;
  const operation = String(cmd.fields?.operation ?? "add");
  const op = operation === "remove" ? "-=" : operation === "set" ? "=" : "+=";
  const amount = m2Amount(cmd, deps);
  return actorGaugeStage(
    "ecp-parameter-gauge-stage",
    m2ActorTargets(cmd),
    (actor) => {
      const normalized = normalizeActorRecord(actor);
      const curves = normalized.parameterCurves;
      const curve = curves[parameterKey as keyof typeof curves] ?? curves.maxHp;
      const before = parameterValueAtLevel(curve, normalized.initialLevel);
      const after = amount.value === null ? before : applyAmountOp(before, op, amount.value);
      return [
        gaugeRow({
          kind: "param",
          label,
          before,
          after,
          max: Math.max(before, after, 1),
          valueText: amount.value === null ? `${before} · ${amount.text}` : `${before} → ${after}`,
        }),
      ];
    },
    `${label} ${op} ${amount.text} · 영구 보정`
  );
}

/** 데미지 처리 — HP 게이지가 깎이거나 회복된다. */
function damageGaugeStage(cmd: M2Command, deps: ActorBattlePreviewDeps): HTMLElement {
  const heal = String(cmd.fields?.operation ?? "add") === "remove";
  const amount = m2Amount(cmd, deps);
  return actorGaugeStage(
    "ecp-damage-gauge-stage",
    m2ActorTargets(cmd),
    (actor) => {
      const vitals = previewActorVitals(store.getCurrent(), actor);
      const after = heal ? vitals.maxHp : vitals.hp - (amount.value ?? 0);
      return [
        gaugeRow({
          kind: "hp",
          label: "HP",
          before: vitals.hp,
          after,
          max: vitals.maxHp,
          valueText: amount.value === null
            ? `${vitals.hp} / ${vitals.maxHp} · ${amount.text}`
            : `${vitals.hp} → ${clampGauge(after, vitals.maxHp)} / ${vitals.maxHp}`,
        }),
      ];
    },
    heal ? `HP 회복 ${amount.text}` : `HP 데미지 ${amount.text}`
  );
}

/** 상태 부여/해제 — 얼굴 칩 + 상태 배지. */
function stateChipStage(cmd: M2Command): HTMLElement {
  const project = store.getCurrent();
  const stateId = String(cmd.fields?.value ?? "").trim();
  const state = project.database.states.find((entry) => entry.id === stateId);
  const remove = String(cmd.fields?.operation ?? "add") === "remove";
  const stage = el("div", { class: "ecp-stage ecp-state-stage", dataset: { testid: "ecp-state-stage" } });
  const row = el("div", { class: "ecp-state-row" });
  for (const actor of m2ActorTargets(cmd).slice(0, 4)) row.append(actorFaceChip(actor, { size: 56 }));
  stage.append(
    row,
    el("div", {
      class: `ecp-state-badge${remove ? " is-remove" : ""}`,
      dataset: { testid: "ecp-state-badge" },
      text: `${state?.name ?? (stateId || "(상태 선택)")} ${remove ? "해제" : "부여"}`,
    })
  );
  return stage;
}

/** 얼굴 변경 — faceset 크롭 전/후. 요약 카드 폴백 금지. */
function facesetChangeStage(cmd: M2Command): HTMLElement {
  const project = store.getCurrent();
  const actor = project.database.actors.find((entry) => entry.id === String(cmd.fields?.target ?? "").trim());
  const resourceId = String(cmd.fields?.value ?? "").trim();
  const stage = el("div", {
    class: "ecp-stage ecp-faceset-change-stage",
    dataset: { testid: "ecp-faceset-change-stage" },
  });
  stage.append(
    el("div", {
      class: "ecp-faceset-change-row",
      children: [
        el("div", {
          class: "ecp-faceset-change-slot",
          dataset: { testid: "ecp-faceset-before" },
          children: [
            el("div", { class: "ecp-faceset-change-title", text: "지금" }),
            renderFacesetCrop({
              resourceId: actor?.faceResourceId ?? "",
              displaySize: 88,
            }),
          ],
        }),
        el("div", { class: "ecp-faceset-change-arrow", text: "→", attrs: { "aria-hidden": "true" } }),
        el("div", {
          class: "ecp-faceset-change-slot is-after",
          dataset: { testid: "ecp-faceset-after" },
          children: [
            el("div", { class: "ecp-faceset-change-title", text: "변경 후" }),
            renderFacesetCrop({ resourceId, displaySize: 88 }),
          ],
        }),
      ],
    }),
    el("div", {
      class: "ecp-gauge-caption",
      dataset: { testid: "ecp-faceset-change-caption" },
      text: `${actor?.name ?? "(주인공 선택)"} · 얼굴${resourceId ? "" : " · 얼굴 미선택"}`,
    })
  );
  return stage;
}

/** 맵 모습 변경 — 얼굴 칩 + 새 차셋 그림. */
function actorGraphicChangeStage(cmd: M2Command, deps: ActorBattlePreviewDeps): HTMLElement {
  const project = store.getCurrent();
  const actor = project.database.actors.find((entry) => entry.id === String(cmd.fields?.target ?? "").trim());
  const resourceId = String(cmd.fields?.value ?? "").trim();
  const stage = el("div", {
    class: "ecp-stage ecp-actor-graphic-stage",
    dataset: { testid: "ecp-actor-graphic-stage" },
  });
  stage.append(
    el("div", {
      class: "ecp-actor-graphic-row",
      children: [
        actorFaceChip(actor, { size: 56 }),
        el("div", { class: "ecp-faceset-change-arrow", text: "→", attrs: { "aria-hidden": "true" } }),
        el("div", {
          class: "ecp-actor-graphic-sprite",
          dataset: { testid: "ecp-actor-graphic-sprite" },
          children: [deps.icon(resourceId || undefined, resourceId || "모습 미선택", 64)],
        }),
      ],
    }),
    el("div", { class: "ecp-gauge-caption", text: `${actor?.name ?? "(주인공 선택)"} · 맵에서 보이는 모습` })
  );
  return stage;
}

/** 이름/별명 변경 — 얼굴 칩 + 새 이름 카드. */
function actorNameChangeStage(cmd: M2Command, kindLabel: string): HTMLElement {
  const project = store.getCurrent();
  const actor = project.database.actors.find((entry) => entry.id === String(cmd.fields?.target ?? "").trim());
  const nextName = String(cmd.fields?.value ?? "").trim();
  return nameCardStage("ecp-actor-name-stage", actor, `새 ${kindLabel}`, nextName || "(입력 없음)");
}

/** 직업 변경 — 얼굴 칩 + 직업 카드. */
function actorClassChangeStage(cmd: M2Command): HTMLElement {
  const project = store.getCurrent();
  const actor = project.database.actors.find((entry) => entry.id === String(cmd.fields?.target ?? "").trim());
  const classId = String(cmd.fields?.value ?? "").trim();
  const record = project.database.classes.find((entry) => entry.id === classId);
  return nameCardStage("ecp-actor-class-stage", actor, "새 직업", record?.name ?? (classId || "(직업 선택)"));
}

function nameCardStage(
  testId: string,
  actor: ActorRecord | undefined,
  title: string,
  value: string
): HTMLElement {
  const stage = el("div", { class: "ecp-stage ecp-actor-name-stage", dataset: { testid: testId } });
  stage.append(
    el("div", {
      class: "ecp-actor-name-row",
      children: [
        actorFaceChip(actor, { size: 64 }),
        el("div", {
          class: "ecp-actor-name-card",
          children: [
            el("div", { class: "ecp-actor-name-title", text: title }),
            el("div", { class: "ecp-actor-name-value", dataset: { testid: "ecp-actor-name-value" }, text: value }),
          ],
        }),
      ],
    })
  );
  return stage;
}
