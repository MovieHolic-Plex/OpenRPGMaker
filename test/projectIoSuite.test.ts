import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { deserialize, serialize } from "@/project/io";
import { listOpeningStillPackIds, findOpeningStillPackEntry } from "@/assets/openingStillPackRuntime";
import { listOpeningStillMoods } from "@/assets/openingStillMoods";
import { listDatabaseResourceOptions } from "@/editor/resourceOptions";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { collectWebExportAssets } from "@/project/webExportAssets";
import { fetchLicenseNotices } from "@/player/titleLicenseNotice";
import { registerExportAssetBase, registerInlineAssets } from "@/assets/inlineAssetStore";
import { layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import { store } from "@/project/store";
import { buildChangeLedger } from "@/project/changeLedger";
import { validateMaps } from "@/project/io/shapeEventFields";
import { recordMapEditIfChanged, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { projectLint } from "@/project/lint/projectLint";
import { isolateTimers } from "./mergedTeardown";

describe("openingDelivery", () => {
  isolateTimers();
  afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();registerExportAssetBase(null);registerInlineAssets(null);});
  describe('opening delivery across authoring, persistence and export',()=>{
    it('uses the interview title for the first opening card',()=>{
      for(const pack of [null,'farm-life'] as const){
        const p=createNewProjectSeed(pack,'달빛 모험');
        expect(p.meta.title).toBe('달빛 모험');
        expect(p.system.opening?.scenes.at(-1)?.narration).toBe('— 달빛 모험 —');
        expect(p.system.titleScreen?.title).toBe('달빛 모험');
      }
    });
    it('keeps deleted and disabled openings through real store normalization',async()=>{
      const {store}=await import('@/project/store');
      const p=createBlankProject();delete p.system.opening;
      await store.loadFallbackProject(deserialize(serialize(p)));
      expect(store.getCurrent().system.opening).toBeUndefined();
      const disabled=createBlankProject();disabled.system.opening!.enabled=false;
      await store.loadFallbackProject(deserialize(serialize(disabled)));
      expect(store.getCurrent().system.opening?.enabled).toBe(false);
    });
    it('every delivered pack still is searchable and survives save/load',()=>{
      const p=createBlankProject(), ids=listOpeningStillPackIds();
      expect(ids.length).toBeGreaterThan(0);
      const options=listDatabaseResourceOptions('still',p);
      const known=collectResourceIds(p);
      for(const id of ids){expect(known.has(id)).toBe(true);expect(listOpeningStillMoods().some(m=>m.id===id)).toBe(true);expect(options.some(o=>o.id===id)).toBe(true);}
      p.system.opening!.scenes=ids.map((id,i)=>({id:'pack-'+i,kind:'image',resourceId:id,narration:'검증',durationMs:1000,motion:'pan'}));
      expect(deserialize(serialize(p)).system.opening).toEqual(p.system.opening);
    });
    it('downloads CDN stills into local export paths, including disabled sequences',()=>{
      vi.stubEnv('VITE_STILL_CDN_BASE','https://cdn.example.test');
      const p=createBlankProject(), id=listOpeningStillPackIds()[0]!;
      const name=findOpeningStillPackEntry(id)!.fileName;
      p.system.opening={enabled:false,skippable:true,scenes:[{id:'one',kind:'image',resourceId:id,narration:'',durationMs:1000,motion:'none'}]};
      expect(collectWebExportAssets(p)).toContainEqual({kind:'public',resourceId:id,sourcePath:'https://cdn.example.test/stills/v1/'+name,zipPath:'assets/stills/pack/'+name});
    });
    it('resolves attribution in subdirectory and standalone exports',async()=>{
      const fetchMock=vi.fn().mockResolvedValue(new Response('Credits'));
      vi.stubGlobal('fetch',fetchMock);
      registerExportAssetBase(new URL('https://games.example.test/moon/'));
      expect(await fetchLicenseNotices()).toBe('Credits');
      expect(fetchMock).toHaveBeenCalledWith('https://games.example.test/moon/assets/ATTRIBUTION.md');
      fetchMock.mockResolvedValue(new Response('Embedded credits'));
      registerInlineAssets({'assets/ATTRIBUTION.md':'data:text/plain,Embedded%20credits'});
      expect(await fetchLicenseNotices()).toBe('Embedded credits');
      expect(fetchMock).toHaveBeenLastCalledWith('data:text/plain,Embedded%20credits');
    });
  });
});

