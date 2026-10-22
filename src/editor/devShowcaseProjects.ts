import { createBlankProject } from "@/project/defaults";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import type { FlagshipDemoBuildResult, FlagshipDemoId } from "@/project/flagship/types";
import type { Project } from "@/project/types";

// 2026-10-07 저작권 정리: 지운 칩셋(EasyRPG·숲마을·기후 마을 등) 위에 그려진 데모·쇼케이스 프로젝트
// (이슬 마을 예제, 집/마을 쇼케이스, 눈산·얼음 평원, 녹턴, 시장 마을…)와 그 URL 파라미터는 지웠다.
// freshProject=1 은 이제 빈 프로젝트다.
const DEV_FRESH_PROJECT_PARAM = "freshProject";
const DEV_BLANK_PROJECT_PARAM = "blankProject";
const DEV_PROJECT_PARAM = "devProject";
const CANONICAL_PROJECT_PARAM = "projectRecovered";

type FlagshipBuilder = (id: FlagshipDemoId) => FlagshipDemoBuildResult;

/** `?demo=` 이 대표 데모를 가리키면 그 id. 데모 빌더(예제 그림 수십 MB)는 이 값이 있을 때만 받는다. */
export function flagshipDemoIdForLocation(): FlagshipDemoId | null {
  if (typeof window === "undefined") return null;
  const rawDemo = new URLSearchParams(window.location.search).get("demo");
  const demo = rawDemo === "fallen-star" ? "chrono-bell" : rawDemo === "astra-horizon" ? "emerald-crown" : rawDemo;
  return demo === "chrono-bell" || demo === "emerald-crown" || demo === "shitamachi-fourth-season" || demo === "first-love" ? demo : null;
}

/**
 * 부팅이 store.load 앞에서 기다린다 — 대표 데모 주소일 때만 데모 빌더를 동적으로 받아 동기 팩토리에 물린다.
 * 예전에는 편집기 진입 번들이 데모 빌더를 정적으로 품어 모든 부팅이 예제 그림 약 18MB 를 읽었다(2026-10-20 실측).
 */
export async function prepareDevShowcaseProjectFactory(): Promise<() => Project | null> {
  if (flagshipDemoIdForLocation() === null) return () => createDevShowcaseProjectForLocation();
  const { createFlagshipDemoProject } = await import("@/project/flagship");
  return () => createDevShowcaseProjectForLocation(createFlagshipDemoProject);
}

export function createDevShowcaseProjectForLocation(buildFlagship?: FlagshipBuilder): Project | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const demo = flagshipDemoIdForLocation();
  if (demo) {
    // 빌더 없이 불렸으면(동기 경로) 데모를 만들 수 없다 — prepareDevShowcaseProjectFactory 를 거쳐야 한다.
    return buildFlagship ? buildFlagship(demo).project : null;
  }
  if (!isLocalDevHost(window.location.hostname)) return null;
  const e2eProject = createE2eProjectForLocation();
  if (e2eProject) return e2eProject;
  if (params.has(CANONICAL_PROJECT_PARAM)) return null;
  if (params.has(DEV_BLANK_PROJECT_PARAM)) return createBlankProject();
  if (params.has(DEV_FRESH_PROJECT_PARAM)) return createBlankProject();
  if (!params.has(DEV_PROJECT_PARAM)) return null;
  if (params.has("scarloxyDemo")) return createScarloxyDemoProject();
  return null;
}

function createE2eProjectForLocation(): Project | null {
  const seed = window.__OPRN_E2E_PROJECT__;
  if (!isE2eProject(seed)) return null;
  return structuredClone(seed);
}

function isE2eProject(value: unknown): value is Project {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return "version" in value && "maps" in value && "startMapId" in value && "database" in value;
}

function isLocalDevHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "mdc-server";
}
