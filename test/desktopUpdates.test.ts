// test/desktopUpdates.test.ts
// 데스크톱 업데이트 판단(electron/main/updates.ts). electron 없이 가짜 업데이터로 상태 흐름을 고정한다.
import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { createUpdateController, resolveUpdateMode, type AutoUpdaterLike } from "../electron/main/updates";
import { compareVersions, normalizeFeedUrl, parseChannelVersion, type UpdateStatus } from "../electron/shared/updates";

const FEED = "https://updates.example.com/oprn";
const RELEASES = "https://github.com/MovieHolic-Plex/rpg-zzu/releases";

class FakeUpdater extends EventEmitter implements AutoUpdaterLike {
  autoDownload = false;
  autoInstallOnAppQuit = false;
  allowPrerelease = true;
  allowDowngrade = true;
  forceDevUpdateConfig = false;
  logger: unknown = null;
  feed: unknown = null;
  installs: [boolean | undefined, boolean | undefined][] = [];
  script: (updater: FakeUpdater) => void = () => {};
  setFeedURL(options: { provider: "generic"; url: string }): void { this.feed = options; }
  async checkForUpdates(): Promise<unknown> {
    this.emit("checking-for-update");
    this.script(this);
    return {};
  }
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void { this.installs.push([isSilent, isForceRunAfter]); }
}

function controller(overrides: Partial<Parameters<typeof createUpdateController>[0]> = {}) {
  const updater = new FakeUpdater();
  const seen: UpdateStatus[] = [];
  const created = createUpdateController({
    platform: "linux",
    packaged: true,
    appImagePath: "/home/u/OPRN Studio-0.39.0.AppImage",
    feedUrl: FEED,
    releasesUrl: RELEASES,
    currentVersion: "0.39.0",
    loadAutoUpdater: async () => updater,
    fetchText: async () => "version: 0.39.0\n",
    broadcast: (status) => seen.push(status),
    now: () => new Date("2026-09-28T00:00:00Z"),
    ...overrides,
  });
  return { created, updater, seen };
}

describe("업데이트 방식", () => {
  it("주소가 없거나 개발 실행이면 확인하지 않는다", () => {
    expect(resolveUpdateMode({ platform: "linux", packaged: true, appImagePath: "/a.AppImage", feedUrl: null })).toBe("unconfigured");
    expect(resolveUpdateMode({ platform: "linux", packaged: false, appImagePath: "/a.AppImage", feedUrl: FEED })).toBe("dev");
    expect(resolveUpdateMode({ platform: "linux", packaged: false, forceDev: true, appImagePath: "/a.AppImage", feedUrl: FEED })).toBe("auto");
  });

  it("스스로 바꿀 수 있는 것은 AppImage 뿐이다", () => {
    expect(resolveUpdateMode({ platform: "linux", packaged: true, appImagePath: "/a.AppImage", feedUrl: FEED })).toBe("auto");
    expect(resolveUpdateMode({ platform: "linux", packaged: true, appImagePath: null, feedUrl: FEED })).toBe("manual");
    expect(resolveUpdateMode({ platform: "win32", packaged: true, appImagePath: null, feedUrl: FEED })).toBe("manual");
    expect(resolveUpdateMode({ platform: "darwin", packaged: true, appImagePath: null, feedUrl: FEED })).toBe("manual");
  });

  it("주소가 없으면 check 가 상태를 바꾸지 않는다", async () => {
    const { created, seen } = controller({ feedUrl: null });
    expect(await created.check()).toEqual({ kind: "unavailable", reason: "unconfigured", releasesUrl: RELEASES });
    expect(seen).toEqual([]);
  });
});

