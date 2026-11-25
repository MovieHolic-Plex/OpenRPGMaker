import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openPageMoveRouteDialog } from "@/editor/panels/eventEditor/moveRouteDialog";
import { MOVE_ROUTE_COMMAND_ROWS } from "@/editor/panels/eventEditor/moveRouteCommandCatalog";
import { createBlankProject, DEFAULT_ACTOR_ID, DEFAULT_ITEM_ID } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPageMovement, EventPage, EventPageCondition, GameEvent, Command } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom, flushFakeAnimationFrames } from "./fakeDom";
import { CHARSET_FRAME_HEIGHT, CHARSET_FRAME_WIDTH, charsetFrameIndex, charsetFrameSource, EASYRPG_CHARSET_ASSETS } from "@/assets/easyrpgRtp";
import { renderGraphicResourceList } from "@/editor/panels/eventEditor/npcGraphicPickerControls";
import { renderNpcGraphicPicker } from "@/editor/panels/eventEditor/npcGraphicPicker";
import { advancedConditionEntries, defaultSimpleCondition, type SimpleConditionKind, toggleSimpleCondition, toggleSwitchCondition, toggleTimerCondition } from "@/editor/panels/eventEditor/pageConditionModel";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { CONDITION_KINDS } from "@/project/commandKindRegistry";
import { resolveEventPage } from "@/project/io/pageResolution";
import { ROGUELIKE_RUN_VERSION, type RoguelikeRunState } from "@/project/roguelikeRun";
import { el } from "@/util/dom";
import type { RelationshipState } from "@/project/relationshipState";
import { databaseRecordSelect } from "@/editor/panels/eventEditor/pageConditionControls";
import { simulatePageCommands, getSimSwitch, getSimVariable, getSimItem, type PreviewSimState } from "@/editor/panels/eventEditor/previewSimulation";
import { actorPicker, searchableRecordBrowser } from "@/editor/panels/eventEditor/recordPicker";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { clearCommandInspector, setCommandInspectorHost, showCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { shouldRerenderCommandForm } from "@/editor/panels/eventEditor/commandEditDialog";
import { formatVariableFormula } from "@/editor/panels/eventEditor/commandBodyVariable";
import { setVariable, startSession } from "@/project/session";
import { idleTimerSatisfies, idleTimerWarningMessage } from "@/editor/panels/eventEditor/timerConditionText";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { cloneCommandContainersForMove } from "@/project/projectClone";
import { createDefaultEventPage, moveEventPageCommandAcross, moveEventPageCommandAt, replaceEventPageCommandAt, replaceEventPageCommands } from "@/editor/eventPages";
import { FORK_THEN_BRANCH_INDEX, FORK_ELSE_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { createCommandToolbarHistory, clearCommandToolbarHistories } from "@/editor/panels/eventEditor/commandToolbarHistory";
import { isolateTimers } from "./mergedTeardown";

// P1 이동 경로 다이얼로그 리치화 테스트 (높음-2).
// - 커맨드 버튼: 아이콘 스팬(data-glyph) 존재 + 버튼 textContent(라벨) 불변
// - 좌측 리스트 아래 경로 프리뷰: moves 변경 시 라이브 갱신
// - 스위치 레코드 피커 / 그래픽 차셋 셀렉트가 커맨드 생성 컨텍스트에 반영
// - 원시 id 입력(fill 경로) 하이브리드 동기화 유지 (e2e testid 보호)
describe("moveRouteDialogRich", () => {
  isolateTimers();
  function fakeBody(): FakeElement {
    const body = (globalThis.document as unknown as { body: FakeElement }).body;
    if (!(body instanceof FakeElement)) throw new Error("fake dom body missing");
    return body;
  }
  function openDialog(onApply: (movement: EventPageMovement) => void = vi.fn()): FakeElement {
    openPageMoveRouteDialog({
      movement: { type: "custom", speed: 3, frequency: 3, route: { moves: [], repeat: true } },
      onApply,
    });
    const dialog = findByTestId(fakeBody(), "event-page-move-route-dialog");
    if (!dialog) throw new Error("move route dialog did not open");
    return dialog;
  }
  function mustFind(root: FakeElement, testId: string): FakeElement {
    const found = findByTestId(root, testId);
    if (!found) throw new Error(`missing testid: ${testId}`);
    return found;
  }
  function clickAddButton(dialog: FakeElement, id: string): void {
    mustFind(dialog, `event-page-move-route-add-${id}`).click();
  }
  function typeNumber(dialog: FakeElement, testId: string, value: string): void {
    const input = mustFind(dialog, testId);
    input.value = value;
    input.dispatchEvent(new Event("input"));
  }
  describe("move route dialog rich UI", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      project.switches = [
        { id: "sw_alpha", name: "알파" },
        { id: "sw_beta", name: "베타" },
      ];
      store.replace(project);
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("renders an icon span per command button while keeping the Korean label text intact", () => {
      const dialog = openDialog();
      for (const row of MOVE_ROUTE_COMMAND_ROWS) {
        for (const item of row) {
          const button = mustFind(dialog, `event-page-move-route-add-${item.testId}`);
          const icon = button.querySelector(".event-page-move-route-command-icon");
          expect(icon, item.testId).not.toBeNull();
          expect(icon?.dataset.glyph ?? "", item.testId).not.toBe("");
          // 글리프는 data-glyph(CSS ::before)로만 그려서 버튼 텍스트는 라벨 그대로다 (e2e toHaveText 보호).
          expect(button.textContent, item.testId).toBe(item.label);
        }
      }
      const moveUpIcon = mustFind(dialog, "event-page-move-route-add-move-up").querySelector(
        ".event-page-move-route-command-icon"
      );
      expect(moveUpIcon?.dataset.glyph).toBe("↑");
      // 방향 이동 버튼은 아이콘 강조 클래스를 가진다.
      expect(
        mustFind(dialog, "event-page-move-route-add-move-upper-right").classList.contains(
          "event-page-move-route-command-directional"
        )
      ).toBe(true);
      expect(
        mustFind(dialog, "event-page-move-route-add-turn-up").classList.contains(
          "event-page-move-route-command-directional"
        )
      ).toBe(false);
    });

    it("updates the route preview live as moves are added and cleared", () => {
      const dialog = openDialog();
      const preview = mustFind(dialog, "event-page-move-route-preview");
      expect(preview.textContent).toContain("이동 명령 없음");
      // repeat 체크박스 초기값(true)이 프리뷰 배지에 반영된다.
      expect(preview.textContent).toContain("반복");

      clickAddButton(dialog, "move-up");
      clickAddButton(dialog, "move-lower-right");
      expect(preview.textContent).toContain("↑");
      expect(preview.textContent).toContain("↘");
      expect(preview.textContent).not.toContain("이동 명령 없음");

      mustFind(dialog, "event-page-move-route-delete-all").click();
      expect(preview.textContent).toContain("이동 명령 없음");
    });

    it("feeds switch picker and charset select values into created route commands", () => {
      const dialog = openDialog();
      const commandList = mustFind(dialog, "event-page-move-route-command-list");
      const rawSwitchInput = mustFind(dialog, "event-page-move-route-switch-id");
      // 초기 스위치는 프로젝트 첫 스위치 id (원시 문자열 기본값 제거).
      expect(rawSwitchInput.value).toBe("sw_alpha");

      // 레코드 피커 셀렉트 선택 → 원시 입력 동기화 + setSwitch 커맨드 반영.
      const pickerSelect = mustFind(dialog, "event-page-move-route-switch-picker").querySelector("select");
      expect(pickerSelect).not.toBeNull();
      expect(pickerSelect?.value).toBe("sw_alpha");
      if (!pickerSelect) throw new Error("switch picker select missing");
      pickerSelect.value = "sw_beta";
      pickerSelect.dispatchEvent(new Event("change"));
      expect(rawSwitchInput.value).toBe("sw_beta");
      clickAddButton(dialog, "switch-on");
      expect(commandList.textContent).toContain("스위치 sw_beta ON");

      // 원시 입력(fill 경로)도 여전히 커맨드 컨텍스트를 갱신한다.
      rawSwitchInput.value = "sw_custom";
      rawSwitchInput.dispatchEvent(new Event("input"));
      clickAddButton(dialog, "switch-off");
      expect(commandList.textContent).toContain("스위치 sw_custom OFF");

      // 그래픽: 차셋 셀렉트 초기값 유지 + 선택 시 칩/원시 입력/커맨드 반영.
      const graphicSelect = mustFind(dialog, "event-page-move-route-graphic-select");
      const rawGraphicInput = mustFind(dialog, "event-page-move-route-graphic-id");
      const graphicChip = mustFind(dialog, "event-page-move-route-graphic-preview");
      expect(graphicSelect.value).toBe("tex_easyrpg_charset_people1");
      expect(rawGraphicInput.value).toBe("tex_easyrpg_charset_people1");
      expect(graphicChip.dataset.spriteId).toBe("tex_easyrpg_charset_people1");
      graphicSelect.value = "tex_easyrpg_charset_actor1";
      graphicSelect.dispatchEvent(new Event("change"));
      expect(rawGraphicInput.value).toBe("tex_easyrpg_charset_actor1");
      expect(graphicChip.dataset.spriteId).toBe("tex_easyrpg_charset_actor1");
      clickAddButton(dialog, "change-graphic");
      expect(commandList.textContent).toContain("그래픽 tex_easyrpg_charset_actor1");
    });

    // 체공 저작 경로: 스키마(heightPx/durationMs/dx/dy)는 있었지만 버튼이 기본값만 뱉어서
    // "보스가 8칸 위에서 떨어진다" 나 "두 칸 건너뛴다" 를 에디터로 만들 수 없었다.
    it("feeds hop parameters into jump and drop-in commands, omitting untouched defaults", () => {
      const onApply = vi.fn();
      const dialog = openDialog(onApply);
      const commandList = mustFind(dialog, "event-page-move-route-command-list");

      // 손대지 않은 상태(0)는 "저작하지 않음" — 예전과 같은 제자리 점프가 나온다.
      clickAddButton(dialog, "jump");
      expect(commandList.textContent).toContain("점프");

      typeNumber(dialog, "event-page-move-route-hop-dx", "2");
      typeNumber(dialog, "event-page-move-route-hop-dy", "-1");
      typeNumber(dialog, "event-page-move-route-hop-height", "48");
      typeNumber(dialog, "event-page-move-route-hop-duration", "1200");
      clickAddButton(dialog, "jump");
      clickAddButton(dialog, "drop-in");
      // 저작값은 리스트 라벨에도 보여야 한다 — 안 그러면 낙하 두 개를 구분할 수 없다.
      expect(commandList.textContent).toContain("점프 (2, -1) 48px 1200ms");
      expect(commandList.textContent).toContain("위에서 낙하 48px 1200ms");

      mustFind(dialog, "event-page-move-route-ok").click();
      const movement = onApply.mock.calls[0]?.[0] as EventPageMovement;
      expect(movement.route?.moves).toEqual([
        { kind: "jump", dx: 0, dy: 0 },
        { kind: "jump", dx: 2, dy: -1, heightPx: 48, durationMs: 1200 },
        { kind: "dropIn", heightPx: 48, durationMs: 1200 },
      ]);
    });

    it("prefills the hop fields from the route being edited", () => {
      openPageMoveRouteDialog({
        movement: {
          type: "custom",
          speed: 3,
          frequency: 3,
          route: {
            moves: [
              { kind: "jump", dx: 3, dy: 0, heightPx: 40, durationMs: 700 },
              { kind: "dropIn", heightPx: 128, durationMs: 1500 },
            ],
            repeat: true,
          },
        },
        onApply: vi.fn(),
      });
      const dialog = findByTestId(fakeBody(), "event-page-move-route-dialog");
      if (!dialog) throw new Error("move route dialog did not open");
      // dx/dy 는 점프만 가지므로 마지막 점프에서, 높이·시간은 둘이 공유하므로 마지막 체공에서 온다.
      expect(mustFind(dialog, "event-page-move-route-hop-dx").value).toBe("3");
      expect(mustFind(dialog, "event-page-move-route-hop-height").value).toBe("128");
      expect(mustFind(dialog, "event-page-move-route-hop-duration").value).toBe("1500");
    });
  });
});

// 리뷰 결함 [높음-4] 회귀: 그래픽 선택 다이얼로그 이미지 리치화.
// (a) 좌측 리소스 리스트 행에 대표 스프라이트(캐릭터 0, 아래, 패턴 1) 24x32 썸네일 크롭이 적용되고
// (b) 원시 리소스 이름은 고급 접힘 뒤에 기본으로 숨으며
// (c) 걷기 애니메이션 프리뷰(npc-walk-preview)가 존재하고 방향/캐릭터 변경 시 갱신된다.
describe("npcGraphicPickerRich", () => {
  isolateTimers();
  const THUMB_SELECTION = { characterIndex: 0, direction: "down", pattern: 1 } as const;
  function samplePage(): EventPage {
    return {
      id: "page-1",
      name: "1",
      conditions: [],
      graphic: {
        sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" },
        direction: "down",
        pattern: charsetFrameIndex(THUMB_SELECTION),
      },
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };
  }
  function renderPicker(): FakeElement {
    return renderWithFakeDom(() => renderNpcGraphicPicker("map-1", "ev-1", samplePage(), () => {}));
  }
  function radioInput(root: FakeElement, testId: string): FakeElement {
    const label = findByTestId(root, testId);
    expect(label, testId).not.toBeNull();
    const input = label?.querySelector("input");
    expect(input, `${testId} input`).not.toBeNull();
    return input as FakeElement;
  }
  describe("NPC 그래픽 선택 다이얼로그 — 이미지 리치화", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("리소스 행 아이콘에 대표 스프라이트 24x32 썸네일 크롭이 적용된다", () => {
      const list = renderGraphicResourceList(EASYRPG_CHARSET_ASSETS, () => {});
      const source = charsetFrameSource(THUMB_SELECTION);
      expect(list.buttons.length).toBe(EASYRPG_CHARSET_ASSETS.length);
      list.buttons.forEach((button, index) => {
        const asset = EASYRPG_CHARSET_ASSETS[index];
        const icon = (button as unknown as FakeElement).querySelector(".event-graphic-resource-icon");
        expect(icon, asset?.textureKey).not.toBeNull();
        expect(icon?.classList.contains("charset-thumb")).toBe(true);
        expect(icon?.style.width).toBe(`${CHARSET_FRAME_WIDTH}px`);
        expect(icon?.style.height).toBe(`${CHARSET_FRAME_HEIGHT}px`);
        expect(icon?.style.backgroundPosition).toBe(`-${source.x}px -${source.y}px`);
        expect(icon?.dataset.transparentColorKeyPath).toBe(asset?.path);
      });
    });

    it("타일셋 자리표시 행을 더 이상 보여 주지 않는다", () => {
      const list = renderGraphicResourceList(EASYRPG_CHARSET_ASSETS, () => {});
      const root = list.root as unknown as FakeElement;
      const disabledRows = root
        .querySelectorAll(".disabled")
        .filter((row) => row.classList.contains("event-graphic-resource-row"));
      expect(disabledRows.length).toBe(0);
    });

    it("직접 이름 입력은 고급 접힘 안에 기본으로 들어간다", () => {
      const root = renderPicker();
      const details = root.querySelector(".npc-advanced-sprite");
      expect(details).not.toBeNull();
      expect(details?.tagName).toBe("DETAILS");
      expect((details as FakeElement & { open?: boolean }).open ?? false).toBe(false);
      const summary = details?.querySelector("summary");
      expect(summary?.textContent).toBe("고급 · 파일 이름 직접 넣기");
      // testid 는 불변이어야 하고, 입력이 details 내부로 이동해야 한다.
      const input = findByTestId(details as FakeElement, "event-graphic-direct-sprite-input");
      expect(input).not.toBeNull();
      expect(input?.value).toBe("tex_easyrpg_charset_people1");
    });

    it("걷기 프리뷰가 존재하고 방향/캐릭터 변경 시 dataset 과 걷기 프레임 변수가 갱신된다", () => {
      const root = renderPicker();
      const walkPreview = findByTestId(root, "npc-walk-preview");
      expect(walkPreview).not.toBeNull();
      expect(walkPreview?.dataset.slot).toBe("0");
      expect(walkPreview?.dataset.direction).toBe("down");

      // 방향 변경 → dataset.direction + 프레임 변수 갱신
      const leftRadio = radioInput(root, "npc-direction-left");
      leftRadio.checked = true;
      leftRadio.dispatchEvent(new Event("change"));
      expect(walkPreview?.dataset.direction).toBe("left");
      for (const pattern of [0, 1, 2]) {
        const source = charsetFrameSource({ characterIndex: 0, direction: "left", pattern });
        expect(walkPreview?.style[`--npc-walk-frame-${pattern}`]).toBe(
          `-${source.x * 2}px -${source.y * 2}px`
        );
      }

      // 캐릭터 슬롯 변경 → dataset.slot 갱신
      const slot3 = findByTestId(root, "npc-character-slot-3");
      expect(slot3).not.toBeNull();
      slot3?.click();
      expect(walkPreview?.dataset.slot).toBe("3");
      const slot3Source = charsetFrameSource({ characterIndex: 3, direction: "left", pattern: 1 });
      expect(walkPreview?.style["--npc-walk-frame-1"]).toBe(
        `-${slot3Source.x * 2}px -${slot3Source.y * 2}px`
      );
    });

    it("기존 testid (프레임 프로브/확인/취소/리소스 행)가 유지된다", () => {
      const root = renderPicker();
      expect(findByTestId(root, "npc-frame-preview")).not.toBeNull();
      expect(findByTestId(root, "event-graphic-confirm")).not.toBeNull();
      expect(findByTestId(root, "event-graphic-cancel")).not.toBeNull();
      expect(findByTestId(root, "event-graphic-resource-tex_easyrpg_charset_people1")).not.toBeNull();
    });

    it("소재 관리자에서 업로드한 charset이 리소스 목록에 나타난다", () => {
      const project = store.getCurrent();
      const uploadedId = "uploaded-custom-hero";
      project.assets.uploaded[uploadedId] = {
        id: uploadedId,
        name: "커스텀 영웅.png",
        kind: "charset",
        dataUrl: "data:image/png;base64,iVBORw0KGgo=",
        meta: { width: 288, height: 256 },
      };
      try {
        const root = renderPicker();
        const uploadedRow = findByTestId(root, `event-graphic-resource-${uploadedId}`);
        expect(uploadedRow, "uploaded charset row").not.toBeNull();
        expect(uploadedRow?.textContent).toContain("커스텀 영웅");
      } finally {
        delete project.assets.uploaded[uploadedId];
      }
    });

    it("칸 이름을 가르치면 project.charsetLabels 에 저장된다", () => {
      const project = store.getCurrent();
      const previous = project.charsetLabels;
      project.charsetLabels = undefined;
      try {
        const root = renderPicker();
        expect(findByTestId(root, "npc-charset-teach")).not.toBeNull();
        const input = findByTestId(root, "npc-charset-label-input");
        expect(input).not.toBeNull();
        if (input) input.value = "우리 마을 촌장";
        findByTestId(root, "npc-charset-teach-save")?.click();
        expect(store.getCurrent().charsetLabels).toEqual([
          expect.objectContaining({
            textureKey: "tex_easyrpg_charset_people1",
            characterIndex: 0,
            label: "우리 마을 촌장",
            origin: "user",
          }),
        ]);
      } finally {
        project.charsetLabels = previous;
      }
    });

    it("uploaded가 아닌 kind(tileset 등)은 charset 목록에 나타나지 않는다", () => {
      const project = store.getCurrent();
      const tilesetId = "uploaded-tileset-x";
      project.assets.uploaded[tilesetId] = {
        id: tilesetId,
        name: "타일셋X.png",
        kind: "tileset",
        dataUrl: "data:image/png;base64,iVBORw0KGgo=",
        meta: { width: 480, height: 256 },
      };
      try {
        const root = renderPicker();
        const tilesetRow = findByTestId(root, `event-graphic-resource-${tilesetId}`);
        expect(tilesetRow).toBeNull();
      } finally {
        delete project.assets.uploaded[tilesetId];
      }
    });
  });
});

