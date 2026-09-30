// 스킬 탭 「연출」 카드의 「도트 연출」 고르기 — 계약(약 850개) 중 하나를 골라 이 스킬의 연출로 빌린다(SkillRecord.retroChoreographyId).
// 색인·필터는 src/assets/retroSkillCatalog.ts 의 것을 조수 도구(list_retro_choreographies)와 함께 쓴다.
// 스킬 id 자체가 계약이면 그 연출이 우선이라 고르기는 안내만 보인다(빌린 값은 지우거나 바꿔도 무시된다).
import { MOTION_LABELS, RETRO_SKILL_CLASS_GROUPS } from "@/editor/panels/databaseSkillRetroStage";
import {
  RETRO_CHOREOGRAPHY_FAMILIES,
  RETRO_ELEMENT_IDS,
  filterRetroChoreographies,
  resolveRetroClassChoreography,
  resolveRetroMonsterChoreography,
  retroChoreographyEntries,
  retroClassSkill,
  type RetroChoreographyFilter,
} from "@/assets/retroSkillCatalog";
import { retroMonsterSkill } from "@/assets/retroMonsterSkills";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import type { SkillRecord } from "@/project/types";
import { el } from "@/util/dom";

/** 표시 글자(직업 모션 + 몬스터 모션). */
export const RETRO_CHOREOGRAPHY_MOTION_LABELS: Readonly<Record<string, string>> = {
  ...MOTION_LABELS,
  lunge: "돌진 물기", breath: "숨결", stomp: "짓밟기",
};
const ELEMENT_LABELS: Readonly<Record<string, string>> = {
  fire: "불", ice: "얼음", thunder: "번개", water: "물", earth: "땅", wind: "바람", holy: "빛", dark: "어둠",
};
const FAMILY_LABELS: Readonly<Record<string, string>> = {
  ...Object.fromEntries(RETRO_SKILL_CLASS_GROUPS.map((group) => [group.id, group.label])), monster: "몬스터",
};
/** 한 번에 그리는 후보 수 상한(850개를 select 에 모두 넣지 않는다). */
export const RETRO_PICKER_LIST_LIMIT = 200;

function optionList(select: HTMLSelectElement, first: string, values: readonly string[], labels: Readonly<Record<string, string>>): void {
  select.append(el("option", { text: first, attrs: { value: "" } }));
  for (const value of values) select.append(el("option", { text: labels[value] ?? value, attrs: { value } }));
}

/** 「도트 연출」 고르기 한 덩어리. 고르면 updateDatabaseRecord 로 저장하고 onPicked 로 무대를 다시 그리게 한다. */
export function retroChoreographyPicker(record: SkillRecord, onPicked: () => void): HTMLElement {
  const own = retroClassSkill(record.id) ?? retroMonsterSkill(record.id);
  const borrowed = record.retroChoreographyId;
  const current = resolveRetroClassChoreography(record) ?? resolveRetroMonsterChoreography(record);
  const root = el("div", { class: "db-skill-retro-picker", dataset: { testid: "db-skill-retro-picker" } });

  const status = el("div", { class: "db-skill-retro-picker-status", dataset: { testid: "db-skill-retro-picker-status" } });
  status.textContent = own
    ? `이 스킬은 도트 연출 계약(${own.name})을 그대로 씁니다. 연출을 바꾸려면 스킬을 복제해서 고르세요.`
    : current
      ? `빌려 온 연출: ${current.name} (${current.id})`
      : borrowed
        ? `연출 계약 ${borrowed} 을(를) 찾지 못했습니다 - 다시 고르세요.`
        : "고르지 않으면 기본 베기·탄 연출로 재생됩니다.";
  root.append(el("div", { class: "db-skill-retro-picker-title", text: "도트 연출" }), status);
  if (own) return root;

  const filter: { -readonly [K in keyof RetroChoreographyFilter]: RetroChoreographyFilter[K] } = {};
  const query = el("input", { class: "db-skill-retro-picker-query", attrs: { type: "search", placeholder: "이름·설명·이펙트 이름으로 찾기 (예: 화염 참격)" }, dataset: { testid: "db-skill-retro-picker-query" } });
  const motion = el("select", { dataset: { testid: "db-skill-retro-picker-motion" } });
  optionList(motion, "모션 전체", [...new Set(retroChoreographyEntries().map((entry) => entry.motion))], RETRO_CHOREOGRAPHY_MOTION_LABELS);
  const element = el("select", { dataset: { testid: "db-skill-retro-picker-element" } });
  optionList(element, "속성 전체", RETRO_ELEMENT_IDS, ELEMENT_LABELS);
  const family = el("select", { dataset: { testid: "db-skill-retro-picker-family" } });
  optionList(family, "계열 전체", RETRO_CHOREOGRAPHY_FAMILIES, FAMILY_LABELS);
  const list = el("select", { class: "db-skill-retro-picker-list", dataset: { testid: "db-skill-retro-picker-list" } });
  const count = el("span", { class: "db-skill-retro-picker-count", dataset: { testid: "db-skill-retro-picker-count" } });

  const fill = (): void => {
    filter.query = query.value.trim() || undefined;
    filter.motion = motion.value || undefined;
    filter.element = element.value || undefined;
    filter.family = family.value || undefined;
    const found = filterRetroChoreographies(filter);
    const shown = found.slice(0, RETRO_PICKER_LIST_LIMIT);
    list.replaceChildren(el("option", { text: `- 연출 고르기 (${found.length}개) -`, attrs: { value: "" } }));
    for (const entry of shown) {
      const label = `${entry.name} · ${entry.className ?? "몬스터"} · ${RETRO_CHOREOGRAPHY_MOTION_LABELS[entry.motion] ?? entry.motion}`;
      list.append(el("option", { text: label, attrs: { value: entry.id } }));
    }
    count.textContent = found.length > shown.length ? `${found.length}개 중 ${shown.length}개 - 더 좁혀 보세요` : `${found.length}개`;
  };
  query.addEventListener("input", fill);
  for (const control of [motion, element, family]) control.addEventListener("change", fill);
  // 필터 조작이 폼 전체의 change 재렌더를 타지 않게 한다(입력 중 카드가 다시 그려지면 포커스를 잃는다).
  for (const control of [query, motion, element, family]) control.addEventListener("change", (event) => event.stopPropagation());

  const clear = el("button", { class: "db-skill-retro-picker-clear", text: "연출 지우기", attrs: { type: "button" }, dataset: { testid: "db-skill-retro-picker-clear" } });
  clear.disabled = !borrowed;
  clear.addEventListener("click", () => {
    updateDatabaseRecord("skills", record.id, { retroChoreographyId: undefined });
    onPicked();
  });
  list.addEventListener("change", (event) => {
    event.stopPropagation();
    if (!list.value) return;
    updateDatabaseRecord("skills", record.id, { retroChoreographyId: list.value });
    onPicked();
  });

  fill();
  const filters = el("div", { class: "db-skill-retro-picker-filters" });
  filters.append(query, motion, element, family);
  const pick = el("div", { class: "db-skill-retro-picker-pick" });
  pick.append(list, clear, count);
  root.append(filters, pick);
  return root;
}
