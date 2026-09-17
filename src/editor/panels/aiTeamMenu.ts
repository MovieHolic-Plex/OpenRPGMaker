import { el } from "@/util/dom";
import { loadTeamSpec, saveTeamSpec, subscribeTeamSpec } from "@/ai/piAgent/teamSpecStore";
import { createTeamBudget, TEAM_BUDGETS } from "./aiTeamBudget";

export function createTeamMenu(options: {
  initialTeam: boolean;
  onTeamChange(team: boolean): void;
  onLabelChange(label: string): void;
  onOpenSettings(): void;
}) {
  let team = options.initialTeam;
  const root = el("div", {
    class: "ai-composer-popover ai-team-menu", attrs: { hidden: "", role: "dialog", "aria-label": "팀 작업 설정" },
    dataset: { testid: "ai-team-menu" },
  });
  const solo = el("button", { text: "혼자", attrs: { type: "button" }, on: { click: () => choose(false) } });
  const together = el("button", { text: "팀으로", attrs: { type: "button" }, on: { click: () => choose(true) } });
  const modes = el("div", { class: "ai-team-menu-modes", attrs: { role: "group", "aria-label": "작업 방식" }, children: [solo, together] });
  const budget = createTeamBudget(workBudget => saveTeamSpec({ ...loadTeamSpec(), workBudget }));
  const review = el("button", {
    attrs: { type: "button", role: "switch", "aria-label": "완료 후 검토", title: "검수 담당이 최종 결과를 읽기 전용으로 검토합니다. 기본 데이터 검증은 항상 유지됩니다." },
    dataset: { testid: "ai-team-review-toggle" },
    on: { click: () => { const spec = loadTeamSpec(); saveTeamSpec({ ...spec, reviewAfterWork: spec.reviewAfterWork === false }); } },
  });
  const missing = el("button", { text: "담당 설정 필요 ›", attrs: { type: "button", title: "팀 구성에서 검수 담당을 추가하거나 켜 주세요." }, on: { click: options.onOpenSettings } });
  const teamOptions = el("div", { children: [
    el("div", { class: "ai-team-menu-budget", children: [el("span", { text: "작업 예산" }), budget.root] }),
    el("div", { class: "ai-team-menu-row", children: [el("span", { text: "완료 후 검토" }), review, missing] }),
  ] });
  root.append(
    el("div", { class: "ai-team-menu-row", children: [el("span", { text: "작업 방식" }), modes] }),
    teamOptions,
    el("button", { class: "ai-team-menu-settings", text: "팀 구성 · 역할 편집　›", attrs: { type: "button" }, on: { click: options.onOpenSettings } }),
  );
  function choose(next: boolean) { team = next; options.onTeamChange(next); render(); }
  function render() {
    const spec = loadTeamSpec();
    const workBudget = spec.workBudget ?? 300;
    const hasReviewer = spec.members.some(member => member.enabled && member.kind === "reviewer");
    solo.setAttribute("aria-pressed", String(!team));
    together.setAttribute("aria-pressed", String(team));
    teamOptions.hidden = !team;
    budget.update(workBudget);
    review.disabled = !hasReviewer && spec.reviewAfterWork === false;
    missing.hidden = hasReviewer;
    review.setAttribute("aria-checked", String(hasReviewer && spec.reviewAfterWork !== false));
    review.textContent = !hasReviewer && spec.reviewAfterWork !== false ? "생략" : hasReviewer && spec.reviewAfterWork !== false ? "켬" : "끔";
    missing.textContent = spec.reviewAfterWork === false ? "검토 끔 · 담당 설정 ›" : "담당 설정 필요 ›";
    options.onLabelChange(team ? `팀 · ${TEAM_BUDGETS.find(item => item.turns === workBudget)?.label ?? "넉넉히"} ▾` : "혼자 ▾");
  }
  const unsubscribe = subscribeTeamSpec(render);
  render();
  return { root, setTeam(next: boolean) { team = next; render(); }, dispose: unsubscribe };
}
