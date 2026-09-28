// 적 그룹 「전투 뒤」 구획 — 결과 화면이 닫히고 필드로 돌아온 뒤 결과별로 한 번 도는 명령 목록.
//
// 전투 이벤트 페이지(전투 안)와 달리 조건·빈도가 없다. 결과(이겼을 때 / 졌을 때 / 도망쳤을 때)가
// 곧 조건이라 세 탭에 명령 목록 하나씩이다. 명령은 필드에서 돌므로 맵 이벤트 명령 목록을 쓴다.
// 화면 어휘는 전투 이벤트 구획의 클래스(머리줄·페이지 탭·명령 영역)를 그대로 빌린다.
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { renderDatabaseCommandListEditor } from "@/editor/panels/databaseCommandListAdapter";
import { store } from "@/project/store";
import { normalizeTroopAfterBattle, TROOP_AFTER_BATTLE_LABELS, TROOP_AFTER_BATTLE_OUTCOMES } from "@/project/troopAfterBattle";
import type { Command } from "@/project/types";
import type { TroopAfterBattleOutcome, TroopRecord } from "@/project/types/database";
import { el } from "@/util/dom";

const OUTCOME_HINTS: Readonly<Record<TroopAfterBattleOutcome, string>> = {
  victory: "이긴 뒤 필드에서 한 번 돕니다. 보상 대사·스위치 켜기·장소 이동에 씁니다.",
  defeat: "「패배 허용」 전투에서 진 뒤에만 돕니다. 게임 오버로 끝나는 패배에는 돌지 않습니다.",
  escape: "도망친 뒤 필드에서 한 번 돕니다.",
};

const activeOutcomes = new Map<string, TroopAfterBattleOutcome>();

export function renderTroopAfterBattlePanel(record: TroopRecord, rerender: () => void = () => undefined): HTMLElement {
  const outcome = activeOutcomes.get(record.id) ?? "victory";
  const commands = record.afterBattle?.[outcome] ?? [];
  const host = el("div", { class: "cmd-list", dataset: { testid: "db-troop-after-battle-command-list" } });
  renderDatabaseCommandListEditor(host, {
    commands,
    rerender,
    pickerContext: "map",
    replaceCommands: (next: Command[]) => replaceOutcomeCommands(record, outcome, next),
  });
  return el("section", {
    class: "db-troop-event-panel db-troop-after-battle-panel",
    dataset: { testid: "db-troop-after-battle-panel" },
    children: [
      el("header", {
        class: "db-troop-event-head",
        children: [
          el("h3", { text: "전투 뒤" }),
          el("span", {
            class: "db-troop-event-head-hint",
            text: "결과 화면이 닫히고 필드로 돌아온 뒤 한 번 실행됩니다. 이벤트 전투·랜덤 인카운터·심볼 접촉 모두 같습니다.",
          }),
        ],
      }),
      el("div", {
        class: "db-troop-event-page-tabs",
        attrs: { role: "group", "aria-label": "전투 결과" },
        children: TROOP_AFTER_BATTLE_OUTCOMES.map((entry) => {
          const count = record.afterBattle?.[entry]?.length ?? 0;
          const active = entry === outcome;
          return el("button", {
            class: `db-troop-event-page-tab${active ? " active" : ""}`,
            attrs: { type: "button", "aria-pressed": String(active) },
            dataset: { testid: `db-troop-after-battle-tab-${entry}` },
            text: count > 0 ? `${TROOP_AFTER_BATTLE_LABELS[entry]} · ${count}` : TROOP_AFTER_BATTLE_LABELS[entry],
            on: { click: () => { activeOutcomes.set(record.id, entry); rerender(); } },
          });
        }),
      }),
      el("p", { class: "db-troop-event-head-hint", dataset: { testid: "db-troop-after-battle-hint" }, text: OUTCOME_HINTS[outcome] }),
      el("div", {
        class: "db-troop-event-command-area event-contents-fieldset",
        dataset: { testid: "db-troop-after-battle-command-area" },
        children: [host],
      }),
    ],
  });
}

function replaceOutcomeCommands(record: TroopRecord, outcome: TroopAfterBattleOutcome, commands: Command[]): void {
  const current = store.getCurrent().database.troops.find((entry) => entry.id === record.id) ?? record;
  updateDatabaseRecord("troops", record.id, { afterBattle: normalizeTroopAfterBattle({ ...current.afterBattle, [outcome]: commands }) });
}
