// CC0 효과음 카탈로그(635개) 배선 가드.
//
// 이 파일이 지키는 것은 네 가지다.
//  1) 카탈로그 자체가 줄거나 깨지지 않는다(생성 스크립트 회귀).
//  2) 카탈로그 항목을 지정한 프로젝트가 **역직렬화에 성공**한다 — 알려진 리소스 id 집합에 있어야 한다.
//     여기서 빠지면 소리가 안 나는 게 아니라 프로젝트 로드 자체가 assert 로 실패한다(BGM 에서 실측).
//  3) **파일이 레포에 실제로 있다.** BGM 과 달리 SE 는 CDN 이 없어 파일 부재가 곧 무음이다.
//  4) 피커/AI 검색에서 카탈로그가 EasyRPG RTP 보다 앞에 온다.
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { SE_CATALOG, SE_CATALOG_CATEGORIES, SE_CATALOG_LICENSE } from "@/assets/seCatalog";
import {
  SE_CATALOG_COUNT,
  SE_CATALOG_TOTAL_SECONDS,
  findSeRuntimePath,
  isSeCatalogResourceId,
  seCatalogResourceIds,
} from "@/assets/seCatalogRuntime";
import { resolveSeCatalogAssetUrl } from "@/assets/seCatalogResolver";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { searchResources } from "@/assets/resourceSearch";
import { createBlankProject } from "@/project/defaults";

