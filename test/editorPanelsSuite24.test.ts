import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { createLane, laneBundleChangedKeys, laneBundleIds, lanesOverlap, reduceLane, type LaneSpec, type LaneState } from "@/ai/piAgent/lane";
import type { PiAgentDoneEvent, PiAgentEvent, PiAgentRequest } from "@/ai/piAgent/protocol";
import { createLaneManager } from "@/editor/panels/aiLaneManager";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { store } from "@/project/store";
import { runTool } from "@/editor/tools";
import type { Project, ResourceProfile, UploadedAsset } from "@/project/types";
import { anchoredPopupPosition } from "@/editor/panels/popupPosition";
import { SVG_ICON_NAMES } from "@/editor/panels/tileToolbarIcons";
import { RESOURCE_FOLDER_IMPORT_CAP, filesFromResourceDrop, renderResourceWorkbench } from "@/editor/panels/resourceManagerViews";
import { canonicalResourceProfileId, dedupeListedProfiles } from "@/editor/panels/resourceManagerUtils";
import { defaultResourceProfiles } from "@/project/defaults/defaultAssets";
import { decideImageDataUrl, decideImageImport, formatImageImportDimensionError, formatImageImportSizeError } from "@/editor/panels/resourceManagerImageImport";
import { findByTestId, installFakeDom, type FakeElement, type FakeNode } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