// 페이지 조건 전 kind 작동 보증 — 체크 토글 시드/해제, 고급 목록 가시성, 런타임 평가, UI 컨트롤.
describe("pageConditionsGuarantee", () => {
  isolateTimers();
  const SIMPLE_KINDS: readonly SimpleConditionKind[] = [
    "variable",
    "item",
    "actor",
    "timePhase",
    "season",
    "npcActivity",
    "insideLocation",
    "friendshipAtLeast",
    "relationshipAtLeast",
  ];
  const RUN_STATE: RoguelikeRunState = {
    version: ROGUELIKE_RUN_VERSION,
    runId: "guarantee-run",
    seed: 1,
    floor: 3,
    status: "active",
    flags: {},
    roomResetCounts: {},
    roomEventGenerationKeys: {},
  };
  function ensureEventWithPage(conditions: EventPage["conditions"] = []): {
    mapId: string;
    eventId: string;
    page: EventPage;
  } {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const page: EventPage = {
      id: "page-guarantee",
      name: "보증 페이지",
      conditions: [...conditions],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };
    const event: GameEvent = {
      id: "ev-cond-guarantee",
      x: 2,
      y: 2,
      trigger: { kind: "action" },
      commands: [],
      pages: [page],
    };
    store.update((draft) => {
      const target = draft.maps[mapId];
      if (!target) return;
      target.events = [...target.events.filter((entry) => entry.id !== event.id), structuredClone(event)];
    });
    const live = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === event.id)?.pages?.[0];
    if (!live) throw new Error("page missing");
    return { mapId, eventId: event.id, page: live };
  }
  function livePage(mapId: string, eventId: string): EventPage {
    const page = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === eventId)?.pages?.[0];
    if (!page) throw new Error("live page missing");
    return page;
  }
  function sampleCondition(kind: (typeof CONDITION_KINDS)[number]): EventPageCondition {
    const project = store.getCurrent();
    switch (kind) {
      case "switch":
        return { kind: "switch", switchId: project.switches[0]?.id ?? "sw_0001", value: true };
      case "variable":
        return { kind: "variable", variableId: project.variables[0]?.id ?? "var_0001", op: ">=", value: 1 };
      case "selfSwitch":
        return { kind: "selfSwitch", key: "A", value: true };
      case "actor":
        return { kind: "actor", actorId: DEFAULT_ACTOR_ID, present: true };
      case "item":
        return { kind: "item", itemId: DEFAULT_ITEM_ID, present: true };
      case "gold":
        return { kind: "gold", op: ">=", amount: 10 };
      case "timer":
        return { kind: "timer", timerId: "timer1", seconds: 30 };
      case "timePhase":
        return { kind: "timePhase", phase: "day" };
      case "season":
        return { kind: "season", season: "spring" };
      case "npcActivity":
        return { kind: "npcActivity", activity: "work" };
      case "insideLocation":
        return { kind: "insideLocation", locationId: "loc1", inside: true };
      case "friendshipAtLeast":
        return { kind: "friendshipAtLeast", value: 50 };
      case "relationshipAtLeast":
        return { kind: "relationshipAtLeast", state: "dating" };
      case "battleResult":
        return { kind: "battleResult", result: "victory" };
      case "run":
        return { kind: "run", query: "floor", op: ">=", value: 3 };
      case "monsterSpecies":
        return { kind: "monsterSpecies", speciesId: project.database.monsterSpecies?.[0]?.id ?? "species_1", present: true };
      case "actorStat":
        return { kind: "actorStat", actorId: DEFAULT_ACTOR_ID, stat: "level", op: ">=", value: 1 };
      case "actorState":
        return { kind: "actorState", actorId: "anyone", stateId: project.database.states[0]?.id ?? "state_1", present: true };
      case "partyLeader":
        return { kind: "partyLeader", actorId: DEFAULT_ACTOR_ID };
      case "partyKnowsSkill":
        return { kind: "partyKnowsSkill", skillId: "skill_probe", present: true };
      case "badgeCount":
        return { kind: "badgeCount", op: ">=", value: 1 };
      case "partySize":
        return { kind: "partySize", op: ">=", value: 1 };
      case "facing":
        return { kind: "facing", subject: "player", dir: "left" };
      case "relativeFacing":
        return { kind: "relativeFacing", relation: "playerBehindEvent" };
      case "hiding":
        return { kind: "hiding", value: true };
      case "pursuitActive":
        return { kind: "pursuitActive", value: true };
      case "eventSeesPlayer":
        // #3317 에서 더해진 시선 조건 — 같은 방·벽 검사를 끄고 거리만 잰다(바로 옆 칸은 방향과 무관하게 본다).
        return { kind: "eventSeesPlayer", eventId: "ev_runtime", range: 5, sameRoom: false };
      case "clearCount":
        return { kind: "clearCount", op: ">=", value: 1 };
      case "endingSeen":
        return { kind: "endingSeen", endingId: "ending_1", value: true };
      case "newGamePlus":
        return { kind: "newGamePlus", value: true };
      case "weekday":
        return { kind: "weekday", weekdays: [0, 1, 2, 3, 4, 5, 6] };
      case "stringVariable":
        return { kind: "stringVariable", stringVariableId: "prayer", op: "==", value: "빛" };
      case "difficulty":
        return { kind: "difficulty", difficultyId: "normal" };
      case "itemUsed":
        return { kind: "itemUsed", itemId: DEFAULT_ITEM_ID };
      case "all":
        return {
          kind: "all",
          conditions: [{ kind: "switch", switchId: project.switches[0]?.id ?? "sw_0001", value: true }],
        };
      case "any":
        return {
          kind: "any",
          conditions: [{ kind: "switch", switchId: project.switches[0]?.id ?? "sw_0001", value: true }],
        };
      case "not":
        return { kind: "not", condition: { kind: "switch", switchId: "sw_absent", value: true } };
    }
  }
  describe("page conditions working guarantee (all kinds)", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("CONDITION_KINDS 전원이 default 시드 또는 토글 경로를 가진다", () => {
      for (const kind of SIMPLE_KINDS) {
        const seeded = defaultSimpleCondition(kind);
        expect(seeded, `defaultSimpleCondition(${kind})`).not.toBeNull();
        expect(seeded?.kind).toBe(kind);
      }
    });

    it.each(SIMPLE_KINDS)("simple 조건 %s: 체크 ON 시드 → OFF 제거", (kind) => {
      const { mapId, eventId, page } = ensureEventWithPage();
      toggleSimpleCondition({ mapId, eventId, page }, kind, true);
      const afterOn = livePage(mapId, eventId);
      expect(afterOn.conditions.some((c) => c.kind === kind)).toBe(true);

      toggleSimpleCondition({ mapId, eventId, page: afterOn }, kind, false);
      const afterOff = livePage(mapId, eventId);
      expect(afterOff.conditions.some((c) => c.kind === kind)).toBe(false);
    });

    it("스위치 slot0/slot1: 체크 ON 시드 → OFF 제거 (서로 독립)", () => {
      const { mapId, eventId, page } = ensureEventWithPage();
      const sw0 = store.getCurrent().switches[0]?.id;
      const sw1 = store.getCurrent().switches[1]?.id ?? sw0;
      expect(sw0).toBeTruthy();

      toggleSwitchCondition({ mapId, eventId, page, slot: 0 }, true);
      let live = livePage(mapId, eventId);
      expect(live.conditions.filter((c) => c.kind === "switch")).toHaveLength(1);

      toggleSwitchCondition({ mapId, eventId, page: live, slot: 1 }, true);
      live = livePage(mapId, eventId);
      expect(live.conditions.filter((c) => c.kind === "switch")).toHaveLength(2);

      toggleSwitchCondition({ mapId, eventId, page: live, slot: 0 }, false);
      live = livePage(mapId, eventId);
      const remaining = live.conditions.filter((c) => c.kind === "switch");
      expect(remaining).toHaveLength(1);
      // slot1 이 남아 있어야 한다
      expect(remaining[0]?.kind).toBe("switch");

      toggleSwitchCondition({ mapId, eventId, page: live, slot: 0 }, false); // already empty slot0
      toggleSwitchCondition({ mapId, eventId, page: livePage(mapId, eventId), slot: 1 }, false);
      expect(livePage(mapId, eventId).conditions.filter((c) => c.kind === "switch")).toHaveLength(0);
      void sw1;
    });

    it("타이머 1/2: 체크 ON 시드 → OFF 제거", () => {
      const { mapId, eventId, page } = ensureEventWithPage();
      toggleTimerCondition({ mapId, eventId, page }, "timer1", true);
      toggleTimerCondition({ mapId, eventId, page: livePage(mapId, eventId) }, "timer2", true);
      let live = livePage(mapId, eventId);
      expect(live.conditions.filter((c) => c.kind === "timer")).toHaveLength(2);

      toggleTimerCondition({ mapId, eventId, page: live }, "timer1", false);
      live = livePage(mapId, eventId);
      expect(live.conditions).toEqual([{ kind: "timer", timerId: "timer2", seconds: 0 }]);

      toggleTimerCondition({ mapId, eventId, page: live }, "timer2", false);
      expect(livePage(mapId, eventId).conditions).toEqual([]);
    });

    it("고급 목록: 간단 행 초과분 + selfSwitch/gold 가 모두 보인다", () => {
      const conditions: EventPageCondition[] = [
        sampleCondition("switch"),
        sampleCondition("switch"),
        { kind: "switch", switchId: "sw_extra", value: true },
        sampleCondition("variable"),
        { kind: "variable", variableId: "var_extra", op: ">=", value: 2 },
        sampleCondition("item"),
        { kind: "item", itemId: "item_extra", present: true },
        sampleCondition("actor"),
        { kind: "actor", actorId: "actor_extra", present: true },
        sampleCondition("timePhase"),
        { kind: "timePhase", phase: "night" },
        sampleCondition("season"),
        { kind: "season", season: "winter" },
        sampleCondition("npcActivity"),
        { kind: "npcActivity", activity: "sleep" },
        sampleCondition("insideLocation"),
        { kind: "insideLocation", locationId: "loc_extra", inside: false },
        sampleCondition("friendshipAtLeast"),
        sampleCondition("relationshipAtLeast"),
        { kind: "relationshipAtLeast", state: "married" },
        { kind: "friendshipAtLeast", value: 200 },
        sampleCondition("timer"),
        { kind: "timer", timerId: "timer1", seconds: 5 },
        { kind: "timer", timerId: "timer2", seconds: 10 },
        { kind: "timer", timerId: "timer2", seconds: 20 },
       sampleCondition("selfSwitch"),
        { kind: "selfSwitch", key: "B", value: false },
       sampleCondition("gold"),
       sampleCondition("battleResult"),
       sampleCondition("run"),
       sampleCondition("monsterSpecies"),
       sampleCondition("actorStat"),
       sampleCondition("actorState"),
       sampleCondition("partyLeader"),
       sampleCondition("partyKnowsSkill"),
       sampleCondition("badgeCount"),
       sampleCondition("partySize"),
       sampleCondition("facing"),
       sampleCondition("relativeFacing"),
       sampleCondition("hiding"),
       sampleCondition("pursuitActive"),
       sampleCondition("eventSeesPlayer"),
       sampleCondition("clearCount"),
       sampleCondition("endingSeen"),
       sampleCondition("newGamePlus"),
       sampleCondition("weekday"),
       sampleCondition("stringVariable"),
       sampleCondition("difficulty"),
       sampleCondition("itemUsed"),
       sampleCondition("all"),
       sampleCondition("any"),
       sampleCondition("not"),
     ];
      const page: EventPage = {
        id: "p",
        name: "p",
        conditions,
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      };
      const advanced = advancedConditionEntries(page);
      const kinds = advanced.map((e) => e.condition.kind);
      // 초과분
      expect(kinds).toContain("switch");
      expect(kinds).toContain("variable");
      expect(kinds).toContain("item");
      expect(kinds).toContain("actor");
      expect(kinds).toContain("timePhase");
      expect(kinds).toContain("season");
      expect(kinds).toContain("npcActivity");
      expect(kinds).toContain("friendshipAtLeast");
      expect(kinds).toContain("timer");
      // 소지금은 간단 행이 없어 항상 고급에; 셀프 스위치 2개 중 1개는 초과분
      expect(kinds).toContain("selfSwitch");
      expect(kinds).toContain("gold");

      // 어떤 kind도 고급/간단 어디에도 안 보이는 구멍 없음:
      // 각 kind 최소 1개는 페이지에 있고, simple 슬롯 또는 advanced에 배치.
      for (const kind of CONDITION_KINDS) {
        const total = conditions.filter((c) => c.kind === kind).length;
        expect(total, `sample has ${kind}`).toBeGreaterThan(0);
        if (kind === "gold") {
          // 소지금은 간단 행 없음 — 항상 고급에
          expect(advanced.some((e) => e.condition.kind === kind)).toBe(true);
        } else if (kind === "selfSwitch") {
          // 셀프 스위치는 첫 번째가 간단 행, 나머지 초과분이 고급에
          expect(advanced.filter((e) => e.condition.kind === "selfSwitch").length).toBe(1);
        } else if (kind === "timer") {
          // timer1 first + timer2 first are simple; extras advanced
          expect(advanced.filter((e) => e.condition.kind === "timer").length).toBeGreaterThanOrEqual(1);
        } else if (kind === "switch") {
          expect(advanced.filter((e) => e.condition.kind === "switch").length).toBe(1); // 3rd
        } else {
          expect(advanced.some((e) => e.condition.kind === kind)).toBe(true); // 2nd+
        }
      }
    });

    it("UI: 모든 간단 조건 행의 컨트롤 testid가 렌더된다", () => {
      const project = store.getCurrent();
      const page: EventPage = {
        id: "p",
        name: "p",
        conditions: [
          { kind: "switch", switchId: project.switches[0]?.id ?? "", value: true },
          { kind: "switch", switchId: project.switches[1]?.id ?? project.switches[0]?.id ?? "", value: true },
          { kind: "variable", variableId: project.variables[0]?.id ?? "", op: ">=", value: 1 },
          { kind: "item", itemId: DEFAULT_ITEM_ID, present: true },
          { kind: "actor", actorId: DEFAULT_ACTOR_ID, present: true },
          { kind: "timer", timerId: "timer1", seconds: 65 },
          { kind: "timer", timerId: "timer2", seconds: 10 },
          { kind: "timePhase", phase: "evening" },
          { kind: "season", season: "fall" },
          { kind: "npcActivity", activity: "patrol" },
          { kind: "insideLocation", locationId: "loc1", inside: true },
         { kind: "friendshipAtLeast", value: 80 },
          { kind: "selfSwitch", key: "A", value: true },
       ],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      };
      // No characterId: friendship row still renders, but connect/CTA may live on pageProps.
      const rootWithoutChar = renderWithFakeDom(() => el("div", { children: renderPageConditions("map-start", "ev", page) }));
      expect(findByTestId(rootWithoutChar, "event-page-friendship-condition-value")).not.toBeNull();
      expect(findByTestId(rootWithoutChar, "event-page-condition-add-toolbar")).toBeNull();

      const root = renderWithFakeDom(() => el("div", { children: renderPageConditions("map-start", "ev", page, { characterId: "char_ev" }) }));
      const ids = [
        "event-page-switch-condition-input",
        "event-page-switch2-condition-input",
        "event-page-variable-condition-input",
        "event-page-variable-condition-op",
        "event-page-variable-condition-value",
        "event-page-item-condition-input",
        "event-page-actor-condition-input",
        "event-page-timer1-condition-minutes",
        "event-page-timer1-condition-seconds",
        "event-page-timer2-condition-minutes",
        "event-page-timer2-condition-seconds",
        "event-page-time-phase-condition-input",
        "event-page-season-condition-input",
        "event-page-npc-activity-condition-input",
       "event-page-friendship-condition-value",
        "event-page-self-switch-condition-key-A",
        "event-page-self-switch-condition-value",
       "event-page-advanced-conditions",
      ];
      for (const id of ids) {
        expect(findByTestId(root, id), id).not.toBeNull();
      }
      // 이 픽스처는 모든 간단 조건을 켠 상태 — 전부 active 여야 한다.
      const activeRows = root.querySelectorAll('[data-condition-active="true"]');
      expect(activeRows.length).toBeGreaterThan(0);
      expect(root.querySelectorAll('[data-condition-active="false"]').length).toBe(0);
      expect(root.textContent).toContain("보유 중");
      expect(root.textContent).toContain("파티에 있음");
      expect(root.textContent).toContain("켜짐");
      // 새 계약: 빈 페이지면 행은 0개, 칩 12개가 종류를 보여준다
      // 조건을 안 건 페이지: 행은 하나도 내지 않고 칩 12개와 한 줄 안내만 남는다.
      // 예전 계약은 «체크 안 된 행» 12줄을 늘 렌더해 첫 화면을 덮었다 — 발견 가능성은 이제 칩이 진다.
      const emptyPage: EventPage = { ...page, conditions: [] };
      const emptyRoot = renderWithFakeDom(() => el("div", { children: renderPageConditions("map-start", "ev", emptyPage) }));
      expect(emptyRoot.querySelectorAll(".event-condition-row").length).toBe(0);
      expect(findByTestId(emptyRoot, "event-condition-empty")).not.toBeNull();
      expect(emptyRoot.querySelectorAll(".event-condition-chip").length).toBe(14);
      for (const key of ["switch1", "switch2", "variable", "item", "actor", "timer1", "timer2", "timePhase", "season", "npcActivity", "insideLocation", "friendship", "selfSwitch"]) {
        const chip = findByTestId(emptyRoot, `event-condition-chip-${key}`);
        expect(chip, `chip missing: ${key}`).not.toBeNull();
        expect(chip?.getAttribute("aria-pressed")).toBe("false");
      }
    });

    it("런타임: CONDITION_KINDS 전원이 true/false로 평가된다", () => {
      const conditions = CONDITION_KINDS.map((kind) => sampleCondition(kind));
      const event: GameEvent = {
        id: "ev_runtime",
        x: 0,
        y: 0,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          {
            id: "p1",
            name: "p1",
            conditions,
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [],
          },
        ],
      };

      const passSession = {
        switches: { [sampleCondition("switch").kind === "switch" ? (sampleCondition("switch") as { switchId: string }).switchId : ""]: true },
        variables: {} as Record<string, number>,
        selfSwitches: { ev_runtime: { A: true, B: false, C: false, D: false } },
        inventory: { [DEFAULT_ITEM_ID]: 1 },
        partyActorIds: [DEFAULT_ACTOR_ID],
        gold: 10,
        timers: { timer1: 10, timer2: 0 },
        gameTime: { minute: 0, hour: 12, day: 1, season: "spring" as const, year: 1 },
        npcActivities: { ev_runtime: "work" },
        friendship: { ev_runtime: 50 },
        relationships: { ev_runtime: "dating" as const },
        battleResult: "victory" as const,
        roguelikeRun: RUN_STATE,
        difficultyId: "normal",
        itemUsedId: DEFAULT_ITEM_ID,
        // 조회 조건(명작 공백 G1) 이 읽는 세션 칸.
        actorLevels: { [DEFAULT_ACTOR_ID]: 5 },
        actorVitals: {},
        actorStateIds: { [DEFAULT_ACTOR_ID]: [store.getCurrent().database.states[0]?.id ?? "state_1"] },
        // partyKnowsSkill(#2602)·badgeCount(#2713) 이 읽는 칸 — 단독 경로(아래 it)와 같은 값.
        actorSkillIds: { [DEFAULT_ACTOR_ID]: ["skill_probe"] },
        playerFacing: "left" as const,
        currentMapId: "m",
        eventLocations: { ev_runtime: { mapId: "m", x: 1, y: 0, direction: "up" as const } },
        horror: { hiding: { mapId: "m", eventId: "closet", witnessedBy: [] }, pursuits: { chaser: { active: true } } },
        flags: { ngplus: true },
        stringVariables: { prayer: "빛" },
        clearHistory: { count: 1, endingIds: ["ending_1"] },
        monsterInstances: { mon1: { id: "mon1", speciesId: store.getCurrent().database.monsterSpecies?.[0]?.id ?? "species_1" } },
        monsterParty: ["mon1"],
      } as unknown as Parameters<typeof resolveEventPage>[1];
      event.characterId = "ev_runtime";
      // fill variable id from actual sample
      const varCond = conditions.find((c) => c.kind === "variable");
      if (varCond?.kind === "variable") passSession.variables[varCond.variableId] = 5;
      const swCond = conditions.find((c) => c.kind === "switch");
      if (swCond?.kind === "switch") passSession.switches[swCond.switchId] = true;
      passSession.switches.mx_badge_1 = true;

      const locationContext = { locations: [{ id: "loc1", x: 0, y: 0, w: 4, h: 4 }] };
      expect(resolveEventPage(event, { ...passSession, x: 1, y: 1 }, locationContext)?.id).toBe("p1");

      // fail item
      expect(
        resolveEventPage(event, {
          ...passSession,
          inventory: {},
        })?.id
      ).toBeUndefined();
    });

    it("런타임: 각 kind를 단독으로 true/false 토글 가능하다", () => {
      for (const kind of CONDITION_KINDS) {
        const condition = sampleCondition(kind);
        const event: GameEvent = {
          id: `ev_${kind}`,
          x: 0,
          y: 0,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            {
              id: "only",
              name: "only",
              conditions: [condition],
              graphic: {},
              trigger: { kind: "action" },
              priority: "same",
              movement: { type: "fixed", speed: 3, frequency: 3 },
              commands: [],
            },
          ],
        };

        const base = {
          switches: {} as Record<string, boolean>,
          variables: {} as Record<string, number>,
          selfSwitches: {} as Record<string, Partial<Record<"A" | "B" | "C" | "D", boolean>>>,
          inventory: {} as Record<string, number>,
          partyActorIds: [] as string[],
          gold: 0,
          timers: {} as Record<string, number>,
          gameTime: undefined as undefined | { minute: number; hour: number; day: number; season: "spring" | "summer" | "fall" | "winter"; year: number },
          npcActivities: {} as Record<string, string>,
          friendship: {} as Record<string, number>,
          relationships: {} as Record<string, RelationshipState>,
          battleResult: undefined as undefined | "victory" | "defeat" | "escape",
          roguelikeRun: undefined as undefined | RoguelikeRunState,
          difficultyId: undefined as string | undefined,
          itemUsedId: undefined as string | undefined,
          x: undefined as number | undefined,
          y: undefined as number | undefined,
        };

        // failing session — timer는 "N초 이하"라 미설정(0)도 참이므로 초과 값으로 실패시킨다.
        const fail = {
          ...base,
          switches: { ...base.switches },
          variables: { ...base.variables },
          selfSwitches: { ...base.selfSwitches },
          inventory: { ...base.inventory },
          partyActorIds: [...base.partyActorIds],
          timers: { ...base.timers },
          npcActivities: { ...base.npcActivities },
          friendship: { ...base.friendship },
          gameTime: base.gameTime,
          gold: base.gold,
          battleResult: base.battleResult,
          roguelikeRun: base.roguelikeRun,
        };
        if (condition.kind === "timer") {
          fail.timers[condition.timerId] = condition.seconds + 1;
        } else if (condition.kind === "timePhase") {
          fail.gameTime = { minute: 0, hour: 23, day: 1, season: "spring", year: 1 }; // night vs day sample
        } else if (condition.kind === "season") {
          fail.gameTime = { minute: 0, hour: 12, day: 1, season: "winter", year: 1 };
        } else if (condition.kind === "not") {
          // NOT 은 내부 조건이 참일 때 거짓이 된다.
          const inner = condition.condition;
          if (inner.kind === "switch") fail.switches[inner.switchId] = inner.value;
        }
        expect(resolveEventPage(event, fail), `${kind} should fail mismatched session`).toBeUndefined();

        // passing session
        const pass = {
          ...base,
          switches: { ...base.switches },
          variables: { ...base.variables },
          selfSwitches: { ...base.selfSwitches },
          inventory: { ...base.inventory },
          partyActorIds: [...base.partyActorIds],
          timers: { ...base.timers },
          npcActivities: { ...base.npcActivities },
          friendship: { ...base.friendship },
          gameTime: base.gameTime,
          gold: base.gold,
          battleResult: base.battleResult,
          roguelikeRun: base.roguelikeRun,
        };
        switch (condition.kind) {
          case "switch":
            pass.switches[condition.switchId] = condition.value;
            break;
          case "variable":
            pass.variables[condition.variableId] = condition.value;
            break;
          case "selfSwitch":
            pass.selfSwitches[event.id] = { [condition.key]: condition.value };
            break;
          case "actor":
            pass.partyActorIds = condition.present ? [condition.actorId] : [];
            break;
          case "item":
            pass.inventory[condition.itemId] = condition.present ? 1 : 0;
            break;
          case "gold":
            pass.gold = condition.amount;
            break;
          case "timer":
            pass.timers[condition.timerId] = condition.seconds;
            break;
          case "timePhase":
            pass.gameTime = { minute: 0, hour: condition.phase === "night" ? 23 : 12, day: 1, season: "spring", year: 1 };
            break;
          case "season":
            pass.gameTime = { minute: 0, hour: 12, day: 1, season: condition.season, year: 1 };
            break;
          case "npcActivity":
            pass.npcActivities[event.id] = condition.activity;
            break;
          case "friendshipAtLeast":
            event.characterId = event.id;
            pass.friendship[event.id] = condition.value;
            break;
          case "relationshipAtLeast":
            event.characterId = event.id;
            pass.relationships = { [event.id]: condition.state };
            break;
          case "battleResult":
            pass.battleResult = condition.result;
            break;
          case "run":
            pass.roguelikeRun = RUN_STATE;
            break;
          case "difficulty":
            pass.difficultyId = condition.difficultyId;
            break;
          case "itemUsed":
            pass.itemUsedId = condition.itemId;
            break;
          case "insideLocation":
            pass.x = 1;
            pass.y = 1;
            break;
          case "all":
          case "any":
            for (const child of condition.conditions) {
              if (child.kind === "switch") pass.switches[child.switchId] = child.value;
            }
            break;
          case "not":
            // 내부 조건(sw_absent)이 거짓인 기본 세션에서 NOT 은 참이다.
            break;
        }
        // 조회 조건(명작 공백 G1)은 세션의 다른 칸을 읽는다 — 조건 값에 맞춰 채운다.
        const query: Record<string, unknown> = { x: 0, y: 0 };
        switch (condition.kind) {
          case "monsterSpecies":
            query.monsterInstances = { mon1: { id: "mon1", speciesId: condition.speciesId } };
            query.monsterParty = ["mon1"];
            break;
          case "actorStat":
            query.partyActorIds = [condition.actorId];
            query.actorLevels = { [condition.actorId]: condition.value };
            break;
          case "actorState":
            query.partyActorIds = [DEFAULT_ACTOR_ID];
            query.actorStateIds = { [DEFAULT_ACTOR_ID]: [condition.stateId] };
            break;
          case "partyLeader":
            query.partyActorIds = [condition.actorId];
            break;
          case "partyKnowsSkill":
            query.partyActorIds = [DEFAULT_ACTOR_ID];
            query.actorSkillIds = { [DEFAULT_ACTOR_ID]: [condition.skillId] };
            break;
          case "badgeCount":
            query.switches = { mx_badge_1: true };
            break;
          case "partySize":
            query.partyActorIds = Array.from({ length: condition.value }, (_, i) => `a${i}`);
            break;
          case "facing":
            query.playerFacing = condition.dir;
            break;
          case "relativeFacing":
            // 이벤트가 위를 보고 주인공은 그 아래(등 뒤)에 있다.
            query.eventLocations = { [event.id]: { mapId: "m", x: 0, y: 0, direction: "up" } };
            query.y = 1;
            query.currentMapId = "m";
            break;
          case "hiding":
            query.horror = { pursuits: {}, hiding: { mapId: "m", eventId: "closet", witnessedBy: [] } };
            break;
          case "pursuitActive":
            query.horror = { pursuits: { chaser: { active: true } } };
            break;
          case "eventSeesPlayer":
            // 이벤트가 (0,0) 에, 주인공은 바로 아래 (0,1) 에 있다.
            query.eventLocations = { [condition.eventId]: { mapId: "m", x: 0, y: 0, direction: "down" } };
            query.currentMapId = "m";
            query.y = 1;
            break;
          case "clearCount":
            query.clearHistory = { count: condition.value, endingIds: [] };
            break;
          case "endingSeen":
            query.clearHistory = { count: 1, endingIds: [condition.endingId] };
            break;
          case "newGamePlus":
            query.flags = { ngplus: true };
            break;
          case "weekday":
            query.gameTime = { minute: 0, hour: 12, day: 1, season: "spring", year: 1 };
            break;
          case "stringVariable":
            query.stringVariables = { [condition.stringVariableId]: condition.value };
            break;
          default:
            delete query.x;
            delete query.y;
        }
        const locationContext = condition.kind === "insideLocation"
          ? { locations: [{ id: "loc1", x: 0, y: 0, w: 4, h: 4 }] }
          : undefined;
        expect(resolveEventPage(event, { ...pass, ...query } as typeof pass, locationContext)?.id, `${kind} should pass matching session`).toBe("only");
      }
    });
  });
});

