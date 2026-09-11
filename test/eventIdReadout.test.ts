// test/eventIdReadout.test.ts
//
// OPRN-OUT-014 — 선택한 이벤트의 정본 `event.id` 를 읽기 전용 속성으로 보여 준다.
//
// 왜 이 게이트가 필요한가: 이 값이 보이는 곳은 목록 호버 카드와 전역 검색 결과뿐이었다 —
// 둘 다 «값을 이미 알아야» 닿는 경로다. 그리고 예전 헤더의 `0007` 은 ID 가 아니라 맵
// events 배열 순번이었다(modal.ts 주석). 그래서 이 테스트는 두 가지를 동시에 못 박는다:
//   1) 화면에 뜨는 문자열이 **저장된 event.id 그 자체**여야 한다(순번·이름·characterId 유도 금지)
//   2) 그 표시를 만지는 것으로 프로젝트도 이벤트 드래프트도 더러워지지 않아야 한다
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { editorState } from "@/editor/editorState";
import { renderEventEditor } from "@/editor/panels/eventEditor";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { createBlankProject } from "@/project/defaults";
import { eventDraftDiff, eventDraftHasUserChanges } from "@/project/eventDrafts";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { store } from "@/project/store";
import { resetToastsForTest } from "@/util/toast";
import type { EventPage, GameEvent, MapId } from "@/project/types";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreFakeDom: () => void = () => undefined;

/** 실제 genId("ev") 출력 모양 — prefix + v4 UUID. 39자라 좁은 상자에서 레이아웃을 시험한다. */
const LONG_UUID_ID = "ev_3f1c9b2e-8a47-4d6b-9c05-7e2a1b4d8f30";

function fakeContainer(): HTMLElement {
  return new FakeElement("div") as unknown as HTMLElement;
}

