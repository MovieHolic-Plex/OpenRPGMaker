import { createMemoryRepository, type MemoryRepository } from "@/project/persistence/memoryRepository";
import { setProjectRepositoryForTest } from "@/project/persistence/repository";
import type { ProjectTarget } from "@/project/persistence/target";
import type { Project } from "@/project/types";

export type MemoryProjectSession = {
  readonly repository: MemoryRepository;
  readonly target: ProjectTarget;
  seed(project: Project): Promise<void>;
  dispose(): void;
};

/**
 * 이 테스트의 저장소를 메모리 어댑터로 명시한다. 원격이 기본이던 시절의 테스트는 localStorage 에
 * 설정을 심고 기본 어댑터가 그것을 집어 들기를 기대했다 — 기본값이 바뀌면 그 테스트는 조용히
 * 다른 것을 검증하게 된다. 대상을 명시하면 기본값이 무엇이든 같은 의미가 남는다.
 */
export function installMemoryProjectSession(options: { readonly target?: ProjectTarget } = {}): MemoryProjectSession {
  const target: ProjectTarget = options.target ?? {
    kind: "local",
    projectDir: "/tmp/oprn-memory-project",
    projectId: "uuid-memory-project",
  };
  const repository = createMemoryRepository({ target });
  setProjectRepositoryForTest(repository);
  return {
    repository,
    target,
    async seed(project: Project): Promise<void> {
      await repository.save(project, target);
    },
    dispose(): void {
      setProjectRepositoryForTest(null);
    },
  };
}
