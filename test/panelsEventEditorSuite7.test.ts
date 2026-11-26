// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi, beforeAll } from "vitest";
import * as catalog from "@/assets/charsetCatalog";
import { renderNpcGraphicPicker } from "@/editor/panels/eventEditor/npcGraphicPicker";
import { editorEventMarkerTexture } from "@/editor/editSceneEventMarkers";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, EventPageCondition, Project } from "@/project/types";
import { runTool } from "@/editor/tools/toolRunner";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { installEventEditorCustomSelects } from "@/editor/panels/eventEditor/customSelect";
import { navigateToEventDraftIssue } from "@/editor/panels/eventEditor/validationBell";
import { prepareScriptCompiler } from "@/editor/script/compile";
import { scriptLineNodes } from "@/editor/panels/eventEditor/scriptLines";
import { isolateTimers } from "./mergedTeardown";

describe("npcGraphicRecovery", () => {
  isolateTimers();
  const textureKey = 'tex_easyrpg_charset_people1';
  let mapId: string;
  const page = (): EventPage => store.getCurrent().maps[mapId]!.events[0]!.pages![0]!;
  const get = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
  function mount() {
    const close = vi.fn();
    document.body.replaceChildren(renderNpcGraphicPicker(mapId, 'resident', page(), close));
    return close;
  }
  function enter(id: string) {
    const input = get('event-graphic-direct-sprite-input') as HTMLInputElement;
    input.value = id;
    input.dispatchEvent(new Event('input'));
    return input;
  }
  beforeEach(() => {
    const project = createBlankProject();
    mapId = project.startMapId;
    project.characters = { resident: { displayName: 'Existing resident' } };
    project.maps[mapId]!.events = [{ id: 'resident', characterId: 'resident', x: 2, y: 2,
      trigger: { kind: 'action' }, commands: [], pages: [{ id: 'page', name: 'Existing dialogue',
        graphic: { sprite: { type: 'bundled', id: textureKey }, opacity: 180 },
        conditions: [], trigger: { kind: 'action' }, priority: 'same',
        movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [{ kind: 'text', body: 'Keep my dialogue' }],
      }] }];
    store.replace(project);
  });
  afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
  describe('character asset recovery', () => {
    it('retains an unavailable request and data, then accepts a manual choice', () => {
      const close = mount();
      const before = structuredClone(store.getCurrent());
      const input = enter('unknown-character');
      get('event-graphic-confirm').click();
      expect(close).not.toHaveBeenCalled();
      expect(store.getCurrent()).toEqual(before);
      expect(input.value).toBe('unknown-character');
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(get('event-graphic-recovery').dataset.code).toBe('graphic-not-found');
      get(`event-graphic-resource-${textureKey}`).click();
      get('npc-character-slot-3').click();
      get('event-graphic-confirm').click();
      expect(close).toHaveBeenCalledOnce();
      expect(page().graphic.sprite?.id).toBe(textureKey);
      expect(page().commands).toEqual(before.maps[mapId]!.events[0]!.pages![0]!.commands);
      expect(store.getCurrent().characters).toEqual(before.characters);
    });

    it('cancels a failed selection without any project write', () => {
      const close = mount();
      const before = structuredClone(store.getCurrent());
      enter('unknown-character');
      get('event-graphic-confirm').click();
      get('event-graphic-cancel').click();
      expect(close).toHaveBeenCalledOnce();
      expect(store.getCurrent()).toEqual(before);
    });

    it('offers explicit no-image recovery in an empty catalog without crashing or assigning an ID', () => {
      vi.spyOn(catalog, 'projectCharsetAssets').mockReturnValue([]);
      const before = structuredClone(store.getCurrent());
      const close = mount();
      expect(store.getCurrent()).toEqual(before);
      expect(get('event-graphic-recovery').dataset.code).toBe('graphic-not-found');
      get('event-graphic-placeholder').click();
      expect(close).toHaveBeenCalledOnce();
      expect(page().graphic.sprite).toBeUndefined();
      expect(page().graphic.transparent).toBeUndefined();
      expect(editorEventMarkerTexture(store.getCurrent(), page().graphic)).toBeNull();
      expect(page().commands).toEqual(before.maps[mapId]!.events[0]!.pages![0]!.commands);
    });

    it.each([undefined, false, true])('preserves authored transparency %s through no-image and manual recovery', (transparent) => {
      if (transparent !== undefined) page().graphic.transparent = transparent;
      const before = structuredClone(store.getCurrent());
      const close = mount();
      get('event-graphic-placeholder').click();
      expect(close).toHaveBeenCalledOnce();
      expect(page().graphic.sprite).toBeUndefined();
      expect(editorEventMarkerTexture(store.getCurrent(), page().graphic)).toBeNull();

      const expectedPlaceholder = { ...before.maps[mapId]!.events[0]!.pages![0]!.graphic };
      delete expectedPlaceholder.sprite;
      expect(page().graphic).toEqual(expectedPlaceholder);
      const reopenedClose = mount();
      get(`event-graphic-resource-${textureKey}`).click();
      get('npc-character-slot-3').click();
      get('event-graphic-confirm').click();
      expect(reopenedClose).toHaveBeenCalledOnce();
      expect(page().graphic.sprite?.id).toBe(textureKey);
      expect(page().graphic.transparent).toBe(transparent);
      const marker = editorEventMarkerTexture(store.getCurrent(), page().graphic);
      if (transparent === true) expect(marker).toBeNull();
      else expect(marker).not.toBeNull();
      const originalPage = before.maps[mapId]!.events[0]!.pages![0]!;
      expect({ ...page(), graphic: originalPage.graphic }).toEqual(originalPage);
      expect(store.getCurrent().characters).toEqual(before.characters);
    });

    it('does not commit a removed upload from an already-open picker', () => {
      store.getCurrent().assets.uploaded.custom = { id: 'custom', kind: 'charset', name: 'Custom', dataUrl: 'data:image/png;base64,AA==' };
      const close = mount();
      get('event-graphic-resource-custom').click();
      delete store.getCurrent().assets.uploaded.custom;
      const before = structuredClone(store.getCurrent());
      get('event-graphic-confirm').click();
      expect(close).not.toHaveBeenCalled();
      expect(store.getCurrent()).toEqual(before);
    });

    it('rejects an unmatched query instead of substituting a villager, and still accepts explicit retry and transparency', () => {
      // 2026-09-27: 검색어 미매칭은 다시 거절이다 — 대체+경고는 조수가 무시해 엉뚱한 그림이 저장됐다.
      const ctx = { project: store.getCurrent() };
      const args = { mapId, id: 'new-resident', x: 3, y: 3, name: 'Requested resident', pages: [{ text: 'Keep this request' }] };
      const result = runTool(ctx, 'place_npc', { ...args, graphic: { query: 'old woman monster' } });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe('graphic-not-found');
      expect(ctx.project.maps[mapId]?.events.find((event) => event.id === 'new-resident')).toBeUndefined();
      const retry = runTool(ctx, 'place_npc', { ...args, graphic: { textureKey, characterIndex: 1 } });
      expect(retry.ok, retry.summary).toBe(true);
      const transparent = runTool(ctx, 'place_npc', { ...args, id: 'transparent-resident', graphic: { transparent: true } });
      expect(transparent.ok, transparent.summary).toBe(true);
    });
  });
});

