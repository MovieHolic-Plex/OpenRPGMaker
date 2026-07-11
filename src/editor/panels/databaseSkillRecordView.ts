import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { emptyToUndefined, field, numberField, selectField, selectLiteral, textField } from "@/editor/panels/databaseControls";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { storyFlagOptionLabel } from "@/project/storyFlags";
import { store } from "@/project/store";
import type { BattleAnimationSheet, DatabaseStateEffect, SkillEffect, SkillRecord } from "@/project/types";
import { el } from "@/util/dom";

const SKILL_EFFECT_KINDS = ["damage", "healing", "support", "switch"] as const satisfies readonly SkillEffect["kind"][];
const SKILL_EFFECT_AFFECTS = ["hp", "mp"] as const satisfies readonly SkillEffectAffects[];
const SKILL_DAMAGE_STATS = ["attack", "mind"] as const satisfies readonly SkillDamageStatistic[];
const STATE_EFFECT_OPERATIONS = ["add", "remove"] as const satisfies readonly DatabaseStateEffect["operation"][];
const DEFAULT_ANIMATION_SHEET: BattleAnimationSheet = { frameWidth: 96, frameHeight: 96, columns: 5 };

type SkillEffectAffects = Extract<SkillEffect, { kind: "damage" | "healing" }>["affects"];
type SkillDamageStatistic = Extract<SkillEffect, { kind: "damage" }>["statistic"];

export function renderSkillRecordForm(form: HTMLElement, record: SkillRecord): void {
  const effectPanel = panel("효과", []);
  const statePanel = panel("상태 변화", []);
  const previewPanel = panel("미리보기", []);
  const renderEffectPanel = () => {
    const current = currentSkill(record);
    effectPanel.replaceChildren(el("legend", { text: "효과" }), ...effectFields(current, renderEffectPanel));
  };
  const renderStatePanel = () => {
    const current = currentSkill(record);
    statePanel.replaceChildren(el("legend", { text: "상태 변화" }), ...stateEffectFields(current, renderStatePanel));
  };
  const renderPreviewPanel = () => {
    const current = currentSkill(record);
    previewPanel.replaceChildren(el("legend", { text: "미리보기" }), skillAnimationPreview(current));
  };

  renderEffectPanel();
  renderStatePanel();
  renderPreviewPanel();

  form.append(
    textField("설명", "db-field-skill-description", record.description, (description) =>
      updateDatabaseRecord("skills", record.id, { description })
    ),
    selectLiteral("종류", "db-field-skill-type", record.type, ["normal", "teleport", "escape", "switch"], (type) =>
      updateDatabaseRecord("skills", record.id, { type })
    ),
    panel("소모와 명중", [
      // bounds 는 store 측 normalizeSkillRecord 의 클램프와 동일하게 유지한다(P4 — 표시·저장 일치).
      numberField("MP", "db-field-skill-mp-flat", record.mpCost.flat, (flat) =>
        updateDatabaseRecord("skills", record.id, { mpCost: { ...currentSkill(record).mpCost, flat } }), { min: 0, max: 9999 }
      ),
      numberField("MP %", "db-field-skill-mp-percent", record.mpCost.percentMax, (percentMax) =>
        updateDatabaseRecord("skills", record.id, { mpCost: { ...currentSkill(record).mpCost, percentMax } }), { min: 0, max: 100 }
      ),
      numberField("성공률", "db-field-skill-success", record.successRate, (successRate) =>
        updateDatabaseRecord("skills", record.id, { successRate }), { min: 0, max: 100 }
      ),
      numberField("명중률", "db-field-skill-hit-rate", record.hitRate, (hitRate) =>
        updateDatabaseRecord("skills", record.id, { hitRate }), { min: 0, max: 100 }
      ),
      numberField("분산", "db-field-skill-variance", record.variance, (variance) =>
        updateDatabaseRecord("skills", record.id, { variance }), { min: 0, max: 100 }
      ),
    ]),
    effectPanel,
    statePanel,
    previewPanel
  );
  bindAnimationPreviewRefresh(form, renderPreviewPanel);
}

function panel(title: string, children: readonly HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "db-advanced-panel", children: [el("legend", { text: title }), ...children] });
}

