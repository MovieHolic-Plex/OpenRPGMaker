import { createElectronRepository, hasElectronBridge } from "./electronRepository";
import { createMemoryRepository } from "./memoryRepository";
import { isRemoteTarget, type RemoteProjectTarget } from "./target";
import type { ProjectRepository } from "./types";

let override: ProjectRepository | null = null;
let memory: ProjectRepository | null = null;
let electron: ProjectRepository | null = null;

/**
 * 이 편집기 세션의 저장소. 부팅 시 고정되지 않고 부를 때마다 고른다 — store 는 모듈
 * 싱글턴이라 테스트가 import 뒤에 주입하기 때문이다. Electron 브리지(window.oprn)가 있으면
 * Electron 어댑터(로컬 폴더 정본), 없으면(웹 빌드·노드) 메모리 어댑터다.
 * 웹 빌드는 편집 도구가 아니라 QA 하네스다 — 원격 행을 쓰던 작업은
 * `scripts/oprn-store.mjs import-supabase` 로 폴더로 옮긴다.
 */
export function projectRepository(): ProjectRepository {
  if (override) return override;
  if (hasElectronBridge()) {
    electron ??= createElectronRepository();
    return electron;
  }
  memory ??= createMemoryRepository({ target: null });
  return memory;
}

/**
 * 이 세션의 현재 원격 대상. 로컬 폴더 정본이나 미설정이면 null.
 *
 * 원격 전용 표면(잠금·PostgREST 조회 툴)이 전역 설정을 직접 읽으면, 폴더 정본 세션에서도
 * 환경의 자격증명을 집어 들어 남의 프로젝트를 향한다 — 세션의 대상을 봐야 맞다.
 */
export function currentRemoteTarget(): RemoteProjectTarget | null {
  const target = projectRepository().currentTarget();
  return target !== null && isRemoteTarget(target) ? target : null;
}

/** 테스트 전용. null 이면 기본 어댑터로 돌아간다. */
export function setProjectRepositoryForTest(repository: ProjectRepository | null): void {
  override = repository;
}

/** 시작 화면이 주 프로세스에 열어 둔 폴더를 이 렌더러 세션에 붙인다. 웹 빌드에서는 no-op. */
export async function adoptElectronOpenProject(): Promise<boolean> {
  if (!hasElectronBridge()) return false;
  try {
    return await createElectronRepository().adoptOpenProject();
  } catch (error) {
    console.error("[persistence] 열린 프로젝트 폴더 채택에 실패했습니다:", error);
    return false;
  }
}