describe("CC0 효과음 카탈로그", () => {
  it("635개가 실려 있고 런타임/메타데이터 목록이 일치한다", () => {
    expect(SE_CATALOG_COUNT).toBe(635);
    expect(SE_CATALOG).toHaveLength(SE_CATALOG_COUNT);
    expect(new Set(seCatalogResourceIds())).toEqual(new Set(SE_CATALOG.map((e) => e.id)));
  });

  it("리소스 id 가 중복되지 않고 전부 cc0-se- 로 시작한다", () => {
    expect(new Set(SE_CATALOG.map((e) => e.id)).size).toBe(SE_CATALOG.length);
    for (const entry of SE_CATALOG) expect(entry.id.startsWith("cc0-se-")).toBe(true);
  });

  it("경로가 중복되지 않는다 — 팩 간 파일명 충돌(metal_01 등)이 평면화로 되살아나면 잡는다", () => {
    expect(new Set(SE_CATALOG.map((e) => findSeRuntimePath(e.id))).size).toBe(SE_CATALOG.length);
  });

  it("같은 오디오 바이트를 이름만 바꿔 두 번 노출하지 않는다", () => {
    expect(new Set(SE_CATALOG.map((entry) => entry.sha256)).size).toBe(SE_CATALOG.length);
  });

  it("라이선스가 CC0 이고 총 길이가 유지된다", () => {
    expect(SE_CATALOG_LICENSE).toBe("CC0-1.0");
    // 개수만 세면 놓치는 "파일이 바뀐" 회귀를 잡는다.
    expect(SE_CATALOG_TOTAL_SECONDS).toBeGreaterThan(330);
    expect(SE_CATALOG_TOTAL_SECONDS).toBeLessThan(340);
  });

  it("모든 파일이 레포에 실제로 존재한다 — SE 는 CDN 이 없어 부재가 곧 무음이다", () => {
    const missing: string[] = [];
    for (const entry of SE_CATALOG) {
      const path = findSeRuntimePath(entry.id);
      expect(path, `${entry.id} 런타임 경로 없음`).toBeDefined();
      if (!existsSync(resolve(process.cwd(), "public", path!))) missing.push(path!);
    }
    expect(missing).toEqual([]);
  });

  it("리졸버가 동일 출처 절대 경로를 낸다 — CDN 절대 URL 이 섞이면 잡는다", () => {
    for (const entry of SE_CATALOG.slice(0, 40)) {
      const url = resolveSeCatalogAssetUrl(entry.id);
      expect(url).toBe(`/${findSeRuntimePath(entry.id)}`);
      // 공용 해석기 체인에도 연결돼 있어야 에디터 미리듣기와 런타임이 함께 동작한다.
      expect(resolveAssetResourceUrl(entry.id)).toBe(url);
    }
    expect(resolveSeCatalogAssetUrl("cc0-se-존재하지-않는-id")).toBeNull();
    expect(isSeCatalogResourceId("easyrpg-sound-absorb1")).toBe(false);
  });

  it("확장자가 브라우저 재생 가능한 것만 있다(.mid 금지)", () => {
    for (const entry of SE_CATALOG) {
      expect(findSeRuntimePath(entry.id)).toMatch(/\.(ogg|wav|mp3|m4a)$/);
    }
  });

  it("모든 id 가 알려진 리소스 집합에 등록돼 있다 — 빠지면 프로젝트 로드가 실패한다", () => {
    const known = collectResourceIds(createBlankProject());
    const unregistered = SE_CATALOG.filter((e) => !known.has(e.id)).map((e) => e.id);
    expect(unregistered).toEqual([]);
  });

  it("카테고리가 13개이고 모든 항목이 그 안에 든다", () => {
    expect(SE_CATALOG_CATEGORIES).toHaveLength(13);
    const set = new Set(SE_CATALOG_CATEGORIES);
    for (const entry of SE_CATALOG) expect(set.has(entry.category)).toBe(true);
    // 카탈로그 순서가 곧 피커 그룹 순서다 — 카테고리가 뒤섞이면 그룹 헤더가 반복된다.
    const firstIndex = new Map<string, number>();
    SE_CATALOG.forEach((e, i) => {
      if (!firstIndex.has(e.category)) firstIndex.set(e.category, i);
    });
    const seen = SE_CATALOG.map((e) => firstIndex.get(e.category)!);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it("AI 검색(se)에서 카탈로그가 EasyRPG RTP 보다 앞에 온다", () => {
    const all = searchResources("se", "*");
    const firstRtp = all.findIndex((r) => r.id.startsWith("se:easyrpg-sound-"));
    const firstCatalog = all.findIndex((r) => r.id.startsWith("se:cc0-se-"));
    expect(firstCatalog).toBeGreaterThanOrEqual(0);
    if (firstRtp >= 0) expect(firstCatalog).toBeLessThan(firstRtp);
  });

  it("한국어 장면어로 효과음을 찾을 수 있다 — 영어 파일명만으로는 감독이 못 찾는다", () => {
    for (const query of ["결정", "취소", "동전", "포효", "자물쇠", "징글"]) {
      const hits = searchResources("se", query);
      expect(hits.length, `"${query}" 검색 결과 없음`).toBeGreaterThan(0);
      expect(hits.some((h) => h.id.startsWith("se:cc0-se-"))).toBe(true);
    }
  });

  it("RPG 발소리와 재질 충돌음을 한국어로 찾아 이벤트에 넣을 수 있다", () => {
    const expected = [
      "se:cc0-se-kra-footstep00",
      "se:cc0-se-kis-footstep-grass-000",
      "se:cc0-se-kis-impactmining-000",
    ];
    for (const id of expected) {
      expect(searchResources("se", "*").some((hit) => hit.id === id), `${id} 없음`).toBe(true);
    }
    expect(searchResources("se", "발소리").some((hit) => hit.id === expected[1])).toBe(true);
    expect(searchResources("se", "채굴").some((hit) => hit.id === expected[2])).toBe(true);
  });
  // 징글 이름은 원본이 숫자뿐이다(`jingles_NES12`). 음향 방향은 삼중 검산을 통과해
  // `scripts/se/accepted-contours.json` 에 남은 것만 제목에 달린다 — 그 배선이 사라지면
  // 징글은 다시 "8비트 징글 04" 가 되어 상승/하강을 구분할 수단이 없어진다.
  it("징글은 삼중 검산으로 확정된 음향 방향을 제목·태그로 가진다", () => {
    const jingles = SE_CATALOG.filter((e) => e.category === "징글 (ME)");
    const directed = jingles.filter((e) => e.tags.includes("상승") || e.tags.includes("하강"));
    expect(directed.length).toBeGreaterThan(20);
    for (const e of directed) {
      const dir = e.tags.includes("상승") ? "상승" : "하강";
      expect(e.title).toContain(`(${dir})`);
      expect(e.tags).toContain(dir === "상승" ? "올라가는" : "내려가는");
    }
    // 방향이 확정되지 않은 징글에는 방향 어휘를 달지 않는다(추정 금지).
    for (const e of jingles.filter((x) => !directed.includes(x))) {
      expect(e.title).not.toMatch(/\((상승|하강)\)/);
    }
    for (const dir of ["상승", "하강"]) {
      const hits = searchResources("se", dir);
      expect(
        hits.some((h) => h.id.startsWith("se:cc0-se-kjg-")),
        `"${dir}" 검색에 징글 없음`,
      ).toBe(true);
    }
  });
});
