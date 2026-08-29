// @vitest-environment jsdom
//
// 편집 행위 로그 조회 창 계약.
//
// 이 저장소의 패널 테스트는 보통 `test/fakeDom.ts` 를 쓰지만 여기서는 JSDOM 을 쓴다:
// 이 창의 핵심 계약이 **`hidden` 프로퍼티로 접는 fold** 와 **DOM 에서 떨어졌을 때의 구독 해제**
// 인데, 둘 다 `isConnected` 와 진짜 노드 트리가 있어야 의미 있게 단정할 수 있다.
// (`<details>` 를 쓰지 않는 이유 = Chromium `::details-content` 함정. 그 계약도 아래에서 지킨다.)
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import {
  _resetEditActivityForTest,
  recordEditActivity,
  type EditActivityInput,
} from "@/editor/editActivityLog";
import { MAP_EDIT_HISTORY_EVENT } from "@/editor/mapEditHistory";
import {
  editActivityPanelSubscriptionCount,
  renderEditActivityPanel,
} from "@/editor/panels/editActivityPanel";
import { renderMapHistoryPanel } from "@/editor/panels/mapHistoryPanel";

const repoRoot = resolve(__dirname, "..");

let generation = 0;

function record(input: Partial<EditActivityInput> & Pick<EditActivityInput, "scope">): void {
  generation += 1;
  recordEditActivity({ generation, ...input });
}

function mount(): HTMLElement {
  const panel = renderEditActivityPanel();
  document.body.append(panel);
  return panel;
}

function byTestId(root: ParentNode, testid: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
}

function rowTexts(root: ParentNode): string[] {
  return [...root.querySelectorAll('[data-testid^="edit-activity-row-"]')].map(
    (row) => row.textContent ?? ""
  );
}

beforeEach(() => {
  _resetEditActivityForTest();
  localStorage.clear();
  generation = 0;
  document.body.replaceChildren();
  editorState.set({ currentMapId: "map_town" });
});

afterEach(() => {
  document.body.replaceChildren();
  _resetEditActivityForTest();
  vi.restoreAllMocks();
});