describe("mapLayersPersistence", () => {
  isolateTimers();
  beforeEach(() => {
    store.replace(createBlankProject());
    resetMapEditHistory();
  });
  function authorAllLayers(): string {
    const id = store.getCurrent().startMapId;
    store.updateMapTiles(id, (m) => {
      setLayerTileAt(m, 2, 0, 5);
      setLayerTileAt(m, 2, m.width + 2, 7);
      setLayerTileAt(m, 4, 1, 6);
      setShadowAt(m, 2, 3);
      setShadowAt(m, m.width * m.height - 1, 15);
    });
    return id;
  }
  describe("새 층 칸 — 저장 왕복", () => {
    it("serialize → deserialize 가 세 선택 층을 그대로 되살린다", () => {
      const id = authorAllLayers();
      const project = store.getCurrent();
      const loaded = deserialize(serialize(project));
      expect(loaded.maps[id]).toEqual(project.maps[id]);
      expect(loaded.maps[id].lowerOverlayTiles).toEqual(project.maps[id].lowerOverlayTiles);
      expect(loaded.maps[id].upperOverlayTiles).toEqual(project.maps[id].upperOverlayTiles);
      expect(loaded.maps[id].shadowBits).toEqual(project.maps[id].shadowBits);
      expect(deserialize(serialize(loaded))).toEqual(loaded);
    });

    it("1층을 칠하고 되돌리면 2층·4층·그림자가 그대로다", () => {
      const id = authorAllLayers();
      const before = structuredClone(store.getCurrent().maps[id]);
      expect(recordMapEditIfChanged(id, () => {
        store.updateMapTiles(id, (m) => { setLayerTileAt(m, 1, 0, 3); setLayerTileAt(m, 1, 1, 3); });
      })).toBe(true);
      expect(layerTileAt(store.getCurrent().maps[id], 1, 0)).toBe(3);
      expect(undoMapEdit()).toBe(true);
      const after = store.getCurrent().maps[id];
      expect(after.lowerTiles).toEqual(before.lowerTiles);
      expect(after.lowerOverlayTiles).toEqual(before.lowerOverlayTiles);
      expect(after.upperOverlayTiles).toEqual(before.upperOverlayTiles);
      expect(after.shadowBits).toEqual(before.shadowBits);
    });

    it("불러오기는 길이가 틀린 선택 층만 버리고 나머지를 연다", () => {
      const id = authorAllLayers();
      const raw = JSON.parse(serialize(store.getCurrent())) as { maps: Record<string, Record<string, unknown>> };
      raw.maps[id].upperOverlayTiles = [1, 2, 3];
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const loaded = deserialize(JSON.stringify(raw));
        expect("upperOverlayTiles" in loaded.maps[id]).toBe(false);
        expect(layerTileAt(loaded.maps[id], 2, 0)).toBe(5);
        expect(shadowAt(loaded.maps[id], 2)).toBe(3);
        expect(warn).toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it("저장 쪽 lint 왕복 검사는 길이가 틀린 선택 층을 오류로 보고한다", () => {
      const id = authorAllLayers();
      const project = structuredClone(store.getCurrent());
      project.maps[id].shadowBits = [0, 1];
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const issues = projectLint(project).filter((issue) => issue.code === "serialize-roundtrip");
        expect(issues.some((issue) => issue.message.includes("shadowBits"))).toBe(true);
      } finally {
        warn.mockRestore();
      }
    });
  });
  describe("새 층 칸 — 저장 경로", () => {
    it("updateMapTiles 는 2층·4층·그림자를 복사해 보존하고 이전 상태와 공유하지 않는다", () => {
      const id = store.getCurrent().startMapId;
      store.updateMapTiles(id, (m) => { setLayerTileAt(m, 2, 0, 5); setLayerTileAt(m, 4, 1, 6); setShadowAt(m, 2, 3); });
      const before = store.getCurrent().maps[id];
      store.updateMapTiles(id, (m) => { setLayerTileAt(m, 2, 0, 9); });
      const after = store.getCurrent().maps[id];
      expect(layerTileAt(before, 2, 0)).toBe(5);
      expect(layerTileAt(after, 2, 0)).toBe(9);
      expect(layerTileAt(after, 4, 1)).toBe(6);
      expect(shadowAt(after, 2)).toBe(3);
    });

    it("검증은 길이가 틀린 선택 칸을 경고와 함께 버리고, 맞는 칸과 1·3층은 그대로 둔다", () => {
      const project = structuredClone(store.getCurrent());
      const map = project.maps[project.startMapId];
      map.lowerOverlayTiles = new Array(map.width * map.height).fill(-1);
      map.shadowBits = new Array(map.width * map.height).fill(0);
      expect(() => validateMaps(project.maps)).not.toThrow();
      map.upperOverlayTiles = [1, 2, 3];
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        expect(() => validateMaps(project.maps)).not.toThrow();
        expect("upperOverlayTiles" in map).toBe(false);
        expect(map.lowerOverlayTiles).toHaveLength(map.width * map.height);
        expect(warn.mock.calls.some(([message]) => /upperOverlayTiles/.test(String(message)) && String(message).includes(map.id))).toBe(true);
      } finally {
        warn.mockRestore();
      }
      map.upperTiles = [1, 2, 3];
      expect(() => validateMaps(project.maps)).toThrow(/upperTiles 길이 불일치/);
    });
  });
  describe("새 층 칸 — 변경 명세", () => {
    function mapDetail(before: ReturnType<typeof store.getCurrent>, after: ReturnType<typeof store.getCurrent>): readonly string[] {
      const entry = buildChangeLedger(before, after).entries.find((item) => item.area === "맵" && item.change === "changed");
      return entry?.detail ?? [];
    }

    it("옛 맵에 2층 한 칸을 칠하면 1칸 바뀜으로 센다", () => {
      const before = structuredClone(store.getCurrent());
      const after = structuredClone(before);
      const map = after.maps[after.startMapId];
      expect(map.lowerOverlayTiles).toBeUndefined();
      setLayerTileAt(map, 2, 0, 5);
      setShadowAt(map, 1, 2);
      const detail = mapDetail(before, after);
      expect(detail).toContain("2층 타일: 1칸 바뀜");
      expect(detail).toContain("그림자: 1칸 바뀜");
    });

    it("모두 빈 층이 지워지면 칸 수를 세지 않는다", () => {
      const before = structuredClone(store.getCurrent());
      const map = before.maps[before.startMapId];
      map.lowerOverlayTiles = new Array(map.width * map.height).fill(-1);
      map.shadowBits = new Array(map.width * map.height).fill(0);
      const after = structuredClone(before);
      delete after.maps[after.startMapId].lowerOverlayTiles;
      delete after.maps[after.startMapId].shadowBits;
      const detail = mapDetail(before, after);
      expect(detail).toContain("2층 타일: 빈 칸 정리");
      expect(detail).toContain("그림자: 빈 칸 정리");
      expect(detail.some((line) => /칸 바뀜/.test(line))).toBe(false);
    });
  });
});