describe("pageItemCondition", () => {
  isolateTimers();
  function ensureEventWithPage(conditions: EventPage["conditions"] = []): {
    mapId: string;
    eventId: string;
    page: EventPage;
  } {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    if (!map) throw new Error("missing start map");
    const page: EventPage = {
      id: "page-item-1",
      name: "아이템 페이지",
      conditions: [...conditions],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    };
    const event: GameEvent = {
      id: "ev-item-cond",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: [page],
    };
    store.update((draft) => {
      const target = draft.maps[mapId];
      if (!target) return;
      target.events = [...target.events.filter((entry) => entry.id !== event.id), event];
    });
    const livePage = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === event.id)?.pages?.[0];
    if (!livePage) throw new Error("page not created");
    return { mapId, eventId: event.id, page: livePage };
  }
  describe("page item possession condition", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("체크만 켜도 기본 아이템 보유 조건을 비운 채 심는다", () => {
      const { mapId, eventId, page } = ensureEventWithPage();

      toggleSimpleCondition({ mapId, eventId, page }, "item", true);

      // 참조는 비운 채 세운다 — 첫 레코드는 사용자의 선택이 아니다(P0-2).
      // 빈 참조는 행의 「선택하세요」 오류와 초안 검증이 잡는다.
      const nextPage = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === eventId)?.pages?.[0];
      expect(nextPage?.conditions).toEqual([{ kind: "item", itemId: "", present: true }]);
    });

    it("아이템 보유 체크를 끄면 조건을 제거한다", () => {
      const firstItemId = store.getCurrent().database.items[0]?.id ?? "item_potion";
      const { mapId, eventId, page } = ensureEventWithPage([
        { kind: "item", itemId: firstItemId, present: true },
      ]);

      toggleSimpleCondition({ mapId, eventId, page }, "item", false);

      const nextPage = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === eventId)?.pages?.[0];
      expect(nextPage?.conditions ?? []).toEqual([]);
    });

    it("defaultSimpleCondition(item)은 빈 참조 + present:true 이다", () => {
      const seeded = defaultSimpleCondition("item");
      expect(seeded).toEqual({ kind: "item", itemId: "", present: true });
    });

    it("존재하지 않는 itemId도 셀렉트에 표시된다", () => {
      const root = renderWithFakeDom(() =>
        databaseRecordSelect({
          kind: "item",
          currentId: "missing-item",
          testId: "event-page-item-condition-input",
          onChange: () => {},
        })
      ) as FakeElement;
      const select = findByTestId(root, "event-page-item-condition-input");

      expect(select?.value).toBe("missing-item");
      expect(root.textContent).toContain("missing-item");
      expect(root.textContent).toContain("(없음)");
    });

    it("페이지 조건 행에서 아이템 셀렉트가 현재 값을 유지한다", () => {
      const firstItemId = store.getCurrent().database.items[0]?.id ?? "item_potion";
      const page: EventPage = {
        id: "page-1",
        name: "EV",
        conditions: [{ kind: "item", itemId: firstItemId, present: true }],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      };

      const root = renderWithFakeDom(() =>
        el("div", { children: renderPageConditions("map-start", "event-1", page) })
      );
      const select = findByTestId(root, "event-page-item-condition-input") as FakeElement & { value: string };
      expect(select?.tagName).toBe("SELECT");
      expect(select?.value).toBe(firstItemId);
      expect(root.textContent).toContain("보유 중");
    });

    it("셀프 스위치 첫 번째는 간단 행, 초과분/소지금은 고급 목록에", () => {
      const page: EventPage = {
        id: "page-1",
        name: "EV",
        conditions: [
          { kind: "selfSwitch", key: "A", value: true },
          { kind: "selfSwitch", key: "B", value: false },
          { kind: "gold", op: ">=", amount: 100 },
          { kind: "item", itemId: "item_potion", present: true },
          { kind: "item", itemId: "item_key", present: true },
        ],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      };

      const advanced = advancedConditionEntries(page);
      expect(advanced.map((entry) => entry.condition.kind)).toEqual(["selfSwitch", "gold", "item"]);
      expect(advanced[2]?.condition).toEqual({ kind: "item", itemId: "item_key", present: true });
    });
  });
});

