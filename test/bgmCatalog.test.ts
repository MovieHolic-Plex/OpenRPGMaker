// CC0 BGM 카탈로그(281곡) 배선 가드.
//
// 이 파일이 지키는 것은 세 가지다.
//  1) 카탈로그 자체가 줄거나 깨지지 않는다(생성 스크립트 회귀).
//  2) 카탈로그 곡을 지정한 프로젝트가 **역직렬화에 성공**한다 — 알려진 리소스 id 집합에 들어 있어야 한다.
//     여기서 빠지면 곡이 안 들리는 게 아니라 프로젝트 로드 자체가 assert 로 실패한다.
//  3) CDN 미설정 환경에서도 기본 프로젝트는 소리가 난다(스타터 곡이 레포에 있다).
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  BGM_CATALOG,
  BGM_CATALOG_LICENSE,
  bgmTrackLabel,
  bgmTracksByCategory,
  findBgmTrack,
} from "@/assets/bgmCatalog";
import {
  BGM_CATALOG_TOTAL_SECONDS,
  BGM_CATALOG_TRACK_COUNT,
  bgmCatalogResourceIds,
  findBgmRuntimeEntry,
  isBgmCatalogResourceId,
} from "@/assets/bgmCatalogRuntime";
import { BGM_CDN_PREFIX, BGM_LOCAL_FALLBACK_PREFIX, bgmCdnBase, bgmTrackUrl } from "@/assets/bgmCdn";
import { BGM_STARTER_TRACK_IDS } from "@/assets/bgmStarterTracks";
import { resolveBgmCatalogAssetUrl } from "@/assets/bgmCatalogResolver";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { searchResources } from "@/assets/resourceSearch";
import { defaultSystem, defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { createBlankProject } from "@/project/defaults";

/** 카탈로그 곡의 로컬 폴백 경로(public/ 기준). env 를 비워 CDN 설정에 흔들리지 않게 한다. */
function localPathFor(resourceId: string): string {
  const entry = findBgmRuntimeEntry(resourceId);
  expect(entry, `${resourceId} 가 카탈로그에 없다`).toBeDefined();
  const url = bgmTrackUrl(entry!.fileName, {});
  expect(url).not.toBeNull();
  return decodeURIComponent(url!.replace(/^\//, ""));
}

describe("CC0 BGM 카탈로그", () => {
  it("281곡이 실려 있고 런타임/메타데이터 목록이 일치한다", () => {
    expect(BGM_CATALOG_TRACK_COUNT).toBe(281);
    expect(BGM_CATALOG).toHaveLength(BGM_CATALOG_TRACK_COUNT);
    expect(new Set(bgmCatalogResourceIds())).toEqual(new Set(BGM_CATALOG.map((track) => track.id)));
  });

  it("리소스 id 와 트랙 코드가 중복되지 않는다", () => {
    expect(new Set(BGM_CATALOG.map((t) => t.id)).size).toBe(BGM_CATALOG.length);
    expect(new Set(BGM_CATALOG.map((t) => t.trackCode)).size).toBe(BGM_CATALOG.length);
    expect(new Set(BGM_CATALOG.map((t) => t.id.replace(/^cc0-bgm-/, ""))).size).toBe(BGM_CATALOG.length);
  });

  it("모든 곡이 재생 가능한 확장자와 양수 길이를 가진다", () => {
    for (const track of BGM_CATALOG) {
      const entry = findBgmRuntimeEntry(track.id);
      expect(entry, track.id).toBeDefined();
      // MIDI 를 기본 세트에 넣으면 브라우저에서 무음이 된다 — EasyRPG RTP 로 이미 겪은 함정이다.
      expect(entry!.fileName).toMatch(/\.(mp3|ogg|wav|m4a)$/i);
      expect(track.durationSeconds, track.id).toBeGreaterThan(0);
      expect(track.bytes, track.id).toBeGreaterThan(0);
    }
  });

  it("총 재생 시간이 곡 수와 함께 기록돼 있다", () => {
    const sum = Math.round(BGM_CATALOG.reduce((total, track) => total + track.durationSeconds, 0));
    expect(BGM_CATALOG_TOTAL_SECONDS).toBe(sum);
    // 11시간 이상 — 곡 수는 같은데 파일이 통째로 바뀌는 회귀를 잡는다.
    expect(BGM_CATALOG_TOTAL_SECONDS).toBeGreaterThan(11 * 3600);
  });

  it("라이선스가 CC0 로 못박혀 있다", () => {
    expect(BGM_CATALOG_LICENSE).toBe("CC0-1.0");
  });

  it("모든 곡이 카테고리와 검색 태그를 갖는다", () => {
    for (const track of BGM_CATALOG) {
      expect(track.category.trim(), track.id).not.toBe("");
      expect(track.tags.length, track.id).toBeGreaterThan(2);
      expect(track.tags, track.id).toContain("bgm");
    }
  });

  it("카테고리 그룹이 전곡을 빠짐없이 담는다", () => {
    const groups = bgmTracksByCategory();
    const total = [...groups.values()].reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(BGM_CATALOG.length);
    expect(groups.size).toBeGreaterThan(50);
  });

  it("표시 라벨에 제목·장면·길이가 모두 들어간다", () => {
    const track = BGM_CATALOG[0]!;
    const label = bgmTrackLabel(track);
    expect(label).toContain(track.title);
    expect(label).toContain(track.category);
    expect(label).toMatch(/\(\d+:\d{2}\)$/);
  });

  it("id 로 트랙을 찾을 수 있고 카탈로그 밖 id 는 undefined 다", () => {
    expect(findBgmTrack(BGM_CATALOG[0]!.id)?.trackCode).toBe(BGM_CATALOG[0]!.trackCode);
    expect(findBgmTrack("cc0-bgm-does-not-exist")).toBeUndefined();
    expect(isBgmCatalogResourceId(BGM_CATALOG[0]!.id)).toBe(true);
    expect(isBgmCatalogResourceId("cc0-bgm-field")).toBe(false);
  });
});

describe("BGM CDN 경로 해석", () => {
  const fileName = "rtp-fld-001-meadow-guild-square_f5d3e29d.mp3";

  it("CDN 미설정이면 같은 오리진 로컬 폴백으로 떨어진다", () => {
    expect(bgmCdnBase({})).toBeNull();
    expect(bgmTrackUrl(fileName, {})).toBe(`${BGM_LOCAL_FALLBACK_PREFIX}/${fileName}`);
  });

  it("CDN 이 설정되면 절대 URL 을 만들고 끝의 슬래시를 정리한다", () => {
    const env = { VITE_BGM_CDN_BASE: "https://cdn.example.com/rpg-zzu///" };
    expect(bgmCdnBase(env)).toBe("https://cdn.example.com/rpg-zzu");
    expect(bgmTrackUrl(fileName, env)).toBe(`https://cdn.example.com/rpg-zzu/${BGM_CDN_PREFIX}/${fileName}`);
  });

  it("http(s) 가 아닌 베이스는 무시한다", () => {
    // 오타로 javascript:/file: 같은 스킴이 들어가면 절대 URL 로 새 나가지 않게 막는다.
    expect(bgmCdnBase({ VITE_BGM_CDN_BASE: "javascript:alert(1)" })).toBeNull();
    expect(bgmCdnBase({ VITE_BGM_CDN_BASE: "   " })).toBeNull();
  });

  it("경로 조작이 섞인 파일명은 거부한다", () => {
    for (const bad of ["../secret.mp3", "a/b.mp3", "a\\b.mp3", "  "]) {
      expect(bgmTrackUrl(bad, {}), bad).toBeNull();
    }
  });

  it("리졸버가 카탈로그 id 를 재생 URL 로 바꾼다", () => {
    const track = BGM_CATALOG[0]!;
    expect(resolveBgmCatalogAssetUrl(track.id)).toContain(findBgmRuntimeEntry(track.id)!.fileName);
    expect(resolveBgmCatalogAssetUrl("cc0-bgm-not-a-track")).toBeNull();
  });

  it("공용 리소스 해석기도 같은 URL 을 돌려준다", () => {
    const track = BGM_CATALOG[0]!;
    const url = resolveAssetResourceUrl(track.id, { project: { assets: { uploaded: {}, sprites: {} } } as never });
    expect(url).toBe(resolveBgmCatalogAssetUrl(track.id));
  });
});

describe("카탈로그 곡을 프로젝트에서 쓸 수 있다", () => {
  it("알려진 리소스 id 집합에 281곡이 모두 들어 있다", () => {
    // 이게 깨지면 곡이 안 들리는 게 아니라 프로젝트 역직렬화가 assert 로 실패한다.
    const known = collectResourceIds(createBlankProject());
    const missing = BGM_CATALOG.filter((track) => !known.has(track.id)).map((track) => track.id);
    expect(missing).toEqual([]);
  });

  it("리소스 검색이 장면 낱말로 카탈로그 곡을 찾는다", () => {
    for (const query of ["던전", "전투", "마을", "동굴"]) {
      const hits = searchResources("bgm", query);
      const fromCatalog = hits.filter((hit) => isBgmCatalogResourceId(hit.id.replace(/^bgm:/, "")));
      expect(fromCatalog.length, `"${query}" 로 카탈로그 곡을 못 찾았다`).toBeGreaterThan(0);
    }
  });

  it("전체 브라우징 질의가 카탈로그 전곡을 포함한다", () => {
    const all = searchResources("bgm", "*").map((hit) => hit.id.replace(/^bgm:/, ""));
    expect(all.filter((id) => isBgmCatalogResourceId(id))).toHaveLength(BGM_CATALOG.length);
  });
});

describe("스타터 곡 — CDN 없이도 소리가 난다", () => {
  it("기본 맵/전투 BGM 이 스타터 곡이다", () => {
    const system = defaultSystem();
    for (const id of [system.defaultBgmResourceId, system.battleBgmResourceId]) {
      expect(id, "기본 BGM 슬롯이 비어 있다").toBeTruthy();
      expect(BGM_STARTER_TRACK_IDS, `${id} 는 레포에 파일이 없는 곡이다(CDN 전용)`).toContain(id);
    }
  });

  it("타이틀 BGM 은 기본값이 없다(의도된 무음)", () => {
    // titleScreenMusic.test.ts 의 "silent title" 계약과 짝. 카탈로그를 기본 세트로 만들면서
    // 이 계약을 조용히 뒤집는 회귀를 막는다 — 곡은 피커에 있고, 꽂는 건 저작자 몫이다.
    expect(defaultTitleScreenSettings().musicResourceId).toBeUndefined();
  });

  it("스타터 곡 파일이 public/ 에 실제로 존재한다", () => {
    for (const id of BGM_STARTER_TRACK_IDS) {
      const path = localPathFor(id);
      expect(existsSync(resolve("public", path)), `${path} 없음`).toBe(true);
    }
  });

  it("스타터 곡은 카탈로그 소속이다", () => {
    for (const id of BGM_STARTER_TRACK_IDS) expect(isBgmCatalogResourceId(id)).toBe(true);
  });
});
