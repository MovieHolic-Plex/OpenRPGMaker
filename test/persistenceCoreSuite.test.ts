import { expect, it, vi, describe, beforeAll } from "vitest";
import { canonicalJsonOf, canonicalJsonString } from "@/project/persistence/core/canonicalJson";
import { authoredIdentity, composeProjectIdentity, contentIdentity, projectIdentityParts } from "@/project/authoredProjectBaseline";
import { createBlankProject } from "@/project/defaults";
import type { Project, GameEvent, UploadedAsset } from "@/project/types";
import { serialize, deserialize } from "@/project/io";
import { deserializeStoredProjectJsonWithReport } from "@/project/persistence/core/loadRepair";
import { collectLoadRepairs, adoptLatestLoadRepairReport } from "@/project/loadRepairReport";
import { separateInlineUploadedMedia } from "@/project/persistence/inlineMediaRefs";
import type { ProjectRepository } from "@/project/persistence/types";
import { uploadedAssetForImport } from "@/editor/uploadedAssetStorage";
import { createMemoryRepository } from "@/project/persistence/memoryRepository";
import { createLocalRepositoryFixture, type LocalRepositoryFixture } from "./localStore/localRepositoryFixture";
import { isolateTimers } from "./mergedTeardown";

describe("canonicalJsonIdentity", () => {
  isolateTimers();
  beforeAll(() => {
    // createBlankProject() builds the ~63MB blank project; each test here builds it (beforeEach/inline) and CI runs 4 workers at once, so
    // single tests measured 8-15s+ — past vitest's 15s default. Same per-file budget other blank-project files use (e.g. actionAcceptanceProof).
    vi.setConfig({ testTimeout: 120_000 });
  });
  // 체크포인트 적용 권위는 이 문자열의 **동일성**에 산다. 빠른 경로는 예전 왕복과 글자까지 같아야 한다.
  const roundtrip = (value: unknown): string => canonicalJsonString(JSON.parse(JSON.stringify(value)));
  it("matches the stringify → parse → canonical round trip on JSON edge cases", () => {
    const sparse: unknown[] = [1, , 3]; // eslint-disable-line no-sparse-arrays
    const values: unknown[] = [
      { z: 1, a: { y: [3, 2, 1], b: null }, m: "한글   \"따옴표\"" },
      { u: undefined, f() { return 1; }, s: Symbol("x"), keep: 0 },
      [undefined, () => 1, Symbol("y"), NaN, Infinity, -0, 1e21, 5e-7],
      sparse,
      { when: new Date(0), boxed: [new Number(3), new String("s"), new Boolean(false)] },
      { custom: { toJSON: (key: string) => ({ key, v: [1, { b: 2, a: 1 }] }) } },
      { nested: [{ b: 1, a: [{ d: undefined, c: [null] }] }], "10": "n", "2": "m", "": "empty" },
      { lone: "\ud800", emoji: "😀" },
      Object.assign(Object.create(null), { b: 1, a: 2 }),
      "text", 42, true, null,
    ];
    for (const value of values) expect(canonicalJsonOf(value)).toBe(roundtrip(value));
    expect(canonicalJsonOf(undefined)).toBeUndefined();
    expect(() => contentIdentity(undefined)).toThrow();
  });
  it("composes proposal, authored and complete identities exactly as the full serializations", () => {
    const project = createBlankProject() as Project & Record<string, unknown>;
    project.world = {
      entities: [
        { id: "npc", type: "character", name: "NPC", summary: "사람", origin: "user" },
        { id: "doc", type: "guideline", name: "지침", summary: "문서", origin: "user" },
      ],
      relations: [{ a: "npc", b: "place", kind: "locatedIn" }],
    } as Project["world"];
    project.optionalGone = undefined;
    const parts = projectIdentityParts(project);
    expect(composeProjectIdentity(parts, "proposal")).toBe(roundtrip({ ...project, world: undefined }));
    expect(composeProjectIdentity(parts, "complete")).toBe(roundtrip(project));
    const { world, ...rest } = project;
    const legacyAuthored = roundtrip({ ...rest, world: {
      entities: world!.entities.filter(entity => !entity.wiki && entity.type !== "guideline"),
      relations: world!.relations,
    } });
    expect(composeProjectIdentity(parts, "authored")).toBe(legacyAuthored);
    expect(authoredIdentity(project)).toBe(legacyAuthored);
    delete (project as { world?: unknown }).world;
    expect(composeProjectIdentity(projectIdentityParts(project), "complete")).toBe(roundtrip(project));
  });
});

