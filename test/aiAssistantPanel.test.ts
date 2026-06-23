import { describe, expect, it } from "vitest";
import {
  aiPreviewDiffLines,
  aiPreviewEvidenceLines,
  aiPreviewSourceFingerprint,
  aiPreviewSourceMatches,
} from "@/editor/panels/aiAssistantPanel";
import { createAiPreviewProject } from "@/project/aiPreviewGenerator";
import { createBlankProject } from "@/project/defaults";

describe("AI assistant preview summaries", () => {
  it("shows diff, evidence, and approval-relevant metadata for a successful preview", () => {
    const source = createBlankProject();
    const result = createAiPreviewProject({ goal: "작은 항구 마을", sourceProject: source });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.clarificationQuestion);

    expect(aiPreviewDiffLines(source, result)).toEqual([
      expect.stringContaining("프리뷰 맵:"),
      `맵 수: ${Object.keys(source.maps).length} → ${Object.keys(result.project.maps).length}`,
      `시작 맵: ${source.startMapId} → ${result.project.startMapId}`,
      expect.stringContaining("NPC: 항구 안내인/preview-guide"),
    ]);
    expect(aiPreviewEvidenceLines(result)).toEqual([
      expect.stringContaining("ChipSet 증거:"),
      expect.stringContaining("CharSet 증거: easyrpg-charset-people"),
      expect.stringContaining("타일 그룹:"),
      expect.stringContaining("reachableNpcEvents=통과"),
    ]);
    expect(source.startMapId).not.toBe(result.project.startMapId);
  });

  it("surfaces fail-closed missing evidence instead of approval metadata", () => {
    const result = createAiPreviewProject({ goal: "추상적인 분위기", sourceProject: createBlankProject() });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected fail-closed result");

    expect(aiPreviewDiffLines(createBlankProject(), result)).toEqual(["적용될 프로젝트 변경 없음."]);
    expect(aiPreviewEvidenceLines(result)).toEqual([
      expect.stringContaining("질문:"),
      expect.stringContaining("부족한 증거: charset_not_high_confidence"),
    ]);
  });
  it("invalidates stale generated previews when the source project changes before approval", () => {
    const source = createBlankProject();
    const fingerprint = aiPreviewSourceFingerprint(source);

    expect(aiPreviewSourceMatches(source, fingerprint)).toBe(true);

    source.meta.title = "changed after preview generation";

    expect(aiPreviewSourceMatches(source, fingerprint)).toBe(false);
  });
});