describe("piAgentLanes", () => {
  isolateTimers();
  function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
  function seed(): Project {
    const ctx = { project: createBlankProject() };
    for (const [id, name] of [["map_east", "동쪽"], ["map_west", "서쪽"]] as const) {
      const result = runTool(ctx, "create_map", { id, name, width: 20, height: 16 });
      if (!result.ok) throw new Error(result.summary);
    }
    return ctx.project;
  }
  function spec(overrides: Partial<LaneSpec> & Pick<LaneSpec, "id" | "mapIds">): LaneSpec {
    return {
      label: overrides.id,
      agentLabel: "시공A",
      provider: "google-antigravity",
      model: "gemini-3.7-flash",
      instruction: "맵을 손본다",
      ...overrides,
    };
  }
  /** 요청이 실은 사본을 편집해 done 을 돌려주는 가짜 워커. 네트워크를 타지 않는다. */
  function fakeRunner(edit: (project: Project) => void, events: PiAgentEvent[] = []): (request: PiAgentRequest, options: { onEvent?: (event: PiAgentEvent) => void }) => Promise<PiAgentDoneEvent> {
    return async (request, options) => {
      for (const event of events) options.onEvent?.(event);
      const project = clone(request.project);
      edit(project);
      const mapKeys = Object.keys(project.maps).filter(
        (id) => JSON.stringify(project.maps[id]) !== JSON.stringify(request.project.maps[id]),
      );
      return {
        type: "done",
        project,
        stats: { ms: 12, turns: 3, toolCalls: 5, toolErrors: 0 },
        changedKeys: mapKeys.map((id) => `maps.${id}`),
      };
    };
  }
  function armStore(project: Project): void {
    vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "");
    vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", "");
    vi.stubEnv("VITE_LEGACY_DB_URL", "");
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replaceProject(project);
    resetMapEditHistory();
  }
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  describe("lane 순수 상태", () => {
    it("시작 → 검토 → 적용 순서로만 상태가 움직이고 진행 카운터가 쌓인다", () => {
      const base = seed();
      let lane: LaneState = createLane(spec({ id: "lane_1", mapIds: ["map_east"] }));
      expect(lane.status).toBe("idle");
      lane = reduceLane(lane, { type: "start", base, at: 100 });
      expect(lane.status).toBe("running");
      expect(lane.bundleIds).toContain("map_east");
      lane = reduceLane(lane, { type: "turn", line: "생각 중" });
      lane = reduceLane(lane, { type: "step", step: { kind: "tool", text: "paint_tiles" } });
      expect(lane.progress.turns).toBe(1);
      expect(lane.progress.toolCalls).toBe(1);
      lane = reduceLane(lane, {
        type: "done",
        result: { project: base, stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: [], spills: [], conflicts: [], summary: "" },
        at: 200,
      });
      expect(lane.status).toBe("review");
      lane = reduceLane(lane, { type: "applied" });
      expect(lane.status).toBe("applied");
      expect(lane.result).toBeNull();
    });

    it("중단해도 이미 받은 검토 결과는 버리지 않는다", () => {
      const base = seed();
      let lane = createLane(spec({ id: "lane_1", mapIds: ["map_east"] }));
      lane = reduceLane(lane, { type: "start", base, at: 0 });
      lane = reduceLane(lane, {
        type: "done",
        result: { project: base, stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: [], spills: [], conflicts: [], summary: "" },
        at: 5,
      });
      lane = reduceLane(lane, { type: "stopped", at: 9 });
      expect(lane.status).toBe("review");
      expect(lane.result).not.toBeNull();
    });

    it("묶음은 맵 + 그 아래 실내까지 확장된다", () => {
      const base = seed();
      const withInterior = clone(base);
      withInterior.maps.map_east_inner = { ...clone(withInterior.maps.map_east!), id: "map_east_inner", name: "동쪽 실내" };
      withInterior.mapTree.children.find((node) => node.mapId === "map_east")!.children.push({ mapId: "map_east_inner", children: [] });
      expect(laneBundleIds(withInterior, spec({ id: "lane", mapIds: ["map_east"] })).sort()).toEqual(["map_east", "map_east_inner"]);
      expect(laneBundleIds(withInterior, spec({ id: "lane", mapIds: ["map_west"] }))).toEqual(["map_west"]);
    });

    it("두 레인이 같은 묶음을 주장하면 겹친 맵을 알려준다", () => {
      const a = { bundleIds: ["map_east", "map_east_inner"] };
      const b = { bundleIds: ["map_east_inner", "map_west"] };
      const c = { bundleIds: ["map_west"] };
      expect(lanesOverlap(a, b)).toEqual(["map_east_inner"]);
      expect(lanesOverlap(a, c)).toEqual([]);
    });
  });
  describe("laneBundleChangedKeys — 레인별 적용의 판정 규칙", () => {
    it("다른 맵이 바뀐 것은 이 레인의 충돌이 아니다", () => {
      const base = seed();
      const current = clone(base);
      current.maps.map_west!.name = "서쪽 (사람이 고침)";
      expect(laneBundleChangedKeys(base, current, ["map_east"])).toEqual([]);
    });

    it("내 묶음의 맵이 바뀌었으면 키로 보고한다", () => {
      const base = seed();
      const current = clone(base);
      current.maps.map_east!.name = "동쪽 (사람이 고침)";
      expect(laneBundleChangedKeys(base, current, ["map_east"])).toEqual(["maps.map_east"]);
    });

    it("묶음에 실내가 붙었으면 mapTree 키로 보고한다", () => {
      const base = seed();
      const current = clone(base);
      current.maps.map_east_inner = { ...clone(current.maps.map_east!), id: "map_east_inner", name: "실내" };
      current.mapTree.children.find((node) => node.mapId === "map_east")!.children.push({ mapId: "map_east_inner", children: [] });
      expect(laneBundleChangedKeys(base, current, ["map_east"]).sort()).toEqual(["mapTree.map_east", "maps.map_east_inner"]);
    });
  });
  // Heavy under CI load (15s default is too tight): runs lanes over blank projects.
  describe("lane manager — 레인별 독립 실행과 적용", { timeout: 120_000 }, () => {
    it("레인 A 를 적용해도 레인 B 의 결과는 살아남아 그대로 적용된다", async () => {
      armStore(seed());
      const manager = createLaneManager({
        clock: () => 0,
        runAgent: fakeRunner((project) => {
          project.maps.map_east!.name = "동쪽 (레인 A)";
        }),
        onChange: () => undefined,
      });
      const other = createLaneManager({
        clock: () => 0,
        runAgent: fakeRunner((project) => {
          project.maps.map_west!.name = "서쪽 (레인 B)";
        }),
      });
      manager.add(spec({ id: "lane_a", mapIds: ["map_east"], label: "동쪽 숲길" }));
      expect((await manager.start("lane_a")).ok).toBe(true);
      other.add(spec({ id: "lane_b", mapIds: ["map_west"], label: "항구 마을" }));
      expect((await other.start("lane_b")).ok).toBe(true);

      // 레인 A 적용으로 프로젝트가 바뀜 뒤에도 B 가 적용되는지가 이 테스트의 전부다.
      const appliedA = await manager.apply("lane_a");
      expect(appliedA.ok).toBe(true);
      expect(store.getCurrent().maps.map_east!.name).toBe("동쪽 (레인 A)");

      const appliedB = await other.apply("lane_b");
      expect(appliedB).toEqual({ ok: true, changedKeys: ["maps.map_west"], spills: [] });
      expect(store.getCurrent().maps.map_west!.name).toBe("서쪽 (레인 B)");
      expect(store.getCurrent().maps.map_east!.name).toBe("동쪽 (레인 A)");
      manager.dispose();
      other.dispose();
    });

    it("도는 동안 내 묶음이 바뀌었으면 적용하지 않고 재실행을 요구한다", async () => {
      armStore(seed());
      const manager = createLaneManager({
        runAgent: fakeRunner((project) => {
          project.maps.map_east!.name = "동쪽 (레인)";
        }),
        onChange: () => undefined,
      });
      manager.add(spec({ id: "lane_a", mapIds: ["map_east"] }));
      await manager.start("lane_a");

      const humanEdit = clone(store.getCurrent());
      humanEdit.maps.map_east!.name = "동쪽 (사람)";
      store.replaceProject(humanEdit);

      const outcome = await manager.apply("lane_a");
      expect(outcome.ok).toBe(false);
      if (outcome.ok) throw new Error("unreachable");
      expect(outcome.reason).toBe("bundle-changed");
      expect(outcome.keys).toEqual(["maps.map_east"]);
      expect(store.getCurrent().maps.map_east!.name).toBe("동쪽 (사람)");
      manager.dispose();
    });

    it("같은 묶음을 이미 도는 레인이 있으면 시작을 거절한다", async () => {
      armStore(seed());
      let release: () => void = () => undefined;
      const held = new Promise<void>((resolve) => { release = () => resolve(); });
      const manager = createLaneManager({
        runAgent: async (request, options) => {
          await new Promise<void>((resolve, reject) => {
            held.then(resolve);
            options.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
          });
          return { type: "done", project: request.project, stats: { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 }, changedKeys: [] };
        },
        onChange: () => undefined,
      });
      manager.add(spec({ id: "lane_a", mapIds: ["map_east"], label: "동쪽 숲길" }));
      manager.add(spec({ id: "lane_b", mapIds: ["map_east"], label: "동쪽 마을" }));
      const first = manager.start("lane_a");
      const refused = await manager.start("lane_b");
      expect(refused.ok).toBe(false);
      expect(refused.issue).toContain("동쪽 숲길");
      manager.stop("lane_a");
      release();
      await first;
      expect(manager.get("lane_a")?.status).toBe("stopped");
      manager.dispose();
    });

    it("묶음이 비면 시작하지 않는다", async () => {
      armStore(seed());
      const manager = createLaneManager({ runAgent: fakeRunner(() => undefined), onChange: () => undefined });
      manager.add(spec({ id: "lane_a", mapIds: [] }));
      const outcome = await manager.start("lane_a");
      expect(outcome.ok).toBe(false);
      expect(outcome.issue).toContain("묶음");
      manager.dispose();
    });
  });
});