describe("previewSimulation", () => {
  isolateTimers();
  describe("previewSimulation", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("returns empty steps for empty commands", () => {
      const result = simulatePageCommands([]);
      expect(result.steps).toHaveLength(0);
    });

    it("tracks setSwitch state changes", () => {
      const project = store.getCurrent();
      const switchId = project.switches[0]?.id ?? "sw_test";
      const commands: Command[] = [
        { kind: "setSwitch", switchId, value: true },
        { kind: "setSwitch", switchId, value: false },
      ];
      const result = simulatePageCommands(commands);
      expect(result.steps).toHaveLength(2);
      expect(getSimSwitch(result.steps[0]!.simState, switchId)).toBe(false);
      expect(getSimSwitch(result.steps[1]!.simState, switchId)).toBe(true);
      expect(getSimSwitch(result.finalState, switchId)).toBe(false);
    });

    it("tracks setVariable state changes", () => {
      const project = store.getCurrent();
      const variableId = project.variables[0]?.id ?? "var_0001";
      const commands: Command[] = [
        { kind: "setVariable", variableId, op: "=", value: 10 },
        { kind: "setVariable", variableId, op: "+=", value: 5 },
        { kind: "setVariable", variableId, op: "*=", value: 2 },
      ];
      const result = simulatePageCommands(commands);
      expect(getSimVariable(result.steps[0]!.simState, variableId)).toBe(0);
      expect(getSimVariable(result.steps[1]!.simState, variableId)).toBe(10);
      expect(getSimVariable(result.steps[2]!.simState, variableId)).toBe(15);
      expect(getSimVariable(result.finalState, variableId)).toBe(30);
    });

    it("tracks changeGold state changes", () => {
      const commands: Command[] = [
        { kind: "changeGold", op: "=", amount: 100 },
        { kind: "changeGold", op: "+=", amount: 50 },
        { kind: "changeGold", op: "-=", amount: 30 },
      ];
      const result = simulatePageCommands(commands);
      expect(result.steps[0]!.simState.gold).toBe(0);
      expect(result.steps[1]!.simState.gold).toBe(100);
      expect(result.steps[2]!.simState.gold).toBe(150);
      expect(result.finalState.gold).toBe(120);
    });

    it("tracks changeItem state changes", () => {
      const project = store.getCurrent();
      const itemId = project.database.items[0]?.id ?? "item_test";
      const commands: Command[] = [
        { kind: "changeItem", itemId, op: "+=", amount: 3 },
        { kind: "changeItem", itemId, op: "-=", amount: 1 },
      ];
      const result = simulatePageCommands(commands);
      expect(getSimItem(result.steps[0]!.simState, itemId)).toBe(0);
      expect(getSimItem(result.steps[1]!.simState, itemId)).toBe(3);
      expect(getSimItem(result.finalState, itemId)).toBe(2);
    });

    it("evaluates fork condition and marks taken branch", () => {
      const project = store.getCurrent();
      const switchId = project.switches[0]?.id ?? "sw_test";
      const commands: Command[] = [
        { kind: "setSwitch", switchId, value: true },
        {
          kind: "fork",
          condition: { kind: "switch", switchId, value: true },
          then: [{ kind: "text", body: "참" }],
          else: [{ kind: "text", body: "거짓" }],
        },
      ];
      const result = simulatePageCommands(commands, "ev_test");
      expect(result.steps).toHaveLength(4);

      const forkStep = result.steps.find((s) => s.command.kind === "fork");
      expect(forkStep).toBeTruthy();
      expect(forkStep!.forkTaken).toBe("then");

      const thenStep = result.steps.find((s) => s.branchLabel === "조건이 맞을 때" && !s.skipped);
      expect(thenStep).toBeTruthy();
      expect(thenStep!.skipped).toBeFalsy();

      const elseStep = result.steps.find((s) => s.branchLabel === "조건이 맞지 않을 때");
      expect(elseStep).toBeTruthy();
      expect(elseStep!.skipped).toBe(true);
    });

    it("evaluates fork condition false and takes else branch", () => {
      const project = store.getCurrent();
      const switchId = project.switches[0]?.id ?? "sw_test";
      const commands: Command[] = [
        {
          kind: "fork",
          condition: { kind: "switch", switchId, value: true },
          then: [{ kind: "text", body: "참" }],
          else: [{ kind: "text", body: "거짓" }],
        },
      ];
      const result = simulatePageCommands(commands, "ev_test");
      const forkStep = result.steps.find((s) => s.command.kind === "fork");
      expect(forkStep!.forkTaken).toBe("else");

      const elseStep = result.steps.find((s) => s.branchLabel === "조건이 맞지 않을 때" && !s.skipped);
      expect(elseStep).toBeTruthy();

      const thenStep = result.steps.find((s) => s.branchLabel === "조건이 맞을 때");
      expect(thenStep).toBeTruthy();
      expect(thenStep!.skipped).toBe(true);
    });

    it("tracks changeParty state changes", () => {
      const project = store.getCurrent();
      const actorId = project.database.actors[1]?.id ?? "actor_2";
      const commands: Command[] = [
        { kind: "changeParty", actorId, action: "add" },
        { kind: "changeParty", actorId, action: "remove" },
      ];
      const result = simulatePageCommands(commands);
      expect(result.steps[0]!.simState.partyActorIds).not.toContain(actorId);
      expect(result.steps[1]!.simState.partyActorIds).toContain(actorId);
      expect(result.finalState.partyActorIds).not.toContain(actorId);
    });

    it("tracks setSelfSwitch for host event", () => {
      const commands: Command[] = [
        { kind: "setSelfSwitch", key: "A", value: true },
      ];
      const result = simulatePageCommands(commands, "ev_test_123");
      expect(result.finalState.selfSwitches["ev_test_123"]?.["A"]).toBe(true);
    });

    it("skips state mutations in skipped branches", () => {
      const project = store.getCurrent();
      const switchId = project.switches[0]?.id ?? "sw_test";
      const commands: Command[] = [
        {
          kind: "fork",
          condition: { kind: "switch", switchId, value: true },
          then: [{ kind: "setSwitch", switchId, value: true }],
          else: [{ kind: "setSwitch", switchId, value: true }],
        },
      ];
      const result = simulatePageCommands(commands, "ev_test");
      expect(getSimSwitch(result.finalState, switchId)).toBe(true);

      const thenStep = result.steps.find((s) => s.branchLabel === "조건이 맞을 때" && s.command.kind === "setSwitch");
      expect(thenStep).toBeTruthy();
      expect(thenStep!.skipped).toBe(true);
    });

    it("tracks toggle switch value", () => {
      const project = store.getCurrent();
      const switchId = project.switches[0]?.id ?? "sw_test";
      const commands: Command[] = [
        { kind: "setSwitch", switchId, value: true },
        { kind: "setSwitch", switchId, value: "toggle" as never },
      ];
      const result = simulatePageCommands(commands);
      expect(getSimSwitch(result.finalState, switchId)).toBe(false);
    });

    it("marks insideLocation fork unknown without a map — never a fabricated else", () => {
      const commands: Command[] = [
        {
          kind: "fork",
          condition: { kind: "insideLocation", locationId: "loc_missing", inside: true },
          then: [{ kind: "text", body: "안" }],
          else: [{ kind: "text", body: "밖" }],
        },
      ];
      // 맵을 넘기지 않으면 로케이션 기하가 없어 판정 불가다.
      const result = simulatePageCommands(commands, "ev_test");
      const forkStep = result.steps.find((s) => s.command.kind === "fork");
      expect(forkStep!.forkTaken).toBe("unknown");
      // 양쪽 다 skipped — 어느 쪽도 「실행된다」고 단정하지 않는다.
      const thenStep = result.steps.find((s) => s.branchLabel === "조건이 맞을 때");
      const elseStep = result.steps.find((s) => s.branchLabel === "조건이 맞지 않을 때");
      expect(thenStep!.skipped).toBe(true);
      expect(elseStep!.skipped).toBe(true);
    });

    it("evaluates insideLocation against the given map — no start-map fallback", () => {
      const project = store.getCurrent();
      const mapId = project.startMapId;
      const map = project.maps[mapId];
      if (!map) throw new Error("missing start map");
      // 구역을 주인공 시작점 위에 놓는다 — 시작 세션 좌표가 그 안에 들어간다.
      const { x, y } = project.startPos;
      map.locations = [{ id: "loc_ev", name: "증거 구역", x: x - 1, y: y - 1, w: 4, h: 4 }];
      const commands: Command[] = [
        {
          kind: "fork",
          condition: { kind: "insideLocation", locationId: "loc_ev", inside: true },
          then: [{ kind: "text", body: "안" }],
          else: [{ kind: "text", body: "밖" }],
        },
      ];
      // 맵을 넘기면 실제 기하로 판정한다(폴백이 아니라 명시된 맵).
      const decided = simulatePageCommands(commands, "ev_test", mapId);
      expect(decided.steps.find((s) => s.command.kind === "fork")!.forkTaken).toBe("then");
      // 다른 맵 ID 를 넘기면 기하가 없어 판정 불가다 — 시작 맵으로 폴백하지 않는다.
      const fallback = simulatePageCommands(commands, "ev_test", "map_no_such");
      expect(fallback.steps.find((s) => s.command.kind === "fork")!.forkTaken).toBe("unknown");
    });

    it("does not leak taken-branch writes into sibling branch snapshots", () => {
      const project = store.getCurrent();
      const switchId = project.switches[0]?.id ?? "sw_test";
      const varId = project.variables[0]?.id ?? "var_test";
      const commands: Command[] = [
        {
          kind: "fork",
          condition: { kind: "switch", switchId, value: true },
          then: [{ kind: "setVariable", variableId: varId, op: "=", value: 7 }],
          else: [{ kind: "text", body: "거짓" }],
        },
      ];
      // 조건 거짓 → else taken. else 스텝의 before 스냅샷에 then 쓰기(7)가 스며들면 안 된다.
      const result = simulatePageCommands(commands, "ev_test");
      const forkStep = result.steps.find((s) => s.command.kind === "fork");
      expect(forkStep!.forkTaken).toBe("else");
      const elseStep = result.steps.find((s) => s.branchLabel === "조건이 맞지 않을 때");
      expect(getSimVariable(elseStep!.simState, varId)).toBe(0);
      expect(getSimVariable(result.finalState, varId)).toBe(0);
    });
  });
});

