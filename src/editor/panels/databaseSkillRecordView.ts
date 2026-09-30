import { actionSkillFields } from "./databaseActionSkillForm";
import { skillCombatRuleCard, skillInputSequenceFields } from "@/editor/panels/databaseCombatRuleFields";
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

import { emptyToUndefined, field, numberField, selectField, selectLiteral, textField, toggleSwitch } from "@/editor/panels/databaseControls";
import { switchDatabaseActiveTab } from "@/editor/panels/database";
import { setSelectedMonsterSpeciesId } from "@/editor/panels/databaseMonsterSpeciesView";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import {
  deriveSkillComposerModel,
  type SkillBacklink,
  type SkillBacklinkCollection,
  type SkillComposerChipKind,
  type SkillComposerEffectKind,
} from "@/editor/panels/databaseSkillComposerModel";
import { renderSkillAnimationStage, type SkillAnimationStage } from "@/editor/panels/databaseSkillAnimationStage";
import { renderSkillRetroStage, retroStageSignature, type SkillRetroStage } from "@/editor/panels/databaseSkillRetroStage";
import { sectionCard } from "@/editor/panels/databaseWorkspace";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { storyFlagOptionLabel } from "@/project/storyFlags";
import { store } from "@/project/store";
import type { DatabaseStateEffect, Project, SkillEffect, SkillRecord } from "@/project/types";
import { el } from "@/util/dom";
import { specialSkillEffectLabel } from "@/battle/battleSpecialEffects";

const SKILL_EFFECT_KINDS = ["damage", "healing", "support", "switch", "steal", "scan", "learnEnemySkill", "randomSkillFrom"] as const satisfies readonly SkillEffect["kind"][];
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
  const retroBody = el("div", { class: "db-skill-retro-slot" });
  const actionBody = el("div", { class: "db-skill-action-fields" });
  const renderEffectPanel = () => effectBody.replaceChildren(...effectFields(currentSkill(record), renderEffectPanel));
  const renderStatePanel = () => stateBody.replaceChildren(...stateEffectFields(currentSkill(record), renderStatePanel));
  let animationStage: SkillAnimationStage | null = null;
  const renderPreviewPanel = (): void => {
    animationStage?.stop();
    animationStage = renderSkillAnimationStage(currentSkill(record), store.getCurrent());
    previewBody.replaceChildren(animationStage.element);
  };
  // 도트 전투 미리보기(retro2003). 계약 스킬이나 런타임 레시피가 있을 때만 그린다.
  // 이름·범위·효과 종류가 바뀌면 레시피가 달라질 수 있어 서명이 바뀔 때만 다시 그린다(입력마다 재생이 끊기지 않게).
  let retroStage: SkillRetroStage | null = null;
  let retroSignature = "";
  const renderRetroPanel = (force = false): void => {
    const skill = currentSkill(record);
    const signature = retroStageSignature(skill);
    if (!force && signature === retroSignature) return;
    retroSignature = signature;
    retroStage?.stop();
    retroStage = renderSkillRetroStage(skill, store.getCurrent());
    retroBody.replaceChildren(...(retroStage ? [retroStage.element] : []));
    presentationCard?.classList.toggle("db-skill-card-has-retro", Boolean(retroStage));
  };
  let presentationCard: HTMLElement | null = null;
  // 투사체를 켜도 데미지/사거리/탄약 필드가 안 나타나던 문제(개편 전부터 있던 결함) —
  // 효과/상태 패널처럼 이 카드도 토글 후 다시 그린다.
  const renderActionPanel = () => actionBody.replaceChildren(...actionSkillFields(currentSkill(record), renderActionPanel));

  renderEffectPanel();
  renderStatePanel();
  renderPreviewPanel();
  renderRetroPanel(true);
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
        testid: "db-skill-card-cost",
        children: [
          ...(powerNode ? [powerNode] : []),
          // bounds 는 store 측 normalizeSkillRecord 의 클램프와 동일하게 유지한다(P4 — 표시·저장 일치).
          numberField("MP", "db-field-skill-mp-flat", record.mpCost.flat, (flat) =>
            updateDatabaseRecord("skills", record.id, { mpCost: { ...currentSkill(record).mpCost, flat } }), { min: 0, max: 9999 }
          ),
        ],
      }),
      battleResourceCard(record),
      // 성공률·명중률·분산·우선도는 초보가 만질 일이 드물다 — 기본값이면 접어 두고, 몇 개가
      // 들어 있는지와 「기본값 그대로」를 머리에 적는다(2026-09-23 파티 UX 검토).
      sectionCard({
        title: "명중 · 분산 · 우선도",
        hint: hasTunedAccuracy(record) ? "기본값에서 바뀜" : "5개 · 기본값 그대로",
        testid: "db-skill-card-accuracy",
        collapsible: true,
        collapsed: !advancedOpen(hasTunedAccuracy(record)),
        children: [
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
      (presentationCard = sectionCard({
        title: "연출",
        hint: retroStage ? "도트 전투 미리보기 · ▶ 재생을 누르면 효과음도 들립니다" : undefined,
        testid: "db-skill-card-presentation",
        children: [retroBody, ...(animationNode ? [animationNode] : []), previewBody],
      })),
      sectionCard({
        title: "Gen1 기술",
        hint: gen1BattleModel() ? "포켓몬풍 전투 전용" : "포켓몬풍 전투 전용 · 이 게임은 사용 안 함",
        testid: "db-skill-card-gen1",
        collapsible: true,
        collapsed: !advancedOpen(gen1BattleModel() || (record.maxPp ?? 0) > 0 || record.gen1CriticalRate === "high"),
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
        hint: record.actionSkill ? "필드에서 근접·돌진·함정·투사체 사용" : "필드 액션 · 사용 안 함",
        testid: "db-skill-card-action",
        collapsible: true,
        collapsed: !advancedOpen(Boolean(record.actionSkill)),
        children: [actionBody],
      }),
    ],
  });

  stack.append(skillCombatRuleCard(currentSkill(record), {
    collapsed: !advancedOpen(Boolean(record.damageFormula) || (record.hitSequence ?? [1]).join(",") !== "1" || Boolean(record.hpCostPercent || record.drainPercent || record.area || record.comboActorIds?.length)),
  }));
  stack.append(skillInputSequenceFields(currentSkill(record)));
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
  // 도트 무대는 확정된 변경(change)에서만 서명을 다시 본다.
  form.addEventListener("change", () => renderRetroPanel());
  presentationCard?.classList.toggle("db-skill-card-has-retro", Boolean(retroStage));
}