function page(id = "page-1", name = "EV001"): EventPage {
  return {
    id,
    name,
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
}

function gameEvent(id: string, overrides: Partial<GameEvent> = {}): GameEvent {
  return {
    id,
    x: 7,
    y: 4,
    trigger: { kind: "action" },
    commands: [],
    pages: [page()],
    ...overrides,
  };
}

/** 맵에 이벤트를 심고 첫 번째를 선택한 상태로 만든다. */
function seed(events: readonly GameEvent[], selectedId = events[0]?.id ?? null): MapId {
  const project = createBlankProject();
  const mapId = project.startMapId;
  project.maps[mapId].events = events.map((event) => ({ ...event }));
  store.replaceProject(project);
  editorState.set({
    currentMapId: mapId,
    selectedEventId: selectedId,
    selectedEventPageId: events.find((event) => event.id === selectedId)?.pages?.[0]?.id ?? null,
  });
  return mapId;
}

function renderSidebar(): HTMLElement {
  const container = fakeContainer();
  renderEventEditor(container);
  return container;
}

function readout(root: HTMLElement, scope = "event-summary"): HTMLElement {
  const node = root.querySelector<HTMLElement>(`[data-testid="${scope}-event-id"]`);
  if (!node) throw new Error(`${scope}-event-id 를 찾지 못했다`);
  return node;
}

function valueInput(root: HTMLElement, scope = "event-summary"): HTMLInputElement {
  const node = root.querySelector<HTMLInputElement>(`[data-testid="${scope}-event-id-value"]`);
  if (!node) throw new Error(`${scope}-event-id-value 를 찾지 못했다`);
  return node;
}

describe("이벤트 ID 읽기 전용 표시 (OPRN-OUT-014)", () => {
  beforeEach(() => {
    _resetEventDraftVaultForTest();
    restoreFakeDom = installFakeDom();
    resetToastsForTest();
  });

  afterEach(() => {
    document.querySelector<HTMLElement>('[data-testid="event-list-tooltip"]')?.remove();
    document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')?.remove();
    resetToastsForTest();
    _resetEventDraftVaultForTest();
    restoreFakeDom();
    vi.unstubAllGlobals();
  });

  // ── 정확한 값 ────────────────────────────────────────────────────────────────

  it("저장된 이벤트: 선택 요약이 저장된 id 를 글자 그대로 보여 준다", () => {
    seed([gameEvent("ev_saved_alpha")]);
    expect(valueInput(renderSidebar()).value).toBe("ev_saved_alpha");
  });

  it("새 드래프트: 아직 커밋 전이어도 배정된 id 를 보여 준다", () => {
    seed([gameEvent("ev_fresh_draft", { draft: { kind: "new" } })]);
    expect(valueInput(renderSidebar()).value).toBe("ev_fresh_draft");
  });

  it("복제 이벤트: 원본이 아니라 자기 id 를 보여 준다", () => {
    const source = gameEvent("ev_source", { pages: [page("page-1", "원본")] });
    const clone = gameEvent("ev_clone", { x: 8, pages: [page("page-1", "원본")] });
    seed([source, clone], "ev_clone");
    expect(valueInput(renderSidebar()).value).toBe("ev_clone");
  });

  it("레거시·커스텀 id: 접두사 규칙을 안 따라도 그대로 보여 준다", () => {
    seed([gameEvent("EV003")]);
    expect(valueInput(renderSidebar()).value).toBe("EV003");
  });

  it("긴 UUID id: 잘리지 않은 전체 값이 value 와 title 에 남는다", () => {
    seed([gameEvent(LONG_UUID_ID)]);
    const input = valueInput(renderSidebar());
    expect(input.value).toBe(LONG_UUID_ID);
    expect(input.getAttribute("title")).toContain(LONG_UUID_ID);
  });

  it("표시 이름·페이지 id·characterId·목록 순번을 값으로 쓰지 않는다", () => {
    seed([
      gameEvent("ev_first"),
      gameEvent("ev_target", {
        characterId: "npc_baker",
        pages: [page("page-xyz", "빵집 주인")],
      }),
    ], "ev_target");
    const input = valueInput(renderSidebar());
    expect(input.value).toBe("ev_target");
    expect(input.value).not.toContain("npc_baker");
    expect(input.value).not.toContain("page-xyz");
    expect(input.value).not.toContain("빵집");
    expect(input.value).not.toBe("2");
  });

  // ── 읽기 전용 ────────────────────────────────────────────────────────────────

  it("readonly 속성으로 잠근다 — disabled 는 키보드 선택을 막으므로 쓰지 않는다", () => {
    seed([gameEvent("ev_locked")]);
    const input = valueInput(renderSidebar());
    expect(input.getAttribute("readonly")).not.toBeNull();
    expect(input.getAttribute("disabled")).toBeNull();
    expect(input.disabled).toBe(false);
    // 탭 순서에 남아야 포커스 → Ctrl+A → 복사가 가능하다.
    expect(input.getAttribute("tabindex")).not.toBe("-1");
  });

  it("값을 바꿔 change 를 쏘아도 프로젝트도 드래프트도 바뀌지 않는다", () => {
    // 드래프트에 원본 스냅샷을 실어 둔다 — original 이 없으면 diff 가 무조건 null 이라
    // 「diff 에 안 들어간다」를 증명하지 못한다.
    const base = gameEvent("ev_immutable");
    const mapId = seed([{ ...base, draft: { kind: "edit", original: { ...base } } }]);
    const input = valueInput(renderSidebar());

    input.value = "ev_hacked";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    const project = store.getCurrent();
    const stored = project.maps[mapId]?.events.find((event) => event.id === "ev_immutable");
    expect(stored).toBeDefined();
    expect(project.maps[mapId]?.events.some((event) => event.id === "ev_hacked")).toBe(false);
    expect(eventDraftHasUserChanges(project, mapId, "ev_immutable")).toBe(false);
    expect(eventDraftDiff(mapId, stored!)?.changes ?? []).toEqual([]);
  });

  it("읽기 전용 표시를 만지는 것만으로 프로젝트가 미저장 상태가 되지 않는다", () => {
    seed([gameEvent("ev_clean")]);
    const before = store.hasUnsavedChanges();
    const input = valueInput(renderSidebar());
    input.focus();
    input.select();
    input.value = "ev_typed";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.hasUnsavedChanges()).toBe(before);
  });

  // ── 라벨·도움말 ──────────────────────────────────────────────────────────────

  it("라벨과 도움말이 이벤트 이름·페이지·characterId·목록 순서와 구분해 준다", () => {
    seed([gameEvent("ev_labelled")]);
    const root = renderSidebar();
    const label = root.querySelector<HTMLElement>('[data-testid="event-summary-event-id-label"]');
    const hint = root.querySelector<HTMLElement>('[data-testid="event-summary-event-id-hint"]');
    expect(label?.textContent).toBe("이벤트 ID");

    const help = hint?.textContent ?? "";
    expect(help).toContain("이벤트 이름");
    expect(help).toContain("페이지");
    expect(help).toContain("characterId");
    expect(help).toContain("순서");
    // 「고칠 수 없다」를 말해야 사용자가 이름칸으로 오해하지 않는다.
    expect(help).toMatch(/고칠 수 없|수정할 수 없/u);

    // 스크린리더가 라벨/설명을 실제로 집도록 연결돼 있어야 한다.
    const input = valueInput(root);
    expect(input.getAttribute("aria-labelledby")).toBe(label?.getAttribute("id"));
    expect(input.getAttribute("aria-describedby")).toBe(hint?.getAttribute("id"));
  });

  // ── 선택 변경 ────────────────────────────────────────────────────────────────

  it("다른 이벤트를 고르면 표시가 따라 바뀐다 — 낡은 값이 남지 않는다", () => {
    seed([gameEvent("ev_one"), gameEvent("ev_two", { x: 9 })], "ev_one");
    expect(valueInput(renderSidebar()).value).toBe("ev_one");

    editorState.set({ selectedEventId: "ev_two", selectedEventPageId: "page-1" });
    const second = renderSidebar();
    expect(valueInput(second).value).toBe("ev_two");
    expect(second.querySelector('[data-testid="event-summary-event-id-value"]')).not.toBeNull();
    // 같은 컨테이너 안에 ID 표시는 하나뿐이어야 한다(이전 렌더 잔존 금지).
    expect(second.querySelectorAll('[data-testid="event-summary-event-id-value"]').length).toBe(1);
  });

  it("선택이 없으면 ID 표시도 없다 — 빈 값이나 마지막 이벤트가 남지 않는다", () => {
    seed([gameEvent("ev_only")], null);
    expect(renderSidebar().querySelector('[data-testid="event-summary-event-id"]')).toBeNull();
  });

  // ── 복사 동작 ────────────────────────────────────────────────────────────────

  it("복사 성공은 접근 가능한 토스트로 알린다", async () => {
    seed([gameEvent(LONG_UUID_ID)]);
    const dirtyBefore = store.hasUnsavedChanges();
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const root = renderSidebar();
    const copy = root.querySelector<HTMLElement>('[data-testid="event-summary-event-id-copy"]');
    expect(copy).not.toBeNull();
    expect(copy?.getAttribute("aria-label")).toContain("이벤트 ID");
    // 눈에 보이는 글자 라벨이어야 한다 — 아이콘만 넣으면 이 저장소에는 SVG 크기 규칙이
    // 없어 8×8px 로 찍힌다(1440×900 실측).
    expect(copy?.textContent?.trim()).toBe("복사");
    copy?.dispatchEvent(new Event("click", { bubbles: true }));
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(LONG_UUID_ID);
    });

    await vi.waitFor(() => {
      const alive = document.querySelector<HTMLElement>('[data-testid="toast"]');
      expect(alive?.textContent ?? "").toContain("복사");
      expect(alive?.className ?? "").toContain("ok");
    });
    // 복사는 읽기 동작이다 — 프로젝트를 더럽히지 않는다.
    expect(store.hasUnsavedChanges()).toBe(dirtyBefore);
  });

  it("복사 실패는 조용히 지나가지 않고 error 토스트로 알린다", async () => {
    seed([gameEvent("ev_copy_fail")]);
    // Clipboard API 없음 + execCommand 없음 → 폴백까지 실패하는 경로.
    vi.stubGlobal("navigator", {});

    const root = renderSidebar();
    root.querySelector<HTMLElement>('[data-testid="event-summary-event-id-copy"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));

    await vi.waitFor(() => {
      const alive = document.querySelector<HTMLElement>('[data-testid="toast"]');
      expect(alive?.className ?? "").toContain("error");
      expect(alive?.getAttribute("role")).toBe("alert");
    });
  });

  // ── 이벤트 편집 모달 헤더 ────────────────────────────────────────────────────

  it("이벤트 편집 모달 헤더도 같은 id 를 읽기 전용으로 보여 준다", () => {
    const mapId = seed([gameEvent(LONG_UUID_ID)]);
    openEventEditorModal(mapId, LONG_UUID_ID);
    const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
    expect(modal).not.toBeNull();

    const input = valueInput(modal!, "event-editor");
    expect(input.value).toBe(LONG_UUID_ID);
    expect(input.getAttribute("readonly")).not.toBeNull();
    expect(input.getAttribute("disabled")).toBeNull();
    // 헤더는 48px 한 줄이라 도움말 문장을 붙일 자리가 없다 — title 이 그 역할을 한다.
    expect(input.getAttribute("title") ?? "").toContain("이벤트 ID");
    expect(readout(modal!, "event-editor").dataset.variant).toBe("chip");
  });

  it("모달 헤더 ID 상자의 change 도 이벤트를 바꾸지 않는다", () => {
    const mapId = seed([gameEvent("ev_modal_ro")]);
    openEventEditorModal(mapId, "ev_modal_ro");
    const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]')!;
    const input = valueInput(modal, "event-editor");
    input.value = "ev_modal_hacked";
    input.dispatchEvent(new Event("change", { bubbles: true }));

    const project = store.getCurrent();
    expect(project.maps[mapId]?.events.map((event) => event.id)).toContain("ev_modal_ro");
    expect(project.maps[mapId]?.events.map((event) => event.id)).not.toContain("ev_modal_hacked");
  });

  // ── 기존 표면 보존 ───────────────────────────────────────────────────────────

  it("목록 호버 카드의 `ID <event.id>` 표기는 그대로다", async () => {
    const { buildEventListTooltipModel } = await import("@/editor/eventMarkerUx");
    const model = buildEventListTooltipModel(gameEvent(LONG_UUID_ID));
    expect(model.identity).toBe(LONG_UUID_ID);
    expect(model.plainText).toContain(`ID ${LONG_UUID_ID}`);
  });

  it("전역 검색은 여전히 event.id 로 이벤트를 찾는다", async () => {
    const mapId = seed([gameEvent(LONG_UUID_ID)]);
    const { searchProject } = await import("@/editor/panels/mapEventSearchModel");
    const results = searchProject({
      project: store.getCurrent(),
      selectedMapId: mapId,
      query: LONG_UUID_ID,
      scope: "all",
    });
    const hit = results.find((result) => result.kind === "mapEvent");
    expect(hit).toBeDefined();
    expect(hit?.detail).toContain(LONG_UUID_ID);
  });

  // ── 레이아웃 ─────────────────────────────────────────────────────────────────

  it("긴 값이 상자를 밀어내지 않도록 두 변형 모두 넘침 규칙을 갖는다", () => {
    // 왜 CSS 를 파일로 읽는가: 맵/모달 캔버스는 WebGL 이고 단위 테스트 DOM 에는 레이아웃
    // 엔진이 없다. 「긴 UUID 가 레이아웃을 깨지 않는다」는 약속을 검증 가능한 형태로
    // 고정할 수 있는 지점은 규칙 자체다(값이 사라지면 이 테스트가 먼저 깨진다).
    const card = readFileSync(resolve(process.cwd(), "src/styles/event/from-editor-core-part-2.css"), "utf8");
    const chip = readFileSync(resolve(process.cwd(), "src/styles/event/event-editor.balanced.css"), "utf8");

    const cardRule = card.slice(card.indexOf(".event-id-readout-value"));
    expect(card).toContain(".event-id-readout");
    // 카드 변형은 전체 값을 보여 준다 — 줄바꿈으로 감싸고 가로 스크롤을 만들지 않는다.
    expect(cardRule).toMatch(/min-width:\s*0/u);
    expect(cardRule).toMatch(/text-overflow:\s*ellipsis/u);

    const chipRule = chip.slice(chip.indexOf(".event-id-readout"));
    expect(chip).toContain(".event-editor-modal-header .event-id-readout");
    // 칩 변형은 48px 헤더 안에 갇혀야 한다 — 상한 폭 + 줄임표.
    expect(chipRule).toMatch(/max-width:/u);
    expect(chipRule).toMatch(/text-overflow:\s*ellipsis/u);
  });
});
