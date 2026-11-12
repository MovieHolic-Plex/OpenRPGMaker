// 필드 HUD 예산 — 화면이 좁다(논리 320×240). 늘 떠 있는 것 ≤ 6%, 가운데 60%×60% 는 비운다, 조작 안내 ≤ 4%·아래 끝, 목표 줄 ≤ 45%×8%.
// 왜(2026-11-13 오너 «이거 보면 HUD 가 개판인거같은데 … 안그래도 화면이 좁은데»): 「새 목표」 카드가 화면 가운데 21%, 한 명 파티 판이 6%,
// 목표 창이 5%, 「Z 대화」 안내가 2.5% 였다. 테마 프리셋 자체가 컸다(농장 20%).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FIELD_HUD_THEMES, HUD_BUDGET, HUD_LINE, HUD_PARTY_ROW, fieldHudWidgets, hudPreset, normalizeFieldHud, projectFieldHpChanges, resolvedHudWidgets, unusedHudGauges, projectHudUse,
  type FieldHudConfig, type HudWidget,
} from "@/project/fieldHud";
import { hudAnchorPoint } from "@/player/fieldHud";
import { choosePromptPlacement, objectiveHome } from "@/player/objectivePlacement";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

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
    expect(block(".objective-card-text")).toContain("-webkit-line-clamp: 2");
    // 두 줄 글 + 여백 = 22px — 화면 높이의 10% 를 넘지 않고, 가운데 띠(세로 20%~80%)에 닿지 않는다.
    const strip = 2 * 9 + 2 * 2;
    expect((4 + strip) / DEFAULT_VIEW.height).toBeLessThan((1 - HUD_BUDGET.centre) / 2);
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
