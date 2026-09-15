import { createElectronRepository, hasElectronBridge } from "./electronRepository";
import { createMemoryRepository } from "./memoryRepository";
import type { ProjectRepository } from "./types";

let override: ProjectRepository | null = null;
let memory: ProjectRepository | null = null;
let electron: ProjectRepository | null = null;

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
  // P6: Supabase 어댑터 퇴역 — 원격이 필요하면 import-supabase 로 폴더로 옮긴 뒤 Electron 을 쓴다.
  // 웹 빌드는 메모리 어댑터만 남아 QA 하네스가 된다(설계서 8절 P6 행).
  memory ??= createMemoryRepository({ target: null });
  return memory;
}

/** 테스트 전용. null 이면 기본 어댑터로 돌아간다. */
export function setProjectRepositoryForTest(repository: ProjectRepository | null): void {
  override = repository;
}
