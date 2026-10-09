import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { AiDocument } from "@/project/types";

const INTERIOR = "easyrpg_chipset_interior";

function ctxOf(): ToolContext {
  return { project: createBlankProject() };
}

describe("present_doc — AI 리치 문서 툴", () => {
  it("구조화 블록 문서를 만들어 project.aiDocuments에 영속하고 data.document로 반환한다", () => {
    const ctx = ctxOf();
    const result = runTool(ctx, "present_doc", {
      title: "오토타일 블록 안내",
      blocks: [
        { kind: "markdown", text: "## 다크월\n칩셋 6~8열 12~15행" },
        {
          kind: "sheetMap",
          tilesetId: INTERIOR,
          zones: [{ col: 6, row: 12, w: 3, h: 4, label: "다크월" }],
        },
        { kind: "tileBlockCard", tilesetId: INTERIOR, col: 6, row: 12, w: 3, h: 4, title: "다크월 블록", badge: "구현됨" },
        { kind: "paintDemo", tilesetId: INTERIOR, blockCol: 6, blockRow: 12 },
        { kind: "table", headers: ["타일", "역할"], rows: [["368", "오목 코너 소스"]] },
        { kind: "html", src: "<p>자유형 블록</p>" },
      ],
    });
    expect(result.ok).toBe(true);
    const docs = ctx.project.aiDocuments ?? [];
    expect(docs).toHaveLength(1);
    expect(docs[0]!.title).toBe("오토타일 블록 안내");
    expect(docs[0]!.blocks).toHaveLength(6);
    const data = result.data as { document: AiDocument };
    expect(data.document.id).toMatch(/^aidoc_/);
    expect(data.document.blocks[0]).toMatchObject({ kind: "markdown" });
  });

  it("알 수 없는 블록 kind와 없는 타일셋을 거부한다", () => {
    const ctx = ctxOf();
    expect(runTool(ctx, "present_doc", { title: "x", blocks: [{ kind: "video", src: "x" }] }).ok).toBe(false);
    expect(
      runTool(ctx, "present_doc", {
        title: "x",
        blocks: [{ kind: "tileBlockCard", tilesetId: "no_such_tileset", col: 0, row: 0, w: 1, h: 1, title: "t" }],
      }).ok,
    ).toBe(false);
    expect(ctx.project.aiDocuments ?? []).toHaveLength(0);
  });

  it("list_ai_docs가 저장된 문서 목록을 반환한다", () => {
    const ctx = ctxOf();
    runTool(ctx, "present_doc", { title: "문서 1", blocks: [{ kind: "markdown", text: "hello" }] });
    runTool(ctx, "present_doc", { title: "문서 2", blocks: [{ kind: "markdown", text: "world" }] });
    const result = runTool(ctx, "list_ai_docs", {});
    expect(result.ok).toBe(true);
    const data = result.data as { documents: { title: string; blockCount: number }[] };
    expect(data.documents.map((doc) => doc.title)).toEqual(["문서 1", "문서 2"]);
  });

  it("list_ai_docs가 query로 제목·마크다운 본문을 부분일치 검색한다(대소문자 무시)", () => {
    const ctx = ctxOf();
    runTool(ctx, "present_doc", { title: "오토타일 안내", blocks: [{ kind: "markdown", text: "다크월 블록 구조" }] });
    runTool(ctx, "present_doc", { title: "NPC Guide", blocks: [{ kind: "markdown", text: "주민 배치 요령" }] });

    const byTitle = runTool(ctx, "list_ai_docs", { query: "npc" });
    expect(byTitle.ok).toBe(true);
    expect((byTitle.data as { documents: { title: string }[] }).documents.map((doc) => doc.title)).toEqual(["NPC Guide"]);

    const byBody = runTool(ctx, "list_ai_docs", { query: "다크월" });
    expect((byBody.data as { documents: { title: string }[] }).documents.map((doc) => doc.title)).toEqual(["오토타일 안내"]);

    const miss = runTool(ctx, "list_ai_docs", { query: "존재하지않음" });
    expect((miss.data as { documents: unknown[] }).documents).toHaveLength(0);
  });

  it("aiDocuments가 직렬화 왕복에서 보존된다", () => {
    const ctx = ctxOf();
    runTool(ctx, "present_doc", {
      title: "왕복 문서",
      blocks: [
        { kind: "markdown", text: "지속성 테스트" },
        { kind: "tileBlockCard", tilesetId: INTERIOR, col: 0, row: 12, w: 3, h: 4, title: "산울타리" },
      ],
    });
    const restored = deserialize(serialize(ctx.project));
    expect(restored.aiDocuments).toHaveLength(1);
    expect(restored.aiDocuments?.[0]).toMatchObject({ title: "왕복 문서" });
    expect(restored.aiDocuments?.[0]?.blocks).toHaveLength(2);
  });
});
