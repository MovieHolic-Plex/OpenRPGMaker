// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import type { EventPage, GameEvent, Command } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";
import { CHARSET_FRAME_HEIGHT, CHARSET_FRAME_WIDTH, CHARSET_SHEET_COLUMNS, CHARSET_SHEET_ROWS, charsetFrameSource } from "@/assets/easyrpgRtp";
import { charsetIconOf, facesetIconOf } from "@/editor/panels/eventEditor/recordPicker";
import { actorPicker, itemPicker, mapPicker, mapSelectElement } from "@/editor/panels/eventEditor/sharedPickers";
import { showEmoteBody } from "@/editor/panels/eventEditor/commandBodyPage3Native";
import { EMOTE_KINDS, EMOTE_MAX_DURATION_MS, emoteFrameIndex } from "@/project/emotes";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { openDatabaseResourcePickerDialog, resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { playAudioBodyForTest } from "@/editor/panels/eventEditor/commandBodyAdvanced";
import { renderM2CommandBody } from "@/editor/panels/eventEditor/commandBodyM2";
import { renderMapProps } from "@/editor/panels/mapProps";
import { audioCommandContext } from "./support/audioSearchFixture";

describe("content", () => {
  isolateTimers();
  // 우선순위와 겹침은 런타임 통행 판정식(`priority === "same" && overlapForbidden`)의 두 반쪽이다.
  // 한 그룹에서 함께 보이고, 판정에 안 쓰이는 상태를 살아있는 것처럼 보이지 않게 하는 계약.
  describe("eventPagePassageGroup", () => {
    isolateTimers();
    function seed(pageOverrides: Partial<EventPage> = {}): string {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId]!;
      map.events = [
        {
          id: "ev_passage",
          x: 2,
          y: 3,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            {
              id: "p1",
              name: "통행",
              conditions: [],
              graphic: {},
              trigger: { kind: "action" },
              priority: "same",
              overlapForbidden: true,
              movement: { type: "fixed", speed: 3, frequency: 3 },
              commands: [],
              ...pageOverrides,
            } as EventPage,
          ],
        },
      ];
      store.replace(project);
      editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
      return mapId;
    }
    describe("겹침과 통행 그룹", () => {
      let host: HTMLElement;

      beforeEach(() => {
        host = document.createElement("div");
        document.body.append(host);
      });

      afterEach(() => {
        host.remove();
      });

      it("우선순위 select 가 겹침과 같은 memory 그룹에 있다", () => {
        renderEventEditorDynamic(host, seed(), "ev_passage");
        const priority = host.querySelector<HTMLElement>("[data-testid='event-page-priority-select']");
        expect(priority).toBeTruthy();
        expect(priority!.closest("[data-testid='evt-rail-group-memory']")).toBeTruthy();
        expect(priority!.closest("[data-testid='evt-rail-group-when']")).toBeNull();
      });

      it("같은 층이면 겹침 체크가 살아 있고 안내문이 판정에 쓰인다고 말한다", () => {
        renderEventEditorDynamic(host, seed({ priority: "same" }), "ev_passage");
        const overlap = host.querySelector<HTMLInputElement>("[data-testid='event-page-overlap-forbidden']");
        expect(overlap!.disabled).toBe(false);
        expect(host.querySelector("[data-testid='event-page-overlap-priority-hint']")!.textContent).toContain(
          "통행 판정에 쓰입니다",
        );
      });

      it("맵 아래/맵 위면 겹침 체크를 잠그고 왜 안 막히는지 알려 준다", () => {
        for (const priority of ["below", "above"] as const) {
          host.replaceChildren();
          renderEventEditorDynamic(host, seed({ priority }), "ev_passage");
          const overlap = host.querySelector<HTMLInputElement>("[data-testid='event-page-overlap-forbidden']");
          expect(overlap!.disabled, priority).toBe(true);
          const hint = host.querySelector("[data-testid='event-page-overlap-priority-hint']")!.textContent ?? "";
          expect(hint, priority).toContain("통행을 막지 않습니다");
          expect(hint, priority).toContain(priority === "below" ? "맵 아래" : "맵 위");
          // 헤더 요약도 «겹침 금지» 라고 거짓말하지 않는다.
          expect(host.querySelector("[data-testid='evt-rail-meta-memory']")!.textContent, priority).toContain("통행 허용");
        }
      });

      it("층을 옮겼으면 그룹에 손댄 표시(점)가 뜬다", () => {
        renderEventEditorDynamic(host, seed({ priority: "below", overlapForbidden: true }), "ev_passage");
        expect(host.querySelector("[data-testid='evt-rail-dot-memory']")).toBeTruthy();
      });

      it("기타 그룹이 생기지 않고 레일 순서는 그대로다", () => {
        renderEventEditorDynamic(host, seed(), "ev_passage");
        expect(host.querySelector("[data-testid='evt-rail-group-other']")).toBeNull();
        const rail = host.querySelector<HTMLElement>("[data-testid='event-editor-settings-accordion']");
        expect([...rail!.children].map((node) => (node as HTMLElement).dataset.railGroup)).toEqual([
          "look-talk",
          "when",
          "move",
          "memory",
          "npc",
        ]);
      });
    });
  });
  // 레일은 한 번에 한 그룹만 연다. 나머지 넷은 접혀 있으므로, 어느 그룹에 저작자가
  // 손댄 내용이 있는지 열어 보지 않고도 알 수 있어야 한다. 기본값 그대로인 그룹과
  // 값이 들어간 그룹을 점 하나로 가른다.
  describe("eventRailAuthoredDot", () => {
    isolateTimers();
    function seed(page: Partial<EventPage> = {}, event: Partial<GameEvent> = {}): string {
      const project = createBlankProject();
      const mapId = project.startMapId;
      project.maps[mapId]!.events = [
        {
          id: "ev_dot",
          x: 2,
          y: 3,
          trigger: { kind: "action" },
          commands: [],
          ...event,
          pages: [
            {
              id: "p1",
              name: "점",
              conditions: [],
              graphic: {},
              trigger: { kind: "action" },
              priority: "same",
              overlapForbidden: true,
              movement: { type: "fixed", speed: 3, frequency: 3 },
              commands: [],
              ...page,
            } as EventPage,
          ],
        } as GameEvent,
      ];
      store.replace(project);
      editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
      return mapId;
    }
    function hasDot(host: HTMLElement, slug: string): boolean {
      const group = host.querySelector<HTMLElement>(`[data-testid='evt-rail-group-${slug}']`);
      return Boolean(group?.querySelector(`[data-testid='evt-rail-dot-${slug}']`));
    }
    describe("레일 그룹 저작 표시 점", () => {
      let host: HTMLElement;

      beforeEach(() => {
        host = document.createElement("div");
        document.body.append(host);
      });

      afterEach(() => {
        host.remove();
      });

      it("기본값뿐인 페이지에는 점이 하나도 없다", () => {
        const mapId = seed();
        renderEventEditorDynamic(host, mapId, "ev_dot");
        for (const slug of ["look-talk", "when", "move", "memory", "npc"]) {
          expect(hasDot(host, slug), slug).toBe(false);
        }
      });

      it("조건을 넣으면 when 그룹에만 점이 붙는다", () => {
        const mapId = seed({ conditions: [{ kind: "switch", switchId: "sw_0001", value: true }] });
        renderEventEditorDynamic(host, mapId, "ev_dot");
        expect(hasDot(host, "when")).toBe(true);
        expect(hasDot(host, "move")).toBe(false);
        expect(hasDot(host, "look-talk")).toBe(false);
      });

      it("이동 유형이 정지가 아니면 move 그룹에 점이 붙는다", () => {
        const mapId = seed({ movement: { type: "random", speed: 4, frequency: 3 } });
        renderEventEditorDynamic(host, mapId, "ev_dot");
        expect(hasDot(host, "move")).toBe(true);
        expect(hasDot(host, "when")).toBe(false);
      });

      it("그래픽을 고르면 look-talk 그룹에 점이 붙는다", () => {
        const mapId = seed({ graphic: { sprite: "Actor1" } });
        renderEventEditorDynamic(host, mapId, "ev_dot");
        expect(hasDot(host, "look-talk")).toBe(true);
      });

      it("겹침 기본값(금지)에는 점이 없고, 통행 허용으로 바꾸면 붙는다", () => {
        const base = seed({ overlapForbidden: true });
        renderEventEditorDynamic(host, base, "ev_dot");
        expect(hasDot(host, "memory")).toBe(false);

        host.replaceChildren();
        const changed = seed({ overlapForbidden: false });
        renderEventEditorDynamic(host, changed, "ev_dot");
        expect(hasDot(host, "memory")).toBe(true);
      });

      it("NPC 를 연결하면 npc 그룹에 점이 붙는다", () => {
        const mapId = seed({}, { characterId: "npc_shopkeeper" });
        renderEventEditorDynamic(host, mapId, "ev_dot");
        expect(hasDot(host, "npc")).toBe(true);
      });
    });
  });
  // 레일 그룹 소속은 위치가 아니라 명시 claim 으로 결정된다는 계약을 고정한다.
  describe("eventRailGroupComposition", () => {
    isolateTimers();
    function seed(pageOverrides: Partial<EventPage> = {}): string {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId]!;
      map.events = [
        {
          id: "ev_rail",
          x: 2,
          y: 3,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            {
              id: "p1",
              name: "레일",
              conditions: [],
              graphic: {},
              trigger: { kind: "action" },
              priority: "same",
              overlapForbidden: true,
              movement: { type: "fixed", speed: 3, frequency: 3 },
              commands: [],
              ...pageOverrides,
            } as EventPage,
          ],
        },
      ];
      store.replace(project);
      editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
      return mapId;
    }
    describe("이벤트 편집기 좌측 레일 그룹 소속", () => {
      let host: HTMLElement;

      beforeEach(() => {
        host = document.createElement("div");
        document.body.append(host);
      });

      afterEach(() => {
        host.remove();
      });

      it("겹침 체크박스는 memory 그룹이 소유한다", () => {
        const mapId = seed();
        renderEventEditorDynamic(host, mapId, "ev_rail");
        const overlap = host.querySelector<HTMLElement>("[data-testid='event-classic-overlap']");
        expect(overlap).toBeTruthy();
        expect(overlap!.closest("[data-testid='evt-rail-group-memory']")).toBeTruthy();
        expect(overlap!.closest("[data-testid='evt-rail-group-when']")).toBeNull();
      });

      it("memory 그룹 body 에 편집 가능한 컨트롤이 있다", () => {
        const mapId = seed();
        renderEventEditorDynamic(host, mapId, "ev_rail");
        const body = host.querySelector<HTMLElement>(
          "[data-testid='evt-rail-group-memory'] .event-editor-settings-accordion-body",
        );
        expect(body).toBeTruthy();
        expect(body!.querySelectorAll("input, select, textarea").length).toBeGreaterThan(0);
      });

      it("미분류 자식이 없어 기타 그룹이 만들어지지 않는다", () => {
        const mapId = seed();
        renderEventEditorDynamic(host, mapId, "ev_rail");
        expect(host.querySelector("[data-testid='evt-rail-group-other']")).toBeNull();
        const rail = host.querySelector<HTMLElement>("[data-testid='event-editor-settings-accordion']");
        const slugs = [...rail!.children].map((node) => (node as HTMLElement).dataset.railGroup);
        expect(slugs).toEqual(["look-talk", "when", "move", "memory", "npc"]);
      });

      it("overlapForbidden 미지정 시 헤더 요약과 체크박스 상태가 일치한다", () => {
        const mapId = seed({ overlapForbidden: undefined });
        renderEventEditorDynamic(host, mapId, "ev_rail");
        const meta = host.querySelector<HTMLElement>("[data-testid='evt-rail-meta-memory']");
        const checkbox = host.querySelector<HTMLInputElement>("[data-testid='event-page-overlap-forbidden']");
        expect(checkbox!.checked).toBe(true);
        expect(meta!.textContent).toBe("겹침 금지");
      });

      it("움직임 그룹 요약은 원시 enum 이 아니라 한글 라벨을 보여준다", () => {
        const mapId = seed({ movement: { type: "random", speed: 5, frequency: 6 } });
        renderEventEditorDynamic(host, mapId, "ev_rail");
        const meta = host.querySelector<HTMLElement>("[data-testid='evt-rail-meta-move']");
        expect(meta!.textContent).toContain("무작위");
        expect(meta!.textContent).not.toContain("random");
      });

      it("이동 속도 select 는 런타임 범위 1~8 을 전부 제시한다", () => {
        const mapId = seed({ movement: { type: "random", speed: 8, frequency: 6 } });
        renderEventEditorDynamic(host, mapId, "ev_rail");
        const select = host.querySelector<HTMLSelectElement>("[data-testid='event-page-movement-speed-select']");
        expect([...select!.options].map((option) => option.value)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
        expect(select!.value).toBe("8");
      });
    });
  });
  // 계약: 스위치·변수·아이템·주인공은 "DB 레코드 하나 고르기"라는 같은 일이므로
  // 같은 컨트롤(트리거 버튼 + 숨은 select)로 편집한다.
  //
  // 이전에는 스위치/변수만 모달 픽커였고 아이템/주인공은 네이티브 <select> 였다.
  // 네이티브 select 는 좁은 조건 칸에서 폭이 눌려 선택값이 읽히지 않았다(실측 91px,
  // "0001: 회복약" 이 들어가지 않음). 숨은 select 는 남긴다 — Playwright
  // selectOption 과 기존 change 파이프라인 호환 때문이며, 스위치/변수가 이미 쓰는 방식이다.
  //
  // 조건 칸은 이후 칩 팔레트로 바뀌어 **켜진 조건의 행만** 렌더한다. 그래서 픽커를 보려면
  // 네 종류 조건을 실제로 심어야 한다 — 빈 conditions 로는 행 자체가 없어 픽커도 없다.
  describe("eventRecordPickerUnified", () => {
    isolateTimers();
    function seed(): string {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const map = project.maps[mapId]!;
      map.events = [
        {
          id: "ev_pick",
          x: 2,
          y: 3,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            {
              id: "p1",
              name: "픽커",
              conditions: [
                { kind: "switch", switchId: "sw_1", value: true },
                { kind: "variable", variableId: "var_1", op: ">=", value: 0 },
                { kind: "item", itemId: "item_potion", present: true },
                { kind: "actor", actorId: "actor_hero", present: true },
              ],
              graphic: {},
              trigger: { kind: "action" },
              priority: "same",
              overlapForbidden: true,
              movement: { type: "fixed", speed: 3, frequency: 3 },
              commands: [],
            },
          ],
        },
      ];
      store.replace(project);
      editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
      return mapId;
    }
    describe("레코드 선택 컨트롤 통일", () => {
      let host: HTMLElement;

      beforeEach(() => {
        host = document.createElement("div");
        document.body.append(host);
      });

      afterEach(() => {
        host.remove();
      });

      for (const kind of ["item", "actor"] as const) {
        it(`${kind} 조건은 네이티브 select 가 아니라 픽커 트리거를 노출한다`, () => {
          const mapId = seed();
          renderEventEditorDynamic(host, mapId, "ev_pick");

          const trigger = host.querySelector<HTMLElement>(
            `[data-testid='event-page-${kind}-condition-picker-open']`,
          );
          expect(trigger, `${kind} 픽커 트리거가 있어야 한다`).not.toBeNull();
          expect(trigger?.tagName).toBe("BUTTON");
        });

        it(`${kind} 의 숨은 select 는 e2e 호환을 위해 남는다`, () => {
          const mapId = seed();
          renderEventEditorDynamic(host, mapId, "ev_pick");

          const select = host.querySelector<HTMLSelectElement>(
            `[data-testid='event-page-${kind}-condition-input']`,
          );
          expect(select, `${kind} 숨은 select 가 남아야 한다`).not.toBeNull();
          expect(select?.tagName).toBe("SELECT");
          expect(select?.getAttribute("aria-hidden")).toBe("true");
        });
      }

      it("네 종류 모두 같은 트리거 클래스를 쓴다", () => {
        const mapId = seed();
        renderEventEditorDynamic(host, mapId, "ev_pick");

        const ids = [
          "event-page-switch-condition-picker-open",
          "event-page-variable-picker-open",
          "event-page-item-condition-picker-open",
          "event-page-actor-condition-picker-open",
        ];
        for (const id of ids) {
          const node = host.querySelector<HTMLElement>(`[data-testid='${id}']`);
          expect(node, `${id} 가 있어야 한다`).not.toBeNull();
          expect(node?.classList.contains("event-record-picker-trigger"), id).toBe(true);
        }
      });
    });
  });
});

