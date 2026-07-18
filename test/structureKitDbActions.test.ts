import { describe, expect, it } from "vitest";
import {
  deleteStructureKit,
  registerStructureKit,
  renameStructureKit,
} from "@/editor/harnessSuggestion/structureKitActions";
import { store } from "@/project/store";
import type { StructureKitDef } from "@/project/types";

function bedKit(id: string): StructureKitDef {
  return {
    id,
    kind: "section",
    name: "Fence 단면",
    width: 1,
    height: 3,
    rows: [
      { tiles: [240], upperTiles: [379] },
      { tiles: [240], upperTiles: [288] },
      { tiles: [240], upperTiles: [379] },
    ],
    learnedFrom: "user-paint",
  };
}

describe("structureKit DB 관리 액션 — 등록/개명/삭제", () => {
  it("등록·중복 서명 병합·이름 변경·삭제가 스토어에 반영된다", () => {
    const tilesetId = Object.keys(store.getCurrent().tilesets)[0]!;

    const registered = registerStructureKit(tilesetId, bedKit("kit_bed_a"));
    expect(store.getCurrent().tilesets[tilesetId]!.structureKits?.some((kit) => kit.id === registered.id)).toBe(true);

    // 같은 서명(동일 rows)은 새로 만들지 않고 기존 킷을 돌려준다.
    const duplicate = registerStructureKit(tilesetId, bedKit("kit_bed_b"));
    expect(duplicate.id).toBe(registered.id);
    expect(store.getCurrent().tilesets[tilesetId]!.structureKits).toHaveLength(1);

    renameStructureKit(tilesetId, registered.id, "울타리 화단");
    expect(
      store.getCurrent().tilesets[tilesetId]!.structureKits?.find((kit) => kit.id === registered.id)?.name,
    ).toBe("울타리 화단");

    deleteStructureKit(tilesetId, registered.id);
    expect(store.getCurrent().tilesets[tilesetId]!.structureKits ?? []).toHaveLength(0);
  });
});
