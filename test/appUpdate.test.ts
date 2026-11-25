// test/appUpdate.test.ts
// 앱 자동 업데이트의 순수 판단(electron/shared/appUpdate.ts). 설치 형태 판정이 틀리면 portable 이 스스로를
// 지우려 하거나(설치판 경로), 설치판이 칩만 띄우고 끝난다. 실제 교체·재시작은 CI e2e(app-update-e2e.yml)가 본다.
import { describe, expect, it } from "vitest";
import { appUpdateChipText, appUpdateModeFor, portableDownloadUrl, summarizeReleaseNotes } from "../electron/shared/appUpdate";

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

  it("항목이 없거나 본문이 아니면 빈 배열", () => {
    expect(summarizeReleaseNotes("그냥 문장")).toEqual([]);
    expect(summarizeReleaseNotes(null)).toEqual([]);
  });
});
