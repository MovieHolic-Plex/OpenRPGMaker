import { describe, expect, it } from "vitest";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import type { GameMap, Project, TilesetReferenceCategory } from "@/project/types";
import { changedMapIdsBetween, mapSaveConflicts, mergeProjectMaps } from "@/project/persistence/core/mapMerge";
import { canonicalJsonString } from "@/project/persistence/core/canonicalJson";
import { applyProjectDocumentPatch, diffProjectDocuments, resolveMapPatchDocuments, diffProjectDocumentsSliced, withWirePatchValues, withWirePatchValuesSliced } from "@/project/persistence/core/projectPatch";
import { projectWireView, serialize } from "@/project/io/serialize";
import { createBlankProject } from "@/project/defaults";
import { restoreBundledTilesetDiffs } from "@/project/bundledTilesetDiff";
import { isolateTimers } from "../mergedTeardown";

describe("mapMerge", () => {
  isolateTimers();
  function mapIds(project: Project): [string, string] {
    const [first, second] = Object.keys(project.maps);
    if (!first || !second) throw new Error("fixture needs two maps");
    return [first, second];
  }
  function renamed(project: Project, mapId: string, name: string): GameMap {
    const map = project.maps[mapId];
    if (!map) throw new Error(`expected map ${mapId}`);
    return { ...map, name };
  }
  describe("mapMerge core", () => {
    it("키 순서만 다른 맵은 바뀐 것으로 보지 않는다 (jsonb 왕복)", () => {
      const base = createScarloxyDemoProject();
      const [mapId] = mapIds(base);
      const reordered = structuredClone(base);
      const map = reordered.maps[mapId];
      if (!map) throw new Error("expected map");
      reordered.maps[mapId] = Object.fromEntries(Object.entries(map).reverse()) as unknown as GameMap;
      expect(changedMapIdsBetween(base, reordered)).toEqual([]);
    });

    it("서로 다른 맵을 고친 두 편집은 충돌이 아니고, 병합 결과에 둘 다 남는다", () => {
      const base = createScarloxyDemoProject();
      const [mineId, theirsId] = mapIds(base);
      const mine = structuredClone(base);
      mine.maps[mineId] = renamed(mine, mineId, "내 맵");
      const latest = structuredClone(base);
      latest.maps[theirsId] = renamed(latest, theirsId, "남의 맵");
      const changed = changedMapIdsBetween(base, mine);
      expect(changed).toEqual([mineId]);
      expect(mapSaveConflicts(base, mine, latest, changed)).toEqual([]);
      const merged = mergeProjectMaps(latest, mine, changed, []);
      expect(merged.maps[mineId]?.name).toBe("내 맵");
      expect(merged.maps[theirsId]?.name).toBe("남의 맵");
    });

    it("같은 맵을 다르게 고치면 그 맵만 충돌로 돌려준다", () => {
      const base = createScarloxyDemoProject();
      const [mapId] = mapIds(base);
      const mine = structuredClone(base);
      mine.maps[mapId] = renamed(mine, mapId, "내 맵");
      const latest = structuredClone(base);
      latest.maps[mapId] = renamed(latest, mapId, "남의 맵");
      const changed = changedMapIdsBetween(base, mine);
      expect(mapSaveConflicts(base, mine, latest, changed)).toEqual([{ mapId, name: "내 맵" }]);
    });

    it("최신본과 같은 내용으로 고친 편집은 충돌이 아니다", () => {
      const base = createScarloxyDemoProject();
      const [mapId] = mapIds(base);
      const mine = structuredClone(base);
      mine.maps[mapId] = renamed(mine, mapId, "같은 이름");
      const latest = structuredClone(mine);
      expect(mapSaveConflicts(base, mine, latest, changedMapIdsBetween(base, mine))).toEqual([]);
    });
  });
});

describe("projectPatch", () => {
  isolateTimers();
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
});

describe("projectPatchReferenceDocuments", () => {
  isolateTimers();
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
    // 첫 타일셋(버들항)은 번들 참고문서를 들고 태어난다 — 「문서 없음」은 그 필드를 실제로 뺀 모양이어야 한다.
    const { referenceDocuments: _bundled, ...withoutDocuments } = tileset;
    project.tilesets[tilesetId] = docs === undefined
      ? withoutDocuments
      : { ...withoutDocuments, referenceDocuments: docs };
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
      // #3774 부터 번들 타일셋은 저장 보기에서 「번들 + 차이」로 실린다 — 패치 칸을 되돌려 문서 전체가 실렸는지 본다.
      const restored: { tilesets: Record<string, unknown> } = { tilesets: { [tilesetId]: structuredClone(changed) } };
      restoreBundledTilesetDiffs(restored);
      expect((restored.tilesets[tilesetId] as { referenceDocuments?: unknown }).referenceDocuments).toEqual(documents("after"));
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
});
