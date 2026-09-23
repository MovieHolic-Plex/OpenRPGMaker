/** @vitest-environment happy-dom */
/**
 * 도구막대 되돌리기/다시실행 쌍과 간이 기록 메뉴.
 *
 * 배경(OPRN-OUT-021): 되돌리기는 단추가 있는데 다시실행은 Ctrl+Shift+Z / Ctrl+Y 로만 있었다.
 * 두 스택 모두 진작에 있었고 기록 창에도 단추가 있었지만, 감독이 편집 중 실제로 보는 컨트롤
 * (타일 도구막대)에서는 다시실행과 «무엇이 되돌아가는지» 를 알 길이 없었다. 새 히스토리
 * 체계를 만드는 게 아니라 있는 스택을 드러내는 문제다 — 그래서 이 시험은 도구막대와
 * 기록 창이 **같은 목록**을 본다는 것까지 잠근다.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import {
  getMapEditHistoryEntries,
  getMapEditRedoEntries,
  recordProjectSnapshot,
  resetMapEditHistory,
  truncateMapEditHistoryFromMarker,
  undoMapEdit,
} from "@/editor/mapEditHistory";
import { renderMapHistoryPanel } from "@/editor/panels/mapHistoryPanel";
import { makeTileToolbar } from "@/editor/panels/tileToolbar";
import { resetTileHistoryMenusForTests } from "@/editor/panels/tileHistoryMenu";
import { resetTileToolbarMenusForTests } from "@/editor/panels/tileToolbarMenus";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import * as modal from "@/editor/ui/modal";

const lintMock = vi.hoisted(() => ({ issues: [] as Array<{ code: string; message: string; severity: string }> }));
vi.mock("@/project/lint/projectLint", () => ({ projectLint: vi.fn(() => []) }));
vi.mock("@/project/lint/clusterRuleLint", () => ({ clusterRuleLintIssues: vi.fn(() => lintMock.issues) }));

let host: HTMLElement;
let confirmation: Promise<boolean> | null = null;

async function answerConfirmation(answer: "confirm" | "cancel"): Promise<void> {
  if (!confirmation) throw new Error("no pending confirmation");
  // Observe the real menu continuation, not an arbitrary number of microtasks.
  // Both spies call through: the actual modal buttons still resolve the decision.
  const continuation = vi.mocked(confirmation.then).mock.results[0];
  if (continuation?.type !== "return") throw new Error("no confirmation continuation");
  const button = document.querySelector<HTMLButtonElement>(`[data-testid="app-modal-${answer}"]`);
  if (!button) throw new Error(`missing modal ${answer}`);
  let timeout: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("confirmation continuation did not settle")), 2000);
  });
  try {
    button.click();
    await Promise.race([continuation.value, deadline]);
  } finally {
    clearTimeout(timeout!);
  }
}

function rerender(): void {
  const project = store.getCurrent();
  const map = project.maps[editorState.get().currentMapId ?? project.startMapId];
  if (!map) throw new Error("missing map");
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) throw new Error("missing tileset");
  host.replaceChildren(makeTileToolbar({ map, rerender, state: editorState.get(), tileset }));
}

function find(testid: string): HTMLElement | null {
  return host.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
}

function control(testid: string): HTMLButtonElement {
  const node = find(testid);
  if (!node) throw new Error(`missing control: ${testid}`);
  return node as HTMLButtonElement;
}

/** 라벨 붙은 편집 1회 — 스냅샷을 남기고 실제로 타일을 바꾼다. */
function edit(label: string, tile: number): void {
  const mapId = store.getCurrent().startMapId;
  recordProjectSnapshot(label, mapId, { kind: "map", mapId });
  store.update((project) => {
    project.maps[mapId].lowerTiles[0] = tile;
  });
}

function tile(): number {
  const project = store.getCurrent();
  return project.maps[project.startMapId].lowerTiles[0];
}

function rowLabels(dropdown: string): string[] {
  const menu = find(dropdown);
  if (!menu) throw new Error(`missing dropdown: ${dropdown}`);
  return Array.from(menu.querySelectorAll<HTMLElement>("[data-history-step]"), (row) => row.textContent ?? "");
}

