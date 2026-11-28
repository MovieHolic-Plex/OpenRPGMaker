// test/appUpdate.test.ts
// 앱 자동 업데이트의 순수 판단(electron/shared/appUpdate.ts). 설치 형태 판정이 틀리면 portable 이 스스로를
// 지우려 하거나(설치판 경로), 설치판이 칩만 띄우고 끝난다. 실제 교체·재시작은 CI e2e(app-update-e2e.yml)가 본다.
import { describe, expect, it } from "vitest";
import {
  APP_UPDATE_FIRST_CHECK_MS,
  APP_UPDATE_INTERVAL_MS,
  appUpdateButtonView,
  appUpdateChipText,
  appUpdateIndicatorView,
  appUpdateModeFor,
  compareSemver,
  isSafeReleaseDownloadUrl,
  portableDownloadUrl,
  releasePageUrl,
  releasesLatestPageUrl,
  restoreLaunchEnv,
  snapshotLaunchEnv,
  summarizeReleaseNotes,
} from "../electron/shared/appUpdate";

describe("appUpdateModeFor", () => {
  it("윈도 portable 은 알리기만, 설치판은 자동", () => {
    expect(appUpdateModeFor({ platform: "win32", isPackaged: true, env: { PORTABLE_EXECUTABLE_FILE: "C:\\a.exe" } })).toBe("manual");
    expect(appUpdateModeFor({ platform: "win32", isPackaged: true, env: {} })).toBe("auto");
  });

  it("리눅스는 AppImage 로 켰을 때만 자동이고, 개발 실행·맥은 끈다", () => {
    expect(appUpdateModeFor({ platform: "linux", isPackaged: true, env: { APPIMAGE: "/x/OPRN.AppImage" } })).toBe("auto");
    expect(appUpdateModeFor({ platform: "linux", isPackaged: true, env: {} })).toBe("off");
    expect(appUpdateModeFor({ platform: "win32", isPackaged: false, env: {} })).toBe("off");
    expect(appUpdateModeFor({ platform: "darwin", isPackaged: true, env: {} })).toBe("off");
  });
});

describe("appUpdateChipText", () => {
  it("다 받았을 때와 portable 새 판일 때만 칩을 띄운다", () => {
    expect(appUpdateChipText({ kind: "ready", version: "0.420.0" })).toBe("v0.420 준비됨 · 다시 시작");
    expect(appUpdateChipText({ kind: "available", version: "0.420.0", downloadUrl: portableDownloadUrl("0.420.0") })).toBe("새 버전 있음 · 내려받기");
    expect(appUpdateChipText({ kind: "downloading", version: "0.420.0" })).toBeNull();
    expect(appUpdateChipText({ kind: "idle" })).toBeNull();
  });

  it("portable 링크는 그 판의 고정 이름 exe 다", () => {
    expect(portableDownloadUrl("v0.420.0")).toBe("https://github.com/MovieHolic-Plex/OpenRPGMaker/releases/download/v0.420.0/OPRN.Studio-windows.exe");
  });
});

describe("summarizeReleaseNotes", () => {
  it("GitHub 피드 HTML 의 「주요 변경」 절에서 항목만 최대 3개 뽑고 PR 번호를 뗀다", () => {
    const html = "<h2>주요 변경</h2><ul><li>앱 안 자동 업데이트 (#5010)</li><li><strong>윈도</strong> 설치판</li><li>셋</li><li>넷</li></ul><h2>개발</h2><ul><li>내부</li></ul>";
    expect(summarizeReleaseNotes(html)).toEqual(["앱 안 자동 업데이트", "윈도 설치판", "셋"]);
  });

  it("「주요 변경」 절이 끝나면 다음 절 항목을 가져오지 않는다", () => {
    expect(summarizeReleaseNotes("## 주요 변경\n- 하나\n## 개발\n- 내부")).toEqual(["하나"]);
  });

  it("릴리스 본문 항목 끝의 PR 번호와 커밋 해시를 함께 뗈다", () => {
    expect(summarizeReleaseNotes("## 주요 변경\n- ai — 영역 지시에 다리를 더한다 (#5084) (e875d17)")).toEqual(["ai — 영역 지시에 다리를 더한다"]);
  });

  it("긴 한국어 릴리스 노트 문장도 70자에서 잘리지 않고 최대 140자까지 보존한다", () => {
    const longLine = "새 버전이 있으면 편집기와 시작 화면 오른쪽 상단에 녹색 업데이트 아이콘이 뜨고, 클릭하면 중앙 대화상자로 이번 변경 내역을 쾌적하게 확인할 수 있습니다";
    expect(summarizeReleaseNotes(`## 주요 변경\n- ${longLine}`)).toEqual([longLine]);
  });

  it("항목이 없거나 본문이 아니면 빈 배열", () => {
    expect(summarizeReleaseNotes("그냥 문장")).toEqual([]);
    expect(summarizeReleaseNotes(null)).toEqual([]);
  });
});

describe("restoreLaunchEnv", () => {
  it("새 판에 물려줄 환경에서 실행이 쓴 경로는 지우고 켜질 때 값은 돌려놓는다", () => {
    const launch = snapshotLaunchEnv({ OPRN_RENDERER_DIR: "/user/dist" });
    const env: Record<string, string | undefined> = {
      PATH: "/bin",
      OPRN_OH_MY_PI_WORKER_BIN: "/tmp/.mount_old/resources/app.asar.unpacked/dist-electron/oh-my-pi-worker",
      OPRN_RENDERER_DIR: "/tmp/.mount_old/resources/app.asar/dist",
    };
    restoreLaunchEnv(env, launch);
    expect(env).toEqual({ PATH: "/bin", OPRN_RENDERER_DIR: "/user/dist" });
  });
});

