/** @vitest-environment happy-dom */
import { afterEach, expect, it, vi } from "vitest";
import { bgmInstallBanner } from "@/editor/panels/bgmInstallBanner";
import type { BgmInstallStatus } from "@/editor/bgmInstallClient";
import { setInstalledBgmFiles } from "@/assets/installedBgm";
import { listDatabaseResourceOptions, openDatabaseResourcePickerDialog } from "@/editor/panels/databaseResourcePickerDialog";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
// 파일명은 BGM_CATALOG 가 아니라 런타임 레지스트리에 있다. BGM_RUNTIME_ENTRIES 는
// 모듈 내부 const 라 export 되지 않으므로 접근자 두 개를 조합해서 얻는다.
import { BGM_CATALOG_TRACK_COUNT, bgmCatalogResourceIds, findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";

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
