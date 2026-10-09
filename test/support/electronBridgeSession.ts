import { createElectronRepository, type OprnBridge } from "@/project/persistence/electronRepository";
import { setProjectRepositoryForTest } from "@/project/persistence/repository";
import type { LocalProjectTarget } from "@/project/persistence/target";
import type { Project } from "@/project/types";
import { serialize } from "@/project/io";
import { applyProjectDocumentPatch, type ProjectDocumentPatch } from "@/project/persistence/core/projectPatch";

export type BridgeSaveGate = {
  entered(): Promise<void>;
  release(): void;
};

export type ElectronBridgeSession = {
  readonly repository: ReturnType<typeof createElectronRepository>;
  readonly target: LocalProjectTarget;
  readonly calls: { save: number; load: number; mapPatch: number; commit: number; conversationList: number };
  readonly bridge: OprnBridge;
  /** 인메모리 어댑터는 즉시 끝나 "뒤 저장이 앞 저장을 기다린다" 를 볼 수 없다. */
  holdNextSave(): BridgeSaveGate;
  /** 커밋 기록도 붙잡는다 — 드레인이 배경 writer 의 완료까지 기다리는지 보려면 필요하다. */
  holdNextCommit(): BridgeSaveGate;
  /** 저장 직전의 증명 읽기를 실패시킨다 — "증명이 503 이면 상태가 어떻게 되는가" 를 옮기기 위해. */
  failNextLoad(error: Error): void;
  /** `ai.listConversations` 가 돌려줄 행들 — 호출 옵션을 보고 페이지를 흥내낼 수 있다. */
  setConversationListImpl(impl: (options: Record<string, unknown>) => readonly unknown[] | Promise<readonly unknown[]>): void;
  /** 목록 호출이 받은 옵션들 — 프로젝트 범위·select 같은 계약을 여기서 본다. */
  conversationListOptions(): readonly Record<string, unknown>[];
  /** 포트가 받은 커밋 입력들. 커밋 계약(patch 의 edits·커서·절단 수치)을 여기서 본다. */
  commitInputs(): readonly unknown[];
  setSerialized(text: string): void;
  /** 브리지가 마지막으로 저장한 직렬화 텍스트 — 병합 후 무엇이 남았는지 본다. */
  storedSerialized(): string | null;
  dispose(): void;
};

/**
 * 저장 위치를 여러 세션에 걸쳐 공유한다. 실제 브리지는 폴더의 파일이 정본이라
 * "저장 → 새 스토어로 다시 열기" 가 같은 바이트를 본다 — 그 성질을 재현할 때 쓴다.
 */
export type SharedWire = { current: string | null };

/**
 * Electron 브리지를 흉내내는 **비동기** 저장소를 심는다.
 *
 * 인메모리 어댑터로는 "두 번째 저장이 첫 저장의 in-flight 를 기다린다" 가 자명해져 테스트가
 * 아무것도 증명하지 않는다 — 그 계약은 IPC 왕복이 느리다는 사실 위에 서 있다.
 */