describe("편집 행위 기록 창", () => {
  it("시각·요약·origin 배지를 한 행으로 렌더한다", () => {
    record({ scope: "map", label: "타일 편집", mapId: "map_town", cellCount: 12 });
    record({ scope: "database", label: "AI: 몬스터 추가", origin: "ai", collection: "enemies" });

    const panel = mount();
    const rows = rowTexts(panel);

    expect(rows).toHaveLength(2);
    // 최신순 — 나중에 기록한 것이 위다.
    expect(rows[0]).toContain("AI: 몬스터 추가");
    expect(rows[0]).toContain("AI");
    expect(rows[1]).toContain("타일 편집");
    expect(rows[1]).toContain("12셀");
    expect(rows[1]).toContain("사람");
    expect(panel.querySelector(".edit-activity-time")?.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/u);
    expect(byTestId(panel, "edit-activity-summary")?.textContent).toBe("기록 2건");
  });

  it("범위 셀렉트로 좁힌다", () => {
    record({ scope: "map", label: "타일 편집", mapId: "map_town" });
    record({ scope: "database", label: "아이템 편집" });

    const panel = mount();
    const scope = byTestId(panel, "edit-activity-scope") as HTMLSelectElement;
    scope.value = "database";
    scope.dispatchEvent(new Event("change"));

    const rows = rowTexts(panel);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("아이템 편집");
    expect(byTestId(panel, "edit-activity-summary")?.textContent).toBe("2건 중 1건");
  });

  it("'이 맵만' 토글은 현재 맵의 기록만 남긴다", () => {
    record({ scope: "map", label: "이 맵 편집", mapId: "map_town" });
    record({ scope: "map", label: "다른 맵 편집", mapId: "map_cave" });

    const panel = mount();
    const mapOnly = byTestId(panel, "edit-activity-map-only") as HTMLInputElement;
    expect(mapOnly.disabled).toBe(false);
    mapOnly.checked = true;
    mapOnly.dispatchEvent(new Event("change"));

    const rows = rowTexts(panel);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("이 맵 편집");
  });

  it("텍스트 검색은 라벨과 필드 경로를 모두 본다", () => {
    record({ scope: "map", label: "타일 편집", mapId: "map_town" });
    record({
      scope: "map",
      label: "이벤트 편집: 촌장",
      mapId: "map_town",
      eventId: "ev_elder",
      fields: [{ path: "pages[0].name", before: "촌장", after: "이장" }],
    });

    const panel = mount();
    const search = byTestId(panel, "edit-activity-search") as HTMLInputElement;

    search.value = "촌장";
    search.dispatchEvent(new Event("input"));
    expect(rowTexts(panel)).toHaveLength(1);
    expect(rowTexts(panel)[0]).toContain("이벤트 편집: 촌장");

    // 필드 경로만으로도 걸린다 — 라벨에는 pages 라는 글자가 없다.
    search.value = "pages[0]";
    search.dispatchEvent(new Event("input"));
    expect(rowTexts(panel)).toHaveLength(1);

    search.value = "타일";
    search.dispatchEvent(new Event("input"));
    expect(rowTexts(panel)[0]).toContain("타일 편집");
  });

  it("필드 펼침은 details 없이 hidden 토글로 동작하고 before → after 를 보여 준다", () => {
    record({
      scope: "map",
      label: "이벤트 편집: 촌장",
      mapId: "map_town",
      fields: [
        { path: "pages[0].name", before: "촌장", after: "이장" },
        { path: "pages[0].trigger", after: "action" },
      ],
    });

    const panel = mount();
    // `<details>` 는 Chromium `::details-content` 함정 때문에 금지다.
    expect(panel.querySelectorAll("details")).toHaveLength(0);

    const toggle = byTestId(panel, "edit-activity-fields-toggle-0") as HTMLButtonElement;
    const body = byTestId(panel, "edit-activity-fields-0") as HTMLElement;
    expect(toggle.textContent).toBe("필드 2개 보기");
    expect(body.hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    toggle.click();

    expect(body.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toBe("필드 2개 접기");
    const first = body.querySelector(".edit-activity-field")?.textContent ?? "";
    expect(first).toContain("pages[0].name");
    expect(first).toContain("촌장");
    expect(first).toContain("→");
    expect(first).toContain("이장");
    // before 가 없는 필드는 "(없음)" 으로 읽힌다 — 빈칸이면 값이 지워진 것과 구분이 안 된다.
    expect(body.textContent).toContain("(없음)");

    toggle.click();
    expect(body.hidden).toBe(true);
  });

  it("빈 상태는 '기록이 없다' 와 '필터에 안 걸린다' 를 갈라 말한다", () => {
    const empty = mount();
    expect(byTestId(empty, "edit-activity-empty")?.textContent).toContain("아직 기록된 편집 행위가 없습니다");

    document.body.replaceChildren();
    record({ scope: "map", label: "타일 편집", mapId: "map_town" });
    const filtered = mount();
    const search = byTestId(filtered, "edit-activity-search") as HTMLInputElement;
    search.value = "존재하지 않는 라벨";
    search.dispatchEvent(new Event("input"));

    const message = byTestId(filtered, "edit-activity-empty")?.textContent ?? "";
    expect(message).toContain("필터에 걸리는 기록이 없습니다");
    expect(message).toContain("전체 1건");
  });

  it("새 기록이 들어오면 EDIT_ACTIVITY_EVENT 로 갱신된다", () => {
    const panel = mount();
    expect(rowTexts(panel)).toHaveLength(0);

    record({ scope: "map", label: "새 타일 편집", mapId: "map_town" });

    expect(rowTexts(panel)).toHaveLength(1);
    expect(rowTexts(panel)[0]).toContain("새 타일 편집");
  });

  it("창이 DOM 에서 떨어지면 구독을 해제한다", () => {
    const before = editActivityPanelSubscriptionCount();
    const panel = mount();
    expect(editActivityPanelSubscriptionCount()).toBe(before + 1);

    // 첫 이벤트는 앞선 테스트가 남긴 창들의 해제까지 같이 흘려보낸다(구독 수는 모듈 전역이다).
    // 그 창들은 이 테스트 내내 계속 떨어진 상태이므로 여기서 한 번 정리되면 다시 줄지 않는다.
    record({ scope: "map", label: "붙어 있는 동안", mapId: "map_town" });
    const settled = editActivityPanelSubscriptionCount();
    expect(rowTexts(panel)).toHaveLength(1);

    panel.remove();
    record({ scope: "map", label: "떨어진 뒤", mapId: "map_town" });

    expect(editActivityPanelSubscriptionCount()).toBe(settled - 1);
    // 해제된 뒤에는 더 이상 갱신하지 않는다 — 떨어질 때 보던 1건에서 멈춘다.
    expect(rowTexts(panel)).toHaveLength(1);
  });

  it("복사 버튼이 보이는 기록을 JSON 으로 클립보드에 넣는다", async () => {
    record({ scope: "map", label: "복사 대상", mapId: "map_town" });
    // 인자 타입을 명시한다 — 인자 없는 `vi.fn(async () => {})` 은 args 를 `[]` 로 좁혀
    // `mock.calls[0][0]` 이 타입 오류가 된다(우리가 확인할 게 바로 그 인자다).
    const writeText = vi.fn(async (_text: string) => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    const panel = mount();
    byTestId(panel, "edit-activity-copy")?.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));

    const payload = JSON.parse(writeText.mock.calls[0]![0]) as readonly { label: string }[];
    expect(payload[0]!.label).toBe("복사 대상");
  });

  it("내보내기 버튼이 JSON blob 다운로드를 트리거한다", () => {
    record({ scope: "map", label: "내보낼 기록", mapId: "map_town" });
    const createObjectURL = vi.fn((_blob: Blob) => "blob:edit-activity");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const panel = mount();
    byTestId(panel, "edit-activity-export")?.click();

    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0]![0]).toBeInstanceOf(Blob);
  });
});