describe("compareSemver", () => {
  it("v 접두사와 프리릴리스를 포함해 버전을 비교한다", () => {
    expect(compareSemver("0.421.0", "0.420.0")).toBeGreaterThan(0);
    expect(compareSemver("v0.420.0", "0.420.0")).toBe(0);
    expect(compareSemver("0.420.0", "0.420.0-dev.1")).toBeGreaterThan(0);
    expect(compareSemver("0.420.0-beta.2", "0.420.0-beta.10")).toBeLessThan(0);
    expect(compareSemver("0.419.9", "0.420.0")).toBeLessThan(0);
  });
});

describe("isSafeReleaseDownloadUrl", () => {
  it("공식 저장소 릴리스 주소만 허용한다", () => {
    expect(isSafeReleaseDownloadUrl(portableDownloadUrl("0.420.0"))).toBe(true);
    expect(isSafeReleaseDownloadUrl(releasesLatestPageUrl())).toBe(true);
    expect(isSafeReleaseDownloadUrl("https://evil.example/OPRN.exe")).toBe(false);
  });
});

describe("appUpdateButtonView", () => {
  const base = { mode: "auto" as const, enabled: true, currentVersion: "0.420.0" };

  it("상태별 버튼 문구·활성·동작을 일관되게 돌려준다", () => {
    expect(appUpdateButtonView({ ...base, state: { kind: "idle" } })).toMatchObject({
      label: "업데이트 확인", action: "check", disabled: false,
    });
    expect(appUpdateButtonView({ ...base, state: { kind: "checking" } })).toMatchObject({
      label: "확인 중…", action: "none", disabled: true,
    });
    expect(appUpdateButtonView({ ...base, state: { kind: "downloading", version: "0.421.0", percent: 42.4 } })).toMatchObject({
      label: "내려받는 중 42%", action: "none", disabled: true,
    });
    expect(appUpdateButtonView({ ...base, state: { kind: "ready", version: "0.421.0" } })).toMatchObject({
      label: "v0.421 다시 시작", action: "install", disabled: false,
    });
    expect(appUpdateButtonView({ ...base, state: { kind: "available", version: "0.421.0", downloadUrl: releasesLatestPageUrl() } })).toMatchObject({
      label: "v0.421 내려받기", action: "download", disabled: false,
    });
    expect(appUpdateButtonView({ ...base, state: { kind: "up-to-date", checkedAt: 1 } })).toMatchObject({
      label: "업데이트 확인", detail: "최신 버전이에요 (v0.420)", action: "check", disabled: false,
    });
    expect(appUpdateButtonView({ ...base, state: { kind: "error", message: "네트워크 오류" } })).toMatchObject({
      label: "다시 확인", detail: "네트워크 오류", action: "check", disabled: false,
    });
  });

  it("자동 업데이트 확인 주기는 시작 15초 후·이후 15분 간격이다", () => {
    expect(APP_UPDATE_FIRST_CHECK_MS).toBe(15_000);
    expect(APP_UPDATE_INTERVAL_MS).toBe(15 * 60 * 1000);
  });
});

describe("appUpdateIndicatorView", () => {
  it("새 버전 감지·다운로드·준비 상태에서만 오른쪽 상단 녹색 아이콘과 변경 사항 정보를 돌려준다", () => {
    expect(appUpdateIndicatorView({ kind: "idle" })).toBeNull();
    expect(appUpdateIndicatorView({ kind: "checking" })).toBeNull();
    expect(appUpdateIndicatorView({ kind: "up-to-date", checkedAt: 1 })).toBeNull();
    expect(appUpdateIndicatorView({ kind: "error", message: "네트워크 오류" })).toBeNull();
    expect(appUpdateIndicatorView({ kind: "downloading", version: "0.421.0", percent: 42.4, releaseNotes: ["자동 저장 개선"] })).toMatchObject({
      kind: "downloading",
      version: "0.421",
      percent: 42,
      label: "새 버전 v0.421 내려받는 중 (42%)",
      notes: ["자동 저장 개선"],
      releaseUrl: releasePageUrl("0.421.0"),
      action: "info",
    });
    expect(appUpdateIndicatorView({ kind: "downloading", version: "0.421.0" })).toMatchObject({
      kind: "downloading",
      version: "0.421",
      percent: null,
      label: "새 버전 v0.421 내려받는 중…",
      notes: [],
      action: "info",
    });
    expect(appUpdateIndicatorView({ kind: "ready", version: "0.421.0", releaseNotes: ["새 UI", "버그 수정"] })).toMatchObject({
      kind: "ready",
      version: "0.421",
      label: "새 버전 v0.421 준비됨 · 변경 사항 보기",
      notes: ["새 UI", "버그 수정"],
      releaseUrl: "https://github.com/MovieHolic-Plex/OpenRPGMaker/releases/tag/v0.421.0",
      action: "install",
    });
    expect(appUpdateIndicatorView({ kind: "available", version: "0.421.0", downloadUrl: portableDownloadUrl("0.421.0") })).toMatchObject({
      kind: "available",
      version: "0.421",
      label: "새 버전 v0.421 있음 · 변경 사항 보기",
      notes: [],
      action: "download",
    });
  });
});
