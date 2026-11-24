/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { bgmNeedsDownload, listAudioResources } from "@/assets/audioResourceCatalog";
import { findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";
import { STARTER_DEFAULT_BGM_ID } from "@/assets/bgmStarterTracks";
import { audioPlayback } from "@/editor/panels/audioResourcePresentation";
import { listDatabaseResourceOptions } from "@/editor/panels/databaseResourcePickerDialog";
import { createBlankProject } from "@/project/defaults";

const catalogCount = (options: readonly { readonly id: string }[]): number => options.filter(entry => findBgmRuntimeEntry(entry.id)).length;

function installOnly(): void {
  const installed = findBgmRuntimeEntry(STARTER_DEFAULT_BGM_ID);
  if (!installed) throw new Error("Missing starter registry entry");
  vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", [installed.fileName]);
  vi.stubEnv("VITE_BGM_CDN_BASE", "");
}
function desktop(flag: boolean | undefined): void {
  window.oprn = { ...(flag === undefined ? {} : { bgmOnDemand: flag }) } as unknown as Window["oprn"];
}
afterEach(() => { delete window.oprn; vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("데스크톱 BGM 피커 — 카탈로그 전체를 받을 수 있음으로 본다", () => {
  it("데스크톱(on-demand)에서는 피커 옵션이 카탈로그 281곡 전부이고 앱에 없는 곡만 받기 필요다", () => {
    installOnly();
    desktop(true);
    const project = createBlankProject();
    expect(catalogCount(listDatabaseResourceOptions("music", project))).toBe(281);
    expect(catalogCount(listAudioResources("music", project))).toBe(281);
    expect(bgmNeedsDownload("cc0-bgm-rtp-fld-001")).toBe(true);
    expect(bgmNeedsDownload(STARTER_DEFAULT_BGM_ID)).toBe(false);
    expect(audioPlayback("cc0-bgm-rtp-fld-001", project).playable).toBe(true);
  });

  it("웹(브리지 없음)·플래그 없는 브리지는 설치된 곡만 보이고 배지도 없다", () => {
    installOnly();
    for (const flag of [undefined, false] as const) {
      if (flag === undefined) delete window.oprn; else desktop(flag);
      const project = createBlankProject();
      expect(catalogCount(listDatabaseResourceOptions("music", project))).toBe(1);
      expect(bgmNeedsDownload("cc0-bgm-rtp-fld-001")).toBe(false);
      expect(audioPlayback("cc0-bgm-rtp-fld-001", project).playable).toBe(false);
    }
    desktop(undefined);
    expect(catalogCount(listDatabaseResourceOptions("music", createBlankProject()))).toBe(1);
  });
});
