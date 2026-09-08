import { afterEach, expect, it, vi } from "vitest";
import { isBgmFileInstalled, setInstalledBgmFiles } from "@/assets/installedBgm";
import { isCatalogBgmAvailable } from "@/assets/audioResourceCatalog";
import { findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";

afterEach(() => { setInstalledBgmFiles(null); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("빌드타임 시드를 매 호출마다 읽는다 — 모듈 로드 시점에 고정하지 않는다", () => {
  vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", ["a.mp3"]);
  expect(isBgmFileInstalled("a.mp3")).toBe(true);
  expect(isBgmFileInstalled("b.mp3")).toBe(false);
  vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", ["b.mp3"]);
  expect(isBgmFileInstalled("b.mp3")).toBe(true);
});

it("define 이 없는 헤드리스 도구에서는 전량 설치로 본다", () => {
  vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", undefined);
  expect(isBgmFileInstalled("anything.mp3")).toBe(true);
});

it("런타임 override 가 시드를 이긴다 — 재시작 없이 재생 가능으로 뒤집힌다", () => {
  vi.stubEnv("VITE_BGM_CDN_BASE", "");
  vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", []);
  const entry = findBgmRuntimeEntry("cc0-bgm-rtp-fld-001");
  if (!entry) throw new Error("Missing registry entry");
  expect(isCatalogBgmAvailable("cc0-bgm-rtp-fld-001")).toBe(false);
  setInstalledBgmFiles([entry.fileName]);
  expect(isCatalogBgmAvailable("cc0-bgm-rtp-fld-001")).toBe(true);
});

it("override 를 null 로 되돌리면 시드로 복귀한다", () => {
  vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", ["seed.mp3"]);
  setInstalledBgmFiles(["runtime.mp3"]);
  expect(isBgmFileInstalled("seed.mp3")).toBe(false);
  setInstalledBgmFiles(null);
  expect(isBgmFileInstalled("seed.mp3")).toBe(true);
});