export async function installElectronBridgeSession(
  options: {
    readonly projectDir?: string;
    readonly projectId?: string;
    readonly project?: Project;
    readonly wire?: SharedWire;
  } = {},
): Promise<ElectronBridgeSession> {
  const projectDir = options.projectDir ?? "/tmp/oprn-bridge-session";
  const projectId = options.projectId ?? "uuid-bridge-session";
  const calls = { save: 0, load: 0, mapPatch: 0, commit: 0, conversationList: 0 };
  let serialized = options.wire?.current ?? (options.project ? serialize(options.project) : null);
  let sha = "0".repeat(64);
  let revision = options.project ? 1 : 0;
  let gate: (() => void) | null = null;
  let gateEntered: (() => void) | null = null;
  let commitGate: (() => void) | null = null;
  let commitGateEntered: (() => void) | null = null;
  let loadFailure: Error | null = null;
  let conversationListImpl: ((options: Record<string, unknown>) => readonly unknown[] | Promise<readonly unknown[]>) | null = null;
  const conversationListOptionCalls: Record<string, unknown>[] = [];
  const commitInputs: unknown[] = [];

  const bridge = {
    project: {
      status: async () => ({ kind: "ready", projectId, projectDir, url: projectDir }),
      probe: async () => true,
      open: async () => ({ projectId, projectDir }),
      load: async () => {
        calls.load += 1;
        if (loadFailure) {
          const failure = loadFailure;
          loadFailure = null;
          throw failure;
        }
        return serialized === null ? null : { serialized, sha256: sha, revision };
      },
      save: async (payload: { readonly serialized: string }) => {
        calls.save += 1;
        if (gate) {
          gateEntered?.();
          const wait = new Promise<void>((resolve) => { gate = resolve; });
          await wait;
        }
        serialized = payload.serialized;
        if (options.wire) options.wire.current = serialized;
        revision += 1;
        return { kind: "saved" as const, sha256: sha, revision };
      },
      saveMapPatch: async (payload: {
        readonly serialized?: string;
        readonly baseSerialized?: string;
        readonly baseSha?: string | null;
        readonly patch?: ProjectDocumentPatch;
      }) => {
        calls.mapPatch += 1;
        if (payload.patch) {
          if (payload.baseSerialized === undefined && payload.baseSha !== sha) return { kind: "stale-base" as const };
          const baseText = payload.baseSerialized ?? serialized;
          if (!baseText) return { kind: "stale-base" as const };
          serialized = JSON.stringify(applyProjectDocumentPatch(JSON.parse(baseText) as unknown, payload.patch));
        } else if (payload.serialized) {
          serialized = payload.serialized;
        }
        if (options.wire) options.wire.current = serialized;
        revision += 1;
        return { kind: "saved" as const, sha256: sha, revision };
      },
      dataVersion: async () => revision,
      separateMedia: async () => ({ changed: false, migratedAssetIds: [], revision }),
      backup: async () => `${projectDir}/backups/x`,
    },
    commits: {
      record: async (input: unknown) => {
        calls.commit += 1;
        commitInputs.push(input);
        if (commitGate) {
          commitGateEntered?.();
          const wait = new Promise<void>((resolve) => { commitGate = resolve; });
          await wait;
        }
        return { kind: "saved" as const, commitId: "c1" };
      },
      list: async () => [],
      listSync: () => [],
    },
    ai: {
      recordActivity: async () => ({ kind: "saved" as const }),
      listActivity: async () => [],
      recordConversation: async () => ({ kind: "saved" as const }),
      listConversations: async (options: Record<string, unknown>) => {
        calls.conversationList += 1;
        conversationListOptionCalls.push(options);
        return conversationListImpl ? await conversationListImpl(options) : [];
      },
      loadConversation: async () => null,
      recordAnalysisRun: async () => ({ kind: "saved" as const }),
    },
    assets: {
      put: async (payload: { readonly mime: string; readonly extension: string; readonly bytes: Uint8Array }) => ({
        ref: { sha256: "b".repeat(64), mime: payload.mime, bytes: payload.bytes.byteLength, extension: payload.extension },
        dataUrl: null,
      }),
      list: async () => [],
      read: async () => new Uint8Array(),
      pruneUnused: async () => [],
    },
  } as unknown as OprnBridge;

  const previousWindow = (globalThis as { window?: unknown }).window;
  // 기존 window 를 **살려 두고** oprn 만 얹는다. 새 객체로 펼치면 클래스 인스턴스의 프로토타입 메서드가
  // 사라져(스프레드는 own enumerable 만 복사한다) 픽스처가 세운 add/removeEventListener 가 없어진다(실측).
  let hadOwnWindow = false;
  let previousOpnn: unknown;
  if (typeof previousWindow === "object" && previousWindow !== null) {
    hadOwnWindow = true;
    const holder = previousWindow as Record<string, unknown>;
    previousOpnn = holder.oprn;
    holder.oprn = bridge;
  } else {
    (globalThis as { window?: unknown }).window = { oprn: bridge, addEventListener: () => {}, removeEventListener: () => {} };
  }

  const repository = createElectronRepository();
  const target: LocalProjectTarget = { kind: "local", projectDir, projectId };
  // 폴더를 열어야 어댑터가 대상을 갖는다 — 안 열면 save/load 가 "열린 프로젝트 폴더가 없습니다" 로 던진다.
  await repository.open(projectDir);
  setProjectRepositoryForTest(repository);

  return {
    repository,
    target,
    calls,
    bridge,
    holdNextSave(): BridgeSaveGate {
      let enteredResolve: (() => void) | null = null;
      const entered = new Promise<void>((resolve) => { enteredResolve = resolve; });
      gateEntered = () => enteredResolve?.();
      gate = () => undefined;
      return {
        entered: () => entered,
        release: () => { const resolve = gate; gate = null; gateEntered = null; resolve?.(); },
      };
    },
    holdNextCommit(): BridgeSaveGate {
      let enteredResolve: (() => void) | null = null;
      const entered = new Promise<void>((resolve) => { enteredResolve = resolve; });
      commitGateEntered = () => enteredResolve?.();
      commitGate = () => undefined;
      return {
        entered: () => entered,
        release: () => { const resolve = commitGate; commitGate = null; commitGateEntered = null; resolve?.(); },
      };
    },
    commitInputs: () => commitInputs,
    failNextLoad: (error: Error) => { loadFailure = error; },
    setConversationListImpl: (impl) => { conversationListImpl = impl; },
    conversationListOptions: () => conversationListOptionCalls,
    setSerialized: (text: string) => { serialized = text; },
    storedSerialized: () => serialized,
    dispose(): void {
      setProjectRepositoryForTest(null);
      if (hadOwnWindow) {
        const holder = previousWindow as Record<string, unknown>;
        if (previousOpnn === undefined) delete holder.oprn;
        else holder.oprn = previousOpnn;
      } else if (previousWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = previousWindow;
      }
    },
  };
}
