import { actionSkillFields } from "./databaseActionSkillForm";
import { skillCombatRuleCard } from "@/editor/panels/databaseCombatRuleFields";
// 스킬 탭 인스펙터 (2026-08 모던 개편).
//
// 개편 전 문제(감사 H 축 P0): `skillComposer()` 를 폼 맨 앞에 prepend 하는데, 그 안의
// `사용처` 가 상한도 접힘도 없는 2 열 그리드였다. `deriveBacklinks` 는 이 스킬을 참조하는
// 주인공/직업/아이템/장비/몬스터/종족을 **전부** 돌려주므로 기본 프로젝트의 `공격` 스킬만
// 해도 38 개다 — 컴포저 한 덩어리가 1406px 이 되어(상세 창 높이 768px) 편집 가능한 필드가
// 전부 y=1571 아래, 즉 두 화면 밖으로 밀려났다. 스크린샷에 입력란이 단 하나도 없었다.
//
// 개편 후: 요약(칩 + 효과 블록)은 한 줄짜리 스트립으로 압축하고, 편집 필드는
// `sectionCard` 카드 스택(`db-ws-stack`, auto-fit 2 열)에 담아 **가장 먼저** 보이게 한다.
// `사용처` 는 스택 맨 끝의 접을 수 있는 카드로 내려보내고 기본 6 개만 노출한 뒤 나머지는
// `전체 보기` 로 편다(테스트 계약 유지를 위해 나머지도 DOM 에는 있고 `hidden` 으로만 감춘다).
//
// 또 다른 P0(clipped:1): `.oprn-detail-skills .db-field` 의 라벨 열이
// `minmax(82px, 0.22fr)` + `text-overflow: ellipsis` 라 `최대 PP (0=무제한)` 라벨이
// 실제로 잘려 나갔다(clientWidth 87 / scrollWidth 119). 라벨을 `최대 PP` 로 줄이고
// 부연은 카드 힌트로 옮겼다. 재발 방지용 줄바꿈 허용 규칙은 modern/skills.css 에 있다.

import { emptyToUndefined, field, numberField, selectField, selectLiteral, textField } from "@/editor/panels/databaseControls";
import { switchDatabaseActiveTab } from "@/editor/panels/database";
import { setSelectedMonsterSpeciesId } from "@/editor/panels/databaseMonsterSpeciesView";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import {
  deriveSkillComposerModel,
  type SkillBacklink,
  type SkillBacklinkCollection,
  type SkillComposerEffectKind,
} from "@/editor/panels/databaseSkillComposerModel";
import { renderSkillAnimationStage, type SkillAnimationStage } from "@/editor/panels/databaseSkillAnimationStage";
import { sectionCard } from "@/editor/panels/databaseWorkspace";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { storyFlagOptionLabel } from "@/project/storyFlags";
import { store } from "@/project/store";
import type { DatabaseStateEffect, SkillEffect, SkillRecord } from "@/project/types";
import { el } from "@/util/dom";

const SKILL_EFFECT_KINDS = ["damage", "healing", "support", "switch"] as const satisfies readonly SkillEffect["kind"][];
const SKILL_EFFECT_AFFECTS = ["hp", "mp"] as const satisfies readonly SkillEffectAffects[];
const SKILL_DAMAGE_STATS = ["attack", "mind"] as const satisfies readonly SkillDamageStatistic[];
const STATE_EFFECT_OPERATIONS = ["add", "remove"] as const satisfies readonly DatabaseStateEffect["operation"][];
/** 접기 전 기본 노출 개수. 나머지는 DOM 에 남기고 hidden 으로만 감춘다. */
const BACKLINK_PREVIEW_COUNT = 6;
type SkillEffectAffects = Extract<SkillEffect, { kind: "damage" | "healing" }>["affects"];
type SkillDamageStatistic = Extract<SkillEffect, { kind: "damage" }>["statistic"];

