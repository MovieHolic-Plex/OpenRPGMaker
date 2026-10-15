// FF6 식 팀 교대 버튼. 전투 명령 창 루트 메뉴에 「<팀>와 교대」를 더한다.
// 팀 교대 설정(system.battleTeams)이 없는 프로젝트는 snapshot.teams 가 없어 빈 배열이다 — 기존 화면은 그대로다.
import type { BattleSnapshot } from "@/battle/runtime";

type CommandButtonFactory = (
  label: string,
  testId: string,
  icon: string,
  detail: string,
  onClick: () => void,
  inert?: boolean,
  disabledReason?: string,
  hint?: string,
) => HTMLButtonElement;

export interface TeamSwapPanelOptions {
  runTeamSwap?(targetTeamId: string): void;
}

/** 다른 팀으로 교대하는 버튼들. 지금 싸우는 팀 이름은 각 버튼의 설명에 「지금 ○○」 로 남긴다. */
export function teamSwapCommandNodes(
  snapshot: BattleSnapshot,
  options: TeamSwapPanelOptions,
  commandButton: CommandButtonFactory,
): HTMLElement[] {
  const teams = snapshot.teams;
  if (!teams || teams.length < 2) return [];
  const current = teams.find((team) => team.active);
  return teams
    .filter((team) => !team.active)
    .map((team) => commandButton(
      `${team.name} 교대`,
      `actor-team-swap-${team.id}`,
      "switch",
      current ? `지금 ${current.name} · ${team.alive}명` : `${team.alive}명`,
      () => options.runTeamSwap?.(team.id),
      !team.canSwapIn,
      team.alive === 0 ? `${team.name}는 모두 쓰러졌다.` : "지금은 교대할 수 없다.",
      `${team.name}으로 팀을 바꾼다. 지금 팀은 대기한다.`,
    ));
}