beforeEach(() => {
  const showConfirm = modal.showConfirm;
  vi.spyOn(modal, "showConfirm").mockImplementation((options) => {
    confirmation = showConfirm(options);
    vi.spyOn(confirmation, "then");
    return confirmation;
  });
  resetTileToolbarMenusForTests();
  resetTileHistoryMenusForTests();
  resetEditorUiModeForTests("standard");
  lintMock.issues = [];
  const project = createBlankProject();
  store.replace(project);
  resetMapEditHistory();
  editorState.set({ currentMapId: project.startMapId, layer: "lower", paintShape: "pen", selection: null, tool: "paint" });
  host = document.createElement("div");
  host.dataset.testid = "left-palette-root";
  document.body.append(host);
  rerender();
});

afterEach(() => {
  vi.restoreAllMocks();
  confirmation = null;
  resetTileToolbarMenusForTests();
  resetTileHistoryMenusForTests();
  host.remove();
  document.body.replaceChildren();
});

describe("도구막대 되돌리기/다시실행", () => {
  it("되돌리기와 다시실행을 나란히 놓고 각자 펼쳐보기를 붙인다", () => {
    const scroll = host.querySelector<HTMLElement>(".oprn-tile-toolbar-scroll");
    expect(scroll).toBeTruthy();
    // 기존 도달성 계약(tileToolbarOverflowReach) — 되돌리기는 스크롤 컨테이너 안에 남는다.
    expect(scroll!.contains(control("oprn-tool-undo"))).toBe(true);
    expect(scroll!.contains(control("oprn-tool-redo"))).toBe(true);

    const order = Array.from(
      scroll!.querySelectorAll<HTMLElement>("[data-testid^='oprn-tool-undo'], [data-testid^='oprn-tool-redo']"),
      (node) => node.dataset.testid,
    );
    expect(order).toEqual([
      "oprn-tool-undo",
      "oprn-tool-undo-history",
      "oprn-tool-redo",
      "oprn-tool-redo-history",
    ]);
  });

  it("툴팁이 두 플랫폼의 단축키를 모두 적는다", () => {
    expect(control("oprn-tool-undo").title).toBe("되돌리기 (Ctrl+Z / ⌘Z)");
    expect(control("oprn-tool-redo").title).toBe("다시실행 (Ctrl+Shift+Z / ⌘⇧Z, Ctrl+Y)");
    expect(control("oprn-tool-undo-history").getAttribute("aria-label")).toContain("되돌리기 기록");
    expect(control("oprn-tool-redo-history").getAttribute("aria-label")).toContain("다시실행 기록");
  });

  it("각 단추는 자기 스택이 비었을 때만 꺼진다", () => {
    expect(control("oprn-tool-undo").disabled).toBe(true);
    expect(control("oprn-tool-redo").disabled).toBe(true);

    edit("첫 칠하기", 11);
    rerender();
    expect(control("oprn-tool-undo").disabled).toBe(false);
    expect(control("oprn-tool-redo").disabled).toBe(true);

    control("oprn-tool-undo").click();
    expect(control("oprn-tool-undo").disabled).toBe(true);
    expect(control("oprn-tool-redo").disabled).toBe(false);

    control("oprn-tool-redo").click();
    expect(control("oprn-tool-undo").disabled).toBe(false);
    expect(control("oprn-tool-redo").disabled).toBe(true);
  });

  it("빈 스택도 메뉴는 열리고 비었다고 말한다", () => {
    control("oprn-tool-undo-history").click();

    const menu = find("oprn-undo-history-dropdown");
    expect(menu).toBeTruthy();
    expect(menu!.textContent).toContain("되돌릴 작업이 없습니다");
    expect(rowLabels("oprn-undo-history-dropdown")).toEqual([]);
  });

  it("한 건짜리 스택은 깊이 표시 없이 항목 하나만 보여준다", () => {
    edit("첫 칠하기", 11);
    rerender();

    control("oprn-tool-undo-history").click();

    const labels = rowLabels("oprn-undo-history-dropdown");
    expect(labels).toHaveLength(1);
    expect(labels[0]).toContain("첫 칠하기");
    expect(labels[0]).not.toContain("단계");
    expect(find("history-undo-more")).toBeNull();
  });

  it("10건은 그대로, 10건을 넘으면 10건만 싣고 남은 수를 알린다", () => {
    for (let step = 1; step <= 10; step += 1) edit(`편집 ${step}`, step);
    rerender();
    control("oprn-tool-undo-history").click();
    expect(rowLabels("oprn-undo-history-dropdown")).toHaveLength(10);
    expect(find("history-undo-more")).toBeNull();

    control("oprn-tool-undo-history").click();
    for (let step = 11; step <= 13; step += 1) edit(`편집 ${step}`, step);
    rerender();
    control("oprn-tool-undo-history").click();

    const labels = rowLabels("oprn-undo-history-dropdown");
    expect(labels).toHaveLength(10);
    expect(labels[0]).toContain("편집 13");
    expect(find("history-undo-more")?.textContent).toContain("3건");
  });

  it("다시실행 메뉴는 가까운 것부터 예정된 작업을 싣는다", () => {
    edit("첫 칠하기", 11);
    edit("둘째 칠하기", 22);
    undoMapEdit();
    undoMapEdit();
    rerender();

    control("oprn-tool-redo-history").click();

    const labels = rowLabels("oprn-redo-history-dropdown");
    expect(labels).toHaveLength(2);
    expect(labels[0]).toContain("첫 칠하기");
    expect(labels[1]).toContain("둘째 칠하기");
    expect(labels[1]).toContain("2단계");
  });

  it("깊은 항목은 몇 단계인지 먼저 확인받고 정확히 그만큼 지나간다", async () => {
    const original = tile();
    edit("첫 칠하기", 11);
    edit("둘째 칠하기", 22);
    edit("셋째 칠하기", 33);
    rerender();
    control("oprn-tool-undo-history").click();

    control("history-undo-step-3").click();

    const confirmModal = document.body.querySelector('[data-testid="app-confirm-modal"]');
    expect(confirmModal).toBeTruthy();
    expect(confirmModal!.textContent).toContain("3단계");
    expect(tile()).toBe(33);

    await answerConfirmation("confirm");

    expect(tile()).toBe(original);
    expect(getMapEditHistoryEntries()).toEqual([]);
  });

  it("확인을 거절하면 아무것도 지나가지 않는다", async () => {
    edit("첫 칠하기", 11);
    edit("둘째 칠하기", 22);
    rerender();
    control("oprn-tool-undo-history").click();

    control("history-undo-step-2").click();
    await answerConfirmation("cancel");

    expect(tile()).toBe(22);
    expect(getMapEditHistoryEntries()).toHaveLength(2);
  });

  it.each(["new edit", "snapshot only", "truncate", "reset and repopulate"])("rejects undo confirmation after %s", async (mutation) => {
    edit("first", 11);
    edit("second", 22);
    edit("third", 33);
    rerender();
    control("oprn-tool-undo-history").click();
    control("history-undo-step-3").click();

    const mapId = store.getCurrent().startMapId;
    if (mutation === "new edit") edit("new edit", 44);
    else if (mutation === "snapshot only") recordProjectSnapshot("new snapshot");
    else if (mutation === "truncate") truncateMapEditHistoryFromMarker(2);
    else {
      // Same project object, stack depth and resettable entry sequence, but a
      // different stack lifetime. A marker/length-only check would accept it.
      resetMapEditHistory();
      recordProjectSnapshot("replacement project");
      recordProjectSnapshot("replacement map", mapId, { kind: "map", mapId });
      recordProjectSnapshot("replacement tilesets", mapId, { kind: "map", mapId, includeTilesets: true });
    }
    const project = store.getCurrent();
    const undo = getMapEditHistoryEntries();
    const redo = getMapEditRedoEntries();
    await answerConfirmation("confirm");

    expect(store.getCurrent()).toBe(project);
    expect(getMapEditHistoryEntries()).toEqual(undo);
    expect(getMapEditRedoEntries()).toEqual(redo);
    expect(find("oprn-undo-history-dropdown")).toBeNull();
  });

  it("rejects redo confirmation after another undo changes the promised depth", async () => {
    edit("first", 11);
    edit("second", 22);
    edit("third", 33);
    undoMapEdit();
    undoMapEdit();
    rerender();
    control("oprn-tool-redo-history").click();
    control("history-redo-step-2").click();
    undoMapEdit();
    const project = store.getCurrent();
    const undo = getMapEditHistoryEntries();
    const redo = getMapEditRedoEntries();
    await answerConfirmation("confirm");

    expect(store.getCurrent()).toBe(project);
    expect(getMapEditHistoryEntries()).toEqual(undo);
    expect(getMapEditRedoEntries()).toEqual(redo);
  });

  it.each(["undo", "redo"])("rejects %s confirmation after replacement with the same project identity", async (direction) => {
    edit("first", 11);
    edit("second", 22);
    if (direction === "redo") {
      undoMapEdit();
      undoMapEdit();
    }
    rerender();
    control(`oprn-tool-${direction}-history`).click();
    control(`history-${direction}-step-2`).click();
    const identity = store.getProjectIdentity();
    const replacement = structuredClone(store.getCurrent());
    replacement.maps[replacement.startMapId].lowerTiles[0] = 99;
    store.replace(replacement);
    expect(store.getProjectIdentity()).toEqual(identity);
    const project = store.getCurrent();
    const undo = getMapEditHistoryEntries();
    const redo = getMapEditRedoEntries();
    await answerConfirmation("confirm");

    expect(store.getCurrent()).toBe(project);
    expect(tile()).toBe(99);
    expect(getMapEditHistoryEntries()).toEqual(undo);
    expect(getMapEditRedoEntries()).toEqual(redo);
  });

  it.each(["outside pointer", "Escape"])("reopens on the first toggle click after %s dismissal", (dismissal) => {
    edit("first", 11);
    rerender();
    control("oprn-tool-undo-history").click();
    const toggle = control("oprn-tool-undo-history");
    if (dismissal === "outside pointer") {
      document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    } else {
      document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      expect(document.activeElement).toBe(toggle);
    }
    expect(find("oprn-undo-history-dropdown")).toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    toggle.click();
    expect(find("oprn-undo-history-dropdown")).not.toBeNull();
    expect(control("oprn-tool-undo-history").getAttribute("aria-expanded")).toBe("true");
  });

  it("한 걸음짜리 항목은 되묻지 않고 바로 지나간다", () => {
    edit("첫 칠하기", 11);
    edit("둘째 칠하기", 22);
    rerender();
    control("oprn-tool-undo-history").click();

    control("history-undo-step-1").click();

    expect(document.body.querySelector('[data-testid="app-confirm-modal"]')).toBeNull();
    expect(tile()).toBe(11);
    expect(find("oprn-undo-history-dropdown")).toBeNull();
  });

  it("다시실행 메뉴의 깊은 항목도 한 번의 결정으로 앞으로 간다", async () => {
    edit("첫 칠하기", 11);
    edit("둘째 칠하기", 22);
    edit("셋째 칠하기", 33);
    undoMapEdit();
    undoMapEdit();
    undoMapEdit();
    rerender();
    control("oprn-tool-redo-history").click();

    control("history-redo-step-3").click();
    const confirmModal = document.body.querySelector('[data-testid="app-confirm-modal"]');
    expect(confirmModal!.textContent).toContain("3단계");
    await answerConfirmation("confirm");

    expect(tile()).toBe(33);
    // 한 번의 결정이므로 되돌리기 한 번이면 원위치다.
    expect(getMapEditHistoryEntries()).toHaveLength(1);
  });

  it("새 편집은 다시실행 메뉴를 비운다", () => {
    edit("첫 칠하기", 11);
    edit("둘째 칠하기", 22);
    undoMapEdit();
    rerender();
    control("oprn-tool-redo-history").click();
    expect(rowLabels("oprn-redo-history-dropdown")).toHaveLength(1);
    control("oprn-tool-redo-history").click();

    edit("갈라진 편집", 99);
    rerender();
    control("oprn-tool-redo-history").click();

    expect(rowLabels("oprn-redo-history-dropdown")).toEqual([]);
    expect(find("oprn-redo-history-dropdown")!.textContent).toContain("다시 실행할 작업이 없습니다");
    expect(control("oprn-tool-redo").disabled).toBe(true);
  });

  it("간이 메뉴와 작업 기록 창은 같은 라벨·같은 순서를 본다", () => {
    edit("첫 칠하기", 11);
    edit("둘째 칠하기", 22);
    edit("셋째 칠하기", 33);
    rerender();
    control("oprn-tool-undo-history").click();

    const compact = Array.from(
      find("oprn-undo-history-dropdown")!.querySelectorAll<HTMLElement>("[data-history-step]"),
      (row) => row.dataset.historyLabel,
    );
    const panel = renderMapHistoryPanel();
    const full = Array.from(panel.querySelectorAll<HTMLElement>(".map-history-label"), (node) => node.textContent);

    expect(compact).toEqual(["셋째 칠하기", "둘째 칠하기", "첫 칠하기"]);
    expect(compact).toEqual(full);
  });

  it("두 메뉴는 동시에 열리지 않는다", () => {
    edit("첫 칠하기", 11);
    undoMapEdit();
    rerender();

    control("oprn-tool-undo-history").click();
    expect(find("oprn-undo-history-dropdown")).toBeTruthy();

    control("oprn-tool-redo-history").click();
    expect(find("oprn-undo-history-dropdown")).toBeNull();
    expect(find("oprn-redo-history-dropdown")).toBeTruthy();
    expect(control("oprn-tool-undo-history").getAttribute("aria-expanded")).toBe("false");
    expect(control("oprn-tool-redo-history").getAttribute("aria-expanded")).toBe("true");
  });

  it("이벤트 레이어에서도 두 컨트롤이 남는다", () => {
    editorState.set({ layer: "event", tool: "event" });
    rerender();

    expect(find("oprn-tool-undo")).toBeTruthy();
    expect(find("oprn-tool-redo")).toBeTruthy();
    expect(find("tool-paint")).toBeNull();
  });
});