describe("pageConditionValidationTargets", () => {
  isolateTimers();
  afterEach(() => document.body.replaceChildren());
  const cases: readonly { readonly condition: EventPageCondition; readonly code: string; readonly simpleId?: string; readonly advancedField: string }[] = [
    { condition: { kind: "variable", variableId: "missing", op: ">=", value: 1 }, code: "reference.variable.missing", simpleId: "event-page-variable-condition-input", advancedField: "variable" },
    { condition: { kind: "actor", actorId: "missing", present: true }, code: "reference.actor.missing", simpleId: "event-page-actor-condition-input", advancedField: "actor" },
    { condition: { kind: "item", itemId: "missing", present: true }, code: "reference.item.missing", simpleId: "event-page-item-condition-input", advancedField: "item" },
    { condition: { kind: "timer", timerId: "timer2", seconds: 0 }, code: "condition.timer.always-true", simpleId: "event-page-timer2-condition-seconds", advancedField: "timer-seconds" },
    { condition: { kind: "timePhase", phase: "night" }, code: "condition.timePhase.no-time-system", simpleId: "event-page-time-phase-condition-input", advancedField: "time-phase" },
    { condition: { kind: "season", season: "winter" }, code: "condition.season.no-time-system", simpleId: "event-page-season-condition-input", advancedField: "season" },
    { condition: { kind: "npcActivity", activity: "" }, code: "condition.npcActivity.empty", simpleId: "event-page-npc-activity-condition-input", advancedField: "npc-activity" },
    { condition: { kind: "friendshipAtLeast", value: 100 }, code: "condition.friendship.no-character-id", simpleId: "event-page-friendship-condition-npc-key", advancedField: "friendship-npc-key" },
    { condition: { kind: "relationshipAtLeast", state: "dating" }, code: "condition.relationship.no-character-id", simpleId: "event-page-relationship-condition-npc-key", advancedField: "relationship-npc-key" },
    { condition: { kind: "gold", op: "<", amount: -1 }, code: "condition.gold.impossible", advancedField: "gold-amount" },
    { condition: { kind: "difficulty", difficultyId: "" }, code: "reference.difficulty.missing", advancedField: "difficulty" },
    { condition: { kind: "itemUsed", itemId: "" }, code: "reference.item.missing", advancedField: "item-used" },
    { condition: { kind: "all", conditions: [] }, code: "condition.all.empty", advancedField: "group-kind" },
    { condition: { kind: "any", conditions: [] }, code: "condition.any.empty", advancedField: "group-kind" },
    { condition: { kind: "run", query: "flag", flag: "", value: true }, code: "condition.run.flag-empty", advancedField: "run" },
  ];
  describe("page condition validation targets", () => {
    it.each(cases)("resolves both repeated and nested $condition.kind fields through rendered controls", ({ condition, code, simpleId, advancedField }) => {
      // Given: duplicate leaves plus the same kind under NOT/ANY. Form IDs for run are deliberately repeated.
      const project = createBlankProject();
      const page: EventPage = { id: "targets", name: "targets", graphic: {}, trigger: { kind: "action" }, priority: "below",
        movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "target" }],
        conditions: [structuredClone(condition), structuredClone(condition), { kind: "not", condition: { kind: "any", conditions: [structuredClone(condition)] } }] };
      const event = { id: "targets", x: 1, y: 1, trigger: { kind: "action" as const }, commands: [], pages: [page] };
      store.replaceProject(project);
      const root = document.createElement("div");
      root.append(...renderPageConditions(project.startMapId, event.id, page));
      document.body.append(root);
      const custom = installEventEditorCustomSelects(root);
      custom.refresh();
      try {
        // When: the real validator creates navigation locators for this rendered page.
        const issues = validateEventDraftBody(project, project.startMapId, event).issues.filter(issue => issue.code === code);
        expect(issues).toHaveLength(3);
        const suffixes = simpleId ? [undefined, "0", "1-0-0"] : ["0", "1", "2-0-0"];
        // Then: each locator resolves the exact independent field, and focus uses its visible custom control.
        const focused = new Set<Element>();
        issues.forEach((issue, index) => {
          const suffix = suffixes[index];
          const expectedId = suffix === undefined ? simpleId : advancedField === "run"
            ? "event-condition-run-flag" : `event-page-advanced-condition-${advancedField}-${suffix}`;
          expect(issue.field?.testId).toBe(expectedId);
          const scope = advancedField === "run" ? root.querySelector(`[data-testid="event-page-advanced-condition-row-${suffix}"]`) : root;
          const input = scope?.querySelector<HTMLElement>(`[data-testid="${expectedId}"]`);
          expect(input).not.toBeNull();
          const target = scope?.querySelector(`[data-custom-select-for="${expectedId}"]`)
            ?? (input?.matches("select.event-record-modal-select") ? input.parentElement?.querySelector(".event-record-picker-trigger") : input);
          navigateToEventDraftIssue(issue);
          expect(document.activeElement).toBe(target);
          expect(target?.closest("details:not([open])")).toBeNull();
          if (document.activeElement) focused.add(document.activeElement);
        });
        expect(focused.size).toBe(3);
      } finally { custom.dispose(); }
    });
  });
});

