// 상점가 마을 쇼케이스 프로젝트 팩터리.
//
// 왜 `src/project/defaults` 가 아니라 editor 층에 있는가 (실측):
//   이 팩터리는 build_village 슬롯 알고리즘(villageShoppingStreetBuild)을 쓰고, 그 모듈은
//   toolRunner → toolRegistry → AI 도구 전량으로 이어진다. defaultProject.ts 에 두면
//   플레이어가 `@/project/defaults` 를 import 하는 순간 그 그래프가 출하 번들로 따라 들어온다
//   (playerBuild 게이트 실측: src/ai/{buildSpec,modifyIntent,groupSampleBuilder,workItemOutcome},
//   projectRepository().currentTarget 5종 유입). 순환을 CJS `require("@/...")` 로 끊으려던 이전 방식은
//   번들러가 그 호출을 정적으로 따라가 누출을 막지 못했고, vitest 에서는 vite alias 를 못 풀어
//   호출 자체가 깨졌다. 호출자는 editor 하나뿐이므로 팩터리를 editor 층으로 옮긴다.
import {
  buildVillageShoppingStreetProject,
  villageShoppingStreetStartPos,
} from "@/editor/content/villageShoppingStreetBuild";
import type { Project } from "@/project/types";

export function createVillageShoppingStreetProject(): Project {
  // build_village 슬롯·HOUSE_MARGIN 알고리즘 + 동쪽 상점가 (하드코딩 집 origin 금지)
  const built = buildVillageShoppingStreetProject({ seed: 11, houses: 6 });
  const project = built.project;
  if (!project.startPos || project.startPos.x < 0) {
    project.startPos = villageShoppingStreetStartPos();
  }
  return project;
}
