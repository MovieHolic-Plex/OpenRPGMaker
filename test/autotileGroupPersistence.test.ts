import { beforeEach, describe, expect, it } from "vitest";
import { serialize, deserialize } from "@/project/io";
import { createBlankProject } from "@/project/defaults";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { DEFAULT_AUTOTILE_GROUPS } from "@/project/defaults/autotileGroups";
import { store } from "@/project/store";
import {
  addAutotileGroup,
  fillAutotileVariantMap,
  removeAutotileGroup,
  seedDefaultAutotileGroups,
  setAutotileVariant,
  updateAutotileGroup,
} from "@/editor/tilesetActions";
import type { Project } from "@/project/types";

function firstTilesetId(project: Project): string {
  const id = Object.keys(project.tilesets)[0];
  if (!id) throw new Error("no tileset in blank project");
  return id;
}

function canonicalProject(): Project {
  const project = createBlankProject();
  // Text-only titleGraphic is omitted by system normalization. Keep that
  // unrelated migration out of the autotile byte-stability precondition.
  project.system = normalizeSystemRecords(project.system);
  return project;
}

beforeEach(() => {
  store.replace(canonicalProject());
});

describe("오토타일 그룹 직렬화 왕복", () => {
  it("구버전(오토타일 필드 없음) 프로젝트가 그대로 로드된다", () => {
    const project = canonicalProject();
    // 기본 프로젝트에는 autotileGroups 가 없다 → optional 필드이므로 왕복 무손실.
    const restored = deserialize(serialize(project));
    expect(serialize(restored)).toBe(serialize(project));
    const tilesetId = firstTilesetId(restored);
    expect(restored.tilesets[tilesetId].autotileGroups).toBeUndefined();
  });

  it("오토타일 그룹이 있는 프로젝트가 왕복 후 보존된다", () => {
    const tilesetId = firstTilesetId(store.getCurrent());
    const groupId = addAutotileGroup(tilesetId, "임포트 길");
    expect(groupId).not.toBeNull();
    fillAutotileVariantMap(tilesetId, groupId!, {
      body: 100,
      edgeN: 101,
      edgeS: 102,
      edgeW: 103,
      edgeE: 104,
      cornerNW: 105,
      cornerNE: 106,
      cornerSW: 107,
      cornerSE: 108,
    });
    updateAutotileGroup(tilesetId, groupId!, { memberTileIds: [100, 101, 102, 103, 104, 105, 106, 107, 108] });

    const before = store.getCurrent();
    const restored = deserialize(serialize(before));
    expect(serialize(restored)).toBe(serialize(before));

    const group = restored.tilesets[tilesetId].autotileGroups?.[0];
    expect(group?.name).toBe("임포트 길");
    expect(Object.keys(group?.variantMap ?? {})).toHaveLength(16);
    expect(group?.variantMap[String(0)]).toBe(105); // 이웃 전무 → 북서 모서리
  });
});

describe("오토타일 그룹 뮤테이션", () => {
  it("그룹 추가/기본값 시드/삭제가 동작한다", () => {
    const tilesetId = firstTilesetId(store.getCurrent());

    seedDefaultAutotileGroups(tilesetId);
    expect(store.getCurrent().tilesets[tilesetId].autotileGroups).toEqual(DEFAULT_AUTOTILE_GROUPS);

    const groupId = addAutotileGroup(tilesetId, "추가");
    expect(store.getCurrent().tilesets[tilesetId].autotileGroups).toHaveLength(DEFAULT_AUTOTILE_GROUPS.length + 1);

    removeAutotileGroup(tilesetId, groupId!);
    expect(store.getCurrent().tilesets[tilesetId].autotileGroups).toEqual(DEFAULT_AUTOTILE_GROUPS);
  });

  it("단일 비트마스크 항목 편집과 제거", () => {
    const tilesetId = firstTilesetId(store.getCurrent());
    const groupId = addAutotileGroup(tilesetId, "그룹")!;

    setAutotileVariant(tilesetId, groupId, 5, 42);
    expect(store.getCurrent().tilesets[tilesetId].autotileGroups?.[0].variantMap[String(5)]).toBe(42);

    setAutotileVariant(tilesetId, groupId, 5, null);
    expect(store.getCurrent().tilesets[tilesetId].autotileGroups?.[0].variantMap[String(5)]).toBeUndefined();
  });

  it("마지막 그룹을 지우면 autotileGroups 필드가 제거된다", () => {
    const tilesetId = firstTilesetId(store.getCurrent());
    const groupId = addAutotileGroup(tilesetId, "그룹")!;
    removeAutotileGroup(tilesetId, groupId);
    expect(store.getCurrent().tilesets[tilesetId].autotileGroups).toBeUndefined();
  });
});
