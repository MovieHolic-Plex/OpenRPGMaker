// test/commitEditActivityAttachment.test.ts
// 편집 행위 기록이 **커밋 row 에 실려 DB 로 나가는지** 고정한다.
//
// 2026-08-29 관측성 감사 실측 — 행위 기록에는 DB 경로가 아예 없었다.
// 브라우저 링버퍼(500) + localStorage(200) + dev 디스크 미러가 전부였고, 셋 다 세션 자산이다.
// 새로고침하면 끊기고, 워크트리를 바꾸면 미러가 갈리고, 배포 환경에는 미러가 없다.
// 그래서 "그때 무슨 행위가 있었나" 를 나중에 조사할 수단이 남지 않았다.
//
// 그런데 `project_changes.patch_json` 은 첫 마이그레이션부터 있고 **읽는 코드가 0개**였다.
// 새 테이블을 만들 이유가 없었다 — 이미 쓰이는 jsonb 컬럼에 실으면 마이그레이션도 없고,
// 볼륨이 mutation 당이 아니라 **저장당**이 되고(조사 단위와 일치), 커밋 row 가 이미
// diff·toolNames·작성자 신원을 들고 있어 앵커로 맞다.
//
// 이 파일이 지키는 계약:
//   (1) 커밋 row 의 patch_json.edits 에 그 저장 경계 안의 행위가 실린다
//   (2) 커서가 있어 같은 엔트리가 다음 커밋에 반복되지 않는다
//   (3) 링버퍼 밀림·상한 절단은 숫자로 남는다 — 조용히 잘리면 "편집이 3건뿐" 으로 읽힌다
//   (4) 행위가 없으면 키를 넣지 않는다 — `edits: []` 와 "이 축이 없던 예전 커밋" 이 구분돼야 한다

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

type FetchCall = { readonly init: RequestInit | undefined; readonly input: RequestInfo | URL };

const TEST_ENV = {
  VITE_SUPABASE_ANON_KEY: "test-anon-key",
  VITE_SUPABASE_PROJECT_ID: "rpg-zzu-house-template-gallery",
  VITE_SUPABASE_URL: "http://dbserver:8100",
} as const;

type PatchJson = {
  readonly diff?: unknown;
  readonly toolNames?: readonly string[];
  readonly edits?: readonly {
    readonly seq: number;
    readonly label: string | null;
    readonly origin: string;
    readonly mapId?: string;
  }[];
  readonly editsOmitted?: number;
};