export function renderSkillRecordForm(form: HTMLElement, record: SkillRecord): void {
  form.classList.add("db-skill-studio");

  // 이름/범위/위력/애니메이션 은 recordForm() + skillFields() 가 이미 form 에 붙여 놓았다.
  // 폼을 다시 짜면서 각자 어울리는 카드로 옮겨 담는다(단위 테스트는 이 뷰만 직접 호출해
  // 필드가 없을 수 있으므로 전부 optional 로 다룬다).
  const carried = new Set<HTMLElement>();
  const adopt = (testid: string): HTMLElement | null => {
    const control = form.querySelector(`[data-testid="${testid}"]`);
    const host = control?.closest(".db-field");
    if (!(host instanceof HTMLElement) || carried.has(host)) return null;
    carried.add(host);
    return host;
  };
  const nameNode = adopt("db-field-name");
  const scopeNode = adopt("db-field-scope");
  const powerNode = adopt("db-field-power");
  const animationNode = adopt("db-picker-animation");
  const leftovers = Array.from(form.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && !carried.has(child)
  );

  const effectBody = el("div", { class: "db-skill-effect-fields" });
  const stateBody = el("div", { class: "db-skill-state-effects" });
  const previewBody = el("div", { class: "db-skill-preview-slot" });
  const actionBody = el("div", { class: "db-skill-action-fields" });
  const renderEffectPanel = () => effectBody.replaceChildren(...effectFields(currentSkill(record), renderEffectPanel));
  const renderStatePanel = () => stateBody.replaceChildren(...stateEffectFields(currentSkill(record), renderStatePanel));
  let animationStage: SkillAnimationStage | null = null;
  const renderPreviewPanel = (): void => {
    animationStage?.stop();
    animationStage = renderSkillAnimationStage(currentSkill(record), store.getCurrent());
    previewBody.replaceChildren(animationStage.element);
  };
  // 투사체를 켜도 데미지/사거리/탄약 필드가 안 나타나던 문제(개편 전부터 있던 결함) —
  // 효과/상태 패널처럼 이 카드도 토글 후 다시 그린다.
  const renderActionPanel = () => actionBody.replaceChildren(...actionSkillFields(currentSkill(record), renderActionPanel));

  renderEffectPanel();
  renderStatePanel();
  renderPreviewPanel();
  renderActionPanel();

  let composer = skillComposer(currentSkill(record));

  const stack = el("div", {
    class: "db-ws-stack db-skill-stack",
    children: [
      sectionCard({
        title: "기본 정보",
        testid: "db-skill-card-identity",
        children: [
          ...(nameNode ? [nameNode] : []),
          textField("설명", "db-field-skill-description", record.description, (description) =>
            updateDatabaseRecord("skills", record.id, { description })
          ),
          selectLiteral("종류", "db-field-skill-type", record.type, ["normal", "teleport", "escape", "switch"], (type) =>
            updateDatabaseRecord("skills", record.id, { type })
          ),
          ...(scopeNode ? [scopeNode] : []),
          ...leftovers,
        ],
      }),
      sectionCard({
        title: "위력과 소모",
        hint: "저장할 때 이 범위를 벗어난 값은 범위 안으로 맞춰집니다",
        testid: "db-skill-card-cost",
        children: [
          ...(powerNode ? [powerNode] : []),
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
          // strict 턴제 전용. 속도보다 먼저 비교한다(퀵어택=+1). 게이지(ATB) 흐름에선 무시.
          numberField("우선도", "db-field-skill-move-priority", record.movePriority ?? 0, (movePriority) =>
            updateDatabaseRecord("skills", record.id, { movePriority }), { min: -7, max: 7 }
          ),
        ],
      }),
      sectionCard({ title: "효과", hint: "전투에서 대상에게 적용됩니다", testid: "db-skill-card-effect", children: [effectBody] }),
      sectionCard({ title: "상태 변화", testid: "db-skill-card-states", children: [stateBody] }),
      sectionCard({
        title: "연출",
        testid: "db-skill-card-presentation",
        children: [...(animationNode ? [animationNode] : []), previewBody],
      }),
      sectionCard({
        title: "Gen1 기술",
        hint: "포켓몬풍 전투 전용",
        testid: "db-skill-card-gen1",
        children: [
          numberField("최대 PP", "db-field-skill-max-pp", record.maxPp ?? 0, (maxPp) =>
            updateDatabaseRecord("skills", record.id, { maxPp: maxPp > 0 ? maxPp : undefined }), { min: 0, max: 99 }
          ),
          el("p", { class: "db-skill-card-note", text: "최대 PP 를 0 으로 두면 사용 횟수 제한이 없습니다." }),
          selectLiteral("급소율", "db-field-skill-gen1-critical", record.gen1CriticalRate ?? "normal", ["normal", "high"], (gen1CriticalRate) =>
            updateDatabaseRecord("skills", record.id, { gen1CriticalRate })
          ),
        ],
      }),
      sectionCard({
        title: "액션 스킬",
        hint: "필드에서 근접·돌진·함정·투사체 사용",
        testid: "db-skill-card-action",
        children: [actionBody],
      }),
    ],
  });

  stack.append(skillCombatRuleCard(currentSkill(record)));
  stack.append(usedByCard(form, currentSkill(record)));

  form.replaceChildren(composer, stack);

  const refreshComposer = (): void => {
    const next = skillComposer(currentSkill(record));
    composer.replaceWith(next);
    composer = next;
  };
  form.addEventListener("input", refreshComposer);
  form.addEventListener("change", refreshComposer);
  form.addEventListener("click", refreshComposer);
  bindAnimationPreviewRefresh(form, renderPreviewPanel);
}

