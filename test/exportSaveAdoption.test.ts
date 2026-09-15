// @vitest-environment happy-dom
// 내보낸 게임의 세이브 네임스페이스가 `rpgzzu-export:` 에서 `oprn-export:` 로 바뀌었다(2026-09 제품명 스윕).
// 플레이어 브라우저에는 옛 네임스페이스로 저장된 세이브가 남아 있으므로, 첫 부팅에서 **이 게임의** 옛 키가
// 있고 새 키가 하나도 없으면 옛 키를 새 이름으로 복사한다. 훑지 않는다 — 고정된 키 8개만 본다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import {
  EXPORT_SAVE_NAMESPACE_PREFIX,
  LEGACY_EXPORT_SAVE_NAMESPACE_PREFIX,
  legacyExportSaveNamespace,
} from "@/player/exportSaveNamespacePrefix";
import { adoptLegacyExportSaves } from "@/player/saveSlots";

describe("export save namespace prefix", () => {
  it("새 접두사는 oprn-export: 이고 옛 접두사는 rpgzzu-export: 다", () => {
    expect(EXPORT_SAVE_NAMESPACE_PREFIX).toBe("oprn-export:");
    expect(LEGACY_EXPORT_SAVE_NAMESPACE_PREFIX).toBe("rpgzzu-export:");
  });

  it("새 네임스페이스에서 옛 네임스페이스를 만들고, 다른 접두사(호스트 주입 값)는 대응이 없다", () => {
    expect(legacyExportSaveNamespace("oprn-export:listing-a")).toBe("rpgzzu-export:listing-a");
    expect(legacyExportSaveNamespace("uploader-copied-host")).toBeUndefined();
    expect(legacyExportSaveNamespace("oprn:save-slot")).toBeUndefined();
  });
});

describe("adoptLegacyExportSaves", () => {
  afterEach(() => localStorage.clear());

  it("새 키가 없고 옛 키가 있으면 슬롯·오토세이브·v4 키를 전부 복사하고 옛 키는 남긴다", () => {
    localStorage.setItem("rpgzzu-export:game-a:save-slot:v5:1", "slot-1");
    localStorage.setItem("rpgzzu-export:game-a:save-slot:v5:3", "slot-3");
    localStorage.setItem("rpgzzu-export:game-a:save-slot:v5:auto", "auto");
    localStorage.setItem("rpgzzu-export:game-a:save-slot:2", "v4-slot-2");
    localStorage.setItem("rpgzzu-export:game-b:save-slot:v5:1", "other-game");

    expect(adoptLegacyExportSaves(localStorage, "oprn-export:game-a")).toBe(4);

    expect(localStorage.getItem("oprn-export:game-a:save-slot:v5:1")).toBe("slot-1");
    expect(localStorage.getItem("oprn-export:game-a:save-slot:v5:3")).toBe("slot-3");
    expect(localStorage.getItem("oprn-export:game-a:save-slot:v5:auto")).toBe("auto");
    expect(localStorage.getItem("oprn-export:game-a:save-slot:2")).toBe("v4-slot-2");
    expect(localStorage.getItem("oprn-export:game-a:save-slot:v5:2")).toBeNull();
    expect(localStorage.getItem("rpgzzu-export:game-a:save-slot:v5:1")).toBe("slot-1");
    // 다른 게임의 옛 키는 보지도, 옮기지도 않는다.
    expect(localStorage.getItem("oprn-export:game-b:save-slot:v5:1")).toBeNull();
    expect(localStorage.getItem("rpgzzu-export:game-b:save-slot:v5:1")).toBe("other-game");
  });

  it("새 네임스페이스에 키가 하나라도 있으면 아무것도 덮어쓰지 않는다", () => {
    localStorage.setItem("oprn-export:game-a:save-slot:v5:2", "already-new");
    localStorage.setItem("rpgzzu-export:game-a:save-slot:v5:1", "legacy-1");
    expect(adoptLegacyExportSaves(localStorage, "oprn-export:game-a")).toBe(0);
    expect(localStorage.getItem("oprn-export:game-a:save-slot:v5:1")).toBeNull();
    expect(localStorage.getItem("oprn-export:game-a:save-slot:v5:2")).toBe("already-new");
  });

  it("두 번 불러도 두 번째는 할 일이 없다", () => {
    localStorage.setItem("rpgzzu-export:game-a:save-slot:v5:1", "legacy-1");
    expect(adoptLegacyExportSaves(localStorage, "oprn-export:game-a")).toBe(1);
    expect(adoptLegacyExportSaves(localStorage, "oprn-export:game-a")).toBe(0);
  });

  it("옛 접두사와 대응하지 않는 네임스페이스(호스트 주입 값)는 건드리지 않는다", () => {
    localStorage.setItem("rpgzzu-export:host:save-slot:v5:1", "x");
    expect(adoptLegacyExportSaves(localStorage, "uploader-copied-host")).toBe(0);
    expect(localStorage.length).toBe(1);
  });
});

// 실제 내보내기 부팅 경로(exportEntry)가 입양을 부르는지 — communitySaveBoot.test.ts 와 같은 방식으로 관측한다.
const { rendered } = vi.hoisted(() => ({ rendered: vi.fn() }));
vi.mock("@/player/player", () => ({ renderPlayer: rendered }));
vi.mock("@/player/audio", () => ({ stopAllAudio: vi.fn() }));
vi.mock("@/project/store", () => import("@/player/exportProjectStoreShim"));

describe("exported player boot", () => {
  afterEach(() => {
    vi.unstubAllGlobals(); rendered.mockReset(); localStorage.clear();
    Reflect.deleteProperty(window, "__OPENRPG_BOOT__");
    document.body.replaceChildren(); history.replaceState(null, "", "/");
  });

  it("호스트가 새 접두사 네임스페이스를 주입하면 이 리스팅의 옛 세이브만 입양한다", async () => {
    vi.resetModules(); history.replaceState(null, "", "/play/listing-a/player.html");
    document.body.innerHTML = '<div id="app"></div>';
    const project = createBlankProject();
    const raw = serialize(project);
    Reflect.set(window, "__OPENRPG_BOOT__", { saveNamespace: "oprn-export:listing-a", qaInstrumentation: false });
    localStorage.setItem("rpgzzu-export:listing-a:save-slot:v5:1", "listing-a-legacy");
    localStorage.setItem("rpgzzu-export:listing-b:save-slot:v5:1", "listing-b-legacy");
    // 호스트 네임스페이스는 **번들(fetch)** 경로에서만 권위다 — 문서에 박힌(standalone) 프로젝트는 opened-file 로 부팅해
    // 자기 프로젝트 id 네임스페이스를 쓴다(resolveExportSaveNamespace 계약). 그래서 fetch 로 준다.
    const fetch = vi.fn().mockResolvedValue(new Response(raw)); vi.stubGlobal("fetch", fetch);
    const ready = new Promise<void>(resolve => rendered.mockImplementation(() => resolve()));
    await import("@/player/exportEntry"); await ready;
    expect(fetch).toHaveBeenCalledTimes(1);

    expect(localStorage.getItem("oprn-export:listing-a:save-slot:v5:1")).toBe("listing-a-legacy");
    expect(localStorage.getItem("rpgzzu-export:listing-a:save-slot:v5:1")).toBe("listing-a-legacy");
    expect(localStorage.getItem("oprn-export:listing-b:save-slot:v5:1")).toBeNull();
    expect(localStorage.getItem("rpgzzu-export:listing-b:save-slot:v5:1")).toBe("listing-b-legacy");
  });
});
