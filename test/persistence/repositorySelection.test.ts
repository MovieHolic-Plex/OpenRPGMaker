import { afterEach, describe, expect, it } from "vitest";
import { projectRepository, setProjectRepositoryForTest } from "@/project/persistence/repository";
import type { ProjectRepository } from "@/project/persistence/types";

const stub = { kind: "memory" } as unknown as ProjectRepository;

describe("projectRepository 선택기", () => {
  afterEach(() => setProjectRepositoryForTest(null));

  it("테스트 주입이 있으면 그것을 돌려준다", () => {
    setProjectRepositoryForTest(stub);
    expect(projectRepository()).toBe(stub);
  });

  it("주입을 지우면 기본 어댑터(remote)로 돌아간다", () => {
    setProjectRepositoryForTest(stub);
    setProjectRepositoryForTest(null);
    expect(projectRepository().kind).toBe("remote");
  });

  it("기본 어댑터는 한 번만 만들어진다", () => {
    expect(projectRepository()).toBe(projectRepository());
  });
});