/**
 * 펼쳐보기 폭 규칙의 **실제 승자**를 판정한다.
 *
 * 맵 캔버스가 WebGL 이라 픽셀을 JS 로 읽을 수 없고, 이 규칙은 캐스케이드로만 이기거나 진다.
 * 그래서 시트를 @import 순서대로 펼쳐 «이 요소에 걸리는» 규칙만 골라 승자를 계산한다.
 * 선택자가 걸리는지는 손으로 짜지 않고 DOM 의 matches() 에 맡긴다 — 직접 짜면
 * `.oprn-toolbar-menu > .oprn-tile-tool`(내 쌍은 그 안에 없다) 같은 걸 경쟁자로 오해한다.
 *
 * 실제로 밟은 함정: 처음엔 폭 규칙을 시트 앞쪽(도구막대 3절)에 뒀는데, 같은 시트 뒤쪽의
 * 마지막 세대 `.oprn-tile-tool { width: var(--space-6) }` 가 **같은 명시도(0,4,0)** 로 앉아
 * 있어서 순서에서 졌다. 규칙의 위치가 규칙의 일부다.
 */
describe("펼쳐보기 폭 규칙의 캐스케이드 승자", () => {
  const STYLES_ROOT = resolve(__dirname, "..", "src", "styles");

  type Declaration = { readonly source: string; readonly selector: string; readonly value: string; readonly weight: number; readonly order: number };

  /** @import 를 재귀로 펼친다. CSS 는 @import 가 자기 규칙보다 앞이므로 자식을 먼저 싣는다. */
  function flattenSheets(entry: string, out: { file: string; css: string }[] = []): { file: string; css: string }[] {
    const css = readFileSync(entry, "utf8");
    for (const match of css.matchAll(/@import\s+"([^"]+)"/g)) {
      flattenSheets(resolve(entry, "..", match[1]!), out);
    }
    out.push({ file: entry, css });
    return out;
  }

  /** 이 시트들엔 id 선택자가 없으므로 클래스·속성 선택자 개수가 곧 명시도 순위다. */
  function weight(selector: string): number {
    return (selector.match(/\.[a-zA-Z][\w-]*|\[[^\]]+\]/g) ?? []).length;
  }

  function widthDeclarationsFor(element: Element): Declaration[] {
    const found: Declaration[] = [];
    let order = 0;
    for (const sheet of flattenSheets(join(STYLES_ROOT, "index.css"))) {
      const css = sheet.css.replace(/\/\*[\s\S]*?\*\//g, "");
      for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const body = rule[2]!;
        const declaration = /(?:^|[;\s])width\s*:([^;]+)/.exec(body);
        if (!declaration) continue;
        for (const selector of rule[1]!.split(",").map((part) => part.trim())) {
          order += 1;
          if (!selector || selector.startsWith("@") || selector.includes("%")) continue;
          let matched = false;
          try {
            matched = element.matches(selector);
          } catch {
            matched = false;
          }
          if (!matched) continue;
          const value = declaration[1]!.trim();
          // !important 는 명시도를 건너뛴다 — studio-theme 세대가 이 방식으로 수정을 무효화한 적이 있다.
          found.push({
            source: sheet.file.slice(STYLES_ROOT.length + 1),
            selector,
            value,
            weight: value.includes("!important") ? weight(selector) + 1000 : weight(selector),
            order,
          });
        }
      }
    }
    return found;
  }

  it("좌패널 안에서 펼쳐보기 폭은 15px 규칙이 이긴다", async () => {
    const { makeTileHistoryControls } = await import("@/editor/panels/tileHistoryMenu");
    const layout = document.createElement("div");
    layout.className = "editor-layout";
    const stack = document.createElement("div");
    stack.className = "left-panel-stack";
    stack.dataset.testid = "left-palette-root";
    layout.append(stack);
    document.body.append(layout);
    stack.append(makeTileHistoryControls(() => {}));
    const toggle = stack.querySelector('[data-testid="oprn-tool-undo-history"]');
    if (!toggle) throw new Error("펼쳐보기 단추가 없다");

    const declarations = widthDeclarationsFor(toggle);
    expect(declarations.length, "폭을 정하는 규칙이 하나도 걸리지 않았다 — 선택자가 바뀌었다").toBeGreaterThan(1);
    const winner = declarations.reduce((best, next) =>
      next.weight > best.weight || (next.weight === best.weight && next.order > best.order) ? next : best);

    expect(
      { value: winner.value, selector: winner.selector },
      `승자가 뒤집혔다 — 걸린 규칙: ${declarations.map((entry) => `${entry.source} ${entry.selector} → ${entry.value}`).join(" | ")}`,
    ).toEqual({
      value: "15px",
      selector: '.left-panel-stack[data-testid="left-palette-root"] .oprn-tile-tool.oprn-tile-history-toggle',
    });
  });

  it("행위 단추는 도구와 같은 정사각형을 유지한다", async () => {
    const { makeTileHistoryControls } = await import("@/editor/panels/tileHistoryMenu");
    const layout = document.createElement("div");
    layout.className = "editor-layout";
    const stack = document.createElement("div");
    stack.className = "left-panel-stack";
    stack.dataset.testid = "left-palette-root";
    layout.append(stack);
    document.body.append(layout);
    stack.append(makeTileHistoryControls(() => {}));
    const action = stack.querySelector('[data-testid="oprn-tool-undo"]');
    if (!action) throw new Error("되돌리기 단추가 없다");

    const declarations = widthDeclarationsFor(action);
    const winner = declarations.reduce((best, next) =>
      next.weight > best.weight || (next.weight === best.weight && next.order > best.order) ? next : best);

    expect(winner.value).toBe("26px");
    expect(winner.selector).not.toContain("history");
  });
});
