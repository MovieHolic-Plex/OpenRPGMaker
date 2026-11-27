import type { Project } from "../types";
import { restoreFreshBundledTilesets } from "../bundledTilesetDiff";
import { createBlankProject } from "./blankProject";
import { preloadBundledTilesetDefinitions } from "./defaultAssets";
import { slimStarterProject } from "./slimStarter";

/**
 * 편집기가 빈 폴더에 짓는 「빈 프로젝트」 — `createStarterBlankProject()` 를 부팅 정규화까지 마친 것과 같은 값이지만,
 * 번들 타일셋 49개를 짓지 않고 구운 «정규화한 새 타일셋» 차이 보기(src/assets/bundledTilesetFreshViews.json)에서 만든다.
 * 맵이 쓰는 타일셋만 곧바로 되돌리고 나머지는 지연 객체다(저장본을 다시 열 때와 같은 경로, bundledTilesetDiff.ts 「지연 되돌리기」).
 *
 * 왜(2026-11-27 실측, 패키지 앱 새 빈 프로젝트): 번들 정의 JSON 약 47MB 읽기 + 타일셋 49개(74MiB) 짓기 1.9s, 그 정규화 1.3s,
 * 첫 저장의 복제·번들 차이 3.3s 와 78MB 쓰기가 편집 화면 앞을 막았다. 구운 보기는 1.4MB 다.
 *
 * 계약:
 *  - 구운 보기는 `createStarterBlankProject()` 에 번들 타일셋 정규화기를 돌린 뒤의 저장 보기와 같아야 한다 —
 *    scripts/content/bake-fresh-bundled-tileset-views.mts --check(ci-fast)와 test/freshStarter.test.ts 가 지킨다.
 *  - 그래서 만든 항목은 «새 항목» 표지(isFreshBundledTileset)를 달고 정규화기가 건너뛴다 — 지연 항목을 되돌리지 않는다.
 *  - 저장본에는 번들 정의와의 차이(대개 머리 + 키 목록)만 실린다. 저장 형식은 바뀌지 않는다(옛 앱도 같은 차이 보기를 읽는다).
 */
export async function createFreshStarterBlankProject(): Promise<Project> {
  const project = slimStarterProject(createBlankProject({ withTilesets: false }));
  const eager = new Set(Object.values(project.maps).map((map) => map.tilesetId).filter((id): id is string => typeof id === "string"));
  const [{ default: baked }] = await Promise.all([import("@/assets/bundledTilesetFreshViews.json"), preloadBundledTilesetDefinitions(eager)]);
  project.tilesets = restoreFreshBundledTilesets(structuredClone(baked) as Record<string, unknown>, eager);
  return project;
}
