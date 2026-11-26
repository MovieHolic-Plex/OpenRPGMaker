import { afterEach, describe, expect, it } from "vitest";
import { projectRepository, setProjectRepositoryForTest } from "@/project/persistence/repository";
import type { ProjectRepository } from "@/project/persistence/types";
import { isLocalTarget, isRemoteTarget, projectTargetKey, sameProjectTarget, type LocalProjectTarget, type RemoteProjectTarget } from "@/project/persistence/target";
import { isolateTimers } from "../mergedTeardown";

describe("repositorySelection", () => {
  isolateTimers();
  const stub = { kind: "memory" } as unknown as ProjectRepository;
  describe("projectRepository 선택기", () => {
    afterEach(() => setProjectRepositoryForTest(null));

    it("테스트 주입이 있으면 그것을 돌려준다", () => {
      setProjectRepositoryForTest(stub);
      expect(projectRepository()).toBe(stub);
    });

    it("주입을 지우면 기본 어댑터(memory)로 돌아간다", () => {
      setProjectRepositoryForTest(stub);
      setProjectRepositoryForTest(null);
      expect(projectRepository().kind).toBe("memory");
    });

    it("기본 어댑터는 한 번만 만들어진다", () => {
      expect(projectRepository()).toBe(projectRepository());
    });
  });
});

describe("target", () => {
  isolateTimers();
  const remote: RemoteProjectTarget = { url: "https://x.legacyDb.co", projectId: "p1", anonKey: "k" };
  const localA: LocalProjectTarget = { kind: "local", projectDir: "/proj/a", projectId: "a-uuid" };
  const localB: LocalProjectTarget = { kind: "local", projectDir: "/proj/b", projectId: "b-uuid" };
  describe("project target union", () => {
    it("로컬·원격을 종류로 좁힌다", () => {
      expect(isLocalTarget(localA)).toBe(true);
      expect(isRemoteTarget(localA)).toBe(false);
      expect(isLocalTarget(remote)).toBe(false);
      expect(isRemoteTarget(remote)).toBe(true);
    });

    it("키는 자격증명 없이 대상을 구분한다", () => {
      expect(projectTargetKey(localA)).toBe("local:/proj/a:a-uuid");
      expect(projectTargetKey(remote)).toBe("remote:https://x.legacyDb.co:p1");
      expect(projectTargetKey(localA)).not.toContain("k");
    });

    it("로컬은 폴더 경로로 비교하고 원격은 url·id·anonKey 로 비교한다", () => {
      expect(sameProjectTarget(localA, { ...localA })).toBe(true);
      expect(sameProjectTarget(localA, localB)).toBe(false);
      expect(sameProjectTarget(localA, remote)).toBe(false);
      expect(sameProjectTarget(remote, { ...remote })).toBe(true);
      expect(sameProjectTarget(remote, { ...remote, anonKey: "other" })).toBe(false);
      expect(sameProjectTarget(localA, null)).toBe(false);
    });
  });
});
