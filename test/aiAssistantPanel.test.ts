import { describe, expect, it } from "vitest";
import {
  aiPreviewDiffLines,
  aiPreviewEvidenceLines,
  aiPreviewSourceFingerprint,
  aiPreviewSourceMatches,
  renderPreviewReport,
} from "@/editor/panels/aiAssistantPanel";
import { createAiPreviewProject } from "@/project/aiPreviewGenerator";
import { createBlankProject } from "@/project/defaults";
import { FakeElement, installFakeDom } from "./fakeDom";

function withFakeDom<T>(run: () => T): T {
  const restore = installFakeDom();
  try {
    return run();
  } finally {
    restore();
  }
}

function directParagraphText(container: HTMLElement): string[] {
  return (Array.from(container.childNodes) as unknown[])
    .filter((node): node is FakeElement => node instanceof FakeElement && node.tagName === "P")
    .map((node) => node.textContent);
}

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

  it("renders technical preview evidence under a default-closed validation details block", () => {
    withFakeDom(() => {
      const container = document.createElement("div");

      renderPreviewReport(container, {
        beforeDetails: ["프리뷰 맵: 작은 항구"],
        detailLines: ["ChipSet 증거: combined-town / high"],
        afterDetails: ["승인 전까지 원본 프로젝트는 변경되지 않습니다."],
      });

      const details = container.querySelector("details");
      expect(details?.getAttribute("open")).toBeNull();
      expect(details?.querySelector("summary")?.textContent).toBe("생성 검증 상세");
      expect(details?.textContent).toContain("ChipSet 증거");
    });
  });

  it("keeps diff and approval lines visible while evidence text stays inside details", () => {
    withFakeDom(() => {
      const container = document.createElement("div");

      renderPreviewReport(container, {
        beforeDetails: ["프리뷰 맵: 작은 항구", "맵 수: 1 → 2"],
        detailLines: ["CharSet 증거: easyrpg-charset-people"],
        afterDetails: ["승인 전까지 원본 프로젝트는 변경되지 않습니다."],
      });

      expect(directParagraphText(container)).toEqual([
        "프리뷰 맵: 작은 항구",
        "맵 수: 1 → 2",
        "승인 전까지 원본 프로젝트는 변경되지 않습니다.",
      ]);
      expect(directParagraphText(container).join("\n")).not.toContain("증거");
      expect(container.querySelector("details")?.textContent).toContain("CharSet 증거");
    });
  });

  it("omits the validation details block when there are no technical lines", () => {
    withFakeDom(() => {
      const container = document.createElement("div");

      renderPreviewReport(container, {
        beforeDetails: ["프리뷰 목표를 먼저 입력하세요."],
      });

      expect(container.querySelector("details")).toBeNull();
      expect(directParagraphText(container)).toEqual(["프리뷰 목표를 먼저 입력하세요."]);
    });
  });
});
