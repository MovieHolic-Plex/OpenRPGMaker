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
      const ts = ctx.project.tilesets.easyrpg_chipset_combined_town!;
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
        ...(mode === "native-upper" ? { tilesetId: "scarloxy_chipset_grassland" } : {}),
      });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.tilesets).toEqual(rulesBefore);
      store.replace(ctx.project);
      const identity = await sha256HexText(serializeForComparison(store.getCurrent()));
      const saved = await store.flush();
      expect(saved.kind).toBe("saved");
      if (saved.kind !== "saved") throw new Error("save failed");
      expect(saved.receipt?.contentIdentity).toBe(identity);
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
  );
});
