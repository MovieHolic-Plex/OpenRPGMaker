import { battleRow, formationActiveSlots, FORMATION_EFFECT_TEXT } from "@/battle/battleFormation";
import { resolveActorName } from "@/project/sessionActorCommands";
import type { StatusMenuDetail, StatusMenuDetailEntry, StatusMenuDetailOptions } from "@/player/playerStatusMenuDetailTypes";

export function formationDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const { project, session } = options;
  const ids = session.partyActorIds;
  const activeSlots = formationActiveSlots(project, ids.length);
  const monsterMode = (project.system.battleParty === "monsters" || project.system.monsterBattleParty === true) && session.monsterParty.length > 0;
  const selected = ids.indexOf(options.formationActorId ?? "");
  const entries: StatusMenuDetailEntry[] = ids.flatMap((id, index) => {
    const actor = project.database.actors.find(a => a.id === id);
    if (!actor) return [];
    const name = resolveActorName(session, actor);
    return [{
      label: `${index + 1}. ${name}`,
      value: monsterMode ? "영웅 순서" : `${index < activeSlots ? "참전" : "대기"} · ${battleRow(session.actorRows?.[id]) === "back" ? "후열" : "전열"}`,
      description: selected < 0 ? (monsterMode ? "몬스터 메뉴에서 전투 파티를 편성하세요. 이 목록은 영웅 순서입니다." : `결정: 이동할 파티원 선택. 앞 ${activeSlots}명 기본 참전(적 그룹 설정 우선).`) : selected === index ? "선택됨 · 아래에서 전후열 변경" : "결정: 선택한 파티원을 이 위치로 이동",
      testId: `status-menu-formation-actor-${id}`,
      onActivate: () => selected >= 0 && selected !== index
        ? options.onMoveFormationActor?.(options.formationActorId!, index)
        : options.onSelectFormationActor?.(id),
    }];
  });
  if (selected >= 0 && !monsterMode) entries.push({
    label: "선택한 파티원 전후열 변경", value: battleRow(session.actorRows?.[ids[selected]!]) === "back" ? "후열 → 전열" : "전열 → 후열",
    description: FORMATION_EFFECT_TEXT, testId: "status-menu-formation-toggle-row",
    onActivate: () => options.onToggleRow?.(ids[selected]!),
  });
  return { title: "진형", entries, emptyLabel: "편성할 파티원이 없습니다",
    hint: monsterMode ? "몬스터 참전 중: 영웅 순서는 전투에 적용되지 않습니다. 몬스터 메뉴에서 편성하세요."
      : `앞 ${activeSlots}명 기본 참전(적 그룹 설정 우선). ${FORMATION_EFFECT_TEXT}` };
}
