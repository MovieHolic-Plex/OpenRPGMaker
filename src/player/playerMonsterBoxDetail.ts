// 보관함(PC) 화면(에메랄드): 상자 하나의 30칸 격자 + 머리 줄 [◀ 상자 이름 ▶].
// 칸의 몬스터를 고르면 요약(관리 쪽)이 열려 파티로 데려가기·다른 칸으로 옮기기·놓아주기를 한다.
import { MONSTER_BOX_SIZE, monsterBoxCells, monsterBoxCount, monsterBoxName, monsterBoxOccupancy } from "@/project/monsterBox";
import { monsterMenuIconResourceId, monsterTypeLabel } from "@/player/playerMonsterPartyModel";
import { monsterCurrentHp, monsterDisplayName, monsterMaxHp, monsterSpeciesById } from "@/project/monsterCollection";
import type { StatusMenuDetail, StatusMenuDetailEntry, StatusMenuDetailOptions } from "@/player/playerStatusMenuDetailTypes";

const idle = (): void => {};

export function monsterBoxDetail(options: StatusMenuDetailOptions): StatusMenuDetail {
  const { project, session } = options;
  const ui = options.monsterCollect;
  const count = monsterBoxCount(session);
  const boxIndex = Math.max(0, Math.min(count - 1, ui?.boxIndex ?? 0));
  const cells = monsterBoxCells(session, boxIndex);
  const moveSourceId = ui?.boxMoveSourceId && session.monsterBox.includes(ui.boxMoveSourceId) ? ui.boxMoveSourceId : undefined;
  const act = options.onMonsterCollect;
  const step = (delta: -1 | 1): (() => void) => () => act?.({ kind: "boxStep", delta });

  const header: StatusMenuDetailEntry[] = [
    { label: "◀", value: "", description: "앞 상자를 봅니다", testId: "status-menu-box-prev", attributes: { boxNav: "prev" }, onActivate: step(-1) },
    {
      label: monsterBoxName(project, boxIndex), value: `${monsterBoxOccupancy(session, boxIndex)}/${MONSTER_BOX_SIZE}`,
      description: moveSourceId ? "옮길 칸을 고르세요. Esc 취소" : "←→ 상자 넘기기 · 선택하면 파티를 봅니다",
      testId: "status-menu-box-name", attributes: { boxNav: "name", boxIndex: String(boxIndex) }, onActivate: options.onToggleMonsterView,
    },
    { label: "▶", value: "", description: "다음 상자를 봅니다", testId: "status-menu-box-next", attributes: { boxNav: "next" }, onActivate: step(1) },
  ];

  const body: StatusMenuDetailEntry[] = cells.map((instanceId, cell): StatusMenuDetailEntry => {
    const slot = boxIndex * MONSTER_BOX_SIZE + cell;
    const raw = instanceId ? session.monsterInstances[instanceId] : undefined;
    const placing = moveSourceId !== undefined;
    if (!raw || !instanceId) {
      return {
        label: "빈 칸", value: "", description: placing ? "이 칸으로 옮깁니다" : "빈 칸입니다",
        testId: `status-menu-box-cell-${slot}`, attributes: { boxCell: String(slot), boxEmpty: "true" },
        onActivate: placing ? () => act?.({ kind: "boxPlace", sourceId: moveSourceId!, slot }) : idle,
      };
    }
    const name = monsterDisplayName(project, raw);
    const species = monsterSpeciesById(project, raw.speciesId);
    const hp = monsterCurrentHp(project, raw), maxHp = monsterMaxHp(project, raw);
    const isSource = instanceId === moveSourceId;
    const info = `${name} Lv.${raw.level} · ${monsterTypeLabel(project, species?.types)} · HP ${hp}/${maxHp}`;
    return {
      label: name, value: `Lv.${raw.level}\nHP ${hp}/${maxHp}`,
      description: isSource ? `${name}: 이 몬스터의 이동을 취소합니다` : placing ? `${info} — 이 칸과 자리를 바꿉니다` : info,
      testId: `status-menu-monster-${instanceId}`,
      attributes: { boxCell: String(slot), partyFainted: String(hp <= 0), ...(isSource ? { boxMoveSource: "true" } : {}) },
      face: { resourceId: monsterMenuIconResourceId(project, species?.graphic.monsterResourceId), alt: name, testId: `status-menu-monster-art-${instanceId}` },
      onActivate: isSource ? () => act?.({ kind: "cancelBoxMove" })
        : placing ? () => act?.({ kind: "boxPlace", sourceId: moveSourceId!, slot })
          : options.onSelectMonster ? () => options.onSelectMonster?.(instanceId) : idle,
    };
  });

  return {
    title: `보관함 · ${session.monsterBox.length}마리 · 파티 ${session.monsterParty.length}`,
    layout: "campaign-box",
    entries: [...header, ...body],
    hint: moveSourceId ? "옮길 칸을 고르세요. Esc 취소" : "↑↓←→ 칸 선택 · Enter 관리 · Esc 돌아가기",
  };
}
