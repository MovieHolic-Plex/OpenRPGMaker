// 스킬 탭 「연출」 카드의 「도트 연출」 고르기 — 움직이는 썸네일 갤러리에서 고른 연출을 이 스킬의 연출로 빌린다(SkillRecord.retroChoreographyId).
// 프로젝트 연출(내가 만든 것)이 앞, 번들 기본 연출(약 850개)이 뒤. 색인·필터는 src/assets/retroSkillCatalog.ts 의 것을 조수 도구와 함께 쓴다.
// 스킬 id 자체가 계약이면 그 연출이 우선이라 고르기는 안내만 보인다(빌린 값은 지우거나 바꿔도 무시된다).
import { retroChoreographyGallery, RETRO_CHOREOGRAPHY_MOTION_LABELS } from "@/editor/panels/databaseRetroGallery";
import { isEnemyUsedSkill, resolveSkillChoreography, retroClassSkill } from "@/assets/retroSkillCatalog";
import { recommendRetroChoreography } from "@/assets/retroChoreographyRecommend";
import { RETRO_SKILL_RECIPES } from "@/player/retroSkillChoreography";
import { retroMonsterSkill } from "@/assets/retroMonsterSkills";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { store } from "@/project/store";
import type { SkillRecord } from "@/project/types";
import { el } from "@/util/dom";

export { RETRO_CHOREOGRAPHY_MOTION_LABELS };

/** 「도트 연출」 고르기 한 덩어리. 고르면 updateDatabaseRecord 로 저장하고 onPicked 로 무대를 다시 그리게 한다. */
export function retroChoreographyPicker(record: SkillRecord, onPicked: () => void): HTMLElement {
  const own = retroClassSkill(record.id) ?? retroMonsterSkill(record.id);
  const borrowed = record.retroChoreographyId;
  const database = store.getCurrent().database;
  // 적이 쓰는 스킬이면 런타임은 「monster 모양」으로만 풀고 자동 추천을 끈다(retroSkillChoreography.ts skillForCaster) — 같은 규칙으로 보여 준다.
  const enemyUsed = isEnemyUsedSkill(database, record.id);
  const current = resolveSkillChoreography(record, database.skillChoreographies, enemyUsed ? "monster" : undefined)?.skill;
  const auto = !enemyUsed && !own && !current && !borrowed && !RETRO_SKILL_RECIPES[record.id] ? recommendRetroChoreography(record) : undefined;
  const root = el("div", { class: "db-skill-retro-picker", dataset: { testid: "db-skill-retro-picker" } });

  const status = el("div", { class: "db-skill-retro-picker-status", dataset: { testid: "db-skill-retro-picker-status" } });
  status.textContent = own
    ? `이 스킬은 도트 연출 계약(${own.name})을 그대로 씁니다. 연출을 바꾸려면 스킬을 복제해서 고르세요.`
    : current
      ? `빌려 온 연출: ${current.name} (${current.id})`
      : borrowed && enemyUsed && resolveSkillChoreography(record, database.skillChoreographies)
        ? `연출 ${borrowed} 은(는) 직업(아군) 전용 기본 연출이라 적에게는 재생되지 않습니다 - 몬스터용 연출이나 내 연출(chor_*)을 고르세요.`
      : borrowed
        ? `연출 계약 ${borrowed} 을(를) 찾지 못했습니다 - 다시 고르세요.`
        : auto
          ? `자동: ${auto.label}`
          : enemyUsed
            ? "적이 쓰는 스킬입니다. 적이 쓸 때 고르지 않으면 기본 몬스터 연출로 재생됩니다(적 스킬은 자동 추천이 꺼져 있음) - 아래에서 고르면 그 연출로 재생됩니다."
            : "고르지 않으면 기본 베기·탄 연출로 재생됩니다.";
  if (auto) status.title = `${auto.reason} — 바꾸려면 아래에서 연출을 고르세요.`;
  if (auto) status.dataset.autoChoreography = auto.baseId;
  root.append(el("div", { class: "db-skill-retro-picker-title", text: "도트 연출" }), status);
  if (own) return root;

  const clear = el("button", { class: "db-skill-retro-picker-clear", text: "연출 지우기", attrs: { type: "button" }, dataset: { testid: "db-skill-retro-picker-clear" } });
  clear.disabled = !borrowed;
  clear.addEventListener("click", () => {
    updateDatabaseRecord("skills", record.id, { retroChoreographyId: undefined });
    onPicked();
  });
  const gallery = retroChoreographyGallery({
    selectedId: borrowed,
    pickLabel: "이 연출을 이 스킬에 쓰기",
    onPick: (entry) => {
      updateDatabaseRecord("skills", record.id, { retroChoreographyId: entry.id });
      onPicked();
    },
  });
  const pick = el("div", { class: "db-skill-retro-picker-pick" });
  pick.append(clear);
  root.append(pick, gallery);
  return root;
}