// test/scriptLines.test.ts — a script command reads like event lines in the event list
// (src/editor/panels/eventEditor/scriptLines.ts): exact command lines when the script converts, one plain line per
// statement (「조건 분기」 · 「계산: …」) when it does not.
describe("scriptLines", () => {
  isolateTimers();
  beforeAll(async () => {
    await prepareScriptCompiler();
  }, 60_000);
  function project(): Project {
    const p = createBlankProject();
    p.switches.push({ id: "sw_gate", name: "창고 문 열림" } as Project["switches"][number]);
    p.variables.push({ id: "var_rep", name: "평판" } as Project["variables"][number]);
    p.variables.push({ id: "var_price", name: "포션 값" } as Project["variables"][number]);
    return p;
  }
  const text = (nodes: readonly HTMLElement[]): string[] => nodes.map((node) => (node.textContent ?? "").replace(/\s+/gu, " ").trim());
  describe("scriptLineNodes", () => {
    it("shows the converted commands' own lines when the script converts exactly", () => {
      const lines = text(scriptLineNodes({ source: 'if (game.getSwitch("sw_gate")) {\n  await game.showMessage("열렸다.");\n}' }, project()));
      expect(lines.length).toBeGreaterThanOrEqual(3);
      // names come from the open project (store); this test project is not loaded there, so the id shows
      expect(lines.some((line) => line.includes("조건 분기") && (line.includes("창고 문 열림") || line.includes("sw_gate")))).toBe(true);
      expect(lines.some((line) => line.includes("열렸다."))).toBe(true);
    });

    it("falls back to one plain line per statement: named values, conditions as sentences", () => {
      const source = [
        "const BASE = 100;",
        'const price = Math.floor(BASE * (1 - game.getVar("var_rep") / 200));',
        'game.setVar("var_price", price);',
        'if (game.getVar("var_rep") >= 10) await game.showMessage("단골이네!");',
      ].join("\n");
      const lines = text(scriptLineNodes({ source }, project()));
      expect(lines.some((line) => line.includes("가격 정하기 — 내림(100 × (1 − 평판 ÷ 200))"))).toBe(true);
      expect(lines.some((line) => line.includes("평판이 10 이상이면"))).toBe(true);
      expect(lines.some((line) => line.includes("단골이네!"))).toBe(true);
    });

    it("keeps else-if flat, says 그러면/아니면, folds three code lines and renders headings and «» chips", () => {
      const source = [
        "// 확인",
        'if (game.getSwitch("sw_gate")) {',
        '  await game.showMessage("열려 있다.");',
        '} else if (game.getVar("var_rep") > 5) {',
        "  const qa = game.random(3);",
        "  const qb = qa * 2;",
        "  const qc = qb + qa;",
        '  game.setVar("var_price", qc);',
        "} else {",
        "  const price = 10;",
        "  await game.showMessage(`${price + game.getVar(\"var_rep\")}골드.`);",
        "}",
      ].join("\n");
      const nodes = scriptLineNodes({ source }, project());
      const lines = text(nodes);
      expect(lines[0]).toBe("확인");
      expect(nodes[0]?.dataset.testid).toBe("event-command-script-heading");
      expect(lines).toContain("스위치 「창고 문 열림」이 켜져 있으면");
      expect(lines).toContain("아니고 평판이 5보다 크면");
      expect(lines).toContain("아니면");
      expect(lines.some((line) => line.startsWith("계산 3줄"))).toBe(true);
      expect(nodes.some((node) => node.querySelector(".cmd-script-hole")?.textContent === "10 + 평판")).toBe(true);
      expect(lines.some((line) => line.includes("조건이 맞"))).toBe(false);
    });

    it("is empty for an empty script", () => {
      expect(scriptLineNodes({ source: "  " }, project())).toEqual([]);
    });
  });
});