/**
 * 요약 스트립. 예전엔 제목 3 줄 + 칩 + 효과 블록 2 열 + 사용처 38 개로 1406px 이었다.
 * 지금은 칩 한 줄 + 효과 블록 4-up 만 남겨 상세 창 상단 ~130px 만 쓴다.
 */
function skillComposer(record: SkillRecord): HTMLElement {
  const model = deriveSkillComposerModel(store.getCurrent(), record);
  return el("section", {
    class: "db-skill-composer",
    dataset: { testid: "db-skill-composer" },
    attrs: { "aria-label": "스킬 구성 요약" },
    children: [
      el("div", {
        class: "db-skill-composer-bar",
        children: [
          el("strong", { class: "db-skill-composer-label", text: "스킬 구성" }),
          el("div", {
            class: "db-skill-composer-chips",
            children: model.chips.map((chip) => composerChip(chip.kind, chip.label)),
          }),
        ],
      }),
      el("div", {
        class: "db-skill-effect-blocks",
        children: model.effectBlocks.map((block) => composerEffectBlock(block.kind, block.title, block.summary)),
      }),
    ],
  });
}

function composerChip(kind: "activation" | "target" | "cost", label: string): HTMLElement {
  return el("span", {
    class: "db-skill-composer-chip",
    dataset: { chipKind: kind, testid: `db-skill-chip-${kind}` },
    text: label,
  });
}

function composerEffectBlock(kind: SkillComposerEffectKind, title: string, summary: string): HTMLElement {
  return el("article", {
    class: "db-skill-effect-block",
    dataset: { effectKind: kind },
    children: [
      el("span", { class: "db-skill-effect-icon", attrs: { "aria-hidden": "true" }, text: effectBlockIcon(kind) }),
      el("div", {
        class: "db-skill-effect-copy",
        children: [el("strong", { text: title }), el("span", { text: summary })],
      }),
    ],
  });
}

function effectBlockIcon(kind: SkillComposerEffectKind): string {
  switch (kind) {
    case "primary": return "01";
    case "element": return "02";
    case "states": return "03";
    case "animation": return "04";
  }
}

/**
 * 사용처 카드. 카드 스택의 **맨 끝**에 놓아 편집 필드가 먼저 보이게 하고, 목록은
 * 6 개까지만 노출한 뒤 나머지는 `전체 보기` 로 편다(접기도 가능). 감춘 항목도 DOM 에는
 * 남겨 `db-skill-backlink-*` testid 계약(백링크 내비게이션 테스트)을 유지한다.
 */
