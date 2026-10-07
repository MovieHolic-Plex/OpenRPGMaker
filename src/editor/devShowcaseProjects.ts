import { createBlankProject } from "@/project/defaults";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import type { Project } from "@/project/types";

// 2026-10-07 저작권 정리: 지운 칩셋(EasyRPG·숲마을·기후 마을 등) 위에 그려진 데모·쇼케이스 프로젝트
// (이슬 마을 예제, 집/마을 쇼케이스, 눈산·얼음 평원, 녹턴, 시장 마을…)와 그 URL 파라미터는 지웠다.
// freshProject=1 은 이제 빈 프로젝트다.
const DEV_FRESH_PROJECT_PARAM = "freshProject";
const DEV_BLANK_PROJECT_PARAM = "blankProject";
const DEV_PROJECT_PARAM = "devProject";
const CANONICAL_PROJECT_PARAM = "projectRecovered";

export function createDevShowcaseProjectForLocation(): Project | null {
  if (typeof window === "undefined") return null;
  if (!isLocalDevHost(window.location.hostname)) return null;
  const e2eProject = createE2eProjectForLocation();
  if (e2eProject) return e2eProject;
  const params = new URLSearchParams(window.location.search);
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