describe("recordPickerSharedControls", () => {
  isolateTimers();
  describe("shared record picker controls", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("actorPicker wires faceset subtitle and selected actor", () => {
      const project = store.getCurrent();
      const actorId = project.database.actors[0]?.id ?? "";
      const root = renderWithFakeDom(() =>
        actorPicker({ project, selectedId: actorId, testid: "shared-actor-select" }).root
      );
      expect(findByTestId(root, "shared-actor-select")?.value).toBe(actorId);
      expect(findByTestId(root, "shared-actor-select-card")?.textContent).toBeTruthy();
    });

    it("searchableRecordBrowser filters and selects by card", () => {
      const project = store.getCurrent();
      const weapons = project.database.equipment.filter((entry) => entry.slot === "weapon");
      const first = weapons[0];
      if (!first) throw new Error("missing weapon");

      let selected = first.id;
      const body = renderWithFakeDom(() => {
        const browser = searchableRecordBrowser({
          records: weapons,
          selectedId: first.id,
          testidPrefix: "shared-equip",
          selectTestId: "shared-equip-select",
          label: "장비",
          searchPlaceholder: "검색",
          emptySelectionLabel: "해제",
          noneCardLabel: "해제",
          noneCardMeta: "비우기",
          allowNone: true,
          subtitleOf: (record) => record.slot,
          onChange: (id) => {
            selected = id;
          },
        });
        return browser.root;
      });

      expect(findByTestId(body, "shared-equip-browser")).not.toBeNull();
      expect(findByTestId(body, "shared-equip-select")?.value).toBe(first.id);
      expect(findByTestId(body, `shared-equip-card-${first.id}`)).not.toBeNull();

      const search = findByTestId(body, "shared-equip-search") as FakeElement | null;
      if (search) {
        search.value = "zzzz-nope";
        search.dispatchEvent(new Event("input"));
      }
      expect(findByTestId(body, `shared-equip-card-${first.id}`)).toBeNull();

      if (search) {
        search.value = "";
        search.dispatchEvent(new Event("input"));
      }
      (findByTestId(body, "shared-equip-card-unequip") as FakeElement | null)?.dispatchEvent(new Event("click"));
      expect(selected).toBe("");
    });
  });
});