describe("작업 기록 창의 두 탭", () => {
  it("기존 testid 를 유지하고 기본 탭은 되돌리기다", () => {
    const panel = renderMapHistoryPanel();
    document.body.append(panel);

    // e2e/기존 계약이 붙어 있는 testid — 탭을 붙였다고 사라지면 안 된다.
    expect(panel.dataset.testid).toBe("map-history-panel");
    expect(byTestId(panel, "history-undo")).toBeTruthy();
    expect(byTestId(panel, "history-redo")).toBeTruthy();

    const undoPane = byTestId(panel, "map-history-pane-undo") as HTMLElement;
    const activityPane = byTestId(panel, "map-history-pane-activity") as HTMLElement;
    expect(undoPane.hidden).toBe(false);
    expect(activityPane.hidden).toBe(true);
    expect(byTestId(panel, "map-history-tab-undo")?.getAttribute("aria-selected")).toBe("true");
    // 행위 기록 창은 탭을 누르기 전까지 만들지 않는다.
    expect(byTestId(panel, "edit-activity-panel")).toBeNull();
  });

  it("행위 기록 탭을 누르면 행위 로그 창이 열린다", () => {
    record({ scope: "map", label: "탭에서 보이는 기록", mapId: "map_town" });
    const panel = renderMapHistoryPanel();
    document.body.append(panel);

    expect(byTestId(panel, "map-history-tab-activity")?.textContent).toBe("행위 기록 (1)");
    byTestId(panel, "map-history-tab-activity")?.click();

    expect((byTestId(panel, "map-history-pane-undo") as HTMLElement).hidden).toBe(true);
    expect((byTestId(panel, "map-history-pane-activity") as HTMLElement).hidden).toBe(false);
    expect(byTestId(panel, "edit-activity-panel")).toBeTruthy();
    expect(rowTexts(panel)[0]).toContain("탭에서 보이는 기록");

    // 되돌리기로 다시 돌아온다.
    byTestId(panel, "map-history-tab-undo")?.click();
    expect((byTestId(panel, "map-history-pane-activity") as HTMLElement).hidden).toBe(true);
    expect(byTestId(panel, "map-history-tab-undo")?.getAttribute("aria-selected")).toBe("true");
  });

  it("되돌리기 창이 갱신돼도 선택한 탭과 검색어가 유지된다", () => {
    record({ scope: "map", label: "유지되는 기록", mapId: "map_town" });
    const panel = renderMapHistoryPanel();
    document.body.append(panel);
    byTestId(panel, "map-history-tab-activity")?.click();
    const search = byTestId(panel, "edit-activity-search") as HTMLInputElement;
    search.value = "유지";
    search.dispatchEvent(new Event("input"));

    window.dispatchEvent(new Event(MAP_EDIT_HISTORY_EVENT));

    expect((byTestId(panel, "map-history-pane-activity") as HTMLElement).hidden).toBe(false);
    expect((byTestId(panel, "edit-activity-search") as HTMLInputElement).value).toBe("유지");
    expect(byTestId(panel, "history-undo")).toBeTruthy();
  });
});

describe("행위 기록 CSS 계약", () => {
  const css = readFileSync(join(repoRoot, "src/styles/editor/map-history.css"), "utf8");

  it("hidden 접기가 author display 선언에 밀리지 않는 특이도로 선언돼 있다", () => {
    // `.edit-activity-fields { display: grid }` 는 (0,1,0) 이므로 속성 선택자를 덧댄
    // (0,2,0) 이상이어야 접힌다. 실측 사고: 같은 함정으로 상점 fold 가 안 접혔다.
    expect(css).toMatch(/\.edit-activity\s+\.edit-activity-fields\[hidden\]\s*\{\s*display:\s*none/u);
    expect(css).toMatch(/\.map-history-panel\s+\.map-history-pane\[hidden\]\s*\{\s*display:\s*none/u);
  });

  it("!important 없이 특이도로만 이긴다 (CSS 예산 게이트 지표)", () => {
    // 주석은 규칙이 아니다 — check-css-budget.mjs 도 같은 이유로 주석을 먼저 걷어낸다.
    // (이 파일의 주석은 "!important 를 쓰지 않는 이유" 를 설명하느라 그 단어를 담고 있다.)
    expect(css.replace(/\/\*[\s\S]*?\*\//gu, " ")).not.toMatch(/!\s*important/u);
  });
});
