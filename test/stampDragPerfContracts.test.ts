// 드래그·바로 깔기 성능 계약 — 도구 초안·되돌리기 스냅샷이 타일셋을 통째로 복제하지 않고도 정확하게 되돌린다.
// 실측(2026-09-28, 새 프로젝트 149MB = 타일셋 82MB + 업로드 자산 66MB): 적용 한 번에 createDraft 1.4~2.1s,
// 되돌리기 스냅샷 1.3s 였다. 공유는 빠르지만 틀리면 되돌리기가 조용히 망가진다 — 그 두 쪽을 함께 묶는다.
import { beforeEach, describe, expect, it } from "vitest";
import { createDraft, finishDraftTilesets } from "@/editor/tools/changeset";
import { applyToolSequenceToStore } from "@/editor/tools/applyChangesetToStore";
import { recordProjectSnapshot, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { cloneProjectForMutation, finishProjectMutation } from "@/project/projectClone";
import { store } from "@/project/store";
import type { UploadedAsset } from "@/project/types";

beforeEach(() => {
  store.replace(createBlankProject());
  resetMapEditHistory();
});

describe("createDraft 지연 타일셋", () => {
  it("읽지 않은 타일셋은 확정 뒤 원본 객체 그대로다", () => {
    const base = createBlankProject();
    const draft = createDraft(base);
    const mapId = Object.keys(draft.maps)[0]!;
    draft.maps[mapId]!.lowerTiles[0] = 7;
    finishDraftTilesets(draft);
    for (const [id, tileset] of Object.entries(draft.tilesets)) expect(tileset).toBe(base.tilesets[id]);
  });

  it("읽고 고친 타일셋은 사본이고 원본은 그대로다", () => {
    const base = createBlankProject();
    const id = Object.keys(base.tilesets)[0]!;
    const originalName = base.tilesets[id]!.name;
    const draft = createDraft(base);
    draft.tilesets[id]!.name = originalName + "!";
    finishDraftTilesets(draft);
    expect(draft.tilesets[id]).not.toBe(base.tilesets[id]);
    expect(draft.tilesets[id]!.name).toBe(originalName + "!");
    expect(base.tilesets[id]!.name).toBe(originalName);
  });

  it("키 순서가 원본과 같다(직렬화 바이트가 같아야 한다)", () => {
    const base = createBlankProject();
    const draft = createDraft(base);
    finishDraftTilesets(draft);
    expect(Object.keys(draft)).toEqual(Object.keys(base));
    expect(Object.keys(draft.tilesets)).toEqual(Object.keys(base.tilesets));
  });
});

describe("프로젝트 되돌리기 스냅샷의 타일셋 공유", () => {
  it("도구 묶음 적용을 되돌리면 맵과 타일셋이 모두 그 전으로 돌아온다", () => {
    const before = store.getCurrent();
    const mapId = before.startMapId;
    const tilesBefore = before.maps[mapId]!.lowerTiles.slice();
    const results = applyToolSequenceToStore([
      { name: "fill_region", args: { mapId, rect: { x: 0, y: 0, w: 4, h: 4 }, material: "흙" } },
    ], { continueOnError: true });
    expect(results[0]?.ok).toBe(true);
    expect(store.getCurrent().maps[mapId]!.lowerTiles).not.toEqual(tilesBefore);
    expect(undoMapEdit()).toBe(true);
    const restored = store.getCurrent();
    expect(restored.maps[mapId]!.lowerTiles).toEqual(tilesBefore);
    expect(JSON.stringify(restored.tilesets)).toBe(JSON.stringify(before.tilesets));
  });

  it("스냅샷 뒤 스토어가 타일셋을 새 객체로 바꿔도 되돌리면 옛 내용이다", () => {
    const id = Object.keys(store.getCurrent().tilesets)[0]!;
    const oldName = store.getCurrent().tilesets[id]!.name;
    recordProjectSnapshot("타일셋 이름");
    store.update((draft) => { draft.tilesets[id]!.name = oldName + " 바뀜"; });
    expect(store.getCurrent().tilesets[id]!.name).toBe(oldName + " 바뀜");
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().tilesets[id]!.name).toBe(oldName);
  });

  it("되돌린 프로젝트의 타일셋은 스냅샷 사본이다(되돌린 뒤 고쳐도 기록이 변하지 않는다)", () => {
    const id = Object.keys(store.getCurrent().tilesets)[0]!;
    const shared = store.getCurrent().tilesets[id];
    recordProjectSnapshot("무엇이든");
    store.update((draft) => { draft.maps[draft.startMapId]!.lowerTiles[0] = 9; });
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().tilesets[id]).not.toBe(shared);
  });
});

describe("업로드 자산 항목 공유", () => {
  const asset = (id: string): UploadedAsset => ({ id, name: id, kind: "picture", dataUrl: "data:image/png;base64,AAAA", meta: {} } as UploadedAsset);

  it("편집 draft 는 항목을 공유하고, 사전 대입은 원본에 새지 않는다", () => {
    const base = createBlankProject();
    base.assets.uploaded = { a: asset("a") };
    const draft = cloneProjectForMutation(base);
    expect(draft.assets.uploaded.a).toBe(base.assets.uploaded.a);
    draft.assets.uploaded.b = asset("b");
    delete draft.assets.uploaded.a;
    finishProjectMutation(draft);
    expect(Object.keys(base.assets.uploaded)).toEqual(["a"]);
    expect(Object.keys(draft)).toEqual(Object.keys(base));
    expect(Object.keys(draft.assets)).toEqual(Object.keys(base.assets));
  });

  it("store.update·replace 를 지나도 바뀌지 않은 자산은 같은 객체다", () => {
    store.update((draft) => { draft.assets.uploaded.a = asset("a"); });
    const first = store.getCurrent().assets.uploaded.a;
    store.update((draft) => { draft.maps[draft.startMapId]!.lowerTiles[0] = 3; });
    expect(store.getCurrent().assets.uploaded.a).toBe(first);
    store.replace(store.getCurrent());
    expect(store.getCurrent().assets.uploaded.a).toBe(first);
  });

  it("자산 추가를 되돌리면 자산이 사라진다", () => {
    recordProjectSnapshot("자산 추가");
    store.update((draft) => { draft.assets.uploaded.z = asset("z"); });
    expect(store.getCurrent().assets.uploaded.z).toBeDefined();
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().assets.uploaded.z).toBeUndefined();
  });
});

describe("옛 스프라이트 참조 청소의 공유 항목 기억", () => {
  it("타일셋·자산 안의 옛 참조는 처음 볼 때 지우고, 깨끗한 새 객체도 계속 검사한다", () => {
    const legacy = ["npc", "villager"].join("_");
    const project = createBlankProject();
    const id = Object.keys(project.tilesets)[0]!;
    project.tilesets[id] = { ...project.tilesets[id]!, name: legacy } as typeof project.tilesets[string];
    project.assets.uploaded = { a: { id: "a", name: "a", kind: "picture", dataUrl: "", meta: { sprite: legacy } } as unknown as UploadedAsset };
    expect(removeLegacySpriteReferences(project)).toBe(true);
    expect(project.tilesets[id]!.name).not.toBe(legacy);
    expect((project.assets.uploaded.a!.meta as Record<string, unknown>).sprite).not.toBe(legacy);
    expect(removeLegacySpriteReferences(project)).toBe(false);
    project.tilesets[id] = { ...project.tilesets[id]!, name: legacy } as typeof project.tilesets[string];
    expect(removeLegacySpriteReferences(project)).toBe(true);
    expect(project.tilesets[id]!.name).not.toBe(legacy);
  });
});