describe("inlineMediaRefs", () => {
  isolateTimers();
  describe("loadRepairReport", () => {
    isolateTimers();
    function quietly<T>(run: () => T): T {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        return run();
      } finally {
        warn.mockRestore();
      }
    }
    function projectWithBrokenReferences(): string {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      map.events.push({ id: "ev_door", x: 1, y: 1, trigger: { kind: "action" }, commands: [
        { kind: "transfer", mapId: "map_deleted", x: 1, y: 1 },
        { kind: "callCommonEvent", commonEventId: "ce_deleted" },
      ] } as GameEvent);
      map.events.push({ id: "ev_gate", x: 2, y: 1, trigger: { kind: "action" }, commands: [
        { kind: "transfer", mapId: "map_deleted", x: 3, y: 3 },
      ] } as GameEvent);
      return serialize(project);
    }
    describe("로드 복구 보고", () => {
      it("깨진 참조를 지운 것을 종류·건수·자리로 돌려준다", () => {
        const text = projectWithBrokenReferences();
        const { project, report } = quietly(() => deserializeStoredProjectJsonWithReport(JSON.parse(text), text));
        const mapId = project.startMapId;
        expect(report.entries).toEqual(expect.arrayContaining([
          expect.objectContaining({ kind: "removed", code: "command-missing-map", count: 2, where: [`${mapId}/ev_door`, `${mapId}/ev_gate`] }),
          expect.objectContaining({ kind: "removed", code: "command-missing-common-event", count: 1, where: [`${mapId}/ev_door`] }),
        ]));
        expect(report.total).toBe(report.entries.reduce((sum, entry) => sum + entry.count, 0));
      });

      it("고칠 것이 없는 프로젝트는 빈 보고다", () => {
        const text = serialize(createBlankProject());
        const { report } = deserializeStoredProjectJsonWithReport(JSON.parse(text), text);
        expect(report).toEqual({ total: 0, entries: [] });
      });

      it("수집 구간 밖의 검증(lint 왕복 등)은 보고를 남기지 않는다", () => {
        const text = projectWithBrokenReferences();
        adoptLatestLoadRepairReport();
        quietly(() => deserialize(text));
        expect(adoptLatestLoadRepairReport()).toBeNull();
        quietly(() => collectLoadRepairs(() => deserialize(text)));
        expect(adoptLatestLoadRepairReport()?.total).toBe(3);
      });
    });
  });
  describe("inlineMediaRefs", () => {
    isolateTimers();
    const png = "data:image/png;base64,iVBORw0KGgo=";
    function project(uploaded: Record<string, UploadedAsset>): Project {
      return { assets: { sprites: {}, uploaded } } as unknown as Project;
    }
    function assets(fail = new Set<string>()): ProjectRepository["assets"] & { readonly puts: string[] } {
      const puts: string[] = [];
      return {
        puts,
        async put(bytes, meta) {
          if (fail.has(meta.originalName ?? "")) throw new Error("disk full");
          puts.push(meta.originalName ?? "");
          return { ref: { sha256: String(bytes.length).padStart(64, "0"), mime: meta.mime, bytes: bytes.length, extension: meta.extension }, dataUrl: null };
        },
        url: () => "",
        list: async () => [],
        pruneUnused: async () => [],
      };
    }
    describe("separateInlineUploadedMedia", () => {
      it("moves inline uploads to refs without touching the source project", async () => {
        // 2026-09-28: the host rewrote these 414 inline shared images after the first save, and the
        // resulting project swap made every in-flight assistant apply fail with stale-base.
        const inline: UploadedAsset = { id: "a", name: "a", kind: "tileset", dataUrl: png, meta: {} };
        const stored: UploadedAsset = { id: "b", name: "b", kind: "tileset", ref: { sha256: "f".repeat(64), mime: "image/png", bytes: 1, extension: "png" }, meta: {} };
        const source = project({ a: inline, b: stored });
        const repo = assets();
        const result = await separateInlineUploadedMedia(source, repo);
        expect(result?.assetIds).toEqual(["a"]);
        expect(repo.puts).toEqual(["a"]);
        expect(result?.project.assets.uploaded.a).toMatchObject({ id: "a", ref: { mime: "image/png", extension: "png" } });
        expect(result?.project.assets.uploaded.a?.dataUrl).toBeUndefined();
        expect(result?.project.assets.uploaded.b).toBe(stored);
        expect(source.assets.uploaded.a).toBe(inline);
        expect(inline.dataUrl).toBe(png);
      });

      it("returns null when nothing is inline and keeps failed uploads inline", async () => {
        expect(await separateInlineUploadedMedia(project({}), assets())).toBeNull();
        const result = await separateInlineUploadedMedia(project({
          a: { id: "a", name: "a", kind: "tileset", dataUrl: png, meta: {} },
          b: { id: "b", name: "b", kind: "tileset", dataUrl: png, meta: {} },
        }), assets(new Set(["b"])));
        expect(result?.assetIds).toEqual(["a"]);
        expect(result?.project.assets.uploaded.b?.dataUrl).toBe(png);
      });
    });
  });
  describe("uploadedAssetStorage", () => {
    isolateTimers();
    const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const DATA_URL = `data:image/png;base64,${Buffer.from(PNG_BYTES).toString("base64")}`;
    async function withLocalFixture(run: (fixture: LocalRepositoryFixture) => Promise<void>): Promise<void> {
      const fixture = await createLocalRepositoryFixture();
      try {
        await run(fixture);
      } finally {
        fixture.close();
      }
    }
    describe("uploadedAssetForImport", () => {
      it("자산 저장이 없는 어댑터는 dataUrl 을 문서에 넣는다", async () => {
        const repository = createMemoryRepository({ target: { url: "memory://contract", anonKey: "memory", projectId: "p1" } });

        const asset = await uploadedAssetForImport({
          repository,
          id: "asset_mem",
          name: "메모리 이미지",
          kind: "sprite",
          dataUrl: DATA_URL,
          meta: { width: 1, height: 1 },
        });

        expect(asset.dataUrl).toBe(DATA_URL);
        expect(asset.ref).toBeUndefined();
        expect(await repository.assets.list()).toHaveLength(0);
      });

      it("자산 저장이 있는 어댑터는 파일로 넣고 ref 만 문서에 남긴다", async () => {
        await withLocalFixture(async ({ repository }) => {
          const asset = await uploadedAssetForImport({
            repository,
            id: "asset_local",
            name: "로컬 이미지",
            kind: "sprite",
            dataUrl: DATA_URL,
            meta: { width: 1, height: 1 },
          });

          expect(asset.dataUrl).toBeUndefined();
          expect(asset.ref?.sha256).toMatch(/^[0-9a-f]{64}$/);
          expect(asset.ref?.extension).toBe("png");
          expect(asset.ref?.mime).toBe("image/png");
          expect(asset.ref?.bytes).toBe(PNG_BYTES.byteLength);

          const listed = await repository.assets.list();
          expect(listed.map((entry) => entry.sha256)).toEqual([asset.ref?.sha256]);
        });
      });
    });
  });
});