beforeEach(() => {
  // 모듈을 매번 새로 만든다. 행위 로그의 `seq` 와 커밋 로그의 커서는 **같이** 0 으로
  // 돌아가야 한다 — 한쪽만 리셋하면 커서가 미래를 가리켜 드레인이 빈손이 된다.
  vi.resetModules();
  stubSupabaseEnv();
  stubEditorIdentityStorage();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("커밋 row 에 실리는 편집 행위 기록", () => {
  it("AI 적용 커밋의 patch_json 에 그 행위가 origin·라벨과 함께 실린다", async () => {
    const calls = stubFetch();
    const { applyToolSequenceToStore, store, mapId } = await freshEditor();

    applyToolSequenceToStore(
      [{ name: "set_map_properties", args: { mapId, name: "행위 기록 검증" } }],
      { source: "agent", agentName: "test-agent-model", summary: "AI map rename" },
    );
    await vi.waitFor(() => {
      expect(changeRows(calls)).toHaveLength(1);
    });

    const patch = changeRows(calls)[0]!;
    const edits = patch.edits ?? [];
    // 핵심: diff 는 "맵 설정 1" 만 알려준다. 어떤 행위가 그렇게 만들었는지는 이 축에만 있다.
    const applied = edits.find((edit) => edit.origin === "ai");
    expect(applied, `edits: ${JSON.stringify(edits)}`).toBeDefined();
    expect(applied!.label).toContain("AI 적용");
    expect(applied!.label).toContain("test-agent-model");
    expect(patch.toolNames).toEqual(["set_map_properties"]);
    expect(store.getCurrent().maps[mapId]?.name).toBe("행위 기록 검증");
    // 30s: `vi.resetModules()` 뒤 첫 테스트가 스토어·툴 그래프를 통째로 다시 변환한다.
  }, 30000);

  it("두 번째 커밋은 첫 커밋이 이미 실은 엔트리를 다시 싣지 않는다", async () => {
    const calls = stubFetch();
    const { applyToolSequenceToStore, mapId } = await freshEditor();

    applyToolSequenceToStore([{ name: "set_map_properties", args: { mapId, name: "첫 번째" } }], {
      source: "agent",
      agentName: "agent-a",
    });
    await vi.waitFor(() => {
      expect(changeRows(calls)).toHaveLength(1);
    });
    applyToolSequenceToStore([{ name: "set_map_properties", args: { mapId, name: "두 번째" } }], {
      source: "agent",
      agentName: "agent-b",
    });
    await vi.waitFor(() => {
      expect(changeRows(calls)).toHaveLength(2);
    });

    const [first, second] = changeRows(calls);
    const firstSeqs = new Set((first!.edits ?? []).map((edit) => edit.seq));
    const secondSeqs = (second!.edits ?? []).map((edit) => edit.seq);
    expect(secondSeqs.length).toBeGreaterThan(0);
    // 커서가 없으면 매 저장마다 세션 전체가 반복돼 row 가 계속 커진다.
    expect(secondSeqs.filter((seq) => firstSeqs.has(seq))).toEqual([]);
    expect((second!.edits ?? []).some((edit) => edit.label?.includes("agent-b"))).toBe(true);
    expect((second!.edits ?? []).some((edit) => edit.label?.includes("agent-a"))).toBe(false);
  }, 30000);

  it("행위 기록이 없으면 edits 키를 넣지 않는다", async () => {
    const { _resetEditActivityForTest } = await import("@/editor/editActivityLog");
    const { recordProjectCommit } = await import("@/project/projectCommitLog");
    const { createHouseTemplateGalleryProject } = await import("@/project/defaults");
    _resetEditActivityForTest();
    const calls = stubFetch();

    await recordProjectCommit({
      project: createHouseTemplateGalleryProject(),
      reviewStatus: "direct",
      summary: "행위 없는 커밋",
      toolNames: [],
    });

    const patch = changeRows(calls)[0]!;
    // `edits: []` 를 쓰면 "이 축이 붙기 전 커밋" 과 구분이 안 된다 — 리더가 `-` 로 보여준다.
    expect(Object.keys(patch)).not.toContain("edits");
    expect(Object.keys(patch)).not.toContain("editsOmitted");
  });
});

describe("takeEditActivitySince 상한", () => {
  it("링버퍼 밀림과 상한 절단을 합쳐 omitted 로 알린다", async () => {
    const activity = await import("@/editor/editActivityLog");
    activity._resetEditActivityForTest();
    const total = 520;
    for (let index = 0; index < total; index += 1) {
      // 라벨을 다르게 줘야 병합 창(600ms)에 안 먹힌다 — 같은 라벨이면 한 엔트리가 된다.
      activity.recordEditActivity({ scope: "map", label: `편집 ${index}`, generation: index });
    }

    const slice = activity.takeEditActivitySince(0);

    expect(slice.entries).toHaveLength(300);
    // 총량 보존: 실린 것 + 빠진 것 = 있었던 것. 이게 깨지면 숫자를 못 믿는다.
    expect(slice.entries.length + slice.omitted).toBe(total);
    // 최근 것을 남긴다 — 저장 시점에 가까운 행위가 그 저장을 설명한다.
    expect(slice.entries[slice.entries.length - 1]!.label).toBe(`편집 ${total - 1}`);
    expect(slice.cursor).toBe(total);
  });

  it("개수는 남아도 덩치가 크면 바이트 예산에서 자른다", async () => {
    const activity = await import("@/editor/editActivityLog");
    activity._resetEditActivityForTest();
    // 필드 상세가 붙은 엔트리는 병합되지 않는다 — 40필드 × 400자가 엔트리당 최악치다.
    const fields = Array.from({ length: 40 }, (_, index) => ({ path: `f${index}`, after: "가".repeat(500) }));
    for (let index = 0; index < 40; index += 1) {
      activity.recordEditActivity({ scope: "map", label: `무거운 편집 ${index}`, generation: index, fields });
    }

    const slice = activity.takeEditActivitySince(0);

    // 40건은 개수 상한(300) 안이지만 덩치로 잘린다. 안 자르면 row 하나가 수 MB 가 된다.
    expect(slice.entries.length).toBeGreaterThan(0);
    expect(slice.entries.length).toBeLessThan(40);
    expect(slice.entries.length + slice.omitted).toBe(40);
    expect(JSON.stringify(slice.entries).length).toBeLessThan(70_000);
    // 자를 때도 최신 쪽을 남긴다.
    expect(slice.entries[slice.entries.length - 1]!.label).toBe("무거운 편집 39");
  });

  it("커서 이후가 없으면 빈 슬라이스를 준다", async () => {
    const activity = await import("@/editor/editActivityLog");
    activity._resetEditActivityForTest();
    activity.recordEditActivity({ scope: "system", label: "한 건", generation: 1 });

    const first = activity.takeEditActivitySince(0);
    expect(first.entries).toHaveLength(1);

    const second = activity.takeEditActivitySince(first.cursor);
    expect(second.entries).toEqual([]);
    expect(second.omitted).toBe(0);
    expect(second.cursor).toBe(first.cursor);
  });
});

// 리더가 없으면 이 축도 `patch_json` 처럼 write-only 가 된다 — 그게 애초에 이 작업의 원인이었다.
// 키 이름은 타입 검사가 못 보는 경계다(한쪽은 TS, 한쪽은 .mjs).
describe("리더 CLI 가 쓰는 쪽과 같은 키를 읽는다", () => {
  const writer = readFileSync(new URL("../src/project/supabaseProjectSync.ts", import.meta.url), "utf8");
  const cli = readFileSync(new URL("../scripts/list-project-commits.mjs", import.meta.url), "utf8");
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    scripts?: Record<string, string>;
  };

  it("edits / editsOmitted 키가 양쪽에 있다", () => {
    expect(writer).toContain("edits: input.editActivity.entries");
    expect(writer).toContain("editsOmitted: input.editActivity.omitted");
    expect(cli).toContain("patch.edits");
    expect(cli).toContain("patch.editsOmitted");
  });

  it("project_changes 를 커밋 쪽에서 임베딩으로 끌어온다", () => {
    // project_changes 에는 project_id 가 없다 — 직접 조회하면 옆 프로젝트 row 가 섞인다.
    expect(cli).toContain("project_changes(patch_json)");
    expect(cli).toContain("project_id: `eq.${projectId}`");
    expect(cli).toContain('"Accept-Profile": "rpg_zzu"');
  });

  it("npm run commit:log 로 등록돼 있다", () => {
    expect(packageJson.scripts?.["commit:log"]).toBe("node scripts/list-project-commits.mjs");
  });
});

/** 스토어·툴 경로를 리셋된 모듈 그래프에서 새로 가져온다. */
async function freshEditor(): Promise<{
  readonly applyToolSequenceToStore: typeof import("@/editor/tools/applyChangesetToStore")["applyToolSequenceToStore"];
  readonly store: typeof import("@/project/store")["store"];
  readonly mapId: string;
}> {
  const { _resetEditActivityForTest } = await import("@/editor/editActivityLog");
  const { applyToolSequenceToStore } = await import("@/editor/tools/applyChangesetToStore");
  const { store } = await import("@/project/store");
  const { createHouseTemplateGalleryProject } = await import("@/project/defaults");
  _resetEditActivityForTest();
  // loaded:false 로 둬서 autosave flush 커밋이 끼어들지 않게 한다(선례: projectCommitLogging).
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: true, disabledReason: null });
  const project = createHouseTemplateGalleryProject();
  const mapId = project.startMapId;
  store.replace(project);
  return { applyToolSequenceToStore, store, mapId };
}

