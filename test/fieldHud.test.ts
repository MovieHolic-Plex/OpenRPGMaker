import { describe, expect, it, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { FIELD_HUD_THEMES, HUD_BUDGET, HUD_LINE, HUD_PARTY_ROW, fieldHudWidgets, hudPreset, normalizeFieldHud, projectFieldHpChanges, resolvedHudWidgets, unusedHudGauges, projectHudUse, type FieldHudConfig, type HudWidget, HUD_FONTS } from "@/project/fieldHud";
import { hudAnchorPoint, FieldHud } from "@/player/fieldHud";
import { choosePromptPlacement, objectiveHome } from "@/player/objectivePlacement";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { activeTools, runTool } from "@/editor/tools";
import { startSession } from "@/project/session";
import { FakeElement, installFakeDom } from "./fakeDom";
import { validateFieldHud } from "@/project/io/shapeFieldHud";
import { isolateTimers } from "./mergedTeardown";

// 필드 HUD 예산 — 화면이 좁다(논리 320×240). 늘 떠 있는 것 ≤ 6%, 가운데 60%×60% 는 비운다, 조작 안내 ≤ 4%·아래 끝, 목표 줄 ≤ 45%×8%.
// 왜(2026-11-13 오너 «이거 보면 HUD 가 개판인거같은데 … 안그래도 화면이 좁은데»): 「새 목표」 카드가 화면 가운데 21%, 한 명 파티 판이 6%,
// 목표 창이 5%, 「Z 대화」 안내가 2.5% 였다. 테마 프리셋 자체가 컸다(농장 20%).
describe("fieldHudBudget", () => {
  isolateTimers();
  type Rect = { x: number; y: number; width: number; height: number; id: string };
  const DEFAULT_VIEW = { width: 320, height: 240 };
  /** 수집 테마는 에메랄드 룩의 것이다 — 그 룩의 화면(480×320, emeraldMonsterStyle.ts)에서 잰다. */
  const viewOf = (theme: string) => (theme === "collector" ? { width: 480, height: 320 } : DEFAULT_VIEW);
  const area = (r: Rect) => r.width * r.height;
  const overlaps = (a: Rect, b: { x: number; y: number; width: number; height: number }) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  const centreOf = (view: { width: number; height: number }) => {
    const edge = (1 - HUD_BUDGET.centre) / 2;
    return { x: view.width * edge, y: view.height * edge, width: view.width * HUD_BUDGET.centre, height: view.height * HUD_BUDGET.centre };
  };
  /** 평소에 늘 떠 있는 칸의 자리: 켜진 칸 가운데 조건이 «항상» 인 것. 슬롯은 찬 것으로, 동료 판은 네 명으로 센다. 상태 타이머는 걸린 것이 없으면 숨는다. */
  function persistentRects(widgets: readonly HudWidget[], view: { width: number; height: number }): Rect[] {
    return widgets.filter((w) => w.enabled && w.condition === "always" && w.kind !== "timers").map((w) => {
      const rows = 4;
      const height = w.kind === "party" ? Math.min(w.height, rows * HUD_PARTY_ROW.row + (rows - 1) * HUD_PARTY_ROW.gap + 2 * (HUD_PARTY_ROW.pad + HUD_PARTY_ROW.border)) : w.height;
      return { id: w.id, ...hudAnchorPoint(w, w.anchor, view, w.width, height), width: w.width, height };
    });
  }
  /** 목표 줄 한 줄(가장 넓을 때)의 자리 — 런타임과 같은 objectiveHome. */
  function objectiveRect(view: { width: number; height: number }, hud: readonly Rect[], lines = 1): Rect {
    const scale = view.height / 240;
    const box = { width: view.width * HUD_BUDGET.objectiveWidth, height: (lines * HUD_LINE.line + 2 * HUD_LINE.padY) * scale };
    const home = objectiveHome({ stage: view, box, margin: Math.round(4 * scale), hud: hud.filter((r) => !r.id.startsWith("tools")) });
    return { id: "objective", x: home.x, y: home.y, width: box.width, height: box.height };
  }
  const themes = (Object.keys(FIELD_HUD_THEMES) as FieldHudConfig["theme"][]).filter((t) => t !== "legacy");
  describe("필드 HUD 예산 — 테마 프리셋", () => {
    for (const theme of themes) {
      it(`${theme}: 늘 떠 있는 것 ≤ 6%, 가운데 60%×60% 는 비어 있다`, () => {
        const view = viewOf(theme);
        // 모든 칸을 켠 프리셋(체력이 필드에서 깎이는 게임) + 목표 줄 — 그 테마가 가장 많이 띄우는 평소 모습.
        const config = normalizeFieldHud({ theme, vitals: true, clock: true, tools: true, objective: true });
        const widgets = persistentRects(resolvedHudWidgets(config), view);
        const all = [...widgets, objectiveRect(view, widgets)];
        const share = all.reduce((sum, r) => sum + area(r), 0) / (view.width * view.height);
        expect(share, `${theme} ${all.map((r) => `${r.id} ${r.width}×${r.height}`).join(" · ")}`).toBeLessThanOrEqual(HUD_BUDGET.persistent);
        const centre = centreOf(view);
        expect(all.filter((r) => overlaps(r, centre)).map((r) => r.id), theme).toEqual([]);
        // 조건부 칸(다쳤을 때만 뜨는 막대 등)도 가운데에는 서지 않는다.
        const conditional = resolvedHudWidgets(config).filter((w) => w.condition !== "always").map((w) => ({ id: w.id, ...hudAnchorPoint(w, w.anchor, view, w.width, w.height), width: w.width, height: w.height }));
        expect(conditional.filter((r) => overlaps(r, centre)).map((r) => r.id), theme).toEqual([]);
      });
    }

    it("동료 판: 한 사람에 한 줄 — 네 명이 판 높이 안에 든다", () => {
      const party = hudPreset("party").find((w) => w.kind === "party")!;
      const four = 4 * HUD_PARTY_ROW.row + 3 * HUD_PARTY_ROW.gap + 2 * (HUD_PARTY_ROW.pad + HUD_PARTY_ROW.border);
      expect(HUD_PARTY_ROW.row).toBeLessThanOrEqual(9);
      expect(party.height).toBeGreaterThanOrEqual(four);
      expect(party.width * four / (DEFAULT_VIEW.width * DEFAULT_VIEW.height)).toBeLessThanOrEqual(0.035);
      // 목표 글이 두 줄로 감겨도(달력이 없어 시계가 숨은 게임) 네 명 판 + 목표 줄이 예산 안이다.
      const twoLines = DEFAULT_VIEW.width * HUD_BUDGET.objectiveWidth * (2 * HUD_LINE.line + 2 * HUD_LINE.padY);
      expect((party.width * four + twoLines) / (DEFAULT_VIEW.width * DEFAULT_VIEW.height)).toBeLessThanOrEqual(HUD_BUDGET.persistent);
    });
  });
  describe("필드 HUD 예산 — 목표 줄 · 조작 안내 · 알림 띠", () => {
    const css = readFileSync("src/styles/runtime/zoneFeedback.css", "utf8");
    // last: 같은 선택자가 묶음 규칙의 마지막 줄로도 나올 때(.zone-feedback-prompt) 그 선택자만의 규칙을 읽는다.
    const block = (selector: string, last = false): string => {
      const at = last ? css.lastIndexOf(`\n${selector} {`) : css.indexOf(`\n${selector} {`);
      expect(at, selector).toBeGreaterThanOrEqual(0);
      return css.slice(at, css.indexOf("\n}", at));
    };

    it("목표 줄: 폭 45% 까지, 두 줄까지만 — 두 줄일 때도 화면 높이의 8% 를 넘지 않는다", () => {
      const objective = block(".zone-feedback-objective");
      expect(objective).toContain(`max-width: ${HUD_BUDGET.objectiveWidth * 100}%`);
      expect(objective).toContain("-webkit-line-clamp: 2");
      const shared = block(".zone-feedback-banner,\n.zone-feedback-toast,\n.zone-feedback-objective,\n.zone-feedback-prompt");
      expect(shared).toContain(`font-size: calc(${HUD_LINE.font}px * var(--play-ui-scale, 1))`);
      expect(shared).toContain(`line-height: calc(${HUD_LINE.line}px * var(--play-ui-scale, 1))`);
      expect(shared).toContain(`padding: calc(${HUD_LINE.padY}px * var(--play-ui-scale, 1)) calc(${HUD_LINE.padX}px * var(--play-ui-scale, 1))`);
      expect(shared).toMatch(/border: 0;/u);
      const twoLines = 2 * HUD_LINE.line + 2 * HUD_LINE.padY;
      expect(twoLines / DEFAULT_VIEW.height).toBeLessThanOrEqual(HUD_BUDGET.objectiveHeight);
    });

    it("조작 안내: 한 줄, 가장 넓어도 화면의 4% 이하, 아래 끝에 선다", () => {
      const prompt = block(".zone-feedback-prompt", true);
      expect(prompt).toContain("white-space: nowrap");
      const box = { width: DEFAULT_VIEW.width * HUD_LINE.promptMaxWidth, height: HUD_LINE.line + 2 * HUD_LINE.padY };
      expect(block(".zone-feedback-banner,\n.zone-feedback-toast,\n.zone-feedback-objective,\n.zone-feedback-prompt")).toContain(`max-width: ${HUD_LINE.promptMaxWidth * 100}%`);
      expect(box.width * box.height / (DEFAULT_VIEW.width * DEFAULT_VIEW.height)).toBeLessThanOrEqual(HUD_BUDGET.prompt);
      // 주인공이 아래 가운데에 서 있어도 안내는 아래 끝 줄을 떠나지 않는다(왼쪽·오른쪽으로만 비킨다).
      const typical = { width: 84, height: box.height };
      for (const player of [null, { x: 152, y: 214, width: 16, height: 24 }, { x: 8, y: 214, width: 16, height: 24 }]) {
        const at = choosePromptPlacement({ stage: DEFAULT_VIEW, box: typical, margin: 4, player, actors: [], hud: [], map: null, current: null });
        expect(at.y + typical.height, JSON.stringify(player)).toBeGreaterThanOrEqual(DEFAULT_VIEW.height * 0.9);
        expect(overlaps({ id: "prompt", ...at, ...typical }, centreOf(DEFAULT_VIEW))).toBe(false);
      }
    });

    it("「새 목표」 알림은 위쪽 끝의 띠다 — 가운데 카드가 아니다", () => {
      const card = block(".objective-card");
      expect(card).toContain("top: calc(4px * var(--play-ui-scale, 1))");
      expect(card).toContain("right: calc(4px * var(--play-ui-scale, 1))");
      expect(card).not.toMatch(/top:\s*\d+%/u);
      expect(card).not.toContain("translate(-50%, -50%)");
      // 띠는 목표 글 전체를 보인다(구석의 목표 줄은 두 줄 뒤를 줄인다) — 「새 목표」 띠는 네 줄까지, 첫 조작 띠는 세 줄 + 조작 안내 한 줄.
      // 2026-11-16 확인 빌드 r6 P10: 두 줄·한 줄이던 띠가 51자 목표의 뒷부분(«먼저 역 앞 전단지 아주머니에게.»)을 목표 줄보다 먼저 끊었다.
      const lines = (rule: string) => Number(/-webkit-line-clamp: (\d+)/u.exec(rule)?.[1]);
      const changeLines = lines(block(".objective-card-text"));
      const introLines = lines(/\.objective-card\[data-kind="intro"\] \.objective-card-text \{[^}]*\}/u.exec(css)?.[0] ?? "");
      expect(changeLines).toBe(4);
      expect(introLines).toBe(3);
      // 잠깐 뜨는 띠라도 가운데 띠(세로 20%~80%)에는 닿지 않는다: 네 줄 글 + 여백 = 40px, 첫 띠는 세 줄 + 줄 사이 1px + 조작 안내 8px + 여백 = 40px.
      const strip = changeLines * 9 + 2 * 2;
      const intro = introLines * 9 + 1 + 8 + 2 * 2;
      expect((4 + Math.max(strip, intro)) / DEFAULT_VIEW.height).toBeLessThan((1 - HUD_BUDGET.centre) / 2);
      // 한 줄에 한글 27자(띠 폭 72% − 여백 10px − 이름표 「현재 목표」 30px, 글자 7px) — set_objective 가 받는 가장 긴 글(80자)이 첫 띠 세 줄에 든다.
      const perLine = Math.floor((DEFAULT_VIEW.width * 0.72 - 10 - 30) / 7);
      expect(card).toContain("max-width: 72%");
      expect(perLine * introLines).toBeGreaterThanOrEqual(80);
      // 지역 알림·체크포인트 알림도 위쪽 끝 띠 안에서 끝난다.
      const toastTop = Number(/top: calc\((\d+)px/u.exec(block(".zone-feedback-toast"))?.[1]);
      expect(toastTop + HUD_LINE.line + 2 * HUD_LINE.padY).toBeLessThan(DEFAULT_VIEW.height * (1 - HUD_BUDGET.centre) / 2);
    });
  });
  describe("필드에서 바뀔 수 없는 것은 필드에 올리지 않는다", () => {
    const withBattle = (): Project => {
      const p = createBlankProject() as Project;
      const map = p.maps[p.startMapId]!;
      map.events.push({ id: "ev_foe", name: "적", x: 3, y: 3, pages: [{ id: "p1", conditions: [], trigger: "action", commands: [{ kind: "battleProcessing", troopId: p.database.troops[0]?.id ?? "troop_1" }] }] } as never);
      return p;
    };
    const kinds = (widgets: readonly HudWidget[]) => widgets.map((w) => `${w.kind}:${w.source}`);

    it("턴제 전투만 있는 게임: 프리셋의 체력·마력 막대와 동료 체력 판은 필드에 없다(시계 같은 다른 칸은 그대로)", () => {
      const p = withBattle();
      expect(projectFieldHpChanges(p)).toBe(false);
      expect(kinds(fieldHudWidgets(p, normalizeFieldHud({ theme: "party" })))).toEqual(["clock:hp"]);
      expect(fieldHudWidgets(p, normalizeFieldHud({ theme: "adventure" })).filter((w) => w.kind === "gauge")).toEqual([]);
      expect(fieldHudWidgets(p, normalizeFieldHud({ theme: "minimal" })).some((w) => w.source === "hp" && w.kind === "gauge")).toBe(false);
      // 조수 쪽(도구 답·끝맺음)도 같은 칸을 «필드에서 안 바뀐다» 로 본다.
      expect(unusedHudGauges(normalizeFieldHud({ theme: "party" }), projectHudUse(p)).map((w) => w.kind)).toEqual(["party"]);
    });

    it("필드에서 체력이 깎이는 게임(피해 명령·실시간 액션 전투)은 그대로 띄운다", () => {
      const trap = withBattle();
      trap.maps[trap.startMapId]!.events.push({ id: "ev_trap", name: "가시 함정", x: 5, y: 5, pages: [{ id: "p1", conditions: [], trigger: "playerTouch", commands: [{ kind: "changeActorHp", op: "-=", amount: 10 }] }] } as never);
      expect(projectFieldHpChanges(trap)).toBe(true);
      expect(kinds(fieldHudWidgets(trap, normalizeFieldHud({ theme: "party" })))).toContain("party:hp");
      const action = withBattle();
      action.system.actionCombat = { ...(action.system.actionCombat ?? {}), enabled: true } as never;
      expect(fieldHudWidgets(action, normalizeFieldHud({ theme: "adventure" })).filter((w) => w.kind === "gauge").map((w) => w.source)).toContain("hp");
    });

    it("저자가 직접 짠 widgets 는 건드리지 않는다", () => {
      const p = withBattle();
      const own = normalizeFieldHud({ theme: "party", widgets: [{ id: "my-party", kind: "party", source: "hp", width: 90, height: 138 }] });
      expect(fieldHudWidgets(p, own).map((w) => `${w.id} ${w.width}×${w.height}`)).toEqual(["my-party 90×138"]);
    });
  });
});

// set_project_settings 가 fieldHud.font 를 버리던 결함(2026-10-30): 스키마에 칸이 없고 처리기가 읽지 않았다.
describe("fieldHudFontTool", () => {
  isolateTimers();
  describe("set_project_settings fieldHud.font", () => {
    it("스키마가 빈 문자열 없는 글꼴 enum 을 싣는다", () => {
      const tool = activeTools().find((entry) => entry.name === "set_project_settings")!;
      const font = (tool.parameters as { properties: { fieldHud: { properties: { font: { enum: string[] } } } } }).properties.fieldHud.properties.font;
      expect(font.enum).toEqual(Object.keys(HUD_FONTS));
      expect(font.enum).not.toContain("");
    });

    it("고른 글꼴을 저장하고, 모르는 글꼴은 거절한다", () => {
      const ctx = { project: createBlankProject() };
      expect(runTool(ctx, "set_project_settings", { fieldHud: { font: "round" } }).ok).toBe(true);
      expect(ctx.project.system.fieldHud?.font).toBe("round");
      expect(runTool(ctx, "set_project_settings", { fieldHud: { font: "comic" } }).ok).toBe(false);
      expect(ctx.project.system.fieldHud?.font).toBe("round");
    });
  });
});

describe("fieldHudFrame", () => {
  isolateTimers();
  const IDLE_FRAMES = 60;
  // The old update assigned left, top, width, maxWidth, and height on every frame.
  const STYLE_PROPS_PER_WIDGET = 5;
  function goldWidget(): HudWidget {
    return {
      id: "gold",
      kind: "text",
      source: "gold",
      label: "G",
      shape: "number",
      anchor: "bottom-center",
      x: 8,
      y: 8,
      width: 80,
      height: 24,
      color: "#e5c878",
      panel: "none",
      condition: "always",
      showValue: true,
      enabled: true,
      hideEmpty: false,
      autoAvoid: true,
      max: 100,
      slots: 1,
      itemIds: [],
    };
  }
  function countStyleWrites(node: FakeElement): { writes: number } {
    const box = { writes: 0 };
    const current = node.style as unknown as object;
    node.style = new Proxy(current, {
      set(target, key, value) {
        box.writes += 1;
        Reflect.set(target, key, value);
        return true;
      },
    }) as typeof node.style;
    return box;
  }
  function countDatasetWrites(node: FakeElement): { writes: number } {
    const box = { writes: 0 };
    node.dataset = new Proxy(node.dataset, {
      set(target, key, value) {
        box.writes += 1;
        Reflect.set(target, key, value);
        return true;
      },
      deleteProperty(target, key) {
        box.writes += 1;
        return Reflect.deleteProperty(target, key);
      },
    });
    return box;
  }
  function countHiddenWrites(node: FakeElement): { writes: number } {
    const box = { writes: 0, value: node.hidden };
    Object.defineProperty(node, "hidden", {
      configurable: true,
      get() { return box.value; },
      set(value: boolean) {
        box.writes += 1;
        box.value = value;
      },
    });
    return box;
  }
  describe("field HUD idle frames", () => {
    let restore: (() => void) | undefined;
    afterEach(() => restore?.());

    it("does not rewrite layout while the player stands still, and still moves when they do", () => {
      restore = installFakeDom();
      const project = createBlankProject();
      project.system.fieldHud = {
        theme: "minimal",
        vitals: false,
        clock: false,
        tools: false,
        objective: false,
        hideEmpty: false,
        widgets: [goldWidget()],
      };
      const session = startSession(project, 1);
      const host = new FakeElement("div");
      const hud = new FieldHud(host as unknown as HTMLElement);
      hud.update(project, session, { playerY: 10 });

      const root = hud.root as unknown as FakeElement;
      const widget = root.querySelector(".hud-widget") as FakeElement;
      expect(widget).toBeTruthy();
      expect(widget.style.top).toBe("208px");
      expect(widget.querySelector(".hud-text")?.textContent).toBe("0");

      const style = countStyleWrites(widget);
      const widgetData = countDatasetWrites(widget);
      const widgetHidden = countHiddenWrites(widget);
      const hostData = countDatasetWrites(host);
      const rootData = countDatasetWrites(root);
      const rootHidden = countHiddenWrites(root);

      for (let frame = 0; frame < IDLE_FRAMES; frame += 1) hud.update(project, session, { playerY: 10 });

      expect(style.writes).toBe(0);
      expect(widgetData.writes).toBe(0);
      expect(widgetHidden.writes).toBe(0);
      expect(hostData.writes).toBe(0);
      expect(rootData.writes).toBe(0);
      expect(rootHidden.writes).toBe(0);
      // 60 idle frames used to assign 5 style properties on this one widget.
      expect(IDLE_FRAMES * STYLE_PROPS_PER_WIDGET).toBe(300);

      session.gold = 25;
      hud.update(project, session, { playerY: 10 });
      expect(widget.querySelector(".hud-text")?.textContent).toBe("25");
      expect(style.writes).toBe(0);
      expect(widget.style.top).toBe("208px");

      hud.update(project, session, { playerY: 220 });
      expect(style.writes).toBe(STYLE_PROPS_PER_WIDGET);
      expect(widget.style.top).toBe("8px");
      expect(widget.dataset.avoiding).toBe("true");

      const moved = style.writes;
      hud.update(project, session, { playerY: 220 });
      expect(style.writes).toBe(moved);
    });

    it("sizes a party panel to the rows it shows, not to the authored box", () => {
      restore = installFakeDom();
      const project = createBlankProject();
      const party: HudWidget = { ...goldWidget(), id: "party", kind: "party", source: "hp", label: "동료", anchor: "top-left", x: 10, y: 10, width: 90, height: 138, autoAvoid: false, slots: 8, panel: "dark" };
      project.system.fieldHud = { theme: "party", vitals: true, clock: false, tools: false, objective: true, hideEmpty: true, widgets: [party] };
      const session = startSession(project, 1);
      const host = new FakeElement("div");
      const hud = new FieldHud(host as unknown as HTMLElement);
      hud.update(project, session, {});
      const widget = (hud.root as unknown as FakeElement).querySelector(".hud-widget") as FakeElement;
      // 가짜 DOM 은 크기를 모른다 — 못 잰 동안은 저작 높이다.
      expect(widget.style.height).toBe("138px");
      // 한 줄짜리 내용 높이(48px)를 잴 수 있게 되면 판은 그 높이가 된다. 저작 높이보다 커지지는 않는다.
      Object.defineProperty(widget, "offsetParent", { configurable: true, value: host });
      Object.defineProperty(widget, "offsetHeight", { configurable: true, value: 48 });
      hud.update(project, session, {});
      expect(widget.style.height).toBe("48px");
      Object.defineProperty(widget, "offsetHeight", { configurable: true, value: 400 });
      session.actorVitals[session.partyActorIds[0]!]!.hp -= 1;
      hud.update(project, session, {});
      expect(widget.style.height).toBe("138px");
    });

    it("keeps an auto-relocated strip off a fixed box outside the HUD (the objective box)", () => {
      restore = installFakeDom();
      const project = createBlankProject();
      project.system.fieldHud = { theme: "minimal", vitals: false, clock: false, tools: false, objective: true, hideEmpty: false, widgets: [{ ...goldWidget(), width: 218 }] };
      const session = startSession(project, 1);
      const host = new FakeElement("div");
      const hud = new FieldHud(host as unknown as HTMLElement);
      // 주인공이 아래쪽에 있어 띠가 위로 올라간다 — 오른쪽 위 목표 창(188..316)과 같은 띠다.
      hud.update(project, session, { playerY: 220, fixed: [{ x: 188, y: 4, width: 128, height: 30 }] });
      const widget = (hud.root as unknown as FakeElement).querySelector(".hud-widget") as FakeElement;
      expect(widget.dataset.avoiding).toBe("true");
      expect(parseFloat(widget.style.left) + parseFloat(widget.style.width)).toBeLessThanOrEqual(184);
    });
  });
});

// 프리셋 HUD 칸이 저장본에 실려도 다시 열린다 — 저장 모양 검사(shapeFieldHud)의 하한이 프리셋 칸보다 크면 게임이 열리지 않는다.
// 왜(2026-11-13 명세 은행 r1s-fun): 안 쓰는 게이지를 뺄 때 프리셋 칸이 widgets 로 저장되는데(시계 56×12), 검사는 높이 14 미만을 거절했다 — «project-reload-failed».
describe("fieldHudSavedShape", () => {
  isolateTimers();
  describe("필드 HUD 프리셋 칸은 저장 모양 검사를 지난다", () => {
    for (const theme of Object.keys(FIELD_HUD_THEMES) as (keyof typeof FIELD_HUD_THEMES)[]) {
      it(`${theme}: 프리셋 칸을 widgets 로 실어도 거절되지 않는다`, () => {
        const hud = normalizeFieldHud({ theme, vitals: true, clock: true, tools: true, objective: true, hideEmpty: true });
        expect(() => validateFieldHud({ ...hud, widgets: resolvedHudWidgets(hud) })).not.toThrow();
        expect(() => validateFieldHud({ ...hud, widgets: hudPreset(theme) })).not.toThrow();
      });
    }
  });
});
