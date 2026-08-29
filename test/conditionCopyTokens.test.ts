/** @vitest-environment happy-dom */
// 조건 문장·요약·배지·분기 폼에 내부 토큰이 새면 안 된다.
// 페이지 문장과 분기 요약은 같은 기능의 두 표면이므로 한 계약으로 묶는다.
import { beforeEach, describe, expect, it } from "vitest";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { conditionForm } from "@/editor/panels/eventEditor/conditionForm";
import { pageConditionSentence } from "@/editor/panels/eventEditor/pageConditionSentence";
import { renderClassicPageTabStrip, renderEventPageProps } from "@/editor/panels/eventEditor/pageProps";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Condition, EventPage, GameEvent } from "@/project/types";

const FORBIDDEN: readonly { readonly name: string; readonly re: RegExp }[] = [
  { name: "ON", re: /\bON\b/ },
  { name: "OFF", re: /\bOFF\b/ },
  { name: "AND(", re: /AND\(/ },
  { name: "OR(", re: /OR\(/ },
  { name: "NOT", re: /\bNOT\b/ },
  { name: "timer1", re: /timer1/ },
  { name: "timer2", re: /timer2/ },
  { name: "completed", re: /\bcompleted\b/ },
  { name: "failed", re: /\bfailed\b/ },
  { name: "abandoned", re: /\babandoned\b/ },
  { name: "run", re: /\brun\b/ },
];

function assertCleanCopy(label: string, text: string): void {
  for (const token of FORBIDDEN) {
    expect(text, `${label} leaked ${token.name}: ${text}`).not.toMatch(token.re);
  }
}

function sampleConditions(): readonly Condition[] {
  const project = store.getCurrent();
  const switchId = project.switches[0]?.id ?? "sw_0001";
  const variableId = project.variables[0]?.id ?? "var_0001";
  const actorId = project.database.actors[0]?.id ?? "act_0001";
  const itemId = project.database.items[0]?.id ?? "item_0001";
  const switchCond: Condition = { kind: "switch", switchId, value: true };
  return [
    switchCond,
    { kind: "switch", switchId, value: false },
    { kind: "variable", variableId, op: ">=", value: 10 },
    { kind: "variable", variableId, op: "==", value: 4 },
    { kind: "variable", variableId, op: "!=", value: 1 },
    { kind: "selfSwitch", key: "A", value: true },
    { kind: "selfSwitch", key: "B", value: false },
    { kind: "actor", actorId, present: true },
    { kind: "actor", actorId, present: false },
    { kind: "item", itemId, present: true },
    { kind: "item", itemId, present: false },
    { kind: "gold", op: ">=", amount: 100 },
    { kind: "timer", timerId: "timer1", seconds: 5 },
    { kind: "timer", timerId: "timer2", seconds: 90 },
    { kind: "timePhase", phase: "morning" },
    { kind: "season", season: "winter" },
    { kind: "npcActivity", activity: "work" },
    { kind: "friendshipAtLeast", npcKey: "촌장", value: 50 },
    { kind: "battleResult", result: "victory" },
    { kind: "run", query: "active", value: true },
    { kind: "run", query: "active", value: false },
    { kind: "run", query: "floor", op: ">=", value: 3 },
    { kind: "run", query: "flag", flag: "door", value: true },
    { kind: "run", query: "result", result: "completed" },
    { kind: "run", query: "result", result: "failed" },
    { kind: "run", query: "result", result: "abandoned" },
    { kind: "all", conditions: [switchCond] },
    { kind: "any", conditions: [switchCond] },
    { kind: "not", condition: switchCond },
    { kind: "all", conditions: [] },
    { kind: "any", conditions: [] },
  ];
}

function pageWith(conditions: readonly Condition[]): EventPage {
  return {
    id: "p1",
    name: "조건 복사",
    conditions: [...conditions],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
}

function hostEvent(page: EventPage): GameEvent {
  return {
    id: "ev_copy",
    x: 0,
    y: 0,
    trigger: { kind: "action" },
    commands: [],
    pages: [page],
  };
}

describe("조건 복사에 내부 토큰이 없다", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
  });

  it("페이지 문장과 분기 요약에 금지 토큰이 없다", () => {
    for (const condition of sampleConditions()) {
      assertCleanCopy(`sentence ${condition.kind}`, pageConditionSentence([condition]).text);
      assertCleanCopy(
        `fork ${condition.kind}`,
        commandSummary({ kind: "fork", condition, then: [] }),
      );
    }
  });

  it("페이지 탭·배지·조건 폼에도 금지 토큰이 없다", () => {
    const mapId = store.getCurrent().startMapId;
    for (const condition of sampleConditions()) {
      const page = pageWith([condition]);
      const event = hostEvent(page);
      const tabs = renderClassicPageTabStrip(mapId, event, page);
      assertCleanCopy(`tab ${condition.kind}`, tabs.textContent ?? "");
      const tooltip = tabs.querySelector('[data-testid="evt-page-cond-1"]')?.parentElement?.getAttribute("title") ?? "";
      assertCleanCopy(`tooltip ${condition.kind}`, tooltip);

      const props = renderEventPageProps(mapId, event.id, page, event);
      assertCleanCopy(`props ${condition.kind}`, props.textContent ?? "");

      const form = conditionForm(condition, () => {});
      assertCleanCopy(`form ${condition.kind}`, form.textContent ?? "");
    }
  });
});