describe("sharedPickers", () => {
  isolateTimers();
  describe("sharedPickers", () => {
    isolateTimers();
    describe("sharedPickers", () => {
      it("mapPicker exposes select testid and map size subtitle", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const map = project.maps[mapId];
        expect(map).toBeTruthy();

        const picker = mapPicker({
          project,
          selectedId: mapId,
          testid: "change-tile-map-select",
        });

        expect(picker.select.dataset.testid).toBe("change-tile-map-select");
        expect(picker.select.value).toBe(mapId);
        expect(picker.root.querySelector(".record-picker-card-name")?.textContent).toContain(map!.name);
        expect(picker.root.querySelector(".record-picker-card-subtitle")?.textContent).toBe(
          `${map!.width}×${map!.height}`,
        );
      });

      it("mapSelectElement lists all maps and keeps empty option when allowed", () => {
        const project = createBlankProject();
        const select = mapSelectElement({
          project,
          selectedId: "",
          testid: "event-page-living-target-map",
          allowEmpty: true,
        });
        expect(select.dataset.testid).toBe("event-page-living-target-map");
        expect(select.options.length).toBe(Object.keys(project.maps).length + 1);
      });

      it("actorPicker and itemPicker reuse record cards with icons/subtitles", () => {
        const project = createBlankProject();
        const actor = project.database.actors[0];
        const item = project.database.items[0];
        expect(actor).toBeTruthy();
        expect(item).toBeTruthy();

        const actorHandle = actorPicker({
          project,
          selectedId: actor!.id,
          testid: "change-party-actor-select",
        });
        expect(actorHandle.select.dataset.testid).toBe("change-party-actor-select");
        expect(actorHandle.root.querySelector(".record-picker-card-name")?.textContent).toBe(actor!.name);

        const itemHandle = itemPicker({
          project,
          selectedId: item!.id,
          testid: "change-item-select",
          subtitleOf: () => "시작 보유 ×0",
        });
        expect(itemHandle.select.dataset.testid).toBe("change-item-select");
        expect(itemHandle.root.querySelector(".record-picker-card-subtitle")?.textContent).toBe("시작 보유 ×0");
      });

      it("facesetIconOf renders one standalone face image, never a sheet crop", () => {
        const project = createBlankProject();
        const icon = facesetIconOf(project, "easyrpg-faceset-actor1-05");
        expect(icon).not.toBeNull();
        if (icon?.kind !== "image") throw new Error("expected whole-image face icon");
        expect(icon.url).toContain("/assets/easyrpg/faceset/Actor1/05.png");

        // actorPicker must render that face as a plain <img>, not a crop box.
        const actor = project.database.actors[0]!;
        actor.faceResourceId = "easyrpg-faceset-actor1-05";
        const picker = actorPicker({ project, selectedId: actor.id, testid: "actor-face-crop" });
        expect(picker.root.querySelectorAll(".rich-record-icon-crop")).toHaveLength(0);
        const images = picker.root.querySelectorAll(".rich-record-icon");
        expect(images).toHaveLength(1);
        expect(images[0]?.getAttribute("src")).toContain("/assets/easyrpg/faceset/Actor1/05.png");
      });

      it("charsetIconOf crops one character slot idle-front frame from multi-object sheets", () => {
        const project = createBlankProject();
        const characterIndex = 4;
        const icon = charsetIconOf(project, "easyrpg-charset-object1", characterIndex);
        expect(icon).not.toBeNull();
        if (icon?.kind !== "sheetRect") throw new Error("expected sheetRect crop");
        const source = charsetFrameSource({ characterIndex, direction: "down", pattern: 1 });
        expect(icon.x).toBe(source.x);
        expect(icon.y).toBe(source.y);
        expect(icon.cellWidth).toBe(CHARSET_FRAME_WIDTH);
        expect(icon.cellHeight).toBe(CHARSET_FRAME_HEIGHT);
        expect(icon.sheetWidth).toBe(CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH);
        expect(icon.sheetHeight).toBe(CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT);
      });
    });
  });
  // 이모트 명령 편집 폼 — 그림으로 고르는 격자와 대상 전환이 실제 명령으로 커밋되는지.
  describe("showEmoteCommandBody", () => {
    isolateTimers();
    function harness(initial: Extract<Command, { kind: "showEmote" }>) {
      const replaced: Command[] = [];
      const context = {
        path: [0],
        lockKind: true,
        actions: {
          replaceCommand: (_path: readonly number[], command: Command) => replaced.push(command),
          addCommand: () => {},
          removeCommand: () => {},
          moveCommand: () => {},
        },
      } as unknown as CommandEditContext;
      const root = showEmoteBody(context, initial);
      document.body.replaceChildren(root);
      return { root, replaced };
    }
    const q = <T extends Element = HTMLElement>(root: ParentNode, testid: string): T | null =>
      root.querySelector<T>(`[data-testid="${testid}"]`);
    describe("showEmote 편집 폼", () => {
      beforeEach(() => {
        store.replace(createBlankProject());
      });

      it("12종 전부가 격자에 있고 각 칸이 자기 프레임을 보여준다", () => {
        const { root } = harness({ kind: "showEmote", target: { eventId: "" }, emote: "heart" });
        const grid = q(root, "show-emote-swatch-grid");
        expect(grid).not.toBeNull();
        expect(grid?.querySelectorAll("button")).toHaveLength(EMOTE_KINDS.length);

        for (const kind of EMOTE_KINDS) {
          const swatch = q<HTMLButtonElement>(root, `show-emote-swatch-${kind}`);
          expect(swatch, kind).not.toBeNull();
          const icon = swatch?.querySelector<HTMLElement>(".emote-swatch-icon");
          // CSSOM 이 값을 정규화한다: "-0px 0" → "0px 0px". 기하값 자체를 같은 형식으로 비교한다.
          expect(icon?.style.backgroundPosition).toBe(`${-(emoteFrameIndex(kind) * 48)}px 0px`);
        }
      });

      it("선택 상태가 aria-checked 로 노출되고 클릭하면 명령이 그 이모트로 커밋된다", () => {
        const { root, replaced } = harness({ kind: "showEmote", target: { eventId: "" }, emote: "heart" });
        expect(q(root, "show-emote-swatch-heart")?.getAttribute("aria-checked")).toBe("true");
        expect(q(root, "show-emote-swatch-music")?.getAttribute("aria-checked")).toBe("false");

        q<HTMLButtonElement>(root, "show-emote-swatch-music")?.click();

        expect(replaced.at(-1)).toMatchObject({ kind: "showEmote", emote: "music" });
        expect(q(root, "show-emote-swatch-music")?.getAttribute("aria-checked")).toBe("true");
        expect(q(root, "show-emote-swatch-heart")?.getAttribute("aria-checked")).toBe("false");
      });

      it("대상 전환: 주인공을 고르면 이벤트 칸이 숨고 target 이 player 로 커밋된다", () => {
        const { root, replaced } = harness({ kind: "showEmote", target: { eventId: "" }, emote: "heart" });
        const select = q<HTMLSelectElement>(root, "show-emote-target-kind-select");
        expect(select).not.toBeNull();
        expect((q(root, "show-emote-event-field") as HTMLElement).hidden).toBe(true);
        expect(getComputedStyle(q(root, "show-emote-event-field") as HTMLElement).display).toBe("none");

        select!.value = "player";
        select!.dispatchEvent(new Event("change"));

        expect(replaced.at(-1)).toMatchObject({ target: "player" });
        expect((q(root, "show-emote-event-field") as HTMLElement).hidden).toBe(true);
        expect(getComputedStyle(q(root, "show-emote-event-field") as HTMLElement).display).toBe("none");

        select!.value = "event";
        select!.dispatchEvent(new Event("change"));
        expect((q(root, "show-emote-event-field") as HTMLElement).hidden).toBe(false);
        expect(getComputedStyle(q(root, "show-emote-event-field") as HTMLElement).display).not.toBe("none");
      });

      it("표시 시간은 상한으로 잘려서 커밋된다", () => {
        const { root, replaced } = harness({ kind: "showEmote", target: "player", emote: "heart" });
        const duration = q<HTMLInputElement>(root, "show-emote-duration-input");
        expect(duration).not.toBeNull();

        duration!.value = "999999";
        duration!.dispatchEvent(new Event("change"));

        expect(replaced.at(-1)).toMatchObject({ durationMs: EMOTE_MAX_DURATION_MS });
      });
    });
  });
  describe("unsupportedMidiAuthoring", () => {
    isolateTimers();
    const MIDI = "easyrpg-music-battle-1";
    const WAV = "cc0-music-field-loop";
    function node<T extends HTMLElement>(id: string): T {
      const result = document.querySelector<T>(`[data-testid="${id}"]`);
      if (!result) throw new Error(`Missing ${id}`);
      return result;
    }
    function choose(id: string, value: string): void {
      const select = node<HTMLSelectElement>(id);
      select.value = value;
      select.dispatchEvent(new Event("change"));
    }
    beforeEach(() => {
      store.replace(createBlankProject());
      editorState.set({ currentMapId: store.getCurrent().startMapId });
    });
    afterEach(() => {
      // Close through the real dialog lifecycle to dispose modal/store subscriptions.
      for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-testid$="-cancel"]')) button.click();
      document.body.replaceChildren();
      vi.restoreAllMocks();
    });
    describe("unsupported MIDI authoring", () => {
      it("disables MIDI candidates in the shared picker but assigns supported audio", () => {
        const confirm = vi.fn();
        openDatabaseResourcePickerDialog({ kind: "music", title: "BGM", onConfirm: confirm });
        expect(node<HTMLButtonElement>(`db-resource-picker-option-${MIDI}`).disabled).toBe(true);
        node<HTMLButtonElement>(`db-resource-picker-option-${WAV}`).click();
        expect(node<HTMLButtonElement>("db-resource-picker-ok").disabled).toBe(false);
        node<HTMLButtonElement>("db-resource-picker-ok").click();
        expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ resourceId: WAV }));
      });

      it("keeps a legacy selection inspectable without confirming or rewriting it", () => {
        const confirm = vi.fn();
        openDatabaseResourcePickerDialog({ kind: "music", title: "BGM", currentId: MIDI, onConfirm: confirm });
        expect(node("db-resource-picker-preview").textContent).toContain(MIDI);
        expect(node<HTMLButtonElement>("db-resource-picker-audio-play").disabled).toBe(true);
        expect(node<HTMLButtonElement>("db-resource-picker-audio-stop").disabled).toBe(true);
        expect(node("db-resource-picker-audio-transport").dataset.state).toBe("unavailable");
        expect(node("db-resource-picker-preview").querySelector("audio")).toBeNull();
        expect(node<HTMLButtonElement>("db-resource-picker-ok").disabled).toBe(true);
        node<HTMLButtonElement>("db-resource-picker-ok").click();
        expect(confirm).not.toHaveBeenCalled();
      });

      it("guards the confirmation callback even for a synthetic activation", () => {
        const confirm = vi.fn();
        openDatabaseResourcePickerDialog({ kind: "music", title: "BGM", currentId: MIDI, onConfirm: confirm });
        node("db-resource-picker-ok").dispatchEvent(new Event("click"));
        expect(confirm).not.toHaveBeenCalled();
      });

      it.each(["music", "sound"] as const)("blocks the shared %s text-input application path", kind => {
        const change = vi.fn();
        document.body.append(resourcePickerControl({ label: "Audio", resourceId: WAV, kind, testid: "audio-field", onChange: change, rerender: () => {} }));
        const input = node<HTMLInputElement>("audio-field");
        input.value = MIDI;
        input.dispatchEvent(new Event("input"));
        input.dispatchEvent(new Event("change"));
        expect(change).not.toHaveBeenCalled();
        expect(input.value).toBe(WAV);
        input.value = "cc0-sound-ui-confirm";
        input.dispatchEvent(new Event("change"));
        expect(change).toHaveBeenCalledWith(expect.objectContaining({ resourceId: "cc0-sound-ui-confirm" }));
      });

      for (const currentId of ["", MIDI]) {
        it.each(["native", "m2"] as const)(`blocks new MIDI in %s dropdowns while preserving current ${currentId || "empty"}`, surface => {
          const replace = vi.fn();
          const body = surface === "native"
            ? playAudioBodyForTest(audioCommandContext(replace), { kind: "playAudio", resourceId: currentId, loop: true })
            : renderM2CommandBody(audioCommandContext(replace), { kind: "m2Command", commandId: "m2-027-change-system-bgm", fields: { resourceId: currentId, volume: 100 } });
          if (!body) throw new Error("Missing command body");
          document.body.append(body);
          const id = surface === "native" ? "play-audio-resource-select" : "m2-command-resourceId-picker";
          const select = node<HTMLSelectElement>(id);
          expect(select.value).toBe(currentId);
          expect(replace).not.toHaveBeenCalled();
          expect([...select.options].find(option => option.value === MIDI)?.disabled).toBe(true);
          choose(id, MIDI);
          expect(replace).not.toHaveBeenCalled();
          expect(select.value).toBe(currentId);
          if (surface === "native") {
            const search = node<HTMLInputElement>("play-audio-search");
            search.value = "no-match-probe";
            search.dispatchEvent(new Event("input"));
            if (currentId) expect(select.selectedOptions[0]?.disabled).toBe(true);
            search.value = "";
            search.dispatchEvent(new Event("input"));
          }
          choose(id, WAV);
          expect(replace).toHaveBeenLastCalledWith([0], expect.objectContaining(surface === "native"
            ? { resourceId: WAV } : { fields: expect.objectContaining({ resourceId: WAV }) }));
          choose(id, MIDI);
          expect(select.value).toBe(WAV);
          expect(replace).toHaveBeenCalledTimes(1);
        });
      }

      it("preserves legacy map BGM during inspection and assigns supported BGM through its picker", () => {
        const project = store.getCurrent();
        const map = project.maps[project.startMapId]!;
        map.bgm = { mode: "custom", resourceId: MIDI, fadeInMs: 700 };
        const host = document.createElement("div");
        document.body.append(host);
        renderMapProps(host);
        node<HTMLButtonElement>("map-bgm-resource-set").click();
        expect(node("map-bgm-resource-dialog-preview").textContent).toContain(MIDI);
        expect(node<HTMLButtonElement>("map-bgm-resource-dialog-ok").disabled).toBe(true);
        node<HTMLButtonElement>("map-bgm-resource-dialog-cancel").click();
        expect(store.getCurrent().maps[map.id]?.bgm).toEqual({ mode: "custom", resourceId: MIDI, fadeInMs: 700 });
        node<HTMLButtonElement>("map-bgm-resource-set").click();
        node<HTMLButtonElement>(`map-bgm-resource-dialog-option-${WAV}`).click();
        node<HTMLButtonElement>("map-bgm-resource-dialog-ok").click();
        expect(store.getCurrent().maps[map.id]?.bgm).toEqual({ mode: "custom", resourceId: WAV, fadeInMs: 700 });
      });
    });
  });
});
