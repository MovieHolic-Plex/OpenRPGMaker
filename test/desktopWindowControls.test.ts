import { describe, expect, it, vi } from "vitest";
import { desktopWindowChrome } from "@/app/windowChrome";
import { isWindowControlAction, windowChromeFor, WINDOW_CONTROL_ACTIONS } from "../electron/shared/windowControl";
import { firstShowSteps } from "../electron/main/windowShow";

describe("데스크톱 창 컨트롤 계약", () => {
  it("메인이 받는 동작은 네 가지뿐이고 그 밖은 모두 거절한다", () => {
    // Break: 렌더러가 보낸 임의 문자열(예: "destroy")을 그대로 창 메서드에 넘기면 닫기 절차를 우회한다.
    expect([...WINDOW_CONTROL_ACTIONS]).toEqual(["toggle-fullscreen", "minimize", "toggle-maximize", "close"]);
    for (const ok of WINDOW_CONTROL_ACTIONS) expect(isWindowControlAction(ok)).toBe(true);
    for (const bad of ["destroy", "quit", "maximize", "", undefined, null, 1, {}, ["close"]]) expect(isWindowControlAction(bad)).toBe(false);
  });

  it("아직 보이지 않은 창은 맥에서 보인 뒤에, 그 밖에서는 보이기 전에 전체화면이 된다", () => {
    // Break: 리눅스에서 숨은 창에 전체화면을 나중에 걸면 창 모드로 먼저 뜨고, 맥에서 숨은 채 걸면 무시된다.
    expect(firstShowSteps("darwin")).toEqual(["show", "fullscreen"]);
    expect(firstShowSteps("win32")).toEqual(["fullscreen", "show"]);
    expect(firstShowSteps("linux")).toEqual(["fullscreen", "show"]);
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
