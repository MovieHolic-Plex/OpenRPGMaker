import { describe, expect, it } from "vitest";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { resolveGraphic } from "@/editor/tools/eventCompile";
import { runTool } from "@/editor/tools";
import { ToolError } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import type { EventPageGraphic } from "@/project/types";

function expectKnownBundledSprite(graphic: EventPageGraphic, knownIds: ReadonlySet<string>): string {
  expect(graphic.sprite?.type).toBe("bundled");
  const id = graphic.sprite?.id;
  expect(id).toBeDefined();
  if (id === undefined) return "";
  expect(knownIds.has(id)).toBe(true);
  return id;
}

describe("eventCompile graphic resolution", () => {
  it("resolves abbreviated textureKey input to a validator-known bundled charset id", () => {
    const knownIds = collectResourceIds(createBlankProject());

    const graphic = resolveGraphic({ textureKey: "people1", characterIndex: 0 });

    expect(expectKnownBundledSprite(graphic, knownIds)).toBe("tex_easyrpg_charset_people1");
  });

  it("resolves full charset search ids passed as textureKey and adopts their index when caller index is zero", () => {
    const knownIds = collectResourceIds(createBlankProject());

    const graphic = resolveGraphic({ textureKey: "charset:tex_easyrpg_charset_people1:7", characterIndex: 0 });

    expect(expectKnownBundledSprite(graphic, knownIds)).toBe("tex_easyrpg_charset_people1");
    expect(graphic.pattern).toBe(charsetFrameIndex({ characterIndex: 7, direction: "down", pattern: 1 }));
  });

  it("throws a tool-time graphic-not-found error with charset candidates for garbage texture keys", () => {
    try {
      resolveGraphic({ textureKey: "not-a-real-charset", characterIndex: 0 });
      expect.unreachable("garbage texture keys must fail before commit");
    } catch (error) {
      expect(error).toBeInstanceOf(ToolError);
      if (error instanceof ToolError) {
        expect(error.code).toBe("graphic-not-found");
        expect(error.message).toContain("tex_easyrpg_charset_");
        expect(error.message).toContain('list_resources(kind:"charset")');
        expect(error.message).toContain("{query}");
        return;
      }
      throw error;
    }
  });

  it("keeps graphic query resolution on validator-known bundled charset ids", () => {
    const knownIds = collectResourceIds(createBlankProject());

    const graphic = resolveGraphic({ query: "상인" });

    expect(knownIds.has(expectKnownBundledSprite(graphic, knownIds))).toBe(true);
  });
});

// 감사 로그 회귀(BUG A): place_npc가 축약 textureKey로도 커밋 게이트(직렬화 왕복/참조 검증)를 통과한다.
// 이전에는 sprite.id가 "people1"로 남아 "graphic.sprite가 존재하지 않습니다"로 커밋 거부됐다.
describe("place_npc 그래픽 커밋 회귀(BUG A)", () => {
  function withMap() {
    const ctx = { project: createBlankProject() };
    const created = runTool(ctx, "create_map", { id: "m_npc", name: "NPC 테스트", width: 8, height: 8 });
    expect(created.ok).toBe(true);
    return ctx;
  }

  it("축약 textureKey('people1')로도 place_npc가 커밋된다", () => {
    const ctx = withMap();
    const result = runTool(ctx, "place_npc", {
      mapId: "m_npc",
      x: 3,
      y: 3,
      name: "촌장",
      graphic: { textureKey: "people1", characterIndex: 0 },
      pages: [{ lines: ["안녕하세요."] }],
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  });

  it("전체 검색 id를 textureKey에 넣어도 place_npc가 커밋된다", () => {
    const ctx = withMap();
    const result = runTool(ctx, "place_npc", {
      mapId: "m_npc",
      x: 3,
      y: 3,
      name: "촌장",
      graphic: { textureKey: "charset:tex_easyrpg_charset_people1:7", characterIndex: 7 },
      pages: [{ lines: ["안녕."] }],
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  });
});