describe("AppImage 자동 업데이트", () => {
  it("받는 중 → 준비됨 → 다시 시작해 적용", async () => {
    const { created, updater, seen } = controller();
    updater.script = (u) => {
      u.emit("update-available", { version: "0.40.0" });
      u.emit("download-progress", { percent: 41.6 });
      u.emit("download-progress", { percent: 41.9 });
    };
    expect(await created.check()).toMatchObject({ kind: "downloading", version: "0.40.0", percent: 42 });
    expect(updater).toMatchObject({ autoDownload: true, autoInstallOnAppQuit: true, allowPrerelease: false, allowDowngrade: false });
    expect(updater.feed).toEqual({ provider: "generic", url: FEED });
    // 같은 퍼센트는 다시 알리지 않는다.
    expect(seen.map((status) => status.kind)).toEqual(["checking", "checking", "downloading", "downloading"]);

    expect(created.canInstall()).toBe(false);
    updater.emit("update-downloaded", { version: "0.40.0" });
    expect(created.status()).toEqual({ kind: "ready", version: "0.40.0", releasesUrl: RELEASES });
    expect(created.installAndRelaunch()).toBe(true);
    expect(updater.installs).toEqual([[true, true]]);
  });

  it("받아 둔 뒤의 확인 실패는 준비됨을 지우지 않는다", async () => {
    const { created, updater } = controller();
    updater.script = (u) => u.emit("update-available", { version: "0.40.0" });
    await created.check();
    updater.emit("update-downloaded", { version: "0.40.0" });
    updater.emit("error", new Error("network down"));
    expect(created.status().kind).toBe("ready");
    // 받는 중·준비됨에서 다시 확인하면 또 받지 않는다.
    let checks = 0;
    updater.script = () => { checks += 1; };
    await created.check();
    expect(checks).toBe(0);
  });

  it("최신이면 idle, 오류면 첫 줄만 보인다", async () => {
    const latest = controller();
    latest.updater.script = (u) => u.emit("update-not-available", {});
    expect(await latest.created.check()).toEqual({ kind: "idle", checkedAt: "2026-09-28T00:00:00.000Z", releasesUrl: RELEASES });

    const broken = controller();
    broken.updater.script = (u) => u.emit("error", new Error("HttpError: 404\nstack…"));
    expect(await broken.created.check()).toEqual({ kind: "error", message: "HttpError: 404", releasesUrl: RELEASES });
  });
});

describe("스스로 못 바꾸는 설치(윈도우 zip·맥)", () => {
  it("새 버전이면 그 태그 페이지로 안내한다", async () => {
    const urls: string[] = [];
    const { created } = controller({
      platform: "win32",
      appImagePath: null,
      fetchText: async (url) => { urls.push(url); return "version: 0.40.0\nfiles:\n  - url: a.AppImage\n"; },
    });
    expect(await created.check()).toEqual({
      kind: "manual",
      version: "0.40.0",
      downloadUrl: `${RELEASES}/tag/v0.40.0`,
      releasesUrl: RELEASES,
    });
    expect(urls).toEqual([`${FEED}/latest-linux.yml`]);
    expect(created.installAndRelaunch()).toBe(false);
  });

  it("같거나 낮은 버전이면 조용하다", async () => {
    const { created } = controller({ platform: "darwin", appImagePath: null, fetchText: async () => "version: '0.38.0'\n" });
    expect((await created.check()).kind).toBe("idle");
  });

  it("동시에 여러 번 눌러도 한 번만 받는다", async () => {
    let calls = 0;
    const { created } = controller({ platform: "win32", appImagePath: null, fetchText: async () => { calls += 1; return "version: 0.40.0\n"; } });
    await Promise.all([created.check(), created.check(), created.check()]);
    expect(calls).toBe(1);
  });
});

describe("주소와 버전 규칙", () => {
  it("업데이트 주소는 https(또는 시험용 루프백 http)만 받는다", () => {
    expect(normalizeFeedUrl("https://updates.example.com/oprn/?x=1#y")).toBe("https://updates.example.com/oprn");
    expect(normalizeFeedUrl("http://127.0.0.1:8080/feed")).toBe("http://127.0.0.1:8080/feed");
    expect(normalizeFeedUrl("http://updates.example.com")).toBeNull();
    expect(normalizeFeedUrl("https://user:pw@updates.example.com")).toBeNull();
    expect(normalizeFeedUrl("file:///tmp/feed")).toBeNull();
    expect(normalizeFeedUrl("")).toBeNull();
  });

  it("채널 파일의 version 줄을 읽는다", () => {
    expect(parseChannelVersion("version: 0.40.0\npath: x\n")).toBe("0.40.0");
    expect(parseChannelVersion("version: '1.2.3-beta.1'\n")).toBe("1.2.3-beta.1");
    expect(parseChannelVersion("files: []\n")).toBeNull();
  });

  it("semver 순서 — 개발 빌드는 같은 코어의 정식판보다 낮다", () => {
    expect(compareVersions("0.40.0", "0.39.9")).toBeGreaterThan(0);
    expect(compareVersions("0.10.0", "0.9.0")).toBeGreaterThan(0);
    expect(compareVersions("0.40.0", "0.40.0-dev.3+gabc")).toBeGreaterThan(0);
    expect(compareVersions("0.40.0", "0.40.0")).toBe(0);
  });
});