/**
 * 계약: **`화면 효과`(Screen Effect) 저작면은 런타임과 같은 것을 보여준다.**
 *
 * 회귀 배경(적대적 QA `.omo/evidence/screen-fx-2/qa-before.md`):
 *  - D1: `.ecp-screen-effect-*` CSS 가 저장소에 없어 오버레이 박스가 0×0 이었다.
 *        여기서는 레이아웃 대신 **클래스/인라인 계약**을 고정한다(CSS 는 실측 e2e 가 지킨다).
 *  - D2: 재생 컨트롤이 없어 durationMs 의 시각 차가 0 이었다 → 재생 버튼 + 불투명도 전이 계약.
 *  - D3: `#xyz` 같은 값에서 프리뷰가 rgba(0,0,0,0) 이었다 → 런타임 폴백(흰색 워시) + 사유 표시.
 *  - D4: 빈 tint 를 프리뷰는 빨강 불투명, 런타임은 `neutral`(색조 제거)로 읽었다.
 *
 * 폼(색 피커·시간 범위)과 목록 요약은 test/screenEffectFields.test.ts 가 지킨다.
 */
describe("screenEffectAuthoring", () => {
  isolateTimers();
  const SCREEN_EFFECT_ID = "m2-202-screen-effect";
  function screenEffect(fields: Record<string, unknown>): Command {
    return { kind: "m2Command", commandId: SCREEN_EFFECT_ID, fields } as unknown as Command;
  }
  function previewOf(fields: Record<string, unknown>): FakeElement {
    return renderWithFakeDom(() => renderCommandPreview(screenEffect(fields)));
  }
  function numberOf(value: string): number {
    return Number.parseFloat(value);
  }
  describe("screen effect authoring — stage and play control", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom({ animationFrames: "manual" });
      store.replace(createBlankProject());
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("stage keeps the mini-monitor class contract so CSS can size the overlay (D1)", () => {
      const preview = previewOf({ effect: "fadeOut", value: "", durationMs: 600 });
      const stage = findByTestId(preview, "ecp-screen-effect-stage");
      expect(stage).toBeTruthy();
      const screen = findByTestId(preview, "ecp-screen-effect-screen");
      const overlay = findByTestId(preview, "ecp-screen-effect-overlay");
      expect(screen?.className).toContain("ecp-screen-effect-screen");
      expect(overlay?.className).toContain("ecp-screen-effect-overlay");
      // 장면(가짜 게임 화면)이 있어야 효과가 덮이는 것이 보인다.
      expect(findByTestId(preview, "ecp-screen-effect-scene")).toBeTruthy();
      // 정지 상태에서도 효과의 도착 상태를 보여준다 — 흰 빈 사각형 금지.
      expect(numberOf(overlay?.style.opacity ?? "0")).toBeGreaterThan(0.5);
      expect(overlay?.style.background).toContain("rgba(0,0,0,1)");
    });

    it("play control replays the effect from its start state for durationMs (D2)", () => {
      const preview = previewOf({ effect: "fadeOut", value: "", durationMs: 900 });
      const play = findByTestId(preview, "ecp-screen-effect-play");
      const stage = findByTestId(preview, "ecp-screen-effect-stage");
      const overlay = findByTestId(preview, "ecp-screen-effect-overlay");
      expect(play).toBeTruthy();
      const rest = numberOf(overlay?.style.opacity ?? "0");

      play?.click();
      expect(stage?.dataset.playState).toBe("playing");
      expect(overlay?.className).toContain("is-fx-from");
      const start = numberOf(overlay?.style.opacity ?? "1");
      expect(start).toBeLessThan(rest);
      // 전이 시간은 durationMs 를 그대로 쓴다(clampMs 의미로 묶은 값).
      expect(stage?.style["--ecp-fx-duration"]).toBe("900ms");

      flushFakeAnimationFrames();
      expect(overlay?.className).not.toContain("is-fx-from");
      const end = numberOf(overlay?.style.opacity ?? "0");
      expect(end - start).toBeGreaterThan(0.3);
      expect(end).toBe(rest);
    });

    it("empty tint value previews the runtime's neutral tone-reset, not opaque red (D4)", () => {
      const preview = previewOf({ effect: "tint", value: "", durationMs: 300 });
      const overlay = findByTestId(preview, "ecp-screen-effect-overlay");
      expect(overlay?.className).toContain("is-fx-neutral");
      expect(overlay?.style.background).not.toContain("#ff0000");
      expect(preview.textContent).toContain("색조 제거");
    });

    it("full-strength hex tint previews at the runtime alpha (D4)", () => {
      const preview = previewOf({ effect: "tint", value: "#39ff14", durationMs: 300 });
      const overlay = findByTestId(preview, "ecp-screen-effect-overlay");
      expect(overlay?.style.background).toBe("rgba(57,255,20,0.45)");
    });

    it("letterbox preview draws the bars and parks the message line on their inner edge", () => {
      const preview = previewOf({ effect: "letterbox", value: "12", durationMs: 800 });
      const top = findByTestId(preview, "ecp-screen-effect-letterbox-top");
      const bottom = findByTestId(preview, "ecp-screen-effect-letterbox-bottom");
      const line = findByTestId(preview, "ecp-screen-effect-letterbox-line");
      expect(top?.style.height).toBe("12%");
      expect(bottom?.style.height).toBe("12%");
      expect(line?.style.bottom).toBe("12%");
      expect(preview.textContent).toContain("레터박스");
      expect(preview.textContent).toContain("위아래 12%");
      expect(preview.textContent).not.toContain("letterbox");

      findByTestId(preview, "ecp-screen-effect-play")?.click();
      expect(top?.className).toContain("is-fx-from");
      expect(top?.style.height).toBe("0%");
      expect(line?.style.bottom).toBe("0%");
      flushFakeAnimationFrames();
      expect(top?.className).not.toContain("is-fx-from");
      expect(top?.style.height).toBe("12%");
      expect(line?.style.bottom).toBe("12%");
      expect(findByTestId(preview, "ecp-screen-effect-stage")?.style["--ecp-fx-duration"]).toBe("800ms");
    });

    it("an empty letterbox value previews the runtime default thickness", () => {
      const preview = previewOf({ effect: "letterbox", value: "", durationMs: 300 });
      expect(findByTestId(preview, "ecp-screen-effect-letterbox-top")?.style.height).toBe("12%");
    });

    it("a letterbox thicker than the runtime cap previews the capped bars", () => {
      const preview = previewOf({ effect: "letterbox", value: "40", durationMs: 300 });
      expect(findByTestId(preview, "ecp-screen-effect-letterbox-bottom")?.style.height).toBe("25%");
      expect(preview.textContent).toContain("위아래 25%");
    });

    it("clear letterbox rests with the bars gone and the message line at the bottom", () => {
      const preview = previewOf({ effect: "clearLetterbox", value: "", durationMs: 400 });
      expect(findByTestId(preview, "ecp-screen-effect-letterbox-top")?.style.height).toBe("0%");
      expect(findByTestId(preview, "ecp-screen-effect-letterbox-line")?.style.bottom).toBe("0%");
      expect(preview.textContent).toContain("레터박스 걷기");
      expect(preview.textContent).toContain("띠가 걷힌 뒤");
    });

    it("invalid tint previews the runtime fallback (white wash) and says so (D3)", () => {
      const preview = previewOf({ effect: "tint", value: "#xyz", durationMs: 300 });
      const overlay = findByTestId(preview, "ecp-screen-effect-overlay");
      // parseTintColor("#xyz") → screenColorToRgb 폴백 = 흰색 45%. 투명 검정 금지.
      expect(overlay?.style.background).toBe("rgba(255,255,255,0.45)");
      expect(findByTestId(preview, "ecp-screen-effect-error")?.textContent).toContain("#xyz");
    });
  });
  /**
   * D5(3라운드): 명령 행 한 번 클릭으로 열리는 우측 인스펙터에는 프리뷰가 아예 없었다.
   * 스테이지는 Space 로 여는 편집 모달에만 있었고, 인스펙터의 `↻ 미리보기 새로고침` 버튼은
   * 빈 약속이었다(누르면 프리뷰 없는 패널을 다시 그림).
   */
  describe("screen effect authoring — inline inspector preview (D5)", () => {
    let restoreDom: (() => void) | undefined;

    const noopActions: CommandListActions = {
      addCommand: () => {},
      insertCommand: () => {},
      replaceCommand: () => {},
      deleteCommand: () => {},
      moveCommand: () => {},
      moveCommandTo: () => {},
    };

    function openInspector(fields: Record<string, unknown>): FakeElement {
      const host = new FakeElement("div");
      setCommandInspectorHost(host as unknown as HTMLElement);
      showCommandInspector({ command: screenEffect(fields), path: [0], actions: noopActions });
      return host;
    }

    beforeEach(() => {
      restoreDom = installFakeDom({ animationFrames: "manual" });
      store.replace(createBlankProject());
    });

    afterEach(() => {
      clearCommandInspector();
      setCommandInspectorHost(undefined);
      restoreDom?.();
    });

    it("renders the same stage and play control the edit modal has", () => {
      const host = openInspector({ effect: "fadeOut", value: "", durationMs: 900 });
      expect(findByTestId(host, "event-inspector-preview")).toBeTruthy();
      expect(findByTestId(host, "ecp-screen-effect-stage")).toBeTruthy();
      expect(findByTestId(host, "ecp-screen-effect-play")).toBeTruthy();
    });

    it("plays the effect inside the inspector", () => {
      const host = openInspector({ effect: "fadeOut", value: "", durationMs: 900 });
      const stage = findByTestId(host, "ecp-screen-effect-stage");
      findByTestId(host, "ecp-screen-effect-play")?.click();
      expect(stage?.dataset.playState).toBe("playing");
      flushFakeAnimationFrames();
      expect(findByTestId(host, "ecp-screen-effect-overlay")?.className).not.toContain("is-fx-from");
    });

    it("refresh button redraws a stage instead of an empty panel", () => {
      const host = openInspector({ effect: "flash", value: "white", durationMs: 400 });
      const refresh = findByTestId(host, "event-inspector-preview-restart");
      expect(refresh).toBeTruthy();
      refresh?.click();
      const preview = findByTestId(host, "event-inspector-preview");
      expect(preview?.childNodes.length ?? 0).toBeGreaterThan(0);
      expect(findByTestId(host, "ecp-screen-effect-stage")).toBeTruthy();
      // 새로고침은 폼을 날리지 않는다 — 값 입력이 그대로 남아야 한다.
      expect(findByTestId(host, "m2-command-value-input")).toBeTruthy();
    });
  });
});

