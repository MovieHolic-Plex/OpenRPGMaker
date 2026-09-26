import { z, type ZodType } from "zod";
import { deserializeStoredProjectJson } from "../../src/project/persistence/core/loadRepair";
import { canonicalJsonString } from "../../src/project/persistence/core/canonicalJson";
import { resolveMapPatchDocuments } from "../../src/project/persistence/core/projectPatch";
import type { Project } from "../../src/project/types";
import { OPRN_CHANNELS } from "../shared/channels";
import {
  activityListSchema,
  activityRecordSchema,
  analysisRunSchema,
  assetPruneSchema,
  assetPutSchema,
  assetReadSchema,
  commitRecordSchema,
  conversationListSchema,
  conversationLoadSchema,
  conversationRecordSchema,
  listLimitSchema,
  projectRefSchema,
  saveMapPatchSchema,
  saveProjectSchema,
} from "../shared/schemas";
import type { SessionKey, SessionRegistry } from "./sessions";

const services = new WeakMap<SessionRegistry, Readonly<Record<string, Handler>>>();

type Handler = (key: SessionKey, payload: unknown) => unknown;

/** zod 검증을 두 전송로가 같은 방식으로 통과시키기 위해 내보낸다. */
export function parseOrThrow<T>(schema: ZodType<T>, payload: unknown, channel: string): T {
  const result = schema.safeParse(payload);
  if (result.success) return result.data;
  const detail = result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ");
  throw new Error(`${channel}: ${detail}`);
}

function projectFromSerialized(serialized: string): Project {
  return deserializeStoredProjectJson(JSON.parse(serialized));
}

