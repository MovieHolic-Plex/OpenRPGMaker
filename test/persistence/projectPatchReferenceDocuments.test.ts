import { describe, expect, it } from "vitest";
import { diffProjectDocuments, applyProjectDocumentPatch, withWirePatchValues } from "@/project/persistence/core/projectPatch";
import { projectWireView, serialize } from "@/project/io/serialize";
import { createBlankProject } from "@/project/defaults";
import type { Project, TilesetReferenceCategory } from "@/project/types";

/**
 * 저장 패치가 타일셋 참고문서(프로젝트당 수십 MB)를 **비교에서만** 건너뛰고,
 * 실제로 바뀌었을 때는 payload 에 그대로 실어 보내는지 고정한다.
 *
 * 왜 이 테스트인가 (2026-09-25 실측): 참고문서가 42MB 인 프로젝트에서 자동저장 한 번이
 * 메인 스레드를 5.1s 잡았다. 그 대부분이 diff 가 타일셋 322칸을 문서 본문까지 JSON.stringify
 * 하던 비용이다. 비교를 배열 실체/요약으로 줄이는 변경의 위험은 **문서가 조용히 빠지는 것**이라
 * 손실 방향을 직접 검증한다.
 */

function documents(label: string): TilesetReferenceCategory[] {
  return [{
    id: `cat-${label}`,
    purpose: label,
    documents: [{ id: `doc-${label}`, title: label, markdown: `# ${label}` }],
    images: [],
  }] as unknown as TilesetReferenceCategory[];
}

function projectWithDocuments(docs: TilesetReferenceCategory[] | undefined): Project {
  const project = createBlankProject();
  const tilesetId = Object.keys(project.tilesets)[0]!;
  const tileset = project.tilesets[tilesetId]!;
  project.tilesets[tilesetId] = docs === undefined
    ? { ...tileset }
    : { ...tileset, referenceDocuments: docs };
  return project;
}

describe("저장 패치의 타일셋 참고문서 처리", () => {
  it("문서 배열을 공유하면 타일셋은 변경으로 잡히지 않는다", () => {
    const shared = documents("shared");
    const base = projectWithDocuments(shared);
    const local = projectWithDocuments(shared);
    const patch = diffProjectDocuments(projectWireView(base), projectWireView(local));
    expect(patch.tilesets).toBeUndefined();
  });

  it("문서 내용이 실제로 바뀌면 패치가 문서 전체를 싣는다", () => {
    const base = projectWithDocuments(documents("before"));
    const local = projectWithDocuments(documents("after"));
    const tilesetId = Object.keys(local.tilesets)[0]!;
    const patch = diffProjectDocuments(projectWireView(base), projectWireView(local));
    const changed = patch.tilesets?.set?.[tilesetId] as { referenceDocuments?: unknown } | undefined;
    expect(changed).toBeDefined();
    expect(changed?.referenceDocuments).toEqual(documents("after"));
  });

  it("문서를 지우면 삭제 방향도 패치에 실린다", () => {
    const base = projectWithDocuments(documents("only"));
    const local = projectWithDocuments(undefined);
    const tilesetId = Object.keys(local.tilesets)[0]!;
    const patch = diffProjectDocuments(projectWireView(base), projectWireView(local));
    const changed = patch.tilesets?.set?.[tilesetId] as Record<string, unknown> | undefined;
    expect(changed).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(changed ?? {}, "referenceDocuments")).toBe(false);
  });

  it("문서 밖 타일셋 필드 변경은 그대로 잡힌다", () => {
    const shared = documents("shared");
    const base = projectWithDocuments(shared);
    const local = projectWithDocuments(shared);
    const tilesetId = Object.keys(local.tilesets)[0]!;
    local.tilesets[tilesetId] = { ...local.tilesets[tilesetId]!, name: "다른 이름" };
    const patch = diffProjectDocuments(projectWireView(base), projectWireView(local));
    expect((patch.tilesets?.set?.[tilesetId] as { name?: string } | undefined)?.name).toBe("다른 이름");
  });

  it("패치를 기준 문서에 얹으면 serialize 와 같은 문서가 나온다", () => {
    const base = projectWithDocuments(documents("before"));
    const local = projectWithDocuments(documents("after"));
    local.maps[local.startMapId]!.name = "바뀐 맵";
    const patch = withWirePatchValues(diffProjectDocuments(projectWireView(base), projectWireView(local)));
    const restored = applyProjectDocumentPatch(JSON.parse(serialize(base)) as unknown, patch);
    expect(restored).toEqual(JSON.parse(serialize(local)));
  });
});
