// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openAudioTestDialog } from "@/editor/panels/audioTestDialog";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { store } from "@/project/store";
import { audioSearchProject, audioElement, AUDIO_SEARCH_ID } from "./support/audioSearchFixture";
import { installPreviewMedia, mediaEvent, mediaMetadata, previewMedia } from "./support/previewMedia";
import { openDatabaseResourcePickerDialog, resourcePickerControl, listDatabaseResourceOptions } from "@/editor/panels/databaseResourcePickerDialog";
import { createAudioDescriptionDetail } from "@/editor/panels/audioDescriptionDetail";
import { listAudioResources, bgmNeedsDownload } from "@/assets/audioResourceCatalog";
import { getAudioEngine } from "@/player/audio";
import { retainDatabasePreviewsIn, setDatabasePreviewsActiveIn } from "@/editor/panels/databasePreviewLifecycle";
import { bgmInstallBanner } from "@/editor/panels/bgmInstallBanner";
import type { BgmInstallStatus } from "@/editor/bgmInstallClient";
import { setInstalledBgmFiles } from "@/assets/installedBgm";
import { createBlankProject } from "@/project/defaults";
import { BGM_CATALOG_TRACK_COUNT, bgmCatalogResourceIds, findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";
import { STARTER_DEFAULT_BGM_ID } from "@/assets/bgmStarterTracks";
import { audioPlayback } from "@/editor/panels/audioResourcePresentation";
import { isolateTimers } from "./mergedTeardown";

describe("audioPreviewSurfaces", () => {
  isolateTimers();
  const disposals: (() => void)[] = [];
  const previous = store.getCurrent();
  beforeEach(() => { store.replace(audioSearchProject()); installPreviewMedia(); });
  afterEach(() => {
    document.querySelector<HTMLButtonElement>('[data-testid="audio-test-close"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="preview-picker-cancel"]')?.click();
    disposals.splice(0).forEach(dispose => dispose());
    document.body.replaceChildren();
    resetModalStackForTest();
    store.replace(previous);
    vi.restoreAllMocks();
  });
  function openSurface(surface: "dialog" | "manager" | "picker"): string {
    switch (surface) {
      case "dialog":
        openAudioTestDialog();
        document.querySelector<HTMLButtonElement>(`[data-testid="audio-test-list"] [data-resource-id="${AUDIO_SEARCH_ID}"]`)?.click();
        return "audio-test";
      case "manager": {
        const resource = listAudioResources("music", store.getCurrent()).find(entry => entry.id === AUDIO_SEARCH_ID);
        if (!resource) throw new Error("Audio fixture missing");
        const detail = createAudioDescriptionDetail(resource, { import: vi.fn(), save: vi.fn(), reset: vi.fn(), delete: vi.fn() });
        document.body.append(detail.element); disposals.push(detail.dispose);
        return "audio-description-preview";
      }
      case "picker":
        openDatabaseResourcePickerDialog({ kind: "music", title: "Audio", currentId: AUDIO_SEARCH_ID, testidPrefix: "preview-picker", onConfirm: vi.fn() });
        return "db-resource-picker-audio";
    }
  }
  describe.each(["dialog", "manager", "picker"] as const)("common transport in %s", surface => {
    it("plays on the first click during metadata loading, then pauses and seeks from media state", async () => {
      const prefix = openSurface(surface);
      const media = previewMedia();
      const play = audioElement(document, "button", `${prefix}-play`);
      media.dispatchEvent(new Event("loadstart"));
      expect(play.getAttribute("aria-pressed")).toBe("false");
      const requested = mediaEvent(media, "play");
      play.click(); await requested;
      expect(play.getAttribute("aria-pressed")).toBe("false");
      media.dispatchEvent(new Event("playing"));
      expect(play.getAttribute("aria-pressed")).toBe("true");
      mediaMetadata(media, 0.18);
      expect(audioElement(document, "output", `${prefix}-time`).textContent).toContain("0:00.18");
      const seek = audioElement(document, "input", `${prefix}-seek`);
      seek.value = "0.1"; seek.dispatchEvent(new Event("input"));
      expect(media.currentTime).toBe(0.1);
      const paused = mediaEvent(media, "pause"); play.click(); await paused;
      expect(play.getAttribute("aria-pressed")).toBe("false");
      expect(document.querySelector(`[data-testid="${prefix}-transport"]`)?.getAttribute("data-state")).toBe("paused");
    });
    it("does not touch gameplay audio when settings, playback and stop are used", async () => {
      const engine = getAudioEngine();
      const before = engine.audioStateSnapshot();
      const gamePlay = vi.spyOn(engine, "play"); const gameStop = vi.spyOn(engine, "stopAll");
      const prefix = openSurface(surface);
      const media = previewMedia();
      const requested = mediaEvent(media, "play");
      audioElement(document, "button", `${prefix}-play`).click(); await requested;
      media.dispatchEvent(new Event("playing"));
      for (const [id, value] of [["volume", "40"], ["tempo", "135"], ["fade", "4"]]) {
        const input = document.querySelector<HTMLInputElement>(`[data-testid="${prefix}-${id}"] input`);
        if (!input) throw new Error("Preview slider missing");
        input.value = value ?? ""; input.dispatchEvent(new Event("input"));
      }
      expect(media.volume).toBe(0.4); expect(media.playbackRate).toBe(1.35);
      audioElement(document, "button", `${prefix}-stop`).click();
      expect(engine.audioStateSnapshot()).toEqual(before);
      expect(gamePlay).not.toHaveBeenCalled(); expect(gameStop).not.toHaveBeenCalled();
    });
  });
  it("keeps authored description reset unique and typing keys native", () => {
    openSurface("manager");
    expect(document.querySelectorAll('[data-testid="audio-description-reset"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="audio-description-preview-reset"]')).toHaveLength(1);
    const input = audioElement(document, "textarea", "audio-description-input");
    input.focus();
    for (const key of [" ", "ArrowLeft", "ArrowRight"]) {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      input.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
    }
  });
  it("keeps only one selected picker media and preserves it through search", () => {
    openSurface("picker");
    const media = previewMedia();
    const search = audioElement(document, "input", "preview-picker-search");
    search.value = "empty-results-9999"; search.dispatchEvent(new Event("input"));
    expect(previewMedia()).toBe(media);
    expect(document.querySelectorAll("audio")).toHaveLength(1);
    expect(document.querySelector('[data-testid="preview-picker-list"] audio')).toBeNull();
  });
  it("stops a picker selection even when the next resource resolves to the same URL", async () => {
    const project = store.getCurrent();
    const original = project.assets.uploaded[AUDIO_SEARCH_ID];
    if (!original) throw new Error("Audio fixture missing");
    store.replace({ ...project, assets: { ...project.assets, uploaded: { ...project.assets.uploaded, alias: { ...original, id: "alias", name: "alias" } } } });
    openSurface("picker");
    const media = previewMedia();
    const requested = mediaEvent(media, "play");
    audioElement(document, "button", "db-resource-picker-audio-play").click(); await requested;
    const paused = mediaEvent(media, "pause");
    audioElement(document, "button", "preview-picker-option-alias").click(); await paused;
    expect(media.hasAttribute("src")).toBe(false);
    expect(previewMedia()).not.toBe(media);
    expect(audioElement(document, "button", "db-resource-picker-audio-play").getAttribute("aria-pressed")).toBe("false");
  });
  it("stops a playing dialog preview when its surface is concealed and does not resume it", async () => {
    openAudioTestDialog();
    document.querySelector<HTMLButtonElement>(`[data-testid="audio-test-list"] [data-resource-id="${AUDIO_SEARCH_ID}"]`)?.click();
    const media = previewMedia();
    const requested = mediaEvent(media, "play");
    audioElement(document, "button", "audio-test-play").click();
    await requested;
    media.dispatchEvent(new Event("playing"));
    const transport = document.querySelector<HTMLElement>("[data-testid='audio-test-transport']");
    if (!transport) throw new Error("transport missing");
    const paused = mediaEvent(media, "pause");
    setDatabasePreviewsActiveIn(transport, false);
    await paused;
    expect(media.paused).toBe(true);
    setDatabasePreviewsActiveIn(transport, true);
    expect(media.paused).toBe(true);
    expect(media.hasAttribute("src")).toBe(true);
  });
  it("keeps inline preview media when a retained field leaves the document", async () => {
    const control = resourcePickerControl({ label: "Audio", kind: "music", resourceId: AUDIO_SEARCH_ID, testid: "inline-audio", onChange: vi.fn(), rerender: vi.fn() });
    document.body.append(control);
    const media = previewMedia();
    const requested = mediaEvent(media, "play");
    audioElement(document, "button", "db-resource-picker-audio-play").click();
    await requested;
    media.dispatchEvent(new Event("playing"));
    retainDatabasePreviewsIn(control, true);
    const paused = mediaEvent(media, "pause");
    setDatabasePreviewsActiveIn(control, false);
    await paused;
    control.remove();
    await new Promise<void>((resolve) => { queueMicrotask(resolve); });
    expect(media.paused).toBe(true);
    expect(media.hasAttribute("src")).toBe(true);
  });
  it("releases playing inline media when the owning DOM is replaced", async () => {
    const control = resourcePickerControl({ label: "Audio", kind: "music", resourceId: AUDIO_SEARCH_ID, testid: "inline-audio", onChange: vi.fn(), rerender: vi.fn() });
    document.body.append(control);
    const media = previewMedia();
    const requested = mediaEvent(media, "play");
    audioElement(document, "button", "db-resource-picker-audio-play").click(); await requested;
    media.dispatchEvent(new Event("playing"));
    const paused = mediaEvent(media, "pause");
    control.replaceWith(document.createElement("div")); await paused;
    expect(media.hasAttribute("src")).toBe(false);
  });
  it("stops an active picker when another editor preview starts", async () => {
    openSurface("picker"); const old = previewMedia();
    const first = mediaEvent(old, "play");
    audioElement(document, "button", "db-resource-picker-audio-play").click(); await first;
    old.dispatchEvent(new Event("playing"));
    openSurface("dialog");
    const paused = mediaEvent(old, "pause"); audioElement(document, "button", "audio-test-play").click(); await paused;
    expect(old.paused).toBe(true);
  });
  it("exposes an idle seekable transport without autoplay when a dialog resource is selected", () => {
    // Given: the actual existing dialog, not a mocked component.
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    openAudioTestDialog();
    // When
    document.querySelector<HTMLButtonElement>(
      '[data-testid="audio-test-list"] [data-resource-id="' + AUDIO_SEARCH_ID + '"]',
    )?.click();
    // Then: this assertion fails on the current UI because seek does not exist.
    expect(document.querySelector('[data-testid="audio-test-seek"]')).not.toBeNull();
    expect(audioElement(document, "button", "audio-test-play").disabled).toBe(false);
    expect(play).not.toHaveBeenCalled();
  });
});

describe("bgmInstallBanner", () => {
  isolateTimers();
  const status = (over: Partial<BgmInstallStatus> = {}): BgmInstallStatus => ({
    expected: 281, installed: ["a.mp3"], installing: false,
    stagedBytes: 0, archiveBytes: 1304157696, remoteAllowed: true, error: null, ...over,
  });
  const find = (banner: HTMLElement | null, testid: string) =>
    banner?.querySelector(`[data-testid=${testid}]`) ?? null;
  afterEach(() => {
    for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-testid="db-resource-picker-cancel"]')) button.click();
    document.body.replaceChildren();
    setInstalledBgmFiles(null); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });
  it("음악이 아닌 종류에는 배너를 그리지 않는다", () => {
    expect(bgmInstallBanner({ kind: "sound", onInstalled: () => {}, status: status() })).toBeNull();
  });
  it("미설치 곡 수와 받을 용량을 보여준다", () => {
    const banner = bgmInstallBanner({ kind: "music", onInstalled: () => {}, status: status() });
    expect(find(banner, "bgm-install-status-text")?.textContent).toContain("281");
    expect(find(banner, "bgm-install-button")).toBeTruthy();
  });
  it("전량 설치돼 있으면 배너 자체가 없다", () => {
    const installed = Array.from({ length: 281 }, (_unused, index) => `t${index}.mp3`);
    expect(bgmInstallBanner({ kind: "music", onInstalled: () => {}, status: status({ installed }) })).toBeNull();
  });
  it("status 를 못 읽는 환경(정적 배포)에서는 배너가 없다", () => {
    expect(bgmInstallBanner({ kind: "music", onInstalled: () => {}, status: null })).toBeNull();
  });
  it("원격 차단이면 버튼을 잠그고 opt-in 방법을 알려준다", () => {
    const banner = bgmInstallBanner({ kind: "music", onInstalled: () => {}, status: status({ remoteAllowed: false }) });
    expect(banner?.querySelector<HTMLButtonElement>("[data-testid=bgm-install-button]")?.disabled).toBe(true);
    expect(find(banner, "bgm-install-error")?.textContent).toContain("OPRN_BGM_INSTALL_REMOTE");
  });
  it("서버가 보낸 오류를 그대로 보여준다", () => {
    const banner = bgmInstallBanner({ kind: "music", onInstalled: () => {}, status: status({ error: "gh 실행 실패" }) });
    expect(find(banner, "bgm-install-error")?.textContent).toContain("gh 실행 실패");
  });
  it("다운로드가 끝나고 검증 단계에 들어가면 문구가 바뀐다", () => {
    const banner = bgmInstallBanner({ kind: "music", onInstalled: () => {},
      status: status({ installing: true, stagedBytes: 1304157696 }) });
    expect(find(banner, "bgm-install-status-text")?.textContent).toContain("검증");
  });
  it("설치 중에만 취소 버튼을 내놓는다", () => {
    const idle = bgmInstallBanner({ kind: "music", onInstalled: () => {}, status: status() });
    expect(find(idle, "bgm-install-cancel")).toBeNull();
    const busy = bgmInstallBanner({ kind: "music", onInstalled: () => {}, status: status({ installing: true }) });
    expect(find(busy, "bgm-install-cancel")).toBeTruthy();
  });
  it("설치 반영 후 리소스 목록이 다시 만들어지면 항목이 늘어난다", () => {
    vi.stubEnv("VITE_BGM_CDN_BASE", "");
    vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", []);
    const project = createBlankProject();
    const before = listDatabaseResourceOptions("music", project).length;
    const everyFileName = bgmCatalogResourceIds()
      .map(id => findBgmRuntimeEntry(id)?.fileName)
      .filter((name): name is string => name !== undefined);
    expect(everyFileName).toHaveLength(BGM_CATALOG_TRACK_COUNT);
    setInstalledBgmFiles(everyFileName);
    expect(listDatabaseResourceOptions("music", project).length - before).toBe(BGM_CATALOG_TRACK_COUNT);
  });
  it.each([4, BGM_CATALOG_TRACK_COUNT])("reopening the real picker applies the live %i-file inventory before updating rows", async count => {
    vi.stubEnv("VITE_BGM_CDN_BASE", "");
    vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", []);
    store.replace(createBlankProject());
    const ids = bgmCatalogResourceIds();
    const installed = ids.slice(0, count).map(id => findBgmRuntimeEntry(id)!.fileName);
    // The first opening sees the build snapshot; installation finishes while it is closed.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    openDatabaseResourcePickerDialog({ kind: "music", title: "BGM", onConfirm: () => {} });
    document.querySelector<HTMLButtonElement>('[data-testid="db-resource-picker-cancel"]')!.click();

    let respond!: (response: Response) => void;
    const response = new Promise<Response>(resolve => { respond = resolve; });
    vi.stubGlobal("fetch", vi.fn(() => response));
    openDatabaseResourcePickerDialog({ kind: "music", title: "BGM", onConfirm: () => {} });
    const list = document.querySelector<HTMLElement>('[data-testid="db-resource-picker-list"]')!;
    const catalogRows = () => ids.filter(id => list.querySelector(`[data-testid="db-resource-picker-option-${id}"]`));
    expect(catalogRows()).toHaveLength(0);
    // Subscribe before releasing the response; await the banner's actual render/removal, not time.
    const rendered = new Promise<void>(resolve => {
      const observer = new MutationObserver(() => { observer.disconnect(); resolve(); });
      observer.observe(list.closest('[role="dialog"]')!, { childList: true, subtree: true });
    });
    respond(new Response(JSON.stringify(status({ installed })), { headers: { "Content-Type": "application/json" } }));
    await rendered;
    expect(listDatabaseResourceOptions("music", store.getCurrent()).filter(entry => ids.includes(entry.id))).toHaveLength(count);
    expect(catalogRows()).toHaveLength(count);
    expect(document.querySelector('[data-testid="bgm-install-banner"]') === null).toBe(count === BGM_CATALOG_TRACK_COUNT);
  });
});

describe("bgmOnDemandPicker", () => {
  isolateTimers();
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
});
