/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { openAudioTestDialog } from "@/editor/panels/audioTestDialog";
import type { BgmInstallStatus } from "@/editor/bgmInstallClient";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { stopAllAudio } from "@/player/audio";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { installPreviewMedia } from "./support/previewMedia";

vi.mock("@/assets/audioAiDescriptions", () => ({ getAudioAiDescription: () => undefined }));

const status = (over: Partial<BgmInstallStatus> = {}): BgmInstallStatus => ({
  expected: 281, installed: ["a.mp3"], installing: false,
  stagedBytes: 0, archiveBytes: 1304157696, remoteAllowed: true, error: null, ...over,
});

const jsonStatus = (value: BgmInstallStatus): Response =>
  new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });

let previous: Project;
beforeEach(() => {
  previous = store.getCurrent();
  store.replace(createBlankProject());
  vi.stubEnv("VITE_BGM_CDN_BASE", "");
  vi.stubGlobal("__OPRN_INSTALLED_BGM_FILES__", ["a.mp3"]);
  installPreviewMedia();
});
afterEach(() => {
  document.querySelector<HTMLButtonElement>('[data-testid="audio-test-close"]')?.click();
  stopAllAudio();
  document.body.replaceChildren();
  resetModalStackForTest();
  store.replace(previous);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("음악 탭에 미설치 곡이 있으면 전체 받기 배너를 보여준다", async () => {
  const { promise, resolve } = Promise.withResolvers<void>();
  const observer = new MutationObserver(() => {
    if (document.querySelector('[data-testid="bgm-install-button"]')?.textContent?.includes("전체 받기")) {
      observer.disconnect();
      resolve();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  try {
    vi.stubGlobal("fetch", vi.fn(async () => jsonStatus(status())));
    openAudioTestDialog();
    // 빈 껍질이 아니라 fetch 반영 후의 채워진 배너를 기다린다.
    await promise;
  } finally { observer.disconnect(); }
  expect(document.querySelector('[data-testid="bgm-install-status-text"]')?.textContent).toContain("281");
});

it("효과음 탭에서는 전체 받기 배너를 보여주지 않는다", async () => {
  const { promise, resolve } = Promise.withResolvers<void>();
  const observer = new MutationObserver(() => {
    if (document.querySelector('[data-testid="bgm-install-button"]')?.textContent?.includes("전체 받기")) {
      observer.disconnect();
      resolve();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  try {
    vi.stubGlobal("fetch", vi.fn(async () => jsonStatus(status())));
    openAudioTestDialog();
    await promise;
  } finally { observer.disconnect(); }
  document.querySelector<HTMLButtonElement>('[data-testid="audio-test-tab-sound"]')?.click();
  expect(document.querySelector('[data-testid="bgm-install-banner"]')).toBeNull();
});

it("전량 설치돼 있으면 음악 탭에도 배너가 없다", async () => {
  const installed = Array.from({ length: 281 }, (_unused, index) => `t${index}.mp3`);
  const { promise, resolve } = Promise.withResolvers<void>();
  let mounted = false;
  const observer = new MutationObserver(() => {
    // 배너가 먼저 붙었다가 fetch 반영 후 떨어지는 순서를 기다린다.
    if (document.querySelector('[data-testid="bgm-install-status-text"]') !== null) mounted = true;
    else if (mounted) {
      observer.disconnect();
      resolve();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  try {
    vi.stubGlobal("fetch", vi.fn(async () => jsonStatus(status({ installed }))));
    openAudioTestDialog();
    await promise;
  } finally { observer.disconnect(); }
  expect(document.querySelector('[data-testid="bgm-install-banner"]')).toBeNull();
});
