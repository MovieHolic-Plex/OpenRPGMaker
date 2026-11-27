import { describe, expect, it, vi } from "vitest";
import { BOOT_TIP_LINES, bootBriefLines } from "@/app/bootBrief";
import { desktopWindowChrome } from "@/app/windowChrome";
import { isWindowControlAction, windowChromeFor, WINDOW_CONTROL_ACTIONS } from "../electron/shared/windowControl";
import { firstShowSteps } from "../electron/main/windowShow";
import { isolateTimers } from "./mergedTeardown";

describe("bootBrief", () => {
  isolateTimers();
  const project = {
    meta: { title: "Medieval · 공용 타일과 AI 조립 참고" },
    maps: { a: {}, b: {}, c: {}, d: {} },
    tilesets: { t: {} },
    database: { items: [{}, {}] },
  };
  describe("bootBriefLines", () => {
    it("reads the open project when a model is connected", () => {
      expect(bootBriefLines(project, true)).toEqual([
        "Medieval · 공용 타일과 AI 조립 참고",
        "맵 4개 · 아이템 2개",
        "타일셋 1개",
      ]);
    });

    it("uses a title when the project name is blank", () => {
      expect(bootBriefLines({ ...project, meta: { title: "  " } }, true)[0]).toBe("제목 없는 프로젝트");
    });

    it("keeps feature names when no model is connected", () => {
      expect(bootBriefLines(project, false)).toEqual(BOOT_TIP_LINES);
    });
  });
});

describe("desktopWindowControls", () => {
  isolateTimers();
  describe("데스크톱 창 컨트롤 계약", () => {
    it("메인이 받는 동작은 네 가지뿐이고 그 밖은 모두 거절한다", () => {
      // Break: 렌더러가 보낸 임의 문자열(예: "destroy")을 그대로 창 메서드에 넘기면 닫기 절차를 우회한다.
      expect([...WINDOW_CONTROL_ACTIONS]).toEqual(["toggle-fullscreen", "minimize", "toggle-maximize", "close"]);
      for (const ok of WINDOW_CONTROL_ACTIONS) expect(isWindowControlAction(ok)).toBe(true);
      for (const bad of ["destroy", "quit", "maximize", "", undefined, null, 1, {}, ["close"]]) expect(isWindowControlAction(bad)).toBe(false);
    });

    it("아직 보이지 않은 창을 처음 보일 때 전체화면을 강제하지 않고 창 모드로 보인다", () => {
      // Break: 앱 실행 시 전체화면을 강제하면 사용자가 원하지 않아도 전체화면으로 열린다.
      expect(firstShowSteps("darwin")).toEqual(["show"]);
      expect(firstShowSteps("win32")).toEqual(["show"]);
      expect(firstShowSteps("linux")).toEqual(["show"]);
    });

    it("Windows·Linux 는 단추를 직접 그리고 macOS 는 OS 신호등을 쓴다", () => {
      // Break: macOS 에서도 오른쪽 단추를 그려 신호등과 이중이 된다.
      expect(windowChromeFor("win32")).toEqual({ platform: "win32", drawsOwnButtons: true });
      expect(windowChromeFor("linux")).toEqual({ platform: "linux", drawsOwnButtons: true });
      expect(windowChromeFor("freebsd")).toEqual({ platform: "linux", drawsOwnButtons: true });
      expect(windowChromeFor("darwin")).toEqual({ platform: "darwin", drawsOwnButtons: false });
    });

    it("브릿지가 없으면(브라우저·팀 페이지) 창 크롬을 만들지 않는다", () => {
      // Break: 브라우저에서 단추가 떠서 눌러도 아무 일도 안 일어난다.
      expect(desktopWindowChrome(undefined, { platform: "Win32", userAgent: "" })).toBeNull();
      expect(desktopWindowChrome({}, undefined)).toBeNull();
    });

    it("프리로드가 준 platform 을 우선하고, 없으면 navigator 로 추정한다", () => {
      const control = vi.fn(async () => true);
      expect(desktopWindowChrome({ windowControl: control, platform: "darwin" }, { platform: "Win32", userAgent: "" })).toMatchObject({ platform: "darwin", drawsOwnButtons: false });
      expect(desktopWindowChrome({ windowControl: control }, { platform: "MacIntel", userAgent: "" })).toMatchObject({ platform: "darwin" });
      expect(desktopWindowChrome({ windowControl: control }, { platform: "Win32", userAgent: "" })).toMatchObject({ platform: "win32", drawsOwnButtons: true });
      expect(desktopWindowChrome({ windowControl: control }, { platform: "Linux x86_64", userAgent: "" })).toMatchObject({ platform: "linux" });
    });
  });
});
