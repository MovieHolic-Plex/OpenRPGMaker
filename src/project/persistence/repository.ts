import { createElectronRepository, hasElectronBridge, type ElectronRepository } from "./electronRepository";
import { createSupabaseRepository } from "./supabaseRepository";
import type { ProjectRepository } from "./types";

let override: ProjectRepository | null = null;
let remote: ProjectRepository | null = null;
let electron: ElectronRepository | null = null;

/**
 * 이 편집기 세션의 저장소. 부팅 시 고정되지 않고 부를 때마다 고른다 — store 는 모듈
 * 싱글턴이라 테스트가 import 뒤에 주입하기 때문이다. preload 브리지(window.oprn)가 있으면
 * Electron 어댑터, 없으면 기존 Supabase 어댑터가 기본이다(원격 퇴역 P6 에서 메모리로 바뀐다).
 */
export function projectRepository(): ProjectRepository {
  if (override) return override;
  if (hasElectronBridge()) {
    electron ??= createElectronRepository();
    return electron;
  }
  remote ??= createSupabaseRepository();
  return remote;
}

/** 테스트 전용. null 이면 기본 어댑터로 돌아간다. */
export function setProjectRepositoryForTest(repository: ProjectRepository | null): void {
  override = repository;
}

/**
 * 시작 화면(메인 프로세스)이 열어둔 폴더를 렌더러가 이어받는다. 편집기 부팅 전에 한 번 부른다.
 * 브라우저·원격에서는 no-op 이고, 채택 실패가 부팅을 막지 않는다.
 */
export async function adoptElectronOpenProject(): Promise<boolean> {
  if (!hasElectronBridge()) return false;
  electron ??= createElectronRepository();
  try {
    return await electron.adoptOpenProject();
  } catch (error) {
    // 브리지 조회 실패로 편집기가 못 뜨면 안 된다 — 세션 없이 기존 경로로 부팅한다.
    console.error("[persistence] 열린 프로젝트 폴더 채택에 실패했습니다:", error);
    return false;
  }
}
