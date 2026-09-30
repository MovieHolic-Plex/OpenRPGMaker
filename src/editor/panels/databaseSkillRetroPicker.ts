// 스킬 탭 「연출」 카드의 「도트 연출」 고르기 — 움직이는 썸네일 갤러리에서 고른 연출을 이 스킬의 연출로 빌린다(SkillRecord.retroChoreographyId).
// 프로젝트 연출(내가 만든 것)이 앞, 번들 기본 연출(약 850개)이 뒤. 색인·필터는 src/assets/retroSkillCatalog.ts 의 것을 조수 도구와 함께 쓴다.
// 스킬 id 자체가 계약이면 그 연출이 우선이라 고르기는 안내만 보인다(빌린 값은 지우거나 바꿔도 무시된다).
import { retroChoreographyGallery, RETRO_CHOREOGRAPHY_MOTION_LABELS } from "@/editor/panels/databaseRetroGallery";
import { resolveSkillChoreography, retroClassSkill } from "@/assets/retroSkillCatalog";
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
  const current = resolveSkillChoreography(record, store.getCurrent().database.skillChoreographies)?.skill;
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
