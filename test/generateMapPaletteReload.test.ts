import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize, serializeForComparison } from "@/project/io";
import { runTool } from "@/editor/tools/toolRunner";
import { markUserTileRuntimeMetadata, setTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { passableFlag, blockedFlag } from "@/project/tilesetPassage";
import { sha256HexText } from "@/util/sha256";
import type { Project } from "@/project/types";
import type { ElectronBridgeSession, SharedWire } from "./support/electronBridgeSession";

// 저장소만 바꿔 끼운다. 와이어 직렬화·store 로드 정규화·변이 추적·영수증·generate_map 은 전부 실제 코드다.
let session: ElectronBridgeSession | null = null;
const wire: SharedWire = { current: null };

async function freshStore() {
  vi.resetModules();
  const { installElectronBridgeSession } = await import("./support/electronBridgeSession");
  // 인스턴스를 새로 만들되 저장 위치는 공유한다 — 실제 브리지도 폴더의 파일이 정본이다.
  session = await installElectronBridgeSession({ projectDir: "/tmp/oprn-palette-reload", projectId: "generator-contract", wire });
  return (await import("@/project/store")).store;
}

afterEach(() => { session?.dispose(); session = null; vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("generator real store palette identity", () => {
  it.each(["captured", "authored-lower", "authored-upper", "native-upper"])(
    "%s -> real save receipt -> fresh load has identical rules and no migration", async mode => {
      // Prevent unrelated debounce autosaves; every operation is explicitly awaited.
      vi.useFakeTimers();
      wire.current = serialize(createBlankProject());
      const store = await freshStore();
      await store.load();
      await store.flush();
      const ctx = { project: structuredClone(store.getCurrent()) };
      // 2026-10-07 정리 뒤 generate_map 프로필은 Scarloxy 셋만 남았다(mapGenerationProfiles.ts). 옛 합본 마을 자리는
      // wilds(동굴=wilds 배치)가, native-upper 는 grassland(장애물 48 이 upper 고체)가 맡는다. 385 는 두 프로필 모두 쓰지 않는 칸이다.
      const ts = ctx.project.tilesets.scarloxy_chipset_wilds!;
      if (mode === "authored-lower" || mode === "authored-upper") {
        const lower = mode === "authored-lower";
        setTileLayerOverride(ts, 385, lower ? "lower" : "upper");
        ts.passability[385] = lower ? passableFlag() : blockedFlag();
        markUserTileRuntimeMetadata(ts, 385, { passage: lower ? "passable" : "solid" });
      }
      const rulesBefore = structuredClone(ctx.project.tilesets);
      const result = runTool(ctx, "generate_map", {
        name: "지하실", theme: "cave", id: "map_cellar", entrance: { y: 8, x: 1 },
        pois: [{ x: 9, y: 2 }], border: "wall", height: 10, width: 12,
        ...(mode === "native-upper" ? { tilesetId: "scarloxy_chipset_grassland" } : { tilesetId: "scarloxy_chipset_wilds" }),
      });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.tilesets).toEqual(rulesBefore);
      store.replace(ctx.project);
      const identity = await sha256HexText(serializeForComparison(store.getCurrent()));
      const saved = await store.flush();
      expect(saved.kind).toBe("saved");
      if (saved.kind !== "saved") throw new Error("save failed");
      // 영수증의 contentIdentity 는 요약 트리 해시(persistedContentIdentity = jsonContentDigest)라 큰 문서에서는
      // sha256(serializeForComparison) 과 다른 값이다 — 같은 함수로 대조하는 제품 증명 경로로 확인한다.
      // 위 identity 는 아래에서 새 스토어로 다시 연 문서와 비교해 «저장 전 문서 = 다시 읽은 문서» 를 잇는다.
      expect(saved.receipt).toBeDefined();
      expect((await store.verifyPersistedRevision(saved.receipt!)).kind).toBe("verified");
      const fresh = await freshStore();
      await fresh.load();
      expect(fresh.getCurrent().maps.map_cellar).toEqual(deserialize(serialize(ctx.project)).maps.map_cellar);
      expect(fresh.getCurrent().tilesets).toEqual(deserialize(serialize(ctx.project)).tilesets);
      expect(await sha256HexText(serializeForComparison(fresh.getCurrent()))).toBe(identity);
      expect(fresh.hasUnsavedChanges()).toBe(false);
      expect(fresh.getAutoSaveState().kind).toBe("idle");
      const writes = session?.calls.save ?? 0;
      await fresh.flush();
      expect(session?.calls.save ?? 0).toBe(writes);
    },
    // 2026-10-07 정리 뒤 새 프로젝트는 번들 타일셋 40여 개(beodeul_city 23,936칸 등)를 들고 태어난다. 이 시험은 모듈을 두 번
    // 새로 읽고(vi.resetModules) 프로젝트 전체를 여러 번 직렬화·비교한다 — CI 1워커에서 저장 확인까지만 약 23s 였다(run 40203401869).
    120_000,
  );
});
