import { afterEach, expect, it, vi, describe } from "vitest";
import { isBgmFileInstalled, setInstalledBgmFiles } from "@/assets/installedBgm";
import { isCatalogBgmAvailable } from "@/assets/audioResourceCatalog";
import { findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";
import { recommendMapBgm } from "@/assets/bgmThemeRecommendation";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { BGM_CATALOG } from "../src/assets/bgmCatalog";
import { isolateTimers } from "./mergedTeardown";

describe("installedBgmRuntime", () => {
  isolateTimers();
  afterEach(() => { setInstalledBgmFiles(null); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("빌드타임 시드를 매 호출마다 읽는다 — 모듈 로드 시점에 고정하지 않는다", () => {
    vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", ["a.mp3"]);
    expect(isBgmFileInstalled("a.mp3")).toBe(true);
    expect(isBgmFileInstalled("b.mp3")).toBe(false);
    vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", ["b.mp3"]);
    expect(isBgmFileInstalled("b.mp3")).toBe(true);
  });
  it("define 이 없는 헤드리스 도구에서는 전량 설치로 본다", () => {
    vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", undefined);
    expect(isBgmFileInstalled("anything.mp3")).toBe(true);
  });
  it("런타임 override 가 시드를 이긴다 — 재시작 없이 재생 가능으로 뒤집힌다", () => {
    vi.stubEnv("VITE_BGM_CDN_BASE", "");
    vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", []);
    const entry = findBgmRuntimeEntry("cc0-bgm-rtp-fld-001");
    if (!entry) throw new Error("Missing registry entry");
    expect(isCatalogBgmAvailable("cc0-bgm-rtp-fld-001")).toBe(false);
    setInstalledBgmFiles([entry.fileName]);
    expect(isCatalogBgmAvailable("cc0-bgm-rtp-fld-001")).toBe(true);
  });
  it("override 를 null 로 되돌리면 시드로 복귀한다", () => {
    vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", ["seed.mp3"]);
    setInstalledBgmFiles(["runtime.mp3"]);
    expect(isBgmFileInstalled("seed.mp3")).toBe(false);
    setInstalledBgmFiles(null);
    expect(isBgmFileInstalled("seed.mp3")).toBe(true);
  });
  it('맵 이름 자동 추천도 설치 목록을 따른다 — 기억의 길이 미설치 emo-002를 선택하지 않는다', () => {
    vi.stubEnv('VITE_BGM_CDN_BASE', '');
    const track = findBgmRuntimeEntry('cc0-bgm-rtp-fld-003')!;
    setInstalledBgmFiles([track.fileName]);
    expect(recommendMapBgm('기억의 길', 7)).toBe('cc0-bgm-rtp-fld-003');
    setInstalledBgmFiles([]);
    expect(recommendMapBgm('기억의 길', 7)).toBe('easyrpg-music-field-1');
  });
  it('명시적 맵 BGM 쓰기도 미설치 파일을 거부하고 원래 설정을 보존한다', () => {
    vi.stubEnv('VITE_BGM_CDN_BASE', '');
    setInstalledBgmFiles([]);
    const project = createBlankProject();
    const before = structuredClone(project.maps[project.startMapId]!.bgm);
    const result = runTool({ project }, 'set_map_properties', { mapId: project.startMapId, bgm: { mode: 'custom', resourceId: 'cc0-bgm-rtp-emo-002' } });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('미설치 BGM');
    expect(project.maps[project.startMapId]!.bgm).toEqual(before);
  });
});

describe("romanceBgm", () => {
  isolateTimers();
  const EVERYDAY_CATEGORIES = ["찻집 · 대화", "서점 · 비 오는 실내", "옥상 · 도시 저녁", "공원 · 도시 저녁", "귀환 · 조용한 대화", "도시 광장 · 저녁", "온실 · 휴식 · 대화", "마을 · 휴식", "회관 · 공동체", "연못 · 휴식"];
  describe("현대 일상 장소(연애·학원·직장물) BGM", () => {
    it("캠퍼스·교실·카페·사무실 이름은 잔잔한 일상 곡 카테고리에서 고른다", () => {
      for (const name of ["캠퍼스 교정", "본관 강의실", "학생회관 동아리방", "로스터리 카페 & 라운지", "기획팀 오피스", "옥상", "편의점"]) {
        for (const seed of [1, 2, 3]) {
          const track = BGM_CATALOG.find((t) => t.id === recommendMapBgm(name, seed));
          expect(EVERYDAY_CATEGORIES, `${name}/${seed} → ${track?.category}`).toContain(track?.category);
        }
      }
    });

    it("기존 마을·숲 테마는 그대로다", () => {
      expect(recommendMapBgm("마을", 7)).toBe(recommendMapBgm("village", 7));
      expect(recommendMapBgm("깊은 숲", 3)).toBe(recommendMapBgm("forest", 3));
    });

    it("일본 현대 실내를 새로 지으면 BGM 이 비지 않는다, 환상 실내도 곡을 받는다", () => {
      const ctx = { project: createBlankProject() };
      const jp = runTool(ctx, "build_hand_interior_room", { tileset: "jp_city", name: "집", floor: "flooring", wall: "cloth", layout: { program: "house-1f" } });
      expect(jp.ok, jp.summary).toBe(true);
      expect(ctx.project.maps[(jp.data as { mapId: string }).mapId]?.bgm?.mode).toBe("custom");
      const fantasy = runTool(ctx, "build_hand_interior_room", { name: "빵집", floor: "plank", wall: "plaster", layout: { program: "bakery" } });
      expect(fantasy.ok, fantasy.summary).toBe(true);
      // #3226(2026-10-22): 환상 실내도 새로 지으면 무음으로 남지 않게 마을 곡이 기본으로 붙는다.
      expect(ctx.project.maps[(fantasy.data as { mapId: string }).mapId]?.bgm?.mode).toBe("custom");
    });
  });
});