describe("setVariableCommandBody", () => {
  isolateTimers();
  describe("setVariable command body + runtime", () => {
    let restoreDom: (() => void) | undefined;
    let replaced: Command | undefined;

    const actions: CommandListActions = {
      addCommand: () => {},
      insertCommand: () => {},
      replaceCommand: (_path, command) => {
        replaced = command;
      },
      deleteCommand: () => {},
      moveCommand: () => {},
      moveCommandTo: () => {},
    };

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
      replaced = undefined;
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("applies number operand and op segment changes into replaceCommand", () => {
      const project = store.getCurrent();
      const variableId = project.variables[0]?.id ?? "var_0001";
      const body = renderWithFakeDom(() =>
        renderCommandBody(
          { path: [0], actions, lockKind: true },
          { kind: "setVariable", variableId, op: "=", value: 0 }
        )
      );

      const numberInput = findByTestId(body, "event-command-variable-number-value") as FakeElement | null;
      expect(numberInput).toBeTruthy();
      if (!numberInput) return;
      numberInput.value = "42";
      numberInput.dispatchEvent(new Event("change"));
      expect(replaced).toMatchObject({
        kind: "setVariable",
        variableId,
        op: "=",
        value: 42,
      });

      const opSelect = findByTestId(body, "event-command-variable-op") as FakeElement | null;
      expect(opSelect).toBeTruthy();
      if (!opSelect) return;
      opSelect.value = "+=";
      opSelect.dispatchEvent(new Event("change"));
      expect(replaced).toMatchObject({
        kind: "setVariable",
        variableId,
        op: "+=",
        value: 42,
      });
    });

    it("switches to variable operand picker and stores var operand", () => {
      const project = store.getCurrent();
      const variableId = project.variables[0]?.id ?? "var_0001";
      // Ensure at least one variable exists for operand selection.
      if (project.variables.length < 1) {
        project.variables.push({ id: "var_0001", name: "테스트" });
        store.replace(project);
      }
      const body = renderWithFakeDom(() =>
        renderCommandBody(
          { path: [0], actions, lockKind: true },
          { kind: "setVariable", variableId, op: "=", value: 3 }
        )
      );

      const source = findByTestId(body, "event-command-variable-value-source") as FakeElement | null;
      expect(source).toBeTruthy();
      if (!source) return;
      source.value = "variable";
      source.dispatchEvent(new Event("change"));

      expect(replaced).toMatchObject({
        kind: "setVariable",
        variableId,
        op: "=",
        value: { kind: "var", id: "" },
      });

      // Operand picker select lives inside event-command-variable-operand.
      const operandHost = findByTestId(body, "event-command-variable-operand") as FakeElement | null;
      expect(operandHost).toBeTruthy();
      const operandSelect =
        (operandHost as unknown as { querySelector?: (s: string) => FakeElement | null })?.querySelector?.("select")
        ?? null;
      // FakeDom may expose select as first select child via child walk.
      const selectNode = operandSelect ?? findFirstSelect(operandHost);
      expect(selectNode).toBeTruthy();
      if (!selectNode) return;
      selectNode.value = variableId;
      selectNode.dispatchEvent(new Event("change"));
      expect(replaced).toMatchObject({
        kind: "setVariable",
        variableId,
        value: { kind: "var", id: variableId },
      });
    });

    it("rerenders form when value source or op changes", () => {
      const base: Command = { kind: "setVariable", variableId: "var_a", op: "=", value: 1 };
      expect(
        shouldRerenderCommandForm(base, { kind: "setVariable", variableId: "var_a", op: "=", value: { kind: "var", id: "var_b" } })
      ).toBe(true);
      expect(
        shouldRerenderCommandForm(base, { kind: "setVariable", variableId: "var_a", op: "+=", value: 1 })
      ).toBe(true);
      expect(
        shouldRerenderCommandForm(base, { kind: "setVariable", variableId: "var_a", op: "=", value: 9 })
      ).toBe(false);
    });

    it("formatVariableFormula is readable for authors", () => {
      store.getCurrent().variables[0] = { id: "var_0001", name: "점수" };
      expect(
        formatVariableFormula({ kind: "setVariable", variableId: "var_0001", op: "*=", value: 3 })
      ).toContain("×=");
      expect(
        formatVariableFormula({ kind: "setVariable", variableId: "", op: "=", value: 0 })
      ).toContain("[변수 선택]");
    });

    it("runtime setVariable ops match contract including divide-by-zero keep", () => {
      const session = startSession(store.getCurrent());
      setVariable(session, "v", "=", 7);
      setVariable(session, "v", "+=", 5);
      setVariable(session, "v", "-=", 2);
      setVariable(session, "v", "*=", 3);
      setVariable(session, "v", "/=", 4);
      expect(session.variables.v).toBe(7); // floor(((7+5-2)*3)/4)
      setVariable(session, "v", "/=", 0);
      expect(session.variables.v).toBe(7);
    });
  });
  function findFirstSelect(root: FakeElement | null): FakeElement | null {
    if (!root) return null;
    const nodes = root.childNodes ?? [];
    for (const node of nodes) {
      const el = node as FakeElement;
      if (String(el.tagName ?? "").toLowerCase() === "select") return el;
      const nested = findFirstSelect(el);
      if (nested) return nested;
    }
    return null;
  }
});