describe("popupPosition", () => {
  isolateTimers();
  describe("anchoredPopupPosition", () => {
    it("keeps a docked assistant menu inside the viewport instead of its clipped host", () => {
      // Break: the menu was absolutely positioned inside an overflow:hidden side host.
      expect(anchoredPopupPosition(
        { left: 1450, right: 1482, top: 100, bottom: 132 },
        { width: 220, height: 360 },
        { width: 1600, height: 900 },
      )).toEqual({ left: 1262, top: 136 });
    });

    it("opens above the anchor when there is no room below", () => {
      expect(anchoredPopupPosition(
        { left: 700, right: 732, top: 760, bottom: 792 },
        { width: 200, height: 300 },
        { width: 800, height: 820 },
      )).toEqual({ left: 532, top: 456 });
    });
  });
});

describe("railIcons", () => {
  isolateTimers();
  describe("rail svg icons", () => {
    it("기본 레일에 필요한 아이콘 이름이 모두 등록되어 있다", () => {
      for (const name of ["select", "brush", "eraser", "fill", "event", "eyedropper", "tile", "layers", "map"]) {
        expect(SVG_ICON_NAMES).toContain(name);
      }
    });
  });
});

// 리소스 관리자에 폴더를 놓으면 폴더 자체가 파일 한 장으로 들어와 「알 수 없는 형식」이 됐다.
// 폴더 안을 읽고, 지금 분류의 확장자만 가져온다.
describe("resourceFolderDrop", () => {
  isolateTimers();
  function fileNamed(name: string): File {
    return new File(["x"], name, { type: "application/octet-stream" });
  }
  function fileEntry(name: string, onRead?: () => void): FileSystemEntry {
    return {
      name,
      isFile: true,
      isDirectory: false,
      file(success) {
        onRead?.();
        success(fileNamed(name));
      },
    } as FileSystemFileEntry;
  }
  function dirEntry(name: string, children: readonly FileSystemEntry[]): FileSystemEntry {
    return {
      name,
      isFile: false,
      isDirectory: true,
      createReader: () => {
        let pending = children.slice();
        return {
          readEntries(success) {
            const batch = pending.splice(0, 100);
            success(batch);
          },
        };
      },
    } as FileSystemDirectoryEntry;
  }
  function transfer(entries: readonly (FileSystemEntry | null)[], files: readonly File[] = []): DataTransfer {
    return {
      items: entries.map((entry) => ({
        kind: "file",
        webkitGetAsEntry: () => entry,
      })),
      files,
    } as unknown as DataTransfer;
  }
  describe("filesFromResourceDrop", () => {
    it("keeps a single dropped file when the browser does not expose a directory entry", async () => {
      const png = fileNamed("lamp.png");
      const read = await filesFromResourceDrop({
        items: [{ kind: "file", webkitGetAsEntry: () => null }],
        files: [png],
      } as unknown as DataTransfer);

      expect(read.files.map((file) => file.name)).toEqual(["lamp.png"]);
      expect(read.notice).toBeNull();
    });

    it("imports images inside a dropped folder and skips notes", async () => {
      const read = await filesFromResourceDrop(transfer([
        dirEntry("village-pictures", [
          fileEntry("lamp.png"),
          fileEntry("notes.txt"),
          dirEntry("signs", [fileEntry("sign.png"), fileEntry(".hidden.png")]),
        ]),
      ], [fileNamed("village-pictures")]));

      expect(read.files.map((file) => file.name)).toEqual(["lamp.png", "sign.png"]);
      expect(read.notice).toBeNull();
    });

    it("says when a folder has nothing the current category can import", async () => {
      const read = await filesFromResourceDrop(transfer([
        dirEntry("music", [fileEntry("theme.mp3")]),
      ]), ["png"]);

      expect(read.files).toEqual([]);
      expect(read.noticeKind).toBe("error");
      expect(read.notice).toBe("이 폴더에서 지금 분류로 가져올 파일이 없습니다.");
    });

    it("stops after the folder cap and does not read the rest", async () => {
      let extraReads = 0;
      const children = Array.from({ length: RESOURCE_FOLDER_IMPORT_CAP + 3 }, (_, index) => (
        fileEntry(`tile-${index}.png`, () => {
          if (index >= RESOURCE_FOLDER_IMPORT_CAP) extraReads += 1;
        })
      ));
      const read = await filesFromResourceDrop(transfer([dirEntry("tiles", children)]));

      expect(read.files).toHaveLength(RESOURCE_FOLDER_IMPORT_CAP);
      expect(extraReads).toBe(0);
      expect(read.noticeKind).toBe("info");
      expect(read.notice).toBe(`폴더에서는 앞의 ${RESOURCE_FOLDER_IMPORT_CAP}개만 가져옵니다.`);
    });

    it("still passes a loose file through even when its extension is not a folder match", async () => {
      const read = await filesFromResourceDrop(transfer([fileEntry("sheet.bmp")]));

      expect(read.files.map((file) => file.name)).toEqual(["sheet.bmp"]);
      expect(read.notice).toBeNull();
    });
  });
});