function usedByCard(form: HTMLElement, record: SkillRecord): HTMLElement {
  const backlinks = deriveSkillComposerModel(store.getCurrent(), record).backlinks;
  if (backlinks.length === 0) {
    return sectionCard({
      title: "사용처",
      hint: "0곳",
      testid: "db-skill-card-used-by",
      children: [el("p", { class: "db-skill-used-by-empty", text: "아직 연결된 레코드가 없습니다." })],
    });
  }

  const rows = backlinks.map((backlink) => backlinkRow(form, backlink));
  const hiddenRows = rows.slice(BACKLINK_PREVIEW_COUNT);
  for (const row of hiddenRows) row.setAttribute("hidden", "");

  const list = el("div", { class: "db-skill-used-by", dataset: { testid: "db-skill-used-by" }, children: rows });
  const children: HTMLElement[] = [list];

  if (hiddenRows.length > 0) {
    const toggle = el("button", {
      class: "db-ws-btn db-ws-btn-ghost db-skill-used-by-more",
      attrs: { type: "button", "aria-expanded": "false" },
      dataset: { testid: "db-skill-used-by-toggle" },
      text: `전체 보기 (${backlinks.length})`,
    });
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      for (const row of hiddenRows) {
        if (expanded) row.setAttribute("hidden", "");
        else row.removeAttribute("hidden");
      }
      toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
      toggle.textContent = expanded ? `전체 보기 (${backlinks.length})` : "접기";
    });
    children.push(toggle);
  }

  return sectionCard({
    title: "사용처",
    hint: `${backlinks.length}곳에서 참조`,
    collapsible: true,
    testid: "db-skill-card-used-by",
    children,
  });
}

function backlinkRow(form: HTMLElement, backlink: SkillBacklink): HTMLElement {
  return el("button", {
    class: "db-skill-backlink",
    attrs: { type: "button", title: `${backlink.name || backlink.id} 열기` },
    dataset: {
      collection: backlink.collection,
      recordId: backlink.id,
      testid: `db-skill-backlink-${backlink.collection}-${backlink.id}`,
    },
    children: [
      el("span", { class: "db-skill-backlink-kind", text: backlinkCollectionLabel(backlink.collection) }),
      el("strong", { class: "db-skill-backlink-name", text: backlink.name || backlink.id }),
      el("small", { class: "db-skill-backlink-relationship", text: backlink.relationship }),
      el("span", { class: "db-skill-backlink-arrow", attrs: { "aria-hidden": "true" }, text: "→" }),
    ],
    on: {
      click: () => {
        if (backlink.collection === "monsterSpecies") setSelectedMonsterSpeciesId(backlink.id);
        else setSelectedRecordId(backlink.collection, backlink.id);
        const root = databasePanelRootFrom(form);
        if (root) switchDatabaseActiveTab(backlink.collection, root);
      },
    },
  });
}

function backlinkCollectionLabel(collection: SkillBacklinkCollection): string {
  switch (collection) {
    case "actors": return "주인공";
    case "classes": return "직업";
    case "items": return "아이템";
    case "equipment": return "장비";
    case "enemies": return "몬스터";
    case "monsterSpecies": return "종족";
  }
}

function databasePanelRootFrom(node: HTMLElement | null): HTMLElement | null {
  if (!node) return null;
  const modalBody = node.closest(".database-modal-body");
  if (modalBody instanceof HTMLElement) return modalBody;
  let current: HTMLElement | null = node;
  while (current) {
    if (current.querySelector(".db-body") && !current.classList.contains("db-body")) return current;
    current = current.parentElement;
  }
  return null;
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
    class: "db-ws-btn db-ws-btn-ghost db-skill-state-effect-add",
    text: "+ 상태 추가",
    attrs: {
      type: "button",
      ...disabledAttr(store.getCurrent().database.states.length === 0),
      // 잠금에는 이유를 같이 준다(databaseControls 의 disabledReason 규약). 이유 없는
      // 무음 비활성은 "왜 안 눌리지"로 끝난다 — 적 탭이 이미 같은 안내를 쓰고 있다.
      ...(store.getCurrent().database.states.length === 0
        ? { title: "[상태] 탭에서 상태를 먼저 만드세요." }
        : {}),
    },
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
        class: "db-ws-btn db-ws-btn-danger db-skill-state-effect-delete",
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

function assertNever(value: never): never {
  throw new Error(`Unhandled skill effect kind: ${value}`);
}
