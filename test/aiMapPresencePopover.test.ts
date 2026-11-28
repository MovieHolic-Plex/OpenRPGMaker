import { afterEach, describe, expect, it } from "vitest";
import { createTeamBoardState, reduceTeamBoard } from "@/ai/piAgent/teamBoardState";
import { publishTeamActivity } from "@/ai/piAgent/teamActivity";
import { mountAiMapPresence } from "@/editor/aiMapPresence";
import { resetJobNumbersForTest } from "@/editor/aiJobNumbers";
import { editorState } from "@/editor/editorState";
import { markDragOrigin } from "@/editor/panels/aiPresence";
import { closePresencePopover, disposePresencePopover } from "@/editor/panels/aiPresencePopover";
import { mountAiStatusBar } from "@/editor/panels/aiStatusBar";
import { setRegionClientRectResolver } from "@/editor/regionClientRect";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

describe("aiMapPresence clickable badge → live progress popover", () => {
  let restoreDom: (() => void) | null = null;
  let unmountPresence: (() => void) | null = null;
  let unmountBar: (() => void) | null = null;

  afterEach(() => {
    unmountPresence?.();
    unmountPresence = null;
    unmountBar?.();
    unmountBar = null;
    disposePresencePopover();
    publishTeamActivity(null);
    setRegionClientRectResolver(null);
    resetJobNumbersForTest();
    restoreDom?.();
    restoreDom = null;
  });

  function setupHost(): { mapId: string; mapName: string } {
    restoreDom = installFakeDom({ window: true });
    const project = createBlankProject("테스트");
    const mapId = Object.keys(project.maps)[0]!;
    const mapName = project.maps[mapId]!.name;
    store.load(project);
    editorState.set({ currentMapId: mapId });
    const host = document.createElement("div");
    host.className = "phaser-container";
    host.getBoundingClientRect = () => ({ left: 0, top: 0, right: 900, bottom: 700, width: 900, height: 700, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    document.body.append(host);
    setRegionClientRectResolver((rect) => ({
      x: rect.x * 32,
      y: rect.y * 32,
      width: rect.width * 32,
      height: rect.height * 32,
    }));
    return { mapId, mapName };
  }

  it("opens live progress popover when clicking the dragged 시공 badge even while right dock covers status bar", () => {
    const { mapId } = setupHost();
    unmountBar = mountAiStatusBar();
    unmountPresence = mountAiMapPresence();

    const task = "분수대와 벤치를 놓아 줘";
    markDragOrigin({ text: task, mapId, region: { x: 4, y: 5, width: 6, height: 5 } });

    let board = createTeamBoardState("single", task, "proj-1");
    board = reduceTeamBoard(board, {
      type: "agent_spawn",
      agentId: mapId,
      role: "builder",
      mapId,
      mapName: "마을",
      task,
    });
    board = reduceTeamBoard(board, {
      type: "agent_event",
      agentId: mapId,
      event: { type: "tool_start", id: "t1", name: "stamp_object", args: { mapId, name: "분수대" } },
    });
    publishTeamActivity(board);

    const tag = document.querySelector<HTMLButtonElement>('[data-testid="ai-map-region-tag"]');
    expect(tag).not.toBeNull();
    expect(tag?.tagName).toBe("BUTTON");
    expect(tag?.textContent).toContain("시공");
    expect(tag?.getAttribute("aria-expanded")).toBe("false");

    // 하단 상태 줄(ai-status-bar)은 노출되지 않고, 지도 위 시공 배지 클릭으로 팝오버가 열려야 한다.
    expect(document.querySelector<HTMLElement>('[data-testid="ai-status-bar"]')?.hidden).toBe(true);
    tag!.click();
    const pop = document.querySelector<HTMLElement>('[data-testid="ai-status-pop"]');
    expect(pop).not.toBeNull();
    expect(pop?.hidden).toBe(false);
    expect(tag?.getAttribute("aria-expanded")).toBe("true");
    expect(pop?.querySelector('[data-testid="ai-status-pop-task"]')?.textContent).toContain(task);
    expect(pop?.textContent).toContain("(4,5) 6×5");
    expect(pop?.querySelector('[data-testid="ai-status-pop-timeline"] li[data-status="running"]')).not.toBeNull();

    // 도구 완료 + 새 도구 시작 시 팝오버가 닫히지 않고 실시간으로 갱신된다.
    board = reduceTeamBoard(board, {
      type: "agent_event",
      agentId: mapId,
      event: { type: "tool_end", id: "t1", name: "stamp_object", ok: true, summary: "분수대 배치" },
    });
    board = reduceTeamBoard(board, {
      type: "agent_event",
      agentId: mapId,
      event: { type: "tool_start", id: "t2", name: "place_npc", args: { mapId, name: "마을 주민" } },
    });
    publishTeamActivity(board);

    expect(pop?.hidden).toBe(false);
    expect(pop?.querySelectorAll('[data-testid="ai-status-pop-timeline"] li[data-status="ok"]').length).toBeGreaterThanOrEqual(1);
    expect(pop?.querySelector('[data-testid="ai-status-pop-timeline"] li[data-status="running"]')).not.toBeNull();

    // 같은 배지를 다시 누르면 닫힌다.
    tag!.click();
    expect(pop?.hidden).toBe(true);
    expect(tag?.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps popover open seamlessly when pre-spawn run hands off to spawned builder agent", () => {
    const { mapId } = setupHost();
    unmountPresence = mountAiMapPresence();

    const task = "작은 연못을 만들어 줘";
    markDragOrigin({ text: task, mapId, region: { x: 2, y: 3, width: 4, height: 4 } });

    let board = createTeamBoardState("single", task, "proj-1");
    publishTeamActivity(board);

    const runTag = document.querySelector<HTMLButtonElement>('[data-testid="ai-map-region-tag"]');
    expect(runTag).not.toBeNull();
    runTag!.click();

    const pop = document.querySelector<HTMLElement>('[data-testid="ai-status-pop"]');
    expect(pop?.hidden).toBe(false);
    expect(pop?.textContent).toContain(task);

    board = reduceTeamBoard(board, {
      type: "agent_spawn",
      agentId: mapId,
      role: "builder",
      mapId,
      mapName: "마을",
      task,
    });
    board = reduceTeamBoard(board, {
      type: "agent_event",
      agentId: mapId,
      event: { type: "tool_start", id: "t1", name: "fill_region", args: { mapId } },
    });
    publishTeamActivity(board);

    expect(pop?.hidden).toBe(false);
    expect(pop?.textContent).toContain("시공");
    expect(pop?.querySelector('[data-testid="ai-status-pop-timeline"] li[data-status="running"]')).not.toBeNull();

    closePresencePopover();
    expect(pop?.hidden).toBe(true);
  });

  it("supports expanding individual tool steps and toggling detail mode with memo, stats, and upcoming todos", () => {
    const { mapId } = setupHost();
    unmountPresence = mountAiMapPresence();

    const task = "광장에 분수대와 벤치, 휴식 주민을 배치해 줘";
    markDragOrigin({ text: task, mapId, region: { x: 4, y: 5, width: 6, height: 5 } });

    let board = createTeamBoardState("single", task, "proj-1");
    board = reduceTeamBoard(board, {
      type: "agent_spawn",
      agentId: mapId,
      role: "builder",
      mapId,
      mapName: "마을",
      task,
    });
    board = reduceTeamBoard(board, {
      type: "agent_event",
      agentId: mapId,
      event: { type: "turn", index: 1 },
    });
    board = reduceTeamBoard(board, {
      type: "agent_event",
      agentId: mapId,
      event: { type: "assistant", text: "광장 바닥을 먼저 정리한 뒤 중앙에 분수대와 벤치를 배치하겠습니다." },
    });
    board = reduceTeamBoard(board, {
      type: "agent_event",
      agentId: mapId,
      event: { type: "tool_start", id: "todo1", name: "todo", args: { op: "init", items: ["포석 정리", "분수대 배치", "주민 배치"] } },
    });
    board = reduceTeamBoard(board, {
      type: "agent_event",
      agentId: mapId,
      event: { type: "tool_end", id: "todo1", name: "todo", ok: true, summary: "할 일 3건" },
    });
    board = reduceTeamBoard(board, {
      type: "agent_event",
      agentId: mapId,
      event: { type: "tool_start", id: "t1", name: "stamp_object", args: { mapId, name: "분수대", x: 7, y: 7 } },
    });
    publishTeamActivity(board);

    document.querySelector<HTMLButtonElement>('[data-testid="ai-map-region-tag"]')?.click();
    const pop = document.querySelector<HTMLElement>('[data-testid="ai-status-pop"]');
    expect(pop?.hidden).toBe(false);
    expect(pop?.querySelector('[data-testid="ai-status-pop-now-sub"]')?.textContent).toContain("stamp_object");
    expect(pop?.querySelector('[data-testid="ai-status-pop-note"]')?.textContent).toContain("광장 바닥을 먼저 정리");
    expect(pop?.querySelector('[data-testid="ai-status-pop-stats"]')?.textContent).toContain("1턴");
    expect(pop?.querySelector('[data-testid="ai-status-pop-next"]')?.textContent).toContain("주민 배치");

    // 기본 보기에서는 개별 단계를 눌러 도구·입력 상세를 펼칠 수 있다.
    expect(pop?.querySelectorAll('[data-testid="ai-status-step-detail"]').length).toBe(0);
    pop?.querySelector<HTMLButtonElement>('[data-testid="ai-status-step-toggle"]')?.click();
    expect(pop?.querySelectorAll('[data-testid="ai-status-step-detail"]').length).toBe(1);
    expect(pop?.querySelector('[data-testid="ai-status-step-detail"]')?.textContent).toContain("stamp_object");

    // 「자세히」 전환 시 모든 도구 단계 상세가 펼쳐지고 data-detail="true" 가 된다.
    pop?.querySelector<HTMLButtonElement>('[data-testid="ai-status-pop-detail-toggle"]')?.click();
    expect(pop?.dataset.detail).toBe("true");
    expect(pop?.querySelectorAll('[data-testid="ai-status-step-detail"]').length).toBeGreaterThanOrEqual(2);
  });
});
