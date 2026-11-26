import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeChipsWithAreas, changePreviewChips, changePreviewRegion, openWideChangeViewer, renderChangePreviewCard, type ChangeShotRenderer } from "@/editor/panels/aiChangePreview";
import type { ChangeSummary } from "@/editor/tools/types";
import { buildChangeLedger } from "@/project/changeLedger";
import { computeChangeSites } from "@/project/changeSites";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import type { GameEvent, Project } from "@/project/types";
import { documentListenerCount, FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { isReadOnlyToolNoise, phaseStatusText, shouldShowStatusInChat } from "@/editor/panels/aiChatPanelHelpers";
import { formatAiRunningStatus, parseAutonomousRunBudget, renderToolActivityEntry, renderWorkPlanChecklist } from "@/editor/panels/aiChatRenderers";
import type { WorkPlan } from "@/ai/workPlan";
import { isolateTimers } from "./mergedTeardown";

describe("aiChangePreview", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });
  function changeSummary(overrides: Partial<ChangeSummary> = {}): ChangeSummary {
    return {
      tilesChanged: 0,
      eventsAdded: 0,
      eventsModified: 0,
      eventsRemoved: 0,
      mapsAdded: 0,
      mapsRemoved: 0,
      dbRecordsChanged: 0,
      tilesetsChanged: 0,
      switchesAdded: 0,
      variablesAdded: 0,
      worldEntitiesAdded: 0,
      worldEntitiesModified: 0,
      palettePresetsAdded: 0,
      palettePresetsModified: 0,
      endingsChanged: 0,
      sessionChanged: false,
      systemChanged: false,
      warnings: [],
      ...overrides,
    };
  }
  function firstMapId(project: Project): string {
    const mapId = Object.keys(project.maps)[0];
    if (!mapId) throw new Error("빈 프로젝트에 맵이 없다");
    return mapId;
  }
  /** before/after 쌍 — after 는 (4,5) 타일 한 칸만 바꾼다. */
  function tilePair(): { before: Project; after: Project; mapId: string } {
    const before = createBlankProject();
    const mapId = firstMapId(before);
    const after = structuredClone(before) as Project;
    const map = after.maps[mapId];
    if (!map) throw new Error("맵 복제 실패");
    const index = 5 * map.width + 4;
    map.lowerTiles[index] = (map.lowerTiles[index] ?? 0) + 1;
    return { before, after, mapId };
  }
  function stubRenderer(): ChangeShotRenderer {
    return vi.fn(async () => document.createElement("canvas") as HTMLCanvasElement);
  }
  /** 마이크로태스크 큐를 비운다 — 타이머/슬립 없음. */
  async function flushMicrotasks(): Promise<void> {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  }
  function requireTestId(root: FakeElement, testId: string): FakeElement {
    const found = findByTestId(root, testId);
    if (!found) throw new Error(`testid 없음: ${testId}`);
    return found;
  }
  function card(root: HTMLElement): FakeElement {
    if (root instanceof FakeElement) return root;
    throw new Error("FakeElement 기대");
  }
  function dispatchDocumentKey(key: string): void {
    const event = new Event("keydown", { cancelable: true });
    Object.defineProperty(event, "key", { configurable: true, value: key });
    document.dispatchEvent(event);
  }
  function dispatchKey(target: FakeElement, key: string, shiftKey = false): Event {
    const event = new Event("keydown", { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      key: { configurable: true, value: key },
      shiftKey: { configurable: true, value: shiftKey },
    });
    target.dispatchEvent(event);
    return event;
  }
  function wideFocusable(root: FakeElement): FakeElement[] {
    return [...root.querySelectorAll(
      "button:not(:disabled), input:not(:disabled), [href], select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
    )].filter((node) => !node.closest("[hidden]"));
  }
  describe("changePreviewRegion", () => {
    it("타일 변경 bbox 에 패딩을 더한 영역을 쓴다", () => {
      const { before, after, mapId } = tilePair();
      const region = changePreviewRegion(before, after, mapId);
      expect(region).toEqual({ x: 1, y: 2, width: 7, height: 7 });
    });

    it("변경 bbox 가 없으면 after 맵 전체를 쓴다", () => {
      const before = createBlankProject();
      const after = structuredClone(before) as Project;
      const mapId = firstMapId(after);
      const map = after.maps[mapId];
      if (!map) throw new Error("맵 없음");
      expect(changePreviewRegion(before, after, mapId)).toEqual({ x: 0, y: 0, width: map.width, height: map.height });
    });

    it("양쪽 프로젝트에 맵이 없으면 null", () => {
      const before = createBlankProject();
      const after = createBlankProject();
      expect(changePreviewRegion(before, after, "map-does-not-exist")).toBeNull();
    });
  });
  describe("changePreviewChips", () => {
    it("0 이 아닌 항목만 한국어 라벨로, 고정 순서로 낸다", () => {
      const chips = changePreviewChips(
        changeSummary({
          tilesChanged: 128,
          eventsAdded: 2,
          eventsModified: 1,
          mapsAdded: 1,
          dbRecordsChanged: 3,
          tilesetsChanged: 1,
          switchesAdded: 2,
          variablesAdded: 1,
          worldEntitiesAdded: 3,
          endingsChanged: 1,
        }),
      );
      expect(chips).toEqual([
        "타일 128",
        "이벤트 +2",
        "이벤트 수정 1",
        "맵 +1",
        "DB 3",
        "타일셋 1",
        "스위치 +2",
        "변수 +1",
        "세계관 +3",
        "엔딩 1",
      ]);
    });

    it("변경이 없으면 빈 배열", () => {
      expect(changePreviewChips(changeSummary())).toEqual([]);
    });

    it("개수가 아닌 축(세션·시스템)은 이름만 낸다", () => {
      expect(changePreviewChips(changeSummary({ sessionChanged: true, systemChanged: true }))).toEqual(["세션", "시스템"]);
    });
  });
  describe("changeChipsWithAreas", () => {
    it("카운터 뒤에 카운터 밖 영역 이름을 붙인다 — 검토 카드가 빈 줄로 끝나지 않는다", () => {
      expect(changeChipsWithAreas(changeSummary({ tilesChanged: 3 }), ["퀘스트", "스토리 플래그"])).toEqual([
        "타일 3",
        "퀘스트",
        "스토리 플래그",
      ]);
    });

    it("요약이 없어도(카운터 밖 변경만 있어도) 이름은 남는다", () => {
      expect(changeChipsWithAreas(undefined, ["퀘스트"])).toEqual(["퀘스트"]);
    });

    it("같은 이름을 두 번 붙이지 않는다", () => {
      expect(changeChipsWithAreas(changeSummary({ sessionChanged: true }), ["세션"])).toEqual(["세션"]);
    });
  });
  describe("renderChangePreviewCard", () => {
    it("계약된 testid 와 before/after 순서를 지킨다", () => {
      const { before, after, mapId } = tilePair();
      const root = card(
        renderChangePreviewCard({
          before,
          after,
          mapId,
          title: "숲길에 나무를 심었습니다",
          detail: "타일 12칸",
          chips: ["타일 12"],
          renderShot: stubRenderer(),
        }),
      );
      expect(root.dataset.testid).toBe("ai-change-card");
      expect(root.className).toContain("ai-change-card");
      expect(requireTestId(root, "ai-change-expand").textContent).toBe("넓게 보기");
      expect(requireTestId(root, "ai-change-card").querySelector(".ai-change-title")?.textContent).toBe(
        "숲길에 나무를 심었습니다",
      );
      const pair = requireTestId(root, "ai-change-pair");
      const kinds = pair.querySelectorAll(".ai-change-shot").map((shot) => shot.dataset.kind);
      expect(kinds).toEqual(["before", "after"]);
      const labels = pair.querySelectorAll(".ai-change-shot-label").map((node) => node.textContent);
      // 데크(2026-09-03): DESIGN.md 의 「지금 / 적용 후」 어휘로 통일.
      expect(labels).toEqual(["지금", "적용 후"]);
      expect(findByTestId(root, "ai-change-shot-before")).not.toBeNull();
      expect(findByTestId(root, "ai-change-shot-after")).not.toBeNull();
      expect(pair.querySelector(".ai-change-arrow")).not.toBeNull();
      expect(root.querySelector(".ai-change-chip")?.textContent).toBe("타일 12");
      expect(root.querySelector(".ai-change-detail")?.textContent).toBe("타일 12칸");
      expect(findByTestId(root, "ai-change-undo")).toBeNull();
    });

    it("onUndo 가 있을 때만 되돌리기 버튼이 있고, 클릭은 한 번 호출한다", () => {
      const { before, after, mapId } = tilePair();
      const onUndo = vi.fn();
      const root = card(
        renderChangePreviewCard({ before, after, mapId, title: "변경", onUndo, renderShot: stubRenderer() }),
      );
      const undo = requireTestId(root, "ai-change-undo");
      expect(undo.textContent).toBe("되돌리기");
      undo.click();
      expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it("주입 렌더러의 캔버스가 after 컨테이너 안에 붙는다", async () => {
      const { before, after, mapId } = tilePair();
      const renderShot = stubRenderer();
      const root = card(renderChangePreviewCard({ before, after, mapId, title: "변경", renderShot }));
      expect(requireTestId(root, "ai-change-shot-after").children).toHaveLength(0);
      await flushMicrotasks();
      const afterShot = requireTestId(root, "ai-change-shot-after");
      expect(afterShot.children.map((child) => child.tagName)).toEqual(["CANVAS"]);
      expect(requireTestId(root, "ai-change-shot-before").children.map((child) => child.tagName)).toEqual(["CANVAS"]);
      expect(renderShot).toHaveBeenCalledTimes(2);
    });

    it("렌더러가 실패하면 폴백 문구를 넣는다", async () => {
      const { before, after, mapId } = tilePair();
      const renderShot: ChangeShotRenderer = vi.fn(async () => {
        throw new Error("no canvas");
      });
      const root = card(renderChangePreviewCard({ before, after, mapId, title: "변경", renderShot }));
      await flushMicrotasks();
      const fallbacks = root.querySelectorAll(".ai-change-shot-fallback");
      expect(fallbacks).toHaveLength(2);
      expect(fallbacks[0]?.textContent).toBe("미리보기 불가");
      expect(requireTestId(root, "ai-change-shot-after").querySelector(".ai-change-shot-fallback")).not.toBeNull();
    });
  });
  describe("openWideChangeViewer", () => {
    it("body 에 붙고 모드 토글이 data-mode 를 바꾼다", () => {
      const { before, after, mapId } = tilePair();
      const viewer = openWideChangeViewer({ before, after, mapId, title: "변경", renderShot: stubRenderer() });
      const root = card(viewer.root);
      expect(document.body.contains(root)).toBe(true);
      expect(root.dataset.testid).toBe("ai-change-wide");
      const body = root.querySelector(".ai-change-wide-body");
      expect(body?.dataset.mode).toBe("side");
      requireTestId(root, "ai-change-wide-mode-overlay").click();
      expect(body?.dataset.mode).toBe("overlay");
      requireTestId(root, "ai-change-wide-mode-side").click();
      expect(body?.dataset.mode).toBe("side");
      viewer.close();
    });

    it("슬라이더가 after 클립을 갱신한다", () => {
      const { before, after, mapId } = tilePair();
      const viewer = openWideChangeViewer({ before, after, mapId, title: "변경", renderShot: stubRenderer() });
      const root = card(viewer.root);
      const slider = requireTestId(root, "ai-change-wide-slider");
      const afterShot = requireTestId(root, "ai-change-wide-shot-after");
      slider.value = "40";
      slider.dispatchEvent(new Event("input"));
      expect(afterShot.style.clipPath).toBe("inset(0 60% 0 0)");
      viewer.close();
    });

    it("닫기 버튼·배경 클릭·Escape 로 닫히고 두 번째 Escape 는 아무 일도 안 한다", () => {
      const { before, after, mapId } = tilePair();
      const open = (): ReturnType<typeof openWideChangeViewer> =>
        openWideChangeViewer({ before, after, mapId, title: "변경", renderShot: stubRenderer() });

      const byButton = open();
      requireTestId(card(byButton.root), "ai-change-wide-close").click();
      expect(document.querySelector("[data-testid='ai-change-wide']")).toBeNull();

      const byBackdrop = open();
      card(byBackdrop.root).click();
      expect(document.querySelector("[data-testid='ai-change-wide']")).toBeNull();

      const byEscape = open();
      expect(documentListenerCount("keydown")).toBe(1);
      dispatchDocumentKey("Escape");
      expect(documentListenerCount("keydown")).toBe(0);
      expect(document.querySelector("[data-testid='ai-change-wide']")).toBeNull();
      expect(document.body.contains(card(byEscape.root))).toBe(false);
      dispatchDocumentKey("Escape");
      expect(document.querySelector("[data-testid='ai-change-wide']")).toBeNull();
      byEscape.close();
    });

    it("보이는 제목을 대화상자 이름으로 묶고 Tab 을 창 안에 가둔 뒤 닫으면 연 곳으로 돌아간다", () => {
      const opener = document.createElement("button");
      document.body.append(opener);
      opener.focus();
      const { before, after, mapId } = tilePair();
      const viewer = openWideChangeViewer({ before, after, mapId, title: "대장간을 고쳤습니다", renderShot: stubRenderer() });
      const root = card(viewer.root);
      const title = root.querySelector(".ai-change-wide-title");
      expect(root.getAttribute("aria-modal")).toBe("true");
      expect(title?.textContent).toBe("대장간을 고쳤습니다");
      expect(title?.getAttribute("id")).toBeTruthy();
      expect(root.getAttribute("aria-labelledby")).toBe(title?.getAttribute("id"));

      const focusable = wideFocusable(root);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) throw new Error("초점 가능한 컨트롤이 없다");
      expect(document.activeElement).toBe(first);

      last.focus();
      const forward = dispatchKey(last, "Tab");
      expect(forward.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(first);
      first.focus();
      const backward = dispatchKey(first, "Tab", true);
      expect(backward.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(last);

      viewer.close();
      expect(document.activeElement).toBe(opener);
      expect(document.querySelector("[data-testid='ai-change-wide']")).toBeNull();
    });
  });
  /** 지도 그림이 같아지는 쌍 — 맵 밖 변경(퀘스트·설정·이벤트 내용)만 다르다. */
  function nonMapPair(mutate: (after: Project, mapId: string) => void): { before: Project; after: Project; mapId: string } {
    const before = createBlankProject();
    const mapId = firstMapId(before);
    const after = structuredClone(before) as Project;
    mutate(after, mapId);
    return { before, after, mapId };
  }
  /** 썸네일이 읽는 것은 id·x·y 뿐이다 — 나머지 필드는 계약 밖이라 최소값으로 채운다. */
  function eventAt(x: number, y: number, name: string): GameEvent {
    return { id: "event_1", name, x, y, pages: [] } as unknown as GameEvent;
  }
  describe("그림이 같으면 비교 대신 사실을 말한다", () => {
    it("타일·이벤트 좌표가 그대로면 두 장을 그리지 않고 안내를 낸다", () => {
      const { before, after, mapId } = nonMapPair((project) => {
        project.meta = { ...project.meta, author: "다른 사람" };
      });
      const renderShot = stubRenderer();

      const root = card(renderChangePreviewCard({ before, after, mapId, title: "작가를 바꿨습니다", renderShot }));

      expect(findByTestId(root, "ai-change-pair")).toBeNull();
      expect(findByTestId(root, "ai-change-expand")).toBeNull();
      expect(requireTestId(root, "ai-change-word-diff").textContent).toContain("지도 그림에 나타나지 않습니다");
      // 두 장을 그리지 않으므로 렌더러를 부르지 않는다 — 같은 그림을 두 번 그리는 비용도 없다.
      expect(renderShot).not.toHaveBeenCalled();
    });

    it("이벤트 내용만 바뀐 경우도 두 장 대신 안내다(그림은 좌표만 그린다)", () => {
      const { before, after, mapId } = nonMapPair((project, id) => {
        project.maps[id]!.events = [eventAt(1, 1, "이름만 바뀐 이벤트")];
      });
      before.maps[mapId]!.events = [eventAt(1, 1, "원래 이름")];
      const root = card(renderChangePreviewCard({ before, after, mapId, title: "대사를 고쳤습니다", renderShot: stubRenderer() }));
      expect(findByTestId(root, "ai-change-pair")).toBeNull();
      expect(findByTestId(root, "ai-change-word-diff")).not.toBeNull();
    });

    it("타일은 같아도 타일셋 정의가 바뀌면 그림이 다르므로 두 장을 그린다", () => {
      const { before, after, mapId } = nonMapPair((project, id) => {
        const tilesetId = project.maps[id]!.tilesetId;
        const tileset = project.tilesets[tilesetId]!;
        project.tilesets[tilesetId] = { ...tileset, name: `${tileset.name} (개정)` };
      });
      const root = card(renderChangePreviewCard({ before, after, mapId, title: "타일셋 개정", renderShot: stubRenderer() }));
      expect(findByTestId(root, "ai-change-pair")).not.toBeNull();
      expect(findByTestId(root, "ai-change-word-diff")).toBeNull();
    });

    it("이벤트가 움직이면 (타일이 그대로여도) 두 장을 그린다", () => {
      const { before, after, mapId } = nonMapPair((project, id) => {
        project.maps[id]!.events = [eventAt(2, 1, "NPC")];
      });
      before.maps[mapId]!.events = [eventAt(1, 1, "NPC")];
      const root = card(renderChangePreviewCard({ before, after, mapId, title: "NPC 를 옮겼습니다", renderShot: stubRenderer() }));
      expect(findByTestId(root, "ai-change-pair")).not.toBeNull();
    });

    it("안내 문구는 칩이 없으면 '위 항목' 을 가리키지 않는다", () => {
      const { before, after, mapId } = nonMapPair((project) => {
        project.meta = { ...project.meta, author: "다른 사람" };
      });
      const root = card(renderChangePreviewCard({ before, after, mapId, title: "변경", renderShot: stubRenderer() }));
      expect(requireTestId(root, "ai-change-word-diff").textContent).not.toContain("위 항목");
    });

    it("넓은 뷰어도 같은 판정을 쓴다 — 같으면 비교 모드를 만들지 않는다", () => {
      const { before, after, mapId } = nonMapPair((project) => {
        project.meta = { ...project.meta, author: "다른 사람" };
      });
      const viewer = openWideChangeViewer({ before, after, mapId, title: "변경", renderShot: stubRenderer() });
      const root = card(viewer.root);
      expect(findByTestId(root, "ai-change-word-diff")).not.toBeNull();
      expect(findByTestId(root, "ai-change-wide-mode-side")).toBeNull();
      expect(findByTestId(root, "ai-change-wide-shot-before")).toBeNull();
      viewer.close();
    });
  });
  describe("카드가 말하는 상태", () => {
    it("기본은 영수증(적용됨)이다", () => {
      const { before, after, mapId } = tilePair();
      const root = card(renderChangePreviewCard({ before, after, mapId, title: "변경", renderShot: stubRenderer() }));
      expect(root.querySelector(".ai-change-badge")?.textContent).toBe("적용됨");
      expect(root.dataset.state).toBe("applied");
    });

    it("검토 대기 카드는 「적용 전」 이고 되돌리기가 없다", () => {
      const { before, after, mapId } = tilePair();
      const root = card(renderChangePreviewCard({ before, after, mapId, title: "변경", state: "proposed", renderShot: stubRenderer() }));
      expect(root.querySelector(".ai-change-badge")?.textContent).toBe("적용 전");
      expect(root.dataset.state).toBe("proposed");
      expect(findByTestId(root, "ai-change-undo")).toBeNull();
    });
  });
  describe("변경 내역(긴 명세)", () => {
    /** 명세 픽스처 — 커맨드·데이터베이스처럼 그림에 안 보이는 변경들. */
    function ledgerPair(): { before: Project; after: Project; mapId: string } {
      const before = createBlankProject();
      const mapId = firstMapId(before);
      const after = structuredClone(before) as Project;
      after.meta = { ...after.meta, title: "새 게임" };
      after.switches = [...after.switches, { id: "switch_quest", name: "퀘스트 시작" } as never];
      return { before, after, mapId };
    }

    it("항목별 before → after 를 카드 안에 그린다 — 칩 한 줄로는 위임을 검토할 수 없다", () => {
      const { before, after, mapId } = ledgerPair();
      const root = card(renderChangePreviewCard({
        before,
        after,
        mapId,
        title: "설정을 바꿨습니다",
        ledger: buildChangeLedger(before, after),
        renderShot: stubRenderer(),
      }));

      const section = requireTestId(root, "ai-change-ledger");
      expect(requireTestId(root, "ai-change-ledger-count").textContent).toBe("2건");
      const rows = section.querySelectorAll(".ai-change-ledger-row");
      expect(rows.map((row) => row.dataset.area)).toEqual(["프로젝트 정보", "스위치"]);
      expect(section.querySelectorAll(".ai-change-ledger-detail li").length).toBeGreaterThan(0);
    });

    it("기본은 펼침이고 토글이 목록만 접는다 — 원래 불평이 «안 보인다» 였다", () => {
      const { before, after, mapId } = ledgerPair();
      const root = card(renderChangePreviewCard({
        before,
        after,
        mapId,
        title: "설정을 바꿨습니다",
        ledger: buildChangeLedger(before, after),
        renderShot: stubRenderer(),
      }));

      const section = requireTestId(root, "ai-change-ledger");
      const toggle = requireTestId(root, "ai-change-ledger-toggle");
      expect(section.dataset.collapsed).toBeUndefined();
      expect(toggle.textContent).toBe("접기");

      toggle.click();
      expect(section.dataset.collapsed).toBe("true");
      expect(toggle.textContent).toBe("펼치기");
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
    });

    it("명세가 없으면 구획을 만들지 않는다", () => {
      const { before, after, mapId } = tilePair();
      const root = card(renderChangePreviewCard({ before, after, mapId, title: "변경", renderShot: stubRenderer() }));
      expect(findByTestId(root, "ai-change-ledger")).toBeNull();
    });

    it("넓게 보기에도 명세가 실린다 — 잘린 항목은 여기서 읽는다", () => {
      const { before, after, mapId } = ledgerPair();
      const viewer = openWideChangeViewer({
        before,
        after,
        mapId,
        title: "설정을 바꿨습니다",
        ledger: buildChangeLedger(before, after),
        renderShot: stubRenderer(),
      });
      expect(requireTestId(card(viewer.root), "ai-change-ledger")).not.toBeNull();
      viewer.close();
    });
  });
  describe("보고서 모드 — sites 가 있으면 지점마다 한 쌍", () => {
    it("지점 수만큼 쌍을 그리고, 머리에 지점 수·팀 보고·검수 지적이 서고, 모드 토글은 없다", async () => {
      const { before, after, mapId } = tilePair();
      const renderShot = stubRenderer();
      const sites = computeChangeSites(before, after);
      expect(sites.length).toBe(1);
      const viewer = openWideChangeViewer({
        before, after, mapId, title: "Pi 팀 결과", sites, renderShot,
        report: "대장간 2채를 세우고 앞마당 돌길을 놓았습니다.",
        findings: ["(20,9) 돌길 한 칸 끊김"],
      });
      const root = card(viewer.root);
      expect(root.className).toContain("is-report");
      expect(requireTestId(root, "ai-change-wide").querySelectorAll('[data-testid="ai-change-report-site"]').length).toBe(1);
      expect(findByTestId(root, "ai-change-wide-mode-side")).toBeNull();
      expect(findByTestId(root, "ai-change-report-brief")!.textContent).toContain("대장간 2채");
      expect(findByTestId(root, "ai-change-report-findings")!.textContent).toContain("돌길 한 칸 끊김");
      expect(root.querySelector(".ai-change-wide-title")!.textContent).toContain("변경 지점 1곳");
      await flushMicrotasks();
      expect((renderShot as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
      viewer.close();
    });

    it("멀리 떨어진 두 군집이면 쌍도 두 개다 — 사진 한 장이 맵 전체가 되지 않는다", async () => {
      const { before, after, mapId } = tilePair();
      const map = after.maps[mapId]!;
      const farIndex = (map.height - 2) * map.width + (map.width - 2);
      map.lowerTiles[farIndex] = (map.lowerTiles[farIndex] ?? 0) + 1;
      const renderShot = stubRenderer();
      const sites = computeChangeSites(before, after);
      expect(sites.length).toBe(2);
      const viewer = openWideChangeViewer({ before, after, mapId, title: "결과", sites, renderShot });
      const root = card(viewer.root);
      const sections = root.querySelectorAll('[data-testid="ai-change-report-site"]');
      expect(sections.length).toBe(2);
      expect(root.querySelectorAll('[data-testid="ai-change-report-before"]').length).toBe(2);
      expect(root.querySelectorAll('[data-testid="ai-change-report-after"]').length).toBe(2);
      await flushMicrotasks();
      expect((renderShot as ReturnType<typeof vi.fn>).mock.calls.length).toBe(4);
      viewer.close();
    });

    it("sites 가 없으면 기존 한 쌍 동작 그대로다", () => {
      const { before, after, mapId } = tilePair();
      const viewer = openWideChangeViewer({ before, after, mapId, title: "변경", renderShot: stubRenderer() });
      const root = card(viewer.root);
      expect(root.className).not.toContain("is-report");
      expect(findByTestId(root, "ai-change-wide-mode-side")).toBeTruthy();
      viewer.close();
    });
  });
});

describe("aiChatLeanUi", () => {
  isolateTimers();
  function samplePlan(overrides: Partial<WorkPlan> = {}): WorkPlan {
    return {
      id: "plan-1",
      goal: "RPG 만들어줘",
      createdAt: "2026-08-14T00:00:00.000Z",
      currentLayerIndex: 0,
      currentItemId: "L1-1",
      layers: [
        {
          id: "L1",
          title: "마을",
          items: [
            { id: "L1-1", title: "마을 광장", instruction: "광장", status: "in_progress" },
            { id: "L1-2", title: "집 3채", instruction: "집", status: "pending" },
          ],
        },
      ],
      ...overrides,
    };
  }
  describe("AI 채팅 lean UI 정책", () => {
    it("단계 라벨에 모델 코드를 넣지 않는다", () => {
      expect(phaseStatusText("plan")).toBe("계획 중");
      expect(phaseStatusText("execute")).toBe("실행 중");
      expect(phaseStatusText("review")).toBe("검수 중");
    });

    it("진행 상태줄은 짧고 분모 상한을 숨긴다", () => {
      expect(formatAiRunningStatus(0, 12_000, 0, 200, "계획 중")).toBe("계획 중… 12초");
      expect(formatAiRunningStatus(0, 12_000, 4, 200, "실행 중")).toBe("실행 중… 12초 · 도구 4");
    });

    it("status 말풍선은 재시도·오류 신호만 허용한다", () => {
      expect(shouldShowStatusInChat("연결 끊김 — 재시도 중(1/2)")).toBe(true);
      expect(shouldShowStatusInChat("요청이 커서 이번 턴에는 일부만 제안합니다. 이어서 요청해 주세요.")).toBe(true);
      expect(shouldShowStatusInChat("변경 없는 종료를 감지해 실행 계획을 다시 요청합니다.")).toBe(false);
      expect(shouldShowStatusInChat("zero-change-rekick")).toBe(false);
    });

    it("조회성 툴 성공은 목록 노이즈로 분류한다", () => {
      expect(isReadOnlyToolNoise("get_map_region")).toBe(true);
      expect(isReadOnlyToolNoise("list_resources")).toBe(true);
      expect(isReadOnlyToolNoise("show_tiles")).toBe(true);
      expect(isReadOnlyToolNoise("paint_road")).toBe(false);
      expect(isReadOnlyToolNoise("build_house" as string)).toBe(false);
    });

    it("성공 툴 항목은 JSON 상세 없이 한 줄이다", () => {
      const restore = installFakeDom();
      try {
        const node = renderWithFakeDom(() =>
          renderToolActivityEntry(
            "paint_road",
            { ok: true, summary: "길 12칸" },
            { args: { mapId: "m1" }, index: 1 }
          )
        ) as FakeElement;
        expect(node.tagName).toBe("DIV");
        // 데크(2026-09-03): 한 줄 텍스트 「✓ 요약」 → 라벨/요약/상태 세 칸 행. 함수 이름은 title 로만.
        expect(node.querySelector?.(".ai-act-label")?.textContent).toBe("길 놓기");
        expect(node.querySelector?.(".ai-act-sum")?.textContent).toBe("길 12칸");
        expect(node.textContent).not.toContain("paint_road");
        expect(node.getAttribute("title")).toContain("paint_road");
        expect(node.querySelector?.("pre")).toBeFalsy();
      } finally {
        restore();
      }
    });
  });
  describe("자율 실행 예산 표시 (todo 6)", () => {
    it("자동 계속 status 텍스트에서 used/total 을 파싱한다", () => {
      expect(parseAutonomousRunBudget("자율 실행 계속 (2/48)")).toEqual({ used: 2, total: 48, exhausted: false });
      expect(parseAutonomousRunBudget("자율 실행 계속 (48/48)")).toEqual({ used: 48, total: 48, exhausted: false });
    });

    it("예산 소진 status 는 used=total + exhausted 플래그로 파싱된다", () => {
      expect(parseAutonomousRunBudget("자율 실행 예산 소진 — 「계속」이라고 보내면 이어서 진행합니다."))
        .toEqual({ used: 48, total: 48, exhausted: true });
    });

    it("무관한 status 텍스트는 null 을 돌려준다", () => {
      expect(parseAutonomousRunBudget("생각 중… 3초")).toBeNull();
      expect(parseAutonomousRunBudget("작업 계획 1/4")).toBeNull();
      expect(parseAutonomousRunBudget("")).toBeNull();
    });
  });
  describe("작업 계획 앞면 렌더", () => {
    it("상태·진행·중지·계획 보기와 예산을 렌더하고 항목 본문은 두지 않는다", () => {
      const restore = installFakeDom();
      try {
        let opened = 0;
        const node = renderWithFakeDom(() =>
          renderWorkPlanChecklist(samplePlan(), {
            active: true,
            budget: { used: 3, total: 48 },
            onOpenBook: () => {
              opened += 1;
            },
          })
        ) as FakeElement;
        expect(node.dataset.testid).toBe("ai-work-plan-checklist");
        expect(node.textContent).toContain("마을 광장 중");
        expect(node.textContent).toContain("예산 3/48");
        expect(node.querySelectorAll("[data-testid='ai-autonomous-item']")).toHaveLength(0);
        expect(node.querySelector("[data-testid='ai-autonomous-progress']")?.textContent).toBe("0/2");
        expect(node.querySelector("[data-testid='ai-run-status']")?.textContent).toBe("마을 광장 중");
        expect(node.querySelector("[data-testid='ai-run-stop']")?.textContent).toBe("중지");
        expect(node.querySelector("[data-testid='ai-plan-book-open']")?.textContent).toBe("계획 보기");
        expect(node.querySelector("[data-testid='ai-run-details-toggle']")?.textContent).toContain("자세히");
        // 2026-09-21 앞면 개편: 머리 pill(아이콘+상태) + 본문은 드롭다운. 예산 칩은 여전히 「자세히」에 둔다.
        expect(node.querySelector("[data-testid='ai-plan-head']")?.textContent).not.toContain("예산");
        expect(node.dataset.active).toBe("true");
        expect(node.dataset.complete).toBe("false");
        expect(node.querySelector("[data-testid='ai-work-item-activity']")?.textContent).toBe("진행 중…");
        node.querySelector("[data-testid='ai-plan-book-open']")?.click();
        expect(opened).toBe(1);
      } finally {
        restore();
      }
    });

    it.each([
      { active: true, stoppedReason: undefined, status: "마무리 확인 중", complete: false },
      { active: false, stoppedReason: "max-tool-calls", status: "작업 중단 — 실행 한도 도달", complete: false },
      { active: false, stoppedReason: "token-budget", status: "작업 중단 — 실행 한도 도달", complete: false },
      { active: false, stoppedReason: "error", status: "작업 중단 — 오류", complete: false },
      { active: false, stoppedReason: "apply-failed", status: "작업 중단 — 적용 실패", complete: false },
      { active: false, stoppedReason: "final", status: "모두 완료", complete: true },
    ])("체크가 끝나도 실행 상태 $stoppedReason / active=$active 를 반영한다", (state) => {
      const restore = installFakeDom();
      try {
        const plan = samplePlan();
        for (const item of plan.layers.flatMap((layer) => layer.items)) item.status = "done";
        const node = renderWithFakeDom(() => renderWorkPlanChecklist(plan, state)) as FakeElement;
        expect(node.querySelector("[data-testid='ai-run-status']")?.textContent).toBe(state.status);
        expect(node.dataset.complete).toBe(String(state.complete));
      } finally { restore(); }
    });

    it("건너뛴 항목이 남은 계획을 모두 완료로 표시하지 않는다", () => {
      const restore = installFakeDom();
      try {
        const plan = samplePlan();
        plan.layers[0]!.items[0]!.status = "done";
        plan.layers[0]!.items[1]!.status = "skipped";
        const node = renderWithFakeDom(() => renderWorkPlanChecklist(plan, { active: false, stoppedReason: "final" })) as FakeElement;
        expect(node.querySelector("[data-testid='ai-run-status']")?.textContent).toBe("계획 종료 — 건너뛴 항목 있음");
        expect(node.dataset.complete).toBe("false");
      } finally { restore(); }
    });

    it("필드가 빠진(망가진) 계획 페이로드도 안전하게 렌더한다 — 예외 없음", () => {
      const restore = installFakeDom();
      try {
        const malformed = {
          goal: "목표",
          layers: [
            { id: "L1", title: "레이어", items: [{ id: "x", title: "항목" }] },
            { title: "아이템 없는 레이어" },
          ],
        } as unknown as WorkPlan;
        const node = renderWithFakeDom(() => renderWorkPlanChecklist(malformed)) as FakeElement;
        expect(node.textContent).toContain("목표");
        expect(node.dataset.testid).toBe("ai-work-plan-checklist");
      } finally {
        restore();
      }
    });

    it("막힌 항목은 앞줄이 먼저 말하고 사유가 붙는다", () => {
      const restore = installFakeDom();
      try {
        const plan = samplePlan();
        plan.layers[0]!.items[0]!.status = "blocked";
        plan.layers[0]!.items[0]!.note = "스펙 게이트: 밑그림이 없습니다";
        const node = renderWithFakeDom(() => renderWorkPlanChecklist(plan, { active: false })) as FakeElement;
        expect(node.dataset.blocked).toBe("true");
        expect(node.querySelector("[data-testid='ai-run-status']")?.textContent).toBe("막힘 — 마을 광장");
        expect(node.querySelector("[data-testid='ai-work-item-blocked-note']")?.textContent).toBe("스펙 게이트: 밑그림이 없습니다");
        expect(node.querySelectorAll("[data-testid='ai-autonomous-item']")).toHaveLength(0);
      } finally {
        restore();
      }
    });

    it("layers 가 아예 없는 페이로드는 빈 앞면으로 안전하게 렌더한다", () => {
      const restore = installFakeDom();
      try {
        const node = renderWithFakeDom(() =>
          renderWorkPlanChecklist({ goal: "던전 하나" } as unknown as WorkPlan)
        ) as FakeElement;
        expect(node.dataset.testid).toBe("ai-work-plan-checklist");
        expect(node.textContent).toContain("던전 하나");
        expect(node.querySelector("[data-testid='ai-autonomous-progress']")?.textContent).toBe("0/0");
      } finally {
        restore();
      }
    });
  });
});