describe("timerConditionOp", () => {
  isolateTimers();
  function page(conditions: EventPage["conditions"]): EventPage {
    return {
      id: "page-1",
      name: "검사 페이지",
      conditions: [...conditions],
      graphic: {},
      trigger: { kind: "action" },
      priority: "below",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", body: "hello" }],
    };
  }
  function gameEvent(eventPage: EventPage): GameEvent {
    return {
      id: "event-test",
      x: 1,
      y: 1,
      trigger: eventPage.trigger,
      commands: [],
      pages: [eventPage],
    };
  }
  describe("timer condition operator", () => {
    let restoreDom: (() => void) | undefined;
    let replaced: Command | undefined;
    const actions: CommandListActions = {
      addCommand: () => {},
      insertCommand: () => {},
      replaceCommand: (_path, command) => { replaced = command; },
      deleteCommand: () => {},
      moveCommand: () => {},
      moveCommandTo: () => {},
    };

    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
      replaced = undefined;
    });

    afterEach(() => {
      restoreDom?.();
    });

    it("treats an idle timer as 0 against the stored operator", () => {
      expect(idleTimerSatisfies({ kind: "timer", timerId: "timer1", seconds: 60 })).toBe(true);
      expect(idleTimerSatisfies({ kind: "timer", timerId: "timer1", seconds: 0 })).toBe(true);
      expect(idleTimerSatisfies({ kind: "timer", timerId: "timer1", seconds: 0, op: ">" })).toBe(false);
      expect(idleTimerSatisfies({ kind: "timer", timerId: "timer1", seconds: 30, op: ">=" })).toBe(false);
      expect(idleTimerWarningMessage({ kind: "timer", timerId: "timer1", seconds: 90 })).toContain("90초 이하");
      expect(idleTimerWarningMessage({ kind: "timer", timerId: "timer1", seconds: 0, op: ">" })).toBeNull();
    });

    it("warns for a positive less-than-or-equal threshold and stays quiet for greater-than zero", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const idle = gameEvent(page([{ kind: "timer", timerId: "timer1", seconds: 60 }]));
      project.maps[mapId]!.events = [idle];
      const idleIssue = validateEventDraftBody(project, mapId, idle).issues.find((issue) => issue.code === "condition.timer.always-true");
      expect(idleIssue?.message).toContain("60초 이하");
      expect(idleIssue?.message).toContain("페이지가 타이머를 켜기 전에");

      const running = gameEvent(page([{ kind: "timer", timerId: "timer1", seconds: 0, op: ">" }]));
      project.maps[mapId]!.events = [running];
      expect(validateEventDraftBody(project, mapId, running).issues.some((issue) => issue.code === "condition.timer.always-true")).toBe(false);
    });

    it("rebuilds the fork dialog when the timer threshold or operator changes", () => {
      const base = { kind: "fork" as const, condition: { kind: "timer" as const, timerId: "timer1" as const, seconds: 0 }, then: [] };
      expect(shouldRerenderCommandForm(base, { ...base, condition: { ...base.condition, seconds: 90 } })).toBe(true);
      expect(shouldRerenderCommandForm(base, { ...base, condition: { ...base.condition, op: ">" } })).toBe(true);
      expect(shouldRerenderCommandForm(base, base)).toBe(false);
    });

    it("keeps a greater-than operator when the fork timer seconds change", () => {
      const body = renderWithFakeDom(() => renderCommandBody(
        { path: [0], actions, lockKind: true },
        {
          kind: "fork",
          condition: { kind: "timer", timerId: "timer1", seconds: 0, op: ">" },
          then: [],
        },
      ));
      expect(findByTestId(body, "event-fork-timer-warning")).toBeNull();
      expect(body.textContent).toContain("초 초과");
      const minutes = findByTestId(body, "event-condition-timer-minutes");
      expect(minutes).toBeTruthy();
      minutes!.value = "1";
      minutes!.dispatchEvent(new Event("change"));
      expect(replaced).toMatchObject({
        kind: "fork",
        condition: { kind: "timer", timerId: "timer1", seconds: 60, op: ">" },
      });
      const op = findByTestId(body, "event-condition-timer-op");
      expect(op?.value).toBe(">");
      op!.value = ">=";
      op!.dispatchEvent(new Event("change"));
      expect(replaced).toMatchObject({
        kind: "fork",
        condition: { kind: "timer", timerId: "timer1", seconds: 60, op: ">=" },
      });
    });

    it("names a 90 second less-than-or-equal fork instead of calling it zero seconds", () => {
      const body = renderWithFakeDom(() => renderCommandBody(
        { path: [0], actions, lockKind: true },
        { kind: "fork", condition: { kind: "timer", timerId: "timer1", seconds: 90 }, then: [] },
      ));
      const warning = findByTestId(body, "event-fork-timer-warning");
      expect(warning?.textContent).toContain("90초 이하");
      expect(warning?.textContent).toContain("0초로 읽어");
      expect(warning?.textContent).not.toContain("임계값");
    });

    it("keeps a greater-than operator when the page timer seconds change", () => {
      const project = store.getCurrent();
      const mapId = project.startMapId;
      const event = gameEvent(page([{ kind: "timer", timerId: "timer1", seconds: 5, op: ">" }]));
      project.maps[mapId]!.events = [event];
      store.replace(project);
      const live = store.getCurrent().maps[mapId]!.events.find((entry) => entry.id === event.id)!.pages![0]!;
      const host = renderWithFakeDom(() => el("div", { children: renderPageConditions(mapId, event.id, live) }));
      expect(host.textContent).toContain("초과");
      const seconds = findByTestId(host, "event-page-timer1-condition-seconds");
      expect(seconds).toBeTruthy();
      seconds!.value = "12";
      seconds!.dispatchEvent(new Event("change"));
      const saved = store.getCurrent().maps[mapId]!.events.find((entry) => entry.id === event.id)!.pages![0]!.conditions;
      expect(saved).toEqual([{ kind: "timer", timerId: "timer1", seconds: 12, op: ">" }]);
    });
  });
});

describe("ux2EventMutationIsolation", () => {
  isolateTimers();
  function event(id: string): GameEvent {
    const result: GameEvent = { id, x: 2, y: 2, trigger: { kind: "action" }, commands: [] };
    const page = createDefaultEventPage(result, 1);
    page.id = "page";
    page.commands = [
      { kind: "fork", condition: { kind: "switch", switchId: "sw_0001", value: true }, then: [{ kind: "text", body: "child" }], else: [{ kind: "text", body: "other" }] },
      { kind: "text", body: "second" },
      { kind: "text", body: "third" },
    ];
    result.pages = [page];
    return result;
  }
  let mapId: string;
  beforeEach(() => {
    const project = createBlankProject();
    mapId = project.startMapId;
    const target = event("ux2-target");
    target.draft = { kind: "edit", original: structuredClone(target) };
    const map = project.maps[mapId]!;
    map.lowerOverlayTiles = Array(map.lowerTiles.length).fill(-1);
    map.upperOverlayTiles = Array(map.lowerTiles.length).fill(-1);
    map.shadowBits = Array(map.lowerTiles.length).fill(0);
    map.lowerTileStacks = { 0: [1, 2] };
    map.upperTileStacks = { 0: [3, 4] };
    map.events = [target, event("ux2-other")];
    store.replaceProject(project);
    clearCommandToolbarHistories(`${mapId}:ux2-target:`);
  });
  const current = () => store.getCurrent().maps[mapId]!.events[0]!;
  const commands = () => current().pages![0]!.commands;
  describe("event-only copy on write", () => {
    it("keeps every grid/other event identity and leaves old published/draft originals intact", () => {
      const before = store.getCurrent();
      const beforeValue = structuredClone(before.maps[mapId]!.events[0]);
      const map = before.maps[mapId]!;
      moveEventPageCommandAt(mapId, "ux2-target", "page", [1], 1);
      const after = store.getCurrent();
      expect(after.maps[mapId]).not.toBe(map);
      for (const key of ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles", "shadowBits", "lowerTileStacks", "upperTileStacks"] as const) {
        expect(after.maps[mapId]![key]).toBe(map[key]);
      }
      expect(after.maps[mapId]!.events[1]).toBe(map.events[1]);
      expect(after.database).toBe(before.database);
      expect(commands()[0]).toBe(map.events[0]!.pages![0]!.commands[0]);
      replaceEventPageCommandAt(mapId, "ux2-target", "page", [0, FORK_THEN_BRANCH_INDEX, 0], { kind: "text", body: "new child" });
      expect(map.events[0]).toEqual(beforeValue);
      expect(current().draft!.original).toEqual(beforeValue!.draft!.original);
      const priorEvent = current();
      store.updateEvent(mapId, "ux2-target", draft => {
        draft.draft!.original!.pages![0]!.commands[0] = { kind: "text", body: "isolated draft original" };
      });
      expect(priorEvent.draft!.original).toEqual(beforeValue!.draft!.original);
      expect(map.events[0]).toEqual(beforeValue);
    });

    it("copies choice option owners and only selected branch arrays before splicing", () => {
      const original: Command[] = [{ kind: "choices", options: [{ text: "a", branch: [{ kind: "text", body: "a" }] }, { text: "b", branch: [] }] }];
      const next = cloneCommandContainersForMove(original, [[0, 0], [0, 1]]);
      const choices = next[0] as Extract<Command, { kind: "choices" }>;
      choices.options[0]!.branch.pop();
      choices.options[1]!.branch.push({ kind: "text", body: "moved" });
      expect((original[0] as typeof choices).options[0]!.branch).toHaveLength(1);
      expect((original[0] as typeof choices).options[1]!.branch).toHaveLength(0);
    });

    it("resolves both cross-move containers before ancestor indices change and rejects self drops", () => {
      const before = store.getCurrent();
      moveEventPageCommandAcross(mapId, "ux2-target", "page", [0, FORK_THEN_BRANCH_INDEX, 0], [0, FORK_ELSE_BRANCH_INDEX], 1);
      const fork = commands()[0] as Extract<Command, { kind: "fork" }>;
      expect(fork.then).toEqual([]);
      expect(fork.else).toEqual([{ kind: "text", body: "other" }, { kind: "text", body: "child" }]);
      expect((before.maps[mapId]!.events[0]!.pages![0]!.commands[0] as typeof fork).then).toHaveLength(1);
      const moved = store.getCurrent();
      moveEventPageCommandAcross(mapId, "ux2-target", "page", [0], [0, FORK_THEN_BRANCH_INDEX], 0);
      expect(store.getCurrent()).toBe(moved);
      replaceEventPageCommands(mapId, "ux2-target", "page", [{ kind: "text", body: "source" }, fork]);
      const old = store.getCurrent();
      moveEventPageCommandAcross(mapId, "ux2-target", "page", [0], [1, FORK_THEN_BRANCH_INDEX], 0);
      expect(commands()).toHaveLength(1);
      expect((commands()[0] as typeof fork).then).toEqual([{ kind: "text", body: "source" }]);
      expect(old.maps[mapId]!.events[0]!.pages![0]!.commands).toHaveLength(2);
    });

    it("does no preparation/emit for boundary moves; immutable history has no full-page snapshot clones", () => {
      const history = createCommandToolbarHistory({ key: `${mapId}:ux2-target:page`, immutableSnapshots: true, readCommands: commands,
        replaceCommands: next => replaceEventPageCommands(mapId, "ux2-target", "page", next) });
      const action = history.wrapActions({ addCommand() {}, insertCommand() {}, replaceCommand() {}, deleteCommand() {},
        moveCommand: (path, dir) => moveEventPageCommandAt(mapId, "ux2-target", "page", path, dir), moveCommandTo() {} });
      const before = store.getCurrent();
      const emit = vi.fn(); const unsubscribe = store.subscribe(emit);
      action.moveCommand([0], -1);
      expect(store.getCurrent()).toBe(before);
      expect(emit).not.toHaveBeenCalled();
      expect(history.canUndo()).toBe(false);
      const clone = vi.spyOn(globalThis, "structuredClone");
      action.moveCommand([1], 1);
      // Vault may clone this draft event. It must not clone the page command tree.
      expect(clone.mock.calls.some(([value]) => value === before.maps[mapId]!.events[0]!.pages![0]!.commands)).toBe(false);
      clone.mockRestore();
      history.undo(); expect(commands()).toEqual(before.maps[mapId]!.events[0]!.pages![0]!.commands);
      history.redo(); expect(commands()[1]).toEqual({ kind: "text", body: "third" });
      replaceEventPageCommandAt(mapId, "ux2-target", "page", [1], { kind: "text", body: "later" });
      expect(before.maps[mapId]!.events[0]!.pages![0]!.commands[1]).toEqual({ kind: "text", body: "second" });
      unsubscribe();
    });
  });
});
