import { numberField, selectField } from "@/editor/panels/databaseControls";
import { switchDatabaseActiveTab } from "@/editor/panels/database";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { selectEditorMap } from "@/editor/mapSelection";
import { sectionCard } from "@/editor/panels/databaseWorkspace";
import { factionReferenceLabels } from "@/editor/panels/databaseFactionModel";
import { DEFAULT_ENEMY_FACTION_ID, PLAYER_FACTION_ID, resolveFactionTable, willAttackOnSight } from "@/project/factions";
import { applyPlayerKillReputation, effectiveFactionStance, type FactionStanceOverrides } from "@/project/factionRuntime";
import type { FactionAggression } from "@/project/types";
import { store } from "@/project/store";
import { el } from "@/util/dom";

/** A fresh authored-state preview. Never writes either the project or the live session. */
export function factionReputationPreview(): HTMLElement {
  const factions = store.getCurrent().factions;
  const table = resolveFactionTable(factions);
  let defeatedId = DEFAULT_ENEMY_FACTION_ID;
  let count = 1;
  const result = el("div", { class: "db-ws-stack", dataset: { testid: "db-faction-reputation-preview-result" } });
  const paint = (): void => {
    let overrides: FactionStanceOverrides = {};
    if (factions?.playerKillReputation) {
      for (let i = 0; i < count; i++) overrides = applyPlayerKillReputation(table, overrides, defeatedId, factions.playerKillReputation.weight);
    }
    result.replaceChildren(...table.ids.filter((id) => id !== PLAYER_FACTION_ID).map((id) => {
      const index = table.ids.indexOf(id);
      const before = effectiveFactionStance(table, undefined, id, PLAYER_FACTION_ID);
      const after = effectiveFactionStance(table, overrides, id, PLAYER_FACTION_ID);
      return el("p", {
        class: "db-ws-usage",
        text: `${table.names[index]}: ${before} → ${Number(after.toFixed(3))} · ${willAttackOnSight(after, table.aggression[index]! as FactionAggression) ? "플레이어에게 선공" : "플레이어에게 선공 안 함"}`,
      });
    }));
  };
  paint();
  return el("div", { class: "db-ws-stack", children: [
    el("p", { class: "db-ws-usage", text: "저장된 초기 관계에서 계산합니다. 아래 미리보기는 게임과 설정을 변경하지 않습니다." }),
    selectField("처치할 진영", "db-faction-preview-target", defeatedId, table.ids.filter((id) => id !== PLAYER_FACTION_ID).map((id) => ({ id, name: table.names[table.ids.indexOf(id)] ?? id })), (id) => { defeatedId = id; paint(); }),
    numberField("처치 횟수", "db-faction-preview-count", count, (value) => { count = Math.trunc(value); paint(); }, { min: 1, max: 100 }),
    result,
  ] });
}

export type FactionUsage = {
  readonly enemyCount: number;
  readonly mapCount: number;
  readonly referenceCount: number;
  readonly card: HTMLElement;
};

/** 사용처 목록(카드)과 제목줄 요약에 쓸 개수를 함께 만든다. */
export function factionUsage(factionId: string): FactionUsage {
  const project = store.getCurrent();
  const rows: HTMLElement[] = project.database.enemies
    .filter((enemy) => (enemy.factionId ?? DEFAULT_ENEMY_FACTION_ID) === factionId)
    .map((enemy) => el("button", {
      class: "db-ws-btn db-ws-btn-ghost", attrs: { type: "button" },
      text: `몬스터: ${enemy.name}${enemy.factionId ? "" : " (기본 소속)"}`,
      dataset: { testid: `db-faction-use-enemy-${enemy.id}` },
      on: { click: (event) => {
        setSelectedRecordId("enemies", enemy.id);
        const root = (event.currentTarget as HTMLElement).closest<HTMLElement>(".database-modal-body");
        if (root) switchDatabaseActiveTab("enemies", root);
      } },
    }));
  const enemyCount = rows.length;
  for (const map of Object.values(project.maps)) {
    const spawns = (map.fieldSpawns ?? []).filter((spawn) => {
      const troop = project.database.troops.find((entry) => entry.id === spawn.troopId);
      const enemyId = troop?.members?.find((member) => member.hidden !== true)?.enemyId ?? troop?.enemyIds[0];
      const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
      return (spawn.factionId ?? enemy?.factionId ?? DEFAULT_ENEMY_FACTION_ID) === factionId;
    });
    if (spawns.length) rows.push(el("button", {
      class: "db-ws-btn db-ws-btn-ghost", attrs: { type: "button" },
      text: `맵: ${map.name} · 필드 스폰 ${spawns.length}개`,
      dataset: { testid: `db-faction-use-map-${map.id}` },
      on: { click: () => { selectEditorMap(map.id); } },
    }));
  }
  const mapCount = rows.length - enemyCount;
  const references = factionReferenceLabels(project, factionId);
  const card = sectionCard({
    title: "사용처", hint: "몬스터나 맵을 눌러 이동합니다. 기본·상속 소속도 포함합니다.",
    children: [el("div", { class: "db-faction-usage-list", children: rows }),
      el("p", { class: "db-ws-usage", text: references.length ? `명시적 참조: ${references.join(" · ")}` : "명시적으로 지정한 참조가 없습니다." })],
    testid: "db-faction-usage",
  });
  return { enemyCount, mapCount, referenceCount: references.length, card };
}
