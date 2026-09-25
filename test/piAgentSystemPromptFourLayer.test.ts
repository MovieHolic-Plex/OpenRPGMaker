// 네 층 타일셋이면 Pi 시스템 프롬프트에 한 줄 — 계획 docs/superpowers/plans/2026-09-25-mz-layers-assistant.md Task 5.
// 옛 프로젝트(선택 층 없음·표지 없음)의 프롬프트는 그 줄이 생기기 전과 글자까지 같아야 한다.
import { describe, expect, it } from "vitest";
import { buildPiAgentSystemPrompt, FOUR_LAYER_REFERENCE_MARKER } from "@/ai/piAgent/systemPrompt";
import { createBlankProject } from "@/project/defaults";
import { setLayerTileAt } from "@/project/mapLayers";
import type { Project } from "@/project/types";

const MAP_ID = "map_blank_start";
const isFourLayerLine = (line: string): boolean => line.includes("MZ 네 층");

function withMarkerReference(project: Project, markdown: string): Project {
  const tilesetId = project.maps[MAP_ID]!.tilesetId;
  const tileset = project.tilesets[tilesetId]!;
  delete tileset.referenceSourceTilesetId;
  tileset.referenceDocuments = [{
    id: "swamp", name: "늪지", description: "늪지 조립", images: [],
    documents: [{ id: "rules", name: "규칙", markdown }],
  }];
  return project;
}

describe("Pi 시스템 프롬프트 — 네 층 타일셋 줄", () => {
  it("옛 프로젝트에는 줄이 없고, 네 층 맵이 생긴 프롬프트에서 그 한 줄만 빼면 글자까지 같다", () => {
    const old = createBlankProject();
    const oldLines = buildPiAgentSystemPrompt(old, [MAP_ID]);
    expect(oldLines.some(isFourLayerLine)).toBe(false);
    expect(oldLines.join("\n")).not.toContain("stamp_layer_block");

    const layered = createBlankProject();
    const map = layered.maps[MAP_ID]!;
    setLayerTileAt(map, 2, 0, 10);
    const lines = buildPiAgentSystemPrompt(layered, [MAP_ID]);
    const added = lines.filter(isFourLayerLine);
    expect(added).toHaveLength(1);
    expect(added[0]).toContain("stamp_layer_block");
    expect(added[0]).toContain(map.tilesetId);
    expect(lines.filter((line) => !isFourLayerLine(line)).join("\n")).toBe(oldLines.join("\n"));
  });

  it("같은 타일셋을 쓰는 다른 맵에 선택 층이 있어도 줄이 붙는다", () => {
    const project = createBlankProject();
    const start = project.maps[MAP_ID]!;
    const other = { ...structuredClone(start), id: "map_other" as typeof start.id, name: "다른 맵" };
    other.shadowBits = new Array<number>(other.width * other.height).fill(0);
    other.shadowBits[3] = 1;
    project.maps[other.id] = other;
    expect(buildPiAgentSystemPrompt(project, [MAP_ID]).filter(isFourLayerLine)).toHaveLength(1);
  });

  it("참고문서 용도 첫 문서가 layer-model: mz4 로 시작하면 빈 맵이어도 줄이 붙는다", () => {
    const project = withMarkerReference(createBlankProject(), `${FOUR_LAYER_REFERENCE_MARKER}\n# 늪지 규칙\n...`);
    expect(buildPiAgentSystemPrompt(project, [MAP_ID]).filter(isFourLayerLine)).toHaveLength(1);
  });

  it("표지가 첫 줄이 아니거나 범위가 프로젝트 전체면 붙지 않는다", () => {
    const notFirst = withMarkerReference(createBlankProject(), `# 늪지\n${FOUR_LAYER_REFERENCE_MARKER}\n`);
    expect(buildPiAgentSystemPrompt(notFirst, [MAP_ID]).some(isFourLayerLine)).toBe(false);
    const marked = withMarkerReference(createBlankProject(), `${FOUR_LAYER_REFERENCE_MARKER}\n`);
    expect(buildPiAgentSystemPrompt(marked, []).some(isFourLayerLine)).toBe(false);
  });
});