/**
 * 요약 스트립. 예전엔 제목 3 줄 + 칩 + 효과 블록 2 열 + 사용처 38 개로 1406px 이었다.
 * 지금은 칩 한 줄 + 효과 블록 4-up 만 남겨 상세 창 상단 ~130px 만 쓴다.
 */
function skillComposer(record: SkillRecord): HTMLElement {
  // 예전에는 칩 줄 + 「01 주 효과 / 02 속성 / 03 상태 변화 / 04 애니메이션」 카드 네 장이 아래
  // 폼과 같은 내용을 한 번 더 보여 줬다. 지금은 **한 문장**이다 — 칩과 효과 조각은 같은 요소
  // (testid·data-effect-kind 계약 유지)지만 문장 안에 흘러 읽힌다.
  const project = store.getCurrent();
  const model = deriveSkillComposerModel(project, record);
  const chip = (kind: SkillComposerChipKind): HTMLElement => {
    const found = model.chips.find((entry) => entry.kind === kind);
    return composerChip(kind, found?.label ?? "");
  };
  const fragments = skillSentenceFragments(project, record);
  return el("section", {
    class: "db-skill-composer",
    dataset: { testid: "db-skill-composer" },
    attrs: { "aria-label": "스킬 요약" },
    children: [
      el("p", {
        class: "db-skill-sentence",
        dataset: { testid: "db-skill-sentence" },
        children: [
          chip("activation"), " · ",
          chip("target"), "에게 ",
          composerEffectBlock("primary", fragments.primary), ". ",
          composerEffectBlock("element", fragments.element),
          composerEffectBlock("states", fragments.states),
          chip("cost"), " · ",
          composerEffectBlock("animation", fragments.animation),
        ],
      }),
    ],
  });
}

/** 문장 조각. 기본값(무속성·상태 변화 없음·명중 100%)은 말하지 않는다 — 다른 점만 읽힌다. */
export function skillSentenceFragments(project: Project, record: SkillRecord): {
  readonly primary: string;
  readonly element: string;
  readonly states: string;
  readonly animation: string;
} {
  const accuracy = record.successRate < 100 || record.hitRate < 100
    ? ` (성공 ${record.successRate}% · 명중 ${record.hitRate}%)`
    : "";
  const primary = (() => {
    switch (record.effect.kind) {
      case "damage":
        return `${record.effect.statistic === "attack" ? "공격력" : "마력"} 기반 ${record.effect.affects === "hp" ? "HP" : "MP"} 피해 · 위력 ${record.power}${accuracy}`;
      case "healing":
        return `${record.effect.affects === "hp" ? "HP" : "MP"} 회복 · 위력 ${record.power}${accuracy}`;
      case "support":
        return `지원 효과${accuracy}`;
      case "switch":
        return "스위치를 켭니다";
      default:
        return `${specialSkillEffectLabel(record.effect)}${accuracy}`;
    }
  })();
  const element = record.elementId
    ? `${project.database.elements?.find((entry) => entry.id === record.elementId)?.name || record.elementId} 속성. `
    : "";
  const states = (record.stateEffects ?? []).length > 0
    ? `${(record.stateEffects ?? []).map((effect) => {
        const state = project.database.states.find((entry) => entry.id === effect.stateId);
        const name = state?.name || effect.stateId;
        return `${name} ${effect.operation === "add" ? "부여" : "해제"}${effect.chance < 100 ? ` ${effect.chance}%` : ""}`;
      }).join(" · ")}. `
    : "";
  const animation = record.animationId
    ? `연출: ${project.database.battleAnimations.find((entry) => entry.id === record.animationId)?.name || record.animationId}`
    : "연출 없음";
  return { primary, element, states, animation };
}