/** 전송로(IPC·HTTP)와 무관한 저장소 채널 본문. */
export function createStoreHandlers(sessions: SessionRegistry): Readonly<Record<string, Handler>> {
  const cached = services.get(sessions);
  if (cached) return cached;
  const store = (key: SessionKey) => sessions.require(key).store;
  /** 임대를 빼앗긴 `resource\0session`. 이 세션은 해당 자원을 혼자 모드에서도 자동 회수하지 않는다. */
  const displacedLeases = new Set<string>();
  type PreparedPatch = { readonly getBase: () => Project; readonly project: Project; readonly changedMapIds?: readonly string[]; readonly baseSha?: string };
  const preparedPatches = new WeakMap<object, PreparedPatch>();

  function prepareMapPatch(key: SessionKey, payload: unknown):
    | { readonly kind: "stale-base" }
    | ({ readonly kind: "ready" } & PreparedPatch) {
    if (payload !== null && typeof payload === "object" && preparedPatches.has(payload)) {
      return { kind: "ready", ...preparedPatches.get(payload)! };
    }
    const input = parseOrThrow(saveMapPatchSchema, payload, OPRN_CHANNELS.projectSaveMapPatch);
    const stored = store(key);
    const info = stored.info();
    const resolved = resolveMapPatchDocuments(input, {
      serialized: stored.exportSerialized(),
      sha256: info.sha256 ?? null,
    });
    if (resolved.kind === "stale-base") return resolved;
    // 기준본 역직렬화는 쓸 때만 한다(다른 세션 잠금 충돌 검사·기준이 다를 때의 3자 병합).
    // 혼자 칠하는 흔한 경로에서는 읽히지 않는다 — 실측(2026-09-26, 81MB) 패치마다 약 1.6s.
    let base: Project | undefined;
    const baseJson = resolved.baseJson;
    const ready: PreparedPatch = {
      getBase: () => (base ??= deserializeStoredProjectJson(baseJson)),
      project: deserializeStoredProjectJson(resolved.localJson),
      ...(input.changedMapIds ? { changedMapIds: input.changedMapIds } : {}),
      // The base came from the stored row only when the client's hash matched it.
      ...(input.baseSerialized === undefined && input.patch && info.sha256 && input.baseSha === info.sha256 ? { baseSha: info.sha256 } : {}),
    };
    if (payload !== null && typeof payload === "object") preparedPatches.set(payload, ready);
    return { kind: "ready", ...ready };
  }

  const raw: Record<string, Handler> = {
    [OPRN_CHANNELS.teamStatus]: (key) => {
      const session = sessions.require(key);
      const member = sessions.member(key);
      return { team: session.team.info(), member, members: session.team.list(),
        revision: session.store.info().revision,
        locks: [...session.locks].filter(([, lease]) => lease.expiresAt > Date.now()).map(([resource, lease]) => ({ resource, ownerLabel: lease.ownerLabel, expiresAt: lease.expiresAt })) };
    },
    [OPRN_CHANNELS.teamInvite]: (key, payload) => {
      requireOwner(key);
      const input = z.object({ label: z.string().trim().min(1).max(80), role: z.enum(['editor', 'viewer']) }).parse(payload);
      return sessions.require(key).team.invite(input.label, input.role);
    },
    [OPRN_CHANNELS.teamRevoke]: (key, payload) => {
      requireOwner(key);
      const { memberId } = z.object({ memberId: z.string().uuid() }).parse(payload);
      const session = sessions.require(key);
      session.team.revoke(memberId);
      for (const [resource, lease] of session.locks) if (lease.memberId === memberId) session.locks.delete(resource);
      return true;
    },
    [OPRN_CHANNELS.teamRename]: (key, payload) => {
      requireOwner(key);
      sessions.require(key).team.rename(z.object({ name: z.string().trim().min(1).max(80) }).parse(payload).name);
      return true;
    },
    [OPRN_CHANNELS.teamLock]: (key, payload) => {
      const input = z.object({ resource: z.string().min(1).max(300).refine(value => value === 'database' || /^map:.+/.test(value), 'invalid lock resource'), release: z.boolean().optional(), takeover: z.boolean().optional() }).parse(payload);
      const session = sessions.require(key), member = sessions.member(key);
      if (member.role === 'viewer') throw new Error('읽기 전용 팀원은 편집할 수 없습니다');
      const lease = session.locks.get(input.resource);
      const liveForeignLease = lease && lease.expiresAt > Date.now() && lease.session !== key ? lease : null;
      if (liveForeignLease) {
        const canTakeover = member.role === 'owner' || liveForeignLease.memberId === member.id;
        // 혼자 쓰는 팀(구성원 1명)에서 같은 구성원이 새 탭으로 다시 열면 이전 임대를 회수한다.
        // 실측(2026-09-26 온보딩 저니 04): 이전 탭이 pagehide 없이 죽으면(크래시·브라우저 강제 종료·절전)
        // 임대가 90초 남아, 혼자 만든 프로젝트에서 「호스트님이 편집 중입니다」로 칠하기가 막혔다.
        // 밀려난 세션은 자동 회수하지 않는다 — 살아 있는 두 탭이 20초 갱신마다 서로 빼앗는 핑퐁을 막는다.
        // 그 탭은 기존 계약대로 locked+canTakeover 를 받고 명시적 클릭으로만 되찾는다.
        const soloReclaim = !input.release && liveForeignLease.memberId === member.id
          && session.team.list().length === 1 && !displacedLeases.has(`${input.resource}\u0000${key}`);
        if (!soloReclaim && (input.release || !input.takeover || !canTakeover)) {
          return { kind: 'locked', ownerLabel: liveForeignLease.ownerLabel, expiresAt: liveForeignLease.expiresAt, canTakeover };
        }
      }
      if (input.release) { session.locks.delete(input.resource); return { kind: 'released' }; }
      if (liveForeignLease) displacedLeases.add(`${input.resource}\u0000${liveForeignLease.session}`);
      displacedLeases.delete(`${input.resource}\u0000${key}`);
      const expiresAt = Date.now() + 90_000;
      session.locks.set(input.resource, { session: key, memberId: member.id, ownerLabel: member.label, expiresAt });
      return { kind: 'held', expiresAt };
    },
    [OPRN_CHANNELS.projectStatus]: (key) => {
      const session = sessions.get(key);
      if (!session) return { kind: "not-configured" };
      // projectDir 를 함께 준다 — 렌더러가 부팅 때 이 값으로 열린 폴더를 채택한다(설계 7.3).
      return { kind: "ready", projectId: session.store.projectId, projectDir: session.projectDir, source: "custom", url: session.projectDir };
    },

    [OPRN_CHANNELS.projectProbe]: (key) => sessions.get(key) !== null,

    [OPRN_CHANNELS.projectOpen]: async (key, payload) => {
      const input = parseOrThrow(projectRefSchema, payload, OPRN_CHANNELS.projectOpen);
      const session = await sessions.open(key, input.projectDir);
      return { projectDir: session.projectDir, ...session.store.info() };
    },

    [OPRN_CHANNELS.projectLoad]: (key) => {
      const target = store(key);
      const serialized = target.exportSerialized();
      if (!serialized) return null;
      // The renderer is the consumer that must validate/deserialize this document. Calling
      // loadSnapshot here first parsed and repaired the same multi-megabyte JSON a second time
      // before exporting the untouched wire string, which was especially visible over the HTTP
      // host bridge. Metadata is available without touching the document body.
      const info = target.info();
      return { serialized, sha256: info.sha256 ?? "", revision: info.revision };
    },

    [OPRN_CHANNELS.projectSave]: async (key, payload) => {
      const input = parseOrThrow(saveProjectSchema, payload, OPRN_CHANNELS.projectSave);
      return await store(key).saveSerialized(input.serialized, input.expectedSha);
    },

    [OPRN_CHANNELS.projectSaveMapPatch]: async (key, payload) => {
      const prepared = prepareMapPatch(key, payload);
      if (prepared.kind === "stale-base") return prepared;
      return await store(key).saveMapPatch({
        getBaseProject: prepared.getBase,
        project: prepared.project,
        ...(prepared.changedMapIds ? { changedMapIds: prepared.changedMapIds } : {}),
        ...(prepared.baseSha ? { baseSha: prepared.baseSha } : {}),
      });
    },

    [OPRN_CHANNELS.projectDataVersion]: (key) => store(key).info().revision,

    [OPRN_CHANNELS.projectSeparateMedia]: async (key) => {
      const target = store(key);
      const snapshot = target.loadSnapshot();
      if (!snapshot) return { changed: false, migratedAssetIds: [], revision: 0 };
      const result = await target.separateInlineMedia(snapshot.project);
      return { changed: result.changed, migratedAssetIds: result.migratedAssetIds, revision: result.revision };
    },

    [OPRN_CHANNELS.projectBackup]: (key) => store(key).backup(),

    [OPRN_CHANNELS.commitsRecord]: (key, payload) => {
      const input = parseOrThrow(commitRecordSchema, payload, OPRN_CHANNELS.commitsRecord);
      const member = sessions.member(key);
      const commitId = store(key).recordCommit({
        identity: { id: member.id, label: member.label, kind: 'human' },
        reviewStatus: input.reviewStatus,
        summary: input.summary,
        ...(input.parentCommitId === undefined ? {} : { parentCommitId: input.parentCommitId }),
        toolNames: input.toolNames,
        ...(input.diff === undefined ? {} : { diff: input.diff }),
        ...(input.editActivity === undefined ? {} : { editActivity: input.editActivity }),
      });
      return { kind: "saved", commitId };
    },

    [OPRN_CHANNELS.commitsList]: (key, payload) => {
      const input = parseOrThrow(listLimitSchema, payload, OPRN_CHANNELS.commitsList);
      return store(key).listCommits(input.limit);
    },

    [OPRN_CHANNELS.aiRecordActivity]: (key, payload) => {
      const input = parseOrThrow(activityRecordSchema, payload, OPRN_CHANNELS.aiRecordActivity);
      store(key).recordActivity({
        logId: input.logId,
        ...(input.runId ? { runId: input.runId } : {}),
        channel: input.channel,
        instruction: input.instruction,
        ...(input.mapId ? { mapId: input.mapId } : {}),
        payload: input.payload,
      });
      return { kind: "saved" };
    },

    [OPRN_CHANNELS.aiListActivity]: (key, payload) => {
      const input = parseOrThrow(activityListSchema, payload, OPRN_CHANNELS.aiListActivity);
      return store(key).listActivity(input.limit, input.runId ? { runId: input.runId } : {});
    },

    [OPRN_CHANNELS.aiRecordConversation]: (key, payload) => {
      const input = parseOrThrow(conversationRecordSchema, payload, OPRN_CHANNELS.aiRecordConversation);
      store(key).recordConversation({
        conversationId: input.conversationId,
        ...(input.destinationProjectId === undefined ? {} : { destinationProjectId: input.destinationProjectId }),
        title: input.title,
        model: input.model,
        ...(input.projectContextKey ? { projectContextKey: input.projectContextKey } : {}),
        entries: input.entries,
        savedAt: input.savedAt,
      });
      return { kind: "saved" };
    },

    [OPRN_CHANNELS.aiListConversations]: (key, payload) => {
      const input = parseOrThrow(conversationListSchema, payload, OPRN_CHANNELS.aiListConversations);
      return store(key).listConversations({
        ...(input.query === undefined ? {} : { query: input.query }),
        ...(input.limit === undefined ? {} : { limit: input.limit }),
        ...(input.offset === undefined ? {} : { offset: input.offset }),
        ...(input.includeEntries === undefined ? {} : { includeEntries: input.includeEntries }),
        ...(input.projectContextKey === undefined ? {} : { projectContextKey: input.projectContextKey }),
      });
    },

    [OPRN_CHANNELS.aiLoadConversation]: (key, payload) => {
      const input = parseOrThrow(conversationLoadSchema, payload, OPRN_CHANNELS.aiLoadConversation);
      return store(key).loadConversation(input.conversationId);
    },

    [OPRN_CHANNELS.aiRecordAnalysisRun]: (key, payload) => {
      const input = parseOrThrow(analysisRunSchema, payload, OPRN_CHANNELS.aiRecordAnalysisRun);
      store(key).recordAnalysisRun({
        tilesetId: input.tilesetId,
        selectedTiles: input.selectedTiles,
        promptContext: input.promptContext,
        result: input.result,
      });
      return { kind: "saved" };
    },

    [OPRN_CHANNELS.assetsPut]: async (key, payload) => {
      const input = parseOrThrow(assetPutSchema, payload, OPRN_CHANNELS.assetsPut);
      const ref = await store(key).putAsset(new Uint8Array(input.bytes), {
        mime: input.mime,
        extension: input.extension,
        ...(input.originalName === undefined ? {} : { originalName: input.originalName }),
        ...(input.kind === undefined ? {} : { kind: input.kind }),
      });
      return { ref, dataUrl: null };
    },

    [OPRN_CHANNELS.assetsList]: (key) => store(key).listAssets(),

    [OPRN_CHANNELS.assetsRead]: async (key, payload) => {
      const input = parseOrThrow(assetReadSchema, payload, OPRN_CHANNELS.assetsRead);
      return await store(key).assetBytes(input.sha256);
    },

    [OPRN_CHANNELS.assetsPruneUnused]: async (key, payload) => {
      const input = parseOrThrow(assetPruneSchema, payload, OPRN_CHANNELS.assetsPruneUnused);
      return await store(key).pruneUnusedAssets(input.referenced);
    },
  };
  function requireOwner(key: SessionKey): void {
    if (sessions.member(key).role !== 'owner') throw new Error('팀 소유자만 할 수 있습니다');
  }
  const reads = new Set<string>([OPRN_CHANNELS.projectStatus, OPRN_CHANNELS.projectProbe, OPRN_CHANNELS.projectOpen,
    OPRN_CHANNELS.projectLoad, OPRN_CHANNELS.projectDataVersion, OPRN_CHANNELS.teamStatus,
    OPRN_CHANNELS.commitsList, OPRN_CHANNELS.aiListActivity, OPRN_CHANNELS.aiListConversations,
    OPRN_CHANNELS.aiLoadConversation, OPRN_CHANNELS.assetsList, OPRN_CHANNELS.assetsRead]);
  // Serialize service operations: lock ownership cannot change halfway through an async save.
  let tail: Promise<unknown> = Promise.resolve();
  const handlers = Object.fromEntries(Object.entries(raw).map(([channel, handler]) => [channel, (key: SessionKey, payload: unknown) => {
    const run = async () => {
      // Initial desktop open/status has no adopted folder yet.
      if (!sessions.get(key) && [OPRN_CHANNELS.projectOpen, OPRN_CHANNELS.projectStatus, OPRN_CHANNELS.projectProbe].some(candidate => candidate === channel)) return handler(key, payload);
      const member = sessions.member(key);
      if (!reads.has(channel) && member.role === 'viewer') throw new Error('읽기 전용 팀원은 저장할 수 없습니다');
      if (channel === OPRN_CHANNELS.assetsPruneUnused && sessions.require(key).team.list().length > 1) throw new Error('팀 작업 중에는 미사용 에셋 정리를 실행할 수 없습니다');
      if ([OPRN_CHANNELS.assetsPruneUnused, OPRN_CHANNELS.projectSeparateMedia, OPRN_CHANNELS.projectBackup].some(candidate => candidate === channel)) requireOwner(key);
      if (channel === OPRN_CHANNELS.projectSave || channel === OPRN_CHANNELS.projectSaveMapPatch) {
        // 다른 세션이 지금 쥐고 있는 임대가 있을 때만 문서를 열어 비교한다. 혼자 쓰는 흔한 경우에는
        // 역직렬화를 하지 않는다 — 실측(2026-09-26, 81MB 새 프로젝트) 전체 저장마다 저장 행 파싱+역직렬화 약 2s.
        let documents: { readonly base: Project | undefined; readonly local: Project } | null = null;
        if (channel === OPRN_CHANNELS.projectSaveMapPatch) {
          const prepared = prepareMapPatch(key, payload);
          if (prepared.kind === "stale-base") return prepared;
        }
        const readDocuments = (): { readonly base: Project | undefined; readonly local: Project } => {
          if (documents) return documents;
          if (channel === OPRN_CHANNELS.projectSave) {
            documents = { local: projectFromSerialized(saveProjectSchema.parse(payload).serialized), base: store(key).loadSnapshot()?.project };
          } else {
            const prepared = prepareMapPatch(key, payload);
            if (prepared.kind === "stale-base") throw new Error("stale base after preparation");
            documents = { base: prepared.getBase(), local: prepared.project };
          }
          return documents;
        };
        const session = sessions.require(key);
        const conflicts = [...session.locks].filter(([resource, lease]) => {
          if (lease.session === key || lease.expiresAt <= Date.now()) return false;
          const { base, local } = readDocuments();
          const value = (project: Project | undefined): unknown => resource.startsWith('map:')
            ? project?.maps[resource.slice(4)] : resource === 'database' ? project?.database : project;
          return canonicalJsonString(value(base) ?? null) !== canonicalJsonString(value(local) ?? null);
        }).map(([resource, lease]) => ({ mapId: resource.replace(/^map:/, ''), name: `${lease.ownerLabel} 편집 중` }));
        if (conflicts.length) return { kind: 'conflict', conflicts };
      }
      return handler(key, payload);
    };
    const result = tail.then(run);
    tail = result.catch(() => {});
    return result;
  }]));
  services.set(sessions, handlers);
  return handlers;

}

