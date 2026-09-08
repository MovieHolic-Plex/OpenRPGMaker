import { afterEach, expect, it, vi } from "vitest";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";
import { STARTER_DEFAULT_BGM_ID } from "@/assets/bgmStarterTracks";
import { audioPlayback } from "@/editor/panels/audioResourcePresentation";
import { createBlankProject } from "@/project/defaults";
import { listDatabaseResourceOptions } from "@/editor/panels/databaseResourcePickerDialog";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("advertises installed BGM only, consistently across catalog and picker without changing runtime identity", () => {
  const installed = findBgmRuntimeEntry(STARTER_DEFAULT_BGM_ID);
  if (!installed) throw new Error("Missing starter registry entry");
  vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", [installed.fileName]);
  vi.stubEnv("VITE_BGM_CDN_BASE", "");
  const project = createBlankProject();
  const catalog = listAudioResources("music", project);
  expect(catalog.filter(entry => findBgmRuntimeEntry(entry.id)).map(entry => entry.id)).toEqual([STARTER_DEFAULT_BGM_ID]);
  expect(listDatabaseResourceOptions("music", project).map(entry => entry.id)).toEqual(catalog.map(entry => entry.id));
  expect(findBgmRuntimeEntry("cc0-bgm-rtp-fld-001")).toBeDefined();
});
it("keeps the complete pack inventory with an explicit CDN", () => {
  vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", []);
  vi.stubEnv("VITE_BGM_CDN_BASE", "https://example.com");
  expect(listAudioResources("music", createBlankProject()).filter(entry => findBgmRuntimeEntry(entry.id))).toHaveLength(281);
});

it("does not advertise preview for an existing reference to an uninstalled pack entry", () => {
  vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", []);
  vi.stubEnv("VITE_BGM_CDN_BASE", "");
  const preview = audioPlayback("cc0-bgm-rtp-fld-001", createBlankProject());
  expect(preview.url).toMatch(/\.mp3$/);
  expect(preview.playable).toBe(false);
});
