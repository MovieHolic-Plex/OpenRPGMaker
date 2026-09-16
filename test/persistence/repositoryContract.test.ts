import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakePostgrest } from "./fakePostgrest";
import { createSupabaseRepository } from "@/project/persistence/supabaseRepository";
import { createLocalRepositoryFixture } from "../localStore/localRepositoryFixture";
import { createHouseTemplateGalleryProject } from "@/project/defaults/defaultProject";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { serialize, serializeForComparison } from "@/project/io";
import { createMemoryRepository } from "@/project/persistence/memoryRepository";
import type { ProjectTarget } from "@/project/persistence/target";
import type { ProjectRepository } from "@/project/persistence/types";
import type { GameMap, Project } from "@/project/types";
import { sha256HexText } from "@/util/sha256";

type Fixture = { readonly repository: ProjectRepository; readonly target: ProjectTarget; readonly cleanup?: () => void };
type FixtureFactory = (projectId: string) => Fixture | Promise<Fixture>;

let sequence = 0;
const nextProjectId = () => `contract-${Date.now().toString(36)}-${(sequence += 1)}`;
const identity = { id: "editor-1", label: "테스터", kind: "human" as const };

function mapIds(project: Project): [string, string] {
  const [first, second] = Object.keys(project.maps);
  if (!first || !second) throw new Error("fixture needs two maps");
  return [first, second];
}
function renamed(project: Project, mapId: string, name: string): GameMap {
  const map = project.maps[mapId];
  if (!map) throw new Error(`expected map ${mapId}`);
  return { ...map, name };
}