function stubFetch(): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal("fetch", (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response(null, { status: 201 });
  }) satisfies typeof fetch);
  return calls;
}

/** project_changes insert 본문의 patch_json 만 순서대로 꺼낸다. */
function changeRows(calls: readonly FetchCall[]): readonly PatchJson[] {
  return calls
    .filter((call) => String(call.input).includes("/rest/v1/project_changes"))
    .flatMap((call) => {
      if (typeof call.init?.body !== "string") throw new Error("expected string body");
      const parsed: unknown = JSON.parse(call.init.body);
      if (!Array.isArray(parsed)) throw new Error("expected record array body");
      return parsed.map((row) => (row as { patch_json: PatchJson }).patch_json);
    });
}

function stubSupabaseEnv(): void {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", TEST_ENV.VITE_SUPABASE_ANON_KEY);
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", TEST_ENV.VITE_SUPABASE_PROJECT_ID);
  vi.stubEnv("VITE_SUPABASE_URL", TEST_ENV.VITE_SUPABASE_URL);
  // 디스크 미러를 끈다 — 켜두면 stub fetch 호출 목록에 미러 POST 가 섞인다.
  vi.stubEnv("VITE_EDIT_ACTIVITY_DISK_MIRROR", "0");
}

function stubEditorIdentityStorage(): void {
  const storage = new Map<string, string>([
    ["oprn:editor-session-id", "session-1234"],
    ["oprn:editor-owner-label", "Editor One"],
  ]);
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  };
  vi.stubGlobal("window", { localStorage, location: { hostname: "127.0.0.1", pathname: "/", search: "" } });
  vi.stubGlobal("localStorage", localStorage);
}