/** 창 없는 전송로도 같은 표를 쓴다 — 두 전송로가 채널 목록에서 갈리지 않게 한다. */
export const STORE_CHANNELS = [
  OPRN_CHANNELS.teamStatus,
  OPRN_CHANNELS.teamInvite,
  OPRN_CHANNELS.teamRevoke,
  OPRN_CHANNELS.teamRename,
  OPRN_CHANNELS.teamLock,
  OPRN_CHANNELS.projectStatus,
  OPRN_CHANNELS.projectProbe,
  OPRN_CHANNELS.projectOpen,
  OPRN_CHANNELS.projectLoad,
  OPRN_CHANNELS.projectSave,
  OPRN_CHANNELS.projectSaveMapPatch,
  OPRN_CHANNELS.projectDataVersion,
  OPRN_CHANNELS.projectSeparateMedia,
  OPRN_CHANNELS.projectBackup,
  OPRN_CHANNELS.commitsRecord,
  OPRN_CHANNELS.commitsList,
  OPRN_CHANNELS.aiRecordActivity,
  OPRN_CHANNELS.aiListActivity,
  OPRN_CHANNELS.aiRecordConversation,
  OPRN_CHANNELS.aiListConversations,
  OPRN_CHANNELS.aiLoadConversation,
  OPRN_CHANNELS.aiRecordAnalysisRun,
  OPRN_CHANNELS.assetsPut,
  OPRN_CHANNELS.assetsList,
  OPRN_CHANNELS.assetsRead,
  OPRN_CHANNELS.assetsPruneUnused,
] as const;