describe("resourceManager", () => {
  isolateTimers();
  describe("resourceManagerDedup", () => {
    isolateTimers();
    const upload = (id: string, kind: UploadedAsset["kind"]): UploadedAsset => ({
      id,
      name: id,
      kind,
      dataUrl: "data:image/png;base64,x",
      meta: {},
    });
    const profile = (kind: ResourceProfile["kind"], assetId: string | undefined, name = assetId ?? "anonymous"): ResourceProfile =>
      assetId === undefined ? { kind, name } : { kind, name, assetId };
    describe("리소스 관리자 목록 중복 제거", () => {
      // EasyRPG 칩셋 시트(easyrpg-chipset-*)는 2026-10-07 저작권 정리(PR #2335)로 번들에서 빠졌다.
      // 접을 칩셋 별칭이 더는 없으므로, 기본 목록에 별칭 칩셋 카드가 남지 않는지만 본다.
      it("기본 프로젝트의 칩셋 목록에 easyrpg-chipset-* 별칭 카드가 남지 않는다", () => {
        const all = defaultResourceProfiles();
        const chipsets = dedupeListedProfiles(all, []).filter((p) => p.kind === "chipset");
        expect(chipsets.filter((p) => p.assetId?.startsWith("easyrpg-chipset-"))).toEqual([]);
        expect(chipsets.some((p) => p.assetId === "tex_beodeul_city")).toBe(true);
      });

      it("캐릭터셋도 같은 시트의 RTP id 별칭이 접히고 정본 프로필만 남는다", () => {
        const all = defaultResourceProfiles();
        const visible = dedupeListedProfiles(all, []).filter((p) => p.kind === "charset");
        expect(all.filter((p) => p.kind === "charset").some((p) => p.assetId === "easyrpg-charset-actor1")).toBe(true);
        expect(visible.some((p) => p.assetId?.startsWith("easyrpg-charset-"))).toBe(false);
        expect(visible.some((p) => p.assetId === "tex_easyrpg_charset_actor1")).toBe(true);
        // 데이터에서 프로필을 지우지 않는다 — 목록만 접는다.
        expect(visible.length).toBeLessThan(all.filter((p) => p.kind === "charset").length);
      });

      it("업로드 자산과 같은 assetId 를 가진 프로필은 업로드 카드가 대신 보인다", () => {
        const profiles = [
          profile("chipset", "my-upload", "업로드와 겹침"),
          profile("chipset", "tex_easyrpg_chipset_dungeon"),
        ];
        const visible = dedupeListedProfiles(profiles, [upload("my-upload", "tileset")]);
        expect(visible.map((p) => p.assetId)).toEqual(["tex_easyrpg_chipset_dungeon"]);
      });

      it("정본 프로필이 없는 별칭 프로필만 있는 프로젝트는 그대로 보인다", () => {
        const profiles = [profile("chipset", "easyrpg-chipset-dungeon")];
        const visible = dedupeListedProfiles(profiles, []);
        expect(visible).toHaveLength(1);
        expect(visible[0]?.assetId).toBe("easyrpg-chipset-dungeon");
      });

      it("assetId 없는 프로필은 서로 다른 항목으로 유지된다", () => {
        const profiles = [profile("chipset", undefined, "수작업 칩셋 A"), profile("chipset", undefined, "수작업 칩셋 B")];
        expect(dedupeListedProfiles(profiles, [])).toHaveLength(2);
      });

      it("canonicalResourceProfileId 는 캐릭터셋 별칭을 번들 텍스처 키로 접는다", () => {
        // 칩셋 별칭의 번들 시트는 PR #2335 로 삭제됐다 — 접을 대상이 없으면 id 를 그대로 둔다.
        expect(canonicalResourceProfileId("easyrpg-chipset-dungeon")).toBe("easyrpg-chipset-dungeon");
        expect(canonicalResourceProfileId("easyrpg-charset-actor1")).toBe("tex_easyrpg_charset_actor1");
        expect(canonicalResourceProfileId("tex_easyrpg_chipset_dungeon")).toBe("tex_easyrpg_chipset_dungeon");
        expect(canonicalResourceProfileId("custom-upload")).toBe("custom-upload");
      });
    });
  });
  describe("resourceManagerImageImport", () => {
    isolateTimers();
    describe("decideImageImport", () => {
      it("accepts png and jpeg without normalization", () => {
        expect(
          decideImageImport({ fileName: "tile.png", mimeType: "image/png", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "png", normalizeToPng: false });
        expect(
          decideImageImport({ fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "jpeg", normalizeToPng: false });
      });

      it("accepts webp and gif with PNG normalization", () => {
        expect(
          decideImageImport({ fileName: "shot.webp", mimeType: "image/webp", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "webp", normalizeToPng: true });
        expect(
          decideImageImport({ fileName: "anim.gif", mimeType: "image/gif", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "gif", normalizeToPng: true });
      });

      it("rejects oversize files with actual size and the 16MB limit", () => {
        const decision = decideImageImport({
          fileName: "big.png",
          mimeType: "image/png",
          sizeBytes: 18 * 1024 * 1024,
        });
        expect(decision.ok).toBe(false);
        if (!decision.ok) {
          expect(decision.reason).toBe("size");
          expect(decision.message).toContain("18.0MB");
          expect(decision.message).toContain("16MB");
        }
      });

      it("rejects unsupported formats naming the actual type", () => {
        const decision = decideImageImport({
          fileName: "icon.svg",
          mimeType: "image/svg+xml",
          sizeBytes: 100,
        });
        expect(decision.ok).toBe(false);
        if (!decision.ok) {
          expect(decision.reason).toBe("format");
          expect(decision.message).toContain("image/svg+xml");
        }
      });

      it("falls back to extension when MIME is empty", () => {
        expect(
          decideImageImport({ fileName: "shot.webp", mimeType: "", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "webp", normalizeToPng: true });
      });

      it("falls back to extension for generic octet-stream MIME", () => {
        expect(
          decideImageImport({ fileName: "tile.png", mimeType: "application/octet-stream", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "png", normalizeToPng: false });
        expect(
          decideImageImport({ fileName: "shot.webp", mimeType: "application/octet-stream", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "webp", normalizeToPng: true });
      });

      it("prefers MIME over a conflicting extension for image types", () => {
        expect(
          decideImageImport({ fileName: "renamed-svg.png", mimeType: "image/svg+xml", sizeBytes: 100 }).ok
        ).toBe(false);
        expect(
          decideImageImport({ fileName: "photo.webp", mimeType: "image/png", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "png", normalizeToPng: false });
      });

      it("accepts uppercase extensions", () => {
        expect(
          decideImageImport({ fileName: "SHOT.WEBP", mimeType: "", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "webp", normalizeToPng: true });
      });

      it("normalizes the non-standard image/jpg alias to PNG", () => {
        expect(
          decideImageImport({ fileName: "photo.jpg", mimeType: "image/jpg", sizeBytes: 100 })
        ).toEqual({ ok: true, format: "jpeg", normalizeToPng: true });
      });
    });
    describe("decideImageDataUrl", () => {
      it("passes png/jpeg data URLs through", () => {
        const decision = decideImageDataUrl("data:image/png;base64,AAAA");
        expect(decision).toEqual({ ok: true, format: "png", normalizeToPng: false });
      });

      it("flags webp/gif data URLs for normalization", () => {
        expect(decideImageDataUrl("data:image/webp;base64,AAAA")).toEqual({
          ok: true,
          format: "webp",
          normalizeToPng: true,
        });
      });

      it("follows the file-level decision for empty or generic data-URL headers", () => {
        expect(
          decideImageDataUrl("data:;base64,AAAA", { format: "webp", normalizeToPng: true })
        ).toEqual({ ok: true, format: "webp", normalizeToPng: true });
        // 일반 헤더는 파일 판정이 png 여도 PNG 로 다시 그린다 — 그대로 저장하면
        // safeUploadedResourceUrl 화이트리스트에 걸려 플레이에서 보이지 않는다.
        expect(
          decideImageDataUrl("data:application/octet-stream;base64,AAAA", { format: "png", normalizeToPng: false })
        ).toEqual({ ok: true, format: "png", normalizeToPng: true });
      });

      it("still rejects non-image data URLs without a fallback", () => {
        const decision = decideImageDataUrl("data:;base64,AAAA");
        expect(decision.ok).toBe(false);
      });

      it("normalizes the image/jpg data-URL alias", () => {
        expect(decideImageDataUrl("data:image/jpg;base64,AAAA")).toEqual({
          ok: true,
          format: "jpeg",
          normalizeToPng: true,
        });
      });
    });
    describe("error message helpers", () => {
      it("shows actual megabytes in size errors", () => {
        const message = formatImageImportSizeError(2.5 * 1024 * 1024);
        expect(message).toContain("2.5MB");
        expect(message).toContain("16MB");
      });

      it("appends actual dimensions when the validator message lacks them", () => {
        const withDims = formatImageImportDimensionError("칩셋: 16x16 단위", 20, 20);
        expect(withDims).toContain("20x20");
        const already = formatImageImportDimensionError("필요 16x16, 현재 20x20", 20, 20);
        expect(already).toBe("필요 16x16, 현재 20x20");
      });
    });
  });
  // 가져오기 직후 새 리소스가 어디에 있는지 보여야 한다.
  //
  // 목록은 기본 포함 리소스(캐릭셋만 40여 줄) 뒤에 업로드분을 덧붙이고, 가져오기 후 목록을
  // 통째로 다시 그리면서 스크롤이 맨 위로 돌아간다. 그래서 "가져오기 완료" 토스트만 뜨고
  // 목록은 그대로인 것처럼 보였다 — 방금 넣은 줄을 짚어 주고 화면 안으로 끌어와야 한다.
  describe("resourceManagerRevealImport", () => {
    isolateTimers();
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });
    const ASSET_ID = "charset_img_reveal";
    function charsetAsset(id: string): UploadedAsset {
      return {
        id,
        name: `teal-${id}`,
        kind: "charset",
        dataUrl: "data:image/png;base64,AAAA",
        meta: { tileSize: 24, frames: 96, frameWidth: 24, frameHeight: 32, width: 288, height: 256 },
      } as UploadedAsset;
    }
    function renderWorkbench(recentAssetId?: string): { root: FakeNode; scrolled: string[] } {
      const scrolled: string[] = [];
      const container = document.createElement("div");
      document.body.append(container);
      const uploaded = [charsetAsset("charset_img_old"), charsetAsset(ASSET_ID)];
      renderResourceWorkbench(container, {
        categories: [{ kind: "charset", label: "캐릭터셋" }],
        selectedKind: "charset",
        profiles: [],
        uploaded,
        kindSelect: document.createElement("select") as HTMLSelectElement,
        fileInput: document.createElement("input") as HTMLInputElement,
        actions: { addTileset: () => {}, applyTileset: () => {}, deleteAsset: () => {} },
        onSelectKind: () => {},
        onImport: () => {},
        ...(recentAssetId === undefined ? {} : { recentAssetId }),
      });
      const root = container as unknown as FakeNode;
      for (const asset of uploaded) {
        const row = findByTestId(root, `resource-upload-${asset.id}`);
        if (!row) continue;
        (row as unknown as { scrollIntoView: () => void }).scrollIntoView = () => scrolled.push(asset.id);
      }
      return { root, scrolled };
    }
    describe("resource manager import reveal", () => {
      it("marks the just-imported row so it stands out from the bundled list", () => {
        const { root } = renderWorkbench(ASSET_ID);

        const fresh = findByTestId(root, `resource-upload-${ASSET_ID}`) as FakeElement | null;
        const older = findByTestId(root, "resource-upload-charset_img_old") as FakeElement | null;
        expect(fresh?.dataset.recent).toBe("true");
        expect(older?.dataset.recent).toBeUndefined();
      });

      it("leaves every row unmarked when nothing was just imported", () => {
        const { root } = renderWorkbench();

        const fresh = findByTestId(root, `resource-upload-${ASSET_ID}`) as FakeElement | null;
        expect(fresh?.dataset.recent).toBeUndefined();
      });

      it("scrolls the just-imported row into view", () => {
        const container = document.createElement("div");
        document.body.append(container);
        const uploaded = [charsetAsset("charset_img_old"), charsetAsset(ASSET_ID)];
        const scrolled: string[] = [];
        // scrollIntoView 는 렌더 도중 불리므로 프로토타입에서 가로챈다.
        const proto = Object.getPrototypeOf(container) as { scrollIntoView: () => void };
        const original = proto.scrollIntoView;
        proto.scrollIntoView = function patched(this: { dataset?: Record<string, string> }): void {
          scrolled.push(this.dataset?.recent === "true" ? "recent" : "other");
        };
        try {
          renderResourceWorkbench(container, {
            categories: [{ kind: "charset", label: "캐릭터셋" }],
            selectedKind: "charset",
            profiles: [],
            uploaded,
            kindSelect: document.createElement("select") as HTMLSelectElement,
            fileInput: document.createElement("input") as HTMLInputElement,
            actions: { addTileset: () => {}, applyTileset: () => {}, deleteAsset: () => {} },
            onSelectKind: () => {},
            onImport: () => {},
            recentAssetId: ASSET_ID,
          });
        } finally {
          proto.scrollIntoView = original;
        }

        expect(scrolled).toEqual(["recent"]);
      });
    });
  });
});