function effectFields(record: SkillRecord, rerender: () => void): HTMLElement[] {
  const controls: HTMLElement[] = [
    selectLiteral("효과", "db-field-skill-effect-kind", record.effect.kind, SKILL_EFFECT_KINDS, (kind) => {
      updateSkillEffectKind(record, kind);
      rerender();
    }),
    selectField("속성", "db-field-skill-element", record.elementId ?? "", store.getCurrent().database.elements ?? [], (value) =>
      updateSkillOptionalFields(record, { elementId: emptyToUndefined(value) })
    ),
  ];
  if (record.effect.kind === "damage" || record.effect.kind === "healing") {
    controls.push(
      selectLiteral("계산", "db-field-skill-effect-statistic", skillDamageStatistic(record.effect), SKILL_DAMAGE_STATS, (statistic) =>
        updateSkillDamageStatistic(record, statistic)
      ),
      selectLiteral("대상 값", "db-field-skill-effect-affects", skillEffectAffects(record.effect), SKILL_EFFECT_AFFECTS, (affects) =>
        updateSkillEffectAffects(record, affects)
      )
    );
  }
  if (record.effect.kind === "switch") {
    controls.push(
      selectField("스위치", "db-field-skill-effect-switch", record.effect.switchId ?? "", switchOptions(), (switchId) =>
        updateDatabaseRecord("skills", record.id, { effect: { kind: "switch", switchId: emptyToUndefined(switchId) } })
      )
    );
  }
  return controls;
}

function updateSkillEffectKind(record: SkillRecord, kind: SkillEffect["kind"]): void {
  const effect = currentSkill(record).effect;
  switch (kind) {
    case "damage":
      updateDatabaseRecord("skills", record.id, {
        effect: { kind, statistic: skillDamageStatistic(effect), affects: skillEffectAffects(effect) },
      });
      return;
    case "healing":
      updateDatabaseRecord("skills", record.id, { effect: { kind, statistic: "mind", affects: skillEffectAffects(effect) } });
      return;
    case "support":
      updateDatabaseRecord("skills", record.id, { effect: { kind } });
      return;
    case "switch":
      updateDatabaseRecord("skills", record.id, { effect: { kind, switchId: effect.kind === "switch" ? effect.switchId : undefined } });
      return;
    default:
      assertNever(kind);
  }
}

function updateSkillDamageStatistic(record: SkillRecord, statistic: SkillDamageStatistic): void {
  const effect = currentSkill(record).effect;
  if (effect.kind === "damage") {
    updateDatabaseRecord("skills", record.id, { effect: { ...effect, statistic } });
    return;
  }
  updateDatabaseRecord("skills", record.id, { effect: { kind: "damage", statistic, affects: skillEffectAffects(effect) } });
}

function updateSkillEffectAffects(record: SkillRecord, affects: SkillEffectAffects): void {
  const effect = currentSkill(record).effect;
  if (effect.kind === "damage" || effect.kind === "healing") {
    updateDatabaseRecord("skills", record.id, { effect: { ...effect, affects } });
    return;
  }
  updateDatabaseRecord("skills", record.id, { effect: { kind: "healing", statistic: "mind", affects } });
}

function skillDamageStatistic(effect: SkillEffect): SkillDamageStatistic {
  return effect.kind === "damage" ? effect.statistic : "mind";
}

function skillEffectAffects(effect: SkillEffect): SkillEffectAffects {
  return effect.kind === "damage" || effect.kind === "healing" ? effect.affects : "hp";
}

function currentSkill(record: SkillRecord): SkillRecord {
  return store.getCurrent().database.skills.find((skill) => skill.id === record.id) ?? record;
}

function stateEffectFields(record: SkillRecord, rerender: () => void): HTMLElement[] {
  const rows = (record.stateEffects ?? []).map((effect, index) => stateEffectRow(record, effect, index, rerender));
  const add = el("button", {
    class: "btn small db-skill-state-effect-add",
    text: "+ 상태 추가",
    attrs: { type: "button", ...disabledAttr(store.getCurrent().database.states.length === 0) },
    dataset: { testid: "db-skill-state-effect-add" },
    on: {
      click: () => {
        const state = store.getCurrent().database.states[0];
        if (!state) return;
        updateSkillStateEffects(record, [...(currentSkill(record).stateEffects ?? []), { stateId: state.id, chance: 100, operation: "add" }]);
        rerender();
      },
    },
  });
  const children = rows.length > 0 ? rows : [el("div", { class: "db-skill-state-effect-empty", text: "상태 변화 없음" })];
  return [...children, add];
}

function stateEffectRow(record: SkillRecord, effect: DatabaseStateEffect, index: number, rerender: () => void): HTMLElement {
  return el("div", {
    class: "db-skill-state-effect-row",
    dataset: { testid: `db-skill-state-effect-row-${index}` },
    children: [
      stateSelectField("상태", `db-field-skill-state-effect-state-${index}`, effect.stateId, (stateId) =>
        updateStateEffectAt(record, index, { stateId })
      ),
      percentField("확률", `db-field-skill-state-effect-chance-${index}`, effect.chance, (chance) =>
        updateStateEffectAt(record, index, { chance })
      ),
      selectLiteral("조작", `db-field-skill-state-effect-op-${index}`, effect.operation, STATE_EFFECT_OPERATIONS, (operation) =>
        updateStateEffectAt(record, index, { operation })
      ),
      el("button", {
        class: "btn small danger",
        text: "삭제",
        attrs: { type: "button" },
        dataset: { testid: `db-skill-state-effect-delete-${index}` },
        on: {
          click: () => {
            updateSkillStateEffects(record, (currentSkill(record).stateEffects ?? []).filter((_, effectIndex) => effectIndex !== index));
            rerender();
          },
        },
      }),
    ],
  });
}