export function describeRepositoryContract(name: string, factory: FixtureFactory): void {
  describe(`ProjectRepository 계약 — ${name}`, () => {
    let fixture: Fixture | undefined;
    afterEach(() => { fixture?.cleanup?.(); fixture = undefined; });
    const open = async () => { fixture = await factory(nextProjectId()); return fixture; };

    it("상태: 대상이 있으면 ready, 비활성 사유가 있으면 disabled", async () => {
      const { repository, target } = await open();
      const ready = repository.status(null);
      expect(ready.kind).toBe("ready");
      if (ready.kind === "ready") expect(ready.projectId).toBe(target.projectId);
      expect(repository.status("dev-showcase")).toEqual({ kind: "disabled", reason: "dev-showcase" });
    });

    it("probe 는 연결이 있으면 true", async () => {
      const { repository } = await open();
      await expect(repository.probe()).resolves.toBe(true);
    });

    it("없는 프로젝트는 null", async () => {
      const { repository, target } = await open();
      await expect(repository.loadSnapshot(target)).resolves.toBeNull();
      await expect(repository.loadProject(target)).resolves.toBeNull();
    });

    it("저장 → 읽기: 같은 내용, sha256 은 직렬화 텍스트의 해시, 권한은 legacy", async () => {
      const { repository, target } = await open();
      const project = createHouseTemplateGalleryProject();
      const saved = await repository.save(project, target, { mode: "create", target });
      expect(saved.kind).toBe("saved");
      if (saved.kind !== "saved") return;
      const expectedSha = await sha256HexText(serialize(projectWithoutEventDrafts(project)));
      expect(saved.sha256).toBe(expectedSha);
      expect(saved.authority).toEqual({ mode: "legacy", target: { ...target } });

      const snapshot = await repository.loadSnapshot(target);
      expect(snapshot?.sha256).toBe(expectedSha);
      expect(snapshot?.authority.mode).toBe("legacy");
      expect(serializeForComparison(projectWithoutEventDrafts(snapshot!.project)))
        .toBe(serializeForComparison(projectWithoutEventDrafts(project)));

      const proof = await repository.loadForProof(target);
      expect(proof?.projectId).toBe(target.projectId);
    });

    it("loadProject 는 권한 콜백을 부르고 프로젝트를 돌려준다", async () => {
      const { repository, target } = await open();
      await repository.save(createHouseTemplateGalleryProject(), target);
      const modes: string[] = [];
      const project = await repository.loadProject(target, (authority) => { modes.push(authority.mode); });
      expect(project).not.toBeNull();
      expect(modes).toEqual(["legacy"]);
    });

    it("맵 패치: 서로 다른 맵을 고친 두 편집기가 차례로 저장하면 둘 다 남는다", async () => {
      const { repository, target } = await open();
      const base = createHouseTemplateGalleryProject();
      await repository.save(base, target);
      const [aId, bId] = mapIds(base);
      const editorA = structuredClone(base);
      editorA.maps[aId] = renamed(editorA, aId, "A 의 맵");
      const editorB = structuredClone(base);
      editorB.maps[bId] = renamed(editorB, bId, "B 의 맵");

      const first = await repository.saveMapPatch({ project: editorA, baseProject: base }, target);
      const second = await repository.saveMapPatch({ project: editorB, baseProject: base }, target);

      expect(first.kind).toBe("saved");
      expect(second.kind).toBe("saved");
      const latest = await repository.loadSnapshot(target);
      expect(latest?.project.maps[aId]?.name).toBe("A 의 맵");
      expect(latest?.project.maps[bId]?.name).toBe("B 의 맵");
    });

    it("맵 패치: 같은 맵을 다르게 고치면 두 번째는 충돌", async () => {
      const { repository, target } = await open();
      const base = createHouseTemplateGalleryProject();
      await repository.save(base, target);
      const [mapId] = mapIds(base);
      const editorA = structuredClone(base);
      editorA.maps[mapId] = renamed(editorA, mapId, "A 의 맵");
      const editorB = structuredClone(base);
      editorB.maps[mapId] = renamed(editorB, mapId, "B 의 맵");

      await repository.saveMapPatch({ project: editorA, baseProject: base }, target);
      const second = await repository.saveMapPatch({ project: editorB, baseProject: base }, target);

      expect(second).toEqual({ kind: "conflict", conflicts: [{ mapId, name: "B 의 맵" }] });
    });

    it("커밋: 기록한 커밋이 목록 맨 앞에 오고 tip 이 된다", async () => {
      const { repository, target } = await open();
      const project = createHouseTemplateGalleryProject();
      await repository.save(project, target);
      const recorded = await repository.commits.record({
        project, identity, reviewStatus: "direct", summary: "첫 커밋", toolNames: [],
      }, target);
      expect(recorded.kind).toBe("saved");
      if (recorded.kind !== "saved") return;
      const list = await repository.commits.list(5, target);
      expect(list[0]?.commitId).toBe(recorded.commitId);
      expect(list[0]?.message).toBe("첫 커밋");
      expect(list[0]?.authorLabel).toBe("테스터");
      expect(repository.commits.peekTip(target.projectId)).toBe(recorded.commitId);
    });

    it("AI 활동: 기록한 로그가 목록에 있고 runId 필터가 먹는다", async () => {
      const { repository, target } = await open();
      await repository.ai.recordActivity({ logId: "log-1", runId: "run-A", channel: "chat", instruction: "안녕", payload: { n: 1 } }, target);
      await repository.ai.recordActivity({ logId: "log-2", runId: "run-B", channel: "chat", instruction: "다른 런", payload: { n: 2 } }, target);
      const all = await repository.ai.listActivity(10, target);
      expect(all.map((row) => row.log_id).sort()).toEqual(["log-1", "log-2"]);
      const onlyA = await repository.ai.listActivity(10, target, { runId: "run-A" });
      expect(onlyA.map((row) => row.log_id)).toEqual(["log-1"]);
    });

    it("AI 대화: 저장한 대화를 범위 키로 다시 찾는다", async () => {
      const { repository, target } = await open();
      const scope = `remote:${target.projectId}`;
      const saved = await repository.ai.recordConversation({
        conversationId: "conv-1", destinationProjectId: target.projectId, title: "대화 제목", model: "test-model",
        projectContextKey: scope, entries: [{ role: "user", text: "안녕" }], savedAt: Date.parse("2026-09-15T10:00:00Z"),
      }, target);
      expect(saved.kind).toBe("saved");
      const rows = await repository.ai.listConversations({ projectContextKey: scope, includeEntries: true }, target);
      expect(rows.map((row) => row.conversation_id)).toEqual(["conv-1"]);
      expect(rows[0]?.title).toBe("대화 제목");
      const one = await repository.ai.loadConversation("conv-1", target);
      expect(one?.conversation_id).toBe("conv-1");
    });

    it("자산: 넣은 바이트를 ref 로 돌려주고 url·list·prune 이 같은 자산을 본다", async () => {
      const { repository } = await open();
      const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

      const stored = await repository.assets.put(bytes, {
        mime: "image/png",
        extension: "png",
        originalName: "a.png",
        kind: "sprite",
      });

      expect(stored.ref.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(stored.ref.bytes).toBe(bytes.byteLength);
      expect(stored.ref.extension).toBe("png");
      expect((await repository.assets.list()).map((asset) => asset.sha256)).toContain(stored.ref.sha256);
      expect(repository.assets.url(stored.ref.sha256)).not.toBe("");

      const removed = await repository.assets.pruneUnused([]);

      expect(removed).toContain(stored.ref.sha256);
      expect(await repository.assets.list()).toHaveLength(0);
    });

    it("자산: 문서에 ref 를 넣을지 dataUrl 을 넣을지 어댑터가 알려준다", async () => {
      const { repository } = await open();

      const stored = await repository.assets.put(new Uint8Array([1, 2, 3]), { mime: "audio/mpeg", extension: "mp3" });

      if (repository.supportsAssetRefs) expect(stored.dataUrl).toBeNull();
      else expect(stored.dataUrl?.startsWith("data:audio/mpeg;base64,")).toBe(true);
    });

    it("대상이 null 이면 쓰기는 not-configured", async () => {
      const { repository } = await open();
      const project = createHouseTemplateGalleryProject();
      await expect(repository.commits.record({ project, identity, reviewStatus: "direct", summary: "x", toolNames: [] }, null))
        .resolves.toEqual({ kind: "not-configured" });
      await expect(repository.ai.recordActivity({ logId: "l", channel: "c", instruction: "i", payload: null }, null))
        .resolves.toEqual({ kind: "not-configured" });
    });
  });
}

describeRepositoryContract("memory", (projectId) => {
  const target: ProjectTarget = { url: "memory://contract", anonKey: "memory", projectId };
  return { repository: createMemoryRepository({ target }), target };
});

describeRepositoryContract("local (real SQLite in a temp folder)", async () => {
  const fixture = await createLocalRepositoryFixture();
  return { repository: fixture.repository, target: fixture.target, cleanup: () => { fixture.close(); } };
});


describeRepositoryContract("supabase (fake PostgREST)", (projectId) => {
  const origin = "http://contract-transport.invalid";
  const postgrest = createFakePostgrest();
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", projectId);
  vi.stubEnv("VITE_SUPABASE_URL", origin);
  vi.stubGlobal("window", {
    location: { hostname: "127.0.0.1", pathname: "/", search: "" },
    localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
  });
  vi.stubGlobal("fetch", postgrest.fetch);
  return {
    repository: createSupabaseRepository(),
    target: { url: origin, anonKey: "test-anon-key", projectId },
    cleanup: () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); },
  };
});