/**
 * 기력·리미트·연계 게이지 소모. 시스템 탭 「전투 자원」에서 켠 자원만 전투에 쓰인다 — 꺼져 있으면
 * 힌트로 알려 주고 값은 그대로 보관한다(나중에 켜면 바로 적용).
 */
function battleResourceCard(record: SkillRecord): HTMLElement {
  const system = store.getCurrent().system;
  const off = [
    system.resource2?.enabled ? "" : "기력",
    system.limitGauge?.enabled ? "" : "리미트",
    system.partyGauge?.enabled ? "" : "연계 게이지",
  ].filter(Boolean);
  const inUse = (record.resource2Cost ?? 0) > 0 || record.limitSkill === true || (record.partyGaugeCost ?? 0) > 0;
  return sectionCard({
    title: "전투 자원",
    hint: off.length === 3 ? "시스템 → 전투 자원에서 켜면 쓰입니다" : off.length > 0 ? `꺼진 자원: ${off.join(" · ")}` : "기력 · 리미트 · 연계 게이지",
    testid: "db-skill-card-battle-resources",
    collapsible: true,
    collapsed: !advancedOpen(inUse),
    children: [
      numberField(system.resource2?.label || "기력 소모", "db-field-skill-resource2-cost", record.resource2Cost ?? 0, (resource2Cost) =>
        updateDatabaseRecord("skills", record.id, { resource2Cost: resource2Cost > 0 ? resource2Cost : undefined }), { min: 0, max: 999 }
      ),
      toggleSwitch("리미트 기술(게이지가 가득 차야 사용)", "db-field-skill-limit", record.limitSkill === true, (limitSkill) =>
        updateDatabaseRecord("skills", record.id, { limitSkill: limitSkill ? true : undefined })
      ),
      numberField("연계 게이지 소모", "db-field-skill-party-gauge-cost", record.partyGaugeCost ?? 0, (partyGaugeCost) =>
        updateDatabaseRecord("skills", record.id, { partyGaugeCost: partyGaugeCost > 0 ? partyGaugeCost : undefined }), { min: 0, max: 999 }
      ),
    ],
  });
}

function hasTunedAccuracy(record: SkillRecord): boolean {
  return record.successRate !== 100 || record.hitRate !== 100 || (record.movePriority ?? 0) !== 0 || record.mpCost.percentMax !== 0;
}

function gen1BattleModel(): boolean {
  return store.getCurrent().system.battleModel === "gen1";
}

/** 고급 카드를 펼칠지. 값이 들어 있을 때만 편다. */
function advancedOpen(inUse: boolean): boolean {
  return inUse;
}

function composerChip(kind: "activation" | "target" | "cost", label: string): HTMLElement {
  return el("span", {
    class: "db-skill-composer-chip",
    dataset: { chipKind: kind, testid: `db-skill-chip-${kind}` },
    text: label,
  });
}

function composerEffectBlock(kind: SkillComposerEffectKind, text: string): HTMLElement {
  return el("span", {
    class: "db-skill-effect-block",
    dataset: { effectKind: kind },
    text,
  });
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
    // 명작 공백 #5: 메뉴에서 쓰는 필드 능력. 정면 대상은 문자열 변수 fieldAbilityTarget.
    selectField("필드 능력(공통 이벤트)", "db-field-skill-field-common-event", record.fieldCommonEventId ?? "",
      (store.getCurrent().commonEvents ?? []).map((event) => ({ id: event.id, name: event.name || event.id })), (value) =>
      updateSkillOptionalFields(record, { fieldCommonEventId: emptyToUndefined(value) })
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
  controls.push(toggleSwitch("적이 쓰면 배울 수 있음(청마법)", "db-field-skill-learnable", record.learnable === true, (learnable) =>
    updateDatabaseRecord("skills", record.id, { learnable: learnable || undefined })
  ));
  if (record.effect.kind === "randomSkillFrom") {
    const skillIds = record.effect.skillIds;
    controls.push(textField("무작위 후보 기술 ID(쉼표)", "db-field-skill-effect-random-skills", skillIds.join(", "), (value) =>
      updateDatabaseRecord("skills", record.id, { effect: { kind: "randomSkillFrom", skillIds: value.split(",").map((id) => id.trim()).filter(Boolean) } })
    ));
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
    case "steal":
    case "scan":
    case "learnEnemySkill":
      updateDatabaseRecord("skills", record.id, { effect: { kind } });
      return;
    case "randomSkillFrom":
      updateDatabaseRecord("skills", record.id, { effect: { kind, skillIds: effect.kind === "randomSkillFrom" ? effect.skillIds : [] } });
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

function updateSkillOptionalFields(record: SkillRecord, patch: Pick<Partial<SkillRecord>, "elementId" | "stateEffects" | "fieldCommonEventId">): void {
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
