import { el } from "@/util/dom";

export const TEAM_BUDGETS = [
  { label: "기본", turns: 100 },
  { label: "넉넉히", turns: 300 },
  { label: "오래 맡기기", turns: 600 },
] as const;

/** Keep arbitrary saved budgets intact until the user selects a preset. */
export function createTeamBudget(onChange: (turns: number) => void) {
  const root = el("div", { class: "ai-team-budget", attrs: { role: "group", "aria-label": "작업 예산" } });
  const buttons = TEAM_BUDGETS.map(({ label, turns }) => {
    const button = el("button", {
      class: "ai-team-btn", text: label,
      attrs: { type: "button", title: `${label} · 최대 ${turns}턴 · 다음 실행부터 적용`, "aria-pressed": "false" },
      dataset: { budgetTurns: String(turns) },
      on: { click: () => { onChange(turns); update(turns); } },
    });
    root.append(button);
    return button;
  });
  function update(turns: number) {
    buttons.forEach((button, index) => button.setAttribute("aria-pressed", String(TEAM_BUDGETS[index]!.turns === turns)));
  }
  return { root, update };
}
