import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assistantIdleHints,
  directorStartPrompts,
  formatComposerPlaceholder,
  idlePresenceLine,
  nextStepHint,
  readAgentBrief,
} from "@/editor/panels/aiAgentBrief";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

describe("readAgentBrief", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
    const mapId = store.getCurrent().startMapId;
    editorState.set({
      currentMapId: mapId,
      layer: "lower",
      tool: "paint",
      selection: null,
    });
  });

  afterEach(() => {
  });

  it("맵 크기·레이어·도구를 한 줄로 읽는다", () => {
    const brief = readAgentBrief();
    expect(brief.mapName).toBe("빈 맵");
    expect(brief.mapSize).toBe("20×15");
    expect(brief.layerShort).toBe("바닥");
    expect(brief.toolLabel).toBe("칠하기");
    expect(brief.line).toBe("빈 맵 20×15 · 바닥 · 칠하기");
    expect(brief.lookingAt).toBe("지금 빈 맵 20×15");
    expect(brief.eventCount).toBe(0);
  });

  it("이벤트 레이어+도구는 도구를 중복하지 않는다", () => {
    editorState.set({ layer: "event", tool: "event" });
    expect(readAgentBrief().line).toBe("빈 맵 20×15 · 이벤트");
  });

  it("선택 영역이 있으면 줄과 placeholder에 칸 수가 실린다", () => {
    const mapId = store.getCurrent().startMapId;
    editorState.set({
      selection: { mapId, x: 3, y: 4, width: 4, height: 3 },
    });
    const brief = readAgentBrief();
    expect(brief.selectionLabel).toBe("선택 4×3 (3,4)");
    expect(brief.line).toContain("선택 4×3 (3,4)");
    expect(formatComposerPlaceholder()).toBe("한 문장으로 지시");
  });

  it("선택이 있으면 선택 꾸미기 명령을 앞에 둔다", () => {
    const mapId = store.getCurrent().startMapId;
    editorState.set({
      selection: { mapId, x: 0, y: 0, width: 2, height: 2 },
    });
    const prompts = directorStartPrompts(readAgentBrief());
    expect(prompts.map((prompt) => prompt.id)).toEqual(["selection", "place", "character"]);
    expect(prompts).toHaveLength(3);
  });

  it("이벤트 레이어에서는 등장인물 명령을 앞에 둔다", () => {
    editorState.set({ layer: "event", tool: "event" });
    const prompts = directorStartPrompts(readAgentBrief());
    expect(prompts[0]?.id).toBe("character");
    expect(prompts[0]?.instruction).toContain("빈 맵");
  });

  it("대기 한 줄과 골드 힌트 둘을 준다", () => {
    const brief = readAgentBrief();
    expect(idlePresenceLine(brief)).toBe("이 맵에 무엇을 둘까요");
    expect(assistantIdleHints(brief)).toHaveLength(2);
    expect(assistantIdleHints(brief)[0]?.label).toBe("강가를 만들어줘");
    expect(formatComposerPlaceholder()).toBe("한 문장으로 지시");
  });

  it("빈 맵은 버튼을 누르라고 안내한다", () => {
    expect(nextStepHint(readAgentBrief())).toBe("빈 맵이에요. 아래 중 하나를 누르면 바로 시작합니다.");
  });

  it("흙길 오토타일 외곽만 있어도 실제 길로 인식한다", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("start map missing");
    map.lowerTiles[7 * map.width + 2] = 390;
    map.lowerTiles[7 * map.width + 3] = 391;
    map.lowerTiles[7 * map.width + 4] = 392;
    store.replace(structuredClone(project));

    const brief = readAgentBrief();
    expect(brief.hasPath).toBe(true);
    expect(nextStepHint(brief)).not.toContain("길이 없어요");
  });

  it("선택이 있으면 그 칸을 고르라고 안내한다", () => {
    const mapId = store.getCurrent().startMapId;
    editorState.set({
      selection: { mapId, x: 1, y: 1, width: 2, height: 2 },
    });
    expect(nextStepHint(readAgentBrief())).toBe("선택한 칸에 무엇을 둘지 골라 보세요.");
  });
});
