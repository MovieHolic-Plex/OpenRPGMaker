import { describe, expect, it } from "vitest";
import { canonicalJsonString } from "@/project/persistence/core/canonicalJson";
import {
  applyProjectDocumentPatch,
  diffProjectDocuments,
  resolveMapPatchDocuments,
  diffProjectDocumentsSliced,
  withWirePatchValues,
  withWirePatchValuesSliced,
} from "@/project/persistence/core/projectPatch";

describe("project document patch", () => {
  it("큰 맵 내부에서 양보하고 제출본은 다음 편집과 분리한다", async () => {
    const cells = Array(8192).fill(16);
    const base = { maps: { m: { lowerTiles: cells } } };
    const local = { maps: { m: { lowerTiles: [...cells] } } };
    local.maps.m.lowerTiles[8191] = 23;
    let yields = 0;
    const patch = await diffProjectDocumentsSliced(base, local, async () => { yields++; }, 0);
    expect(yields).toBeGreaterThan(1);
    const wire = await withWirePatchValuesSliced(patch, async () => {}, 0);
    local.maps.m.lowerTiles[0] = 99;
    const submitted = applyProjectDocumentPatch(base, wire) as typeof local;
    expect(submitted.maps.m.lowerTiles[0]).toBe(16);
    expect(submitted.maps.m.lowerTiles[8191]).toBe(23);
    expect(base.maps.m.lowerTiles[8191]).toBe(16);
  });

  it("JSON 특수값과 중첩 toJSON의 키를 왕복과 동일하게 복사한다", async () => {
    const value = { missing: undefined, cells: [undefined, NaN, Infinity], child: { toJSON(key: string) { return { key }; } } };
    const patch = { maps: { set: { m: value } } };
    const expected = JSON.parse(JSON.stringify(value));
    expect(withWirePatchValues(patch).maps?.set?.m).toEqual(expected);
    expect((await withWirePatchValuesSliced(patch, async () => {}, 0)).maps?.set?.m).toEqual(expected);
  });

  it("맵만 바뀌면 타일셋 참고 그림은 본문에 실리지 않는다", () => {
    const blob = "x".repeat(50_000);
    const base: {
      meta: { title: string };
      maps: Record<string, { name: string }>;
      tilesets: { town: { referenceDocuments: string; passability: number[] } };
      database: { actors: Array<{ id: string; name: string }> };
    } = {
      meta: { title: "마을" },
      maps: { m1: { name: "광장" }, m2: { name: "골목" } },
      tilesets: { town: { referenceDocuments: blob, passability: [1, 2] } },
      database: { actors: [{ id: "a", name: "A" }] },
    };
    const local = structuredClone(base);
    local.meta.title = "시장";
    local.maps.m1.name = "장마당";
    delete local.maps.m2;
    local.database.actors.push({ id: "b", name: "B" });

    const patch = diffProjectDocuments(base, local);
    expect(patch.tilesets).toBeUndefined();
    expect(JSON.stringify(patch).length).toBeLessThan(blob.length);
    expect(patch.maps?.set?.m1).toEqual({ name: "장마당" });
    expect(patch.maps?.del).toEqual(["m2"]);
    expect(canonicalJsonString(applyProjectDocumentPatch(base, patch))).toBe(canonicalJsonString(local));
  });

  it("키 순서만 다른 문서는 빈 패치다", () => {
    const patch = diffProjectDocuments({ z: 1, a: { m: 1, b: 2 } }, { a: { b: 2, m: 1 }, z: 1 });
    expect(patch).toEqual({});
  });

  it("기준 해시가 맞으면 저장본 위에 패치를 얹고, 다르면 기준 문서를 다시 요구한다", () => {
    const stored = JSON.stringify({ meta: { title: "마을" }, maps: { m1: { name: "광장" } } });
    const patch = diffProjectDocuments(JSON.parse(stored), { meta: { title: "마을" }, maps: { m1: { name: "장마당" } } });
    const ready = resolveMapPatchDocuments({ baseSha: "abc", patch }, { serialized: stored, sha256: "abc" });
    expect(ready.kind).toBe("ready");
    if (ready.kind === "ready") expect((ready.localJson as { maps: { m1: { name: string } } }).maps.m1.name).toBe("장마당");
    expect(resolveMapPatchDocuments({ baseSha: "old", patch }, { serialized: stored, sha256: "abc" }).kind).toBe("stale-base");
  });
});
