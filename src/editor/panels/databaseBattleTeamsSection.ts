// 시스템 탭 「팀 교대 전투」 — FF6 식 교대 묶음(system.battleTeams · teamSwapCost). 도구 battle.teams 와 같은 규칙.
import { selectField, textField } from "@/editor/panels/databaseControls";
import { sectionCard } from "@/editor/panels/databaseWorkspace";
import { DEFAULT_TEAM_SWAP_COST } from "@/battle/battleTeams";
import { MAX_BATTLE_TEAMS, TEAM_SWAP_COST_LABELS, isTeamSwapCost } from "@/project/battleTeamModel";
import { el } from "@/util/dom";
import type { BattleTeamRecord, Project, TeamSwapCost } from "@/project/types";

const COST_OPTIONS = ["free", "gauge", "turn"] as const satisfies readonly TeamSwapCost[];

/** 시스템 탭의 다른 켜기 칸과 같은 34×18 알약 스위치(R3) — 맨 체크박스는 카드 오른쪽 끝으로 밀려 났다(2026-10-21 감사). */
function checkboxField(label: string, testid: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
  const input = el("input", { class: "db-toggle-input", attrs: { type: "checkbox", role: "switch" }, dataset: { testid } }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  return el("label", {
    class: "db-field",
    children: [el("span", { text: label }), el("span", { class: "db-toggle-switch", children: [input, el("span", { class: "db-toggle-thumb" })] })],
  });
}

type Update = (mutator: (draft: Project) => void, snapshotKey?: string) => void;

/** 시작 파티를 반으로 나눠 두 팀을 만든다(켤 때의 초안). 파티가 1명이면 둘째 팀은 첫 배우가 아닌 다른 배우로 채운다. */
function draftTeams(project: Project): BattleTeamRecord[] {
  const everyone = project.database.actors.map((actor) => actor.id);
  const party = (project.system.startActorIds ?? []).filter((id) => everyone.includes(id));
  const pool = [...party, ...everyone.filter((id) => !party.includes(id))];
  const half = Math.max(1, Math.ceil(pool.length / 2));
  return [
    { id: "team_a", name: "A팀", actorIds: pool.slice(0, half) },
    { id: "team_b", name: "B팀", actorIds: pool.slice(half) },
  ];
}

export function battleTeamsSection(project: Project, updateSystem: Update, rerender: () => void): HTMLElement {
  const teams = project.system.battleTeams ?? [];
  const enabled = teams.length >= 2;
  const children: HTMLElement[] = [
    el("p", { class: "db-system-help", text: "팀 = 교대 묶음입니다. 한 번에 한 팀만 싸우고, 전투 명령에 「○○ 교대」가 생깁니다(동시 행동 없음). 팀을 끄면 기존처럼 한 파티로 싸웁니다." }),
    checkboxField("팀 교대 전투 사용", "db-field-system-battle-teams-enabled", enabled, (checked) => {
      updateSystem((draft) => {
        if (checked) draft.system.battleTeams = draftTeams(draft);
        else {
          delete draft.system.battleTeams;
          delete draft.system.teamSwapCost;
        }
      });
      rerender();
    }),
  ];
  if (!enabled) return sectionCard({ title: "팀 교대 전투", children });
  children.push(
    selectField("교대 비용", "db-field-system-team-swap-cost", project.system.teamSwapCost ?? DEFAULT_TEAM_SWAP_COST,
      COST_OPTIONS.map((id) => ({ id, name: TEAM_SWAP_COST_LABELS[id] })), (value) => {
        updateSystem((draft) => {
          if (!isTeamSwapCost(value) || value === DEFAULT_TEAM_SWAP_COST) delete draft.system.teamSwapCost;
          else draft.system.teamSwapCost = value;
        });
      }),
  );
  teams.forEach((team, index) => {
    children.push(textField(`팀 ${index + 1} 이름`, `db-field-system-team-name-${index}`, team.name, (value) => {
      updateSystem((draft) => {
        const target = draft.system.battleTeams?.[index];
        if (target) target.name = value.trim() || target.id;
      }, `system:team-name-${index}`);
    }));
  });
  // 배우별 소속 팀. 팀 사이에서 옮기면 앞 팀에서 빠진다.
  const teamOptions = [{ id: "", name: "(소속 없음 — 첫 팀)" }, ...teams.map((team) => ({ id: team.id, name: team.name }))];
  for (const actor of project.database.actors.slice(0, 24)) {
    const current = teams.find((team) => team.actorIds.includes(actor.id))?.id ?? "";
    children.push(selectField(`${actor.name} 소속`, `db-field-system-team-of-${actor.id}`, current, teamOptions, (value) => {
      updateSystem((draft) => {
        for (const team of draft.system.battleTeams ?? []) team.actorIds = team.actorIds.filter((id) => id !== actor.id);
        const target = draft.system.battleTeams?.find((team) => team.id === value);
        if (target) target.actorIds.push(actor.id);
      });
    }));
  }
  if (teams.length < MAX_BATTLE_TEAMS) {
    children.push(el("button", {
      class: "btn small",
      text: "팀 추가",
      attrs: { type: "button" },
      dataset: { testid: "db-system-team-add" },
      on: {
        click: () => {
          updateSystem((draft) => {
            const next = (draft.system.battleTeams?.length ?? 0) + 1;
            draft.system.battleTeams = [...(draft.system.battleTeams ?? []), { id: `team_${String.fromCharCode(96 + next)}`, name: `${String.fromCharCode(64 + next)}팀`, actorIds: [] }];
          });
          rerender();
        },
      },
    }));
  }
  return sectionCard({ title: "팀 교대 전투", children });
}