function stateSelectField(label: string, testid: string, value: string, onChange: (value: string) => void): HTMLElement {
  const select = el("select", { dataset: { testid } });
  for (const state of store.getCurrent().database.states) select.append(el("option", { text: state.name || state.id, attrs: { value: state.id } }));
  if (value && !store.getCurrent().database.states.some((state) => state.id === value)) {
    select.append(el("option", { text: value, attrs: { value } }));
  }
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return field(label, select);
}

function percentField(label: string, testid: string, value: number, onInput: (value: number) => void): HTMLElement {
  const input = el("input", {
    attrs: { type: "number", min: "0", max: "100" },
    value,
    dataset: { testid },
  });
  input.addEventListener("input", () => {
    const next = clampPercent(Number(input.value));
    input.value = String(next);
    onInput(next);
  });
  return field(label, input);
}

function updateStateEffectAt(record: SkillRecord, index: number, patch: Partial<DatabaseStateEffect>): void {
  updateSkillStateEffects(record, (currentSkill(record).stateEffects ?? []).map((effect, effectIndex) => (
    effectIndex === index ? { ...effect, ...patch } : effect
  )));
}

function updateSkillStateEffects(record: SkillRecord, stateEffects: readonly DatabaseStateEffect[]): void {
  updateSkillOptionalFields(record, { stateEffects: stateEffects.map((effect) => ({ ...effect, chance: clampPercent(effect.chance) })) });
}

function updateSkillOptionalFields(record: SkillRecord, patch: Pick<Partial<SkillRecord>, "elementId" | "stateEffects">): void {
  // updateSkillRecord 뮤테이터가 elementId/stateEffects 를 화이트리스트에 포함하므로 단일 갱신으로 충분하다.
  updateDatabaseRecord("skills", record.id, patch);
}

function skillAnimationPreview(record: SkillRecord): HTMLElement {
  const project = store.getCurrent();
  const animation = record.animationId
    ? project.database.battleAnimations.find((entry) => entry.id === record.animationId)
    : undefined;
  const url = resolveAssetResourceUrl(animation?.resourceId, { project });
  const wrap = el("div", { class: "db-skill-animation-preview", dataset: { testid: "db-skill-animation-preview" } });
  if (!animation || !url) {
    wrap.append(el("div", { class: "db-skill-animation-preview-empty", text: "(애니메이션 없음)" }));
    return wrap;
  }
  const sheet = animation.sheet ?? DEFAULT_ANIMATION_SHEET;
  const frame = animationFramePreviewBox(url, sheet, animation.name);
  wrap.append(frame, el("span", { class: "db-skill-animation-preview-caption", text: animation.name || animation.id }));
  return wrap;
}

function animationFramePreviewBox(url: string, sheet: BattleAnimationSheet, animationName: string): HTMLElement {
  const frameWidth = positiveNumber(sheet.frameWidth, DEFAULT_ANIMATION_SHEET.frameWidth);
  const frameHeight = positiveNumber(sheet.frameHeight, DEFAULT_ANIMATION_SHEET.frameHeight);
  const columns = Math.max(1, Math.floor(positiveNumber(sheet.columns, DEFAULT_ANIMATION_SHEET.columns)));
  const displayWidth = clamp(frameWidth, 48, 96);
  const displayHeight = clamp(Math.round(frameHeight * (displayWidth / frameWidth)), 48, 96);
  const frame = el("div", {
    class: "db-skill-animation-preview-frame",
    attrs: { "aria-label": `${animationName || "애니메이션"} 패턴 1`, role: "img" },
  });
  frame.style.backgroundImage = `url("${url}")`;
  frame.style.backgroundPosition = "0 0";
  frame.style.backgroundSize = `${columns * displayWidth}px auto`;
  frame.style.width = `${displayWidth}px`;
  frame.style.height = `${displayHeight}px`;
  return frame;
}

function bindAnimationPreviewRefresh(form: HTMLElement, rerender: () => void): void {
  const picker = form.querySelector<HTMLElement>("[data-testid='db-picker-animation']");
  picker?.addEventListener("change", rerender);
}

function switchOptions(): readonly { readonly id: string; readonly name: string }[] {
  const project = store.getCurrent();
  return project.switches.map((entry, index) => ({
    id: entry.id,
    name: storyFlagOptionLabel(project, "switch", entry, index),
  }));
}

function disabledAttr(disabled: boolean): Record<string, string> {
  return disabled ? { disabled: "true" } : {};
}

function clampPercent(value: number): number {
  return clamp(Number.isFinite(value) ? Math.round(value) : 0, 0, 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function positiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled skill effect kind: ${value}`);
}
