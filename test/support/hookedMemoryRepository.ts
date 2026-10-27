import { createHash } from "node:crypto";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { serialize } from "@/project/io";
import { createMemoryRepository, type MemoryRepository } from "@/project/persistence/memoryRepository";
import { setProjectRepositoryForTest } from "@/project/persistence/repository";
import type { ProjectTarget } from "@/project/persistence/target";
import type { ProjectSnapshot, SaveResult } from "@/project/persistence/types";
import type { Project } from "@/project/types";

export type RepositoryRequest = { readonly op: "save" | "save-map-patch" | "proof-read" | "commit-record" | "commit-list" };
export type RecordedCommit = { readonly commitId: string; readonly sha256: string; readonly authorKind: string };

/**
 * The project store's canonical transport is the repository (SQLite host / Electron / memory), not the retired LegacyDb REST
 * rows. This wraps the memory repository with the same seams the REST-mocking tests used: hold or fail a proof read, hold a
 * save, hold or fail the commit log, and count each repository request.
 */
export function installHookedMemoryRepository(projectId: string) {
  const target: ProjectTarget = { kind: "local", projectDir: `/tmp/oprn-hooked-${projectId}`, projectId };
  const base = createMemoryRepository({ target });
  const requests: RepositoryRequest[] = [];
  const commits: RecordedCommit[] = [];
  let read: (() => Promise<ProjectSnapshot | null>) | undefined;
  let write: (() => Promise<void>) | undefined;
  let commit: (() => Promise<void>) | undefined;
  const repository: MemoryRepository = {
    ...base,
    async save(project, saveTarget, authority) {
      requests.push({ op: "save" });
      if (write) await write();
      return base.save(project, saveTarget, authority);
    },
    async saveMapPatch(input, saveTarget) {
      requests.push({ op: "save-map-patch" });
      if (write) await write();
      return base.saveMapPatch(input, saveTarget);
    },
    async loadForProof(proofTarget, signal) {
      requests.push({ op: "proof-read" });
      return read ? read() : base.loadForProof(proofTarget, signal);
    },
    commits: {
      ...base.commits,
      async record(input, commitTarget): Promise<SaveResult> {
        requests.push({ op: "commit-record" });
        const serialized = input.serialized ?? serialize(projectWithoutEventDrafts(input.project));
        const result = await base.commits.record(input, commitTarget);
        if (result.kind === "saved" && result.commitId) {
          commits.push({ commitId: result.commitId, sha256: createHash("sha256").update(serialized).digest("hex"), authorKind: input.identity.kind });
        }
        if (commit) await commit();
        return result;
      },
      list(limit, listTarget) {
        requests.push({ op: "commit-list" });
        return base.commits.list(limit, listTarget);
      },
    },
  };
  setProjectRepositoryForTest(repository);
  return {
    repository, target, requests, commits,
    /**
     * Seeds the canonical store and returns the project as the editor loads it. A project that came from the repository
     * round-trips to the same content identity; a never-saved createBlankProject() does not (default fields and bundled
     * tileset key order are normalized on save), which would turn every proof into a content mismatch.
     */
    async seedLoaded(project: Project): Promise<Project> {
      await base.save(project, target);
      const loaded = await base.loadProject(target);
      if (!loaded) throw new Error("Seeded project did not load");
      return loaded;
    },
    /** A fresh, mutable copy of the saved document as the proof read would return it. */
    async snapshot(): Promise<ProjectSnapshot> {
      const saved = await base.loadForProof(target);
      if (!saved) throw new Error("No saved project");
      return saved;
    },
    setRead: (next: (() => Promise<ProjectSnapshot | null>) | undefined) => { read = next; },
    setWrite: (next: (() => Promise<void>) | undefined) => { write = next; },
    setCommit: (next: (() => Promise<void>) | undefined) => { commit = next; },
    dispose: () => { setProjectRepositoryForTest(null); },
  };
}
