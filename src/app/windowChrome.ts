// 데스크톱 앱 창의 제목줄 방식 — 렌더러가 읽는 쪽. 결정 표는 electron/shared/windowControl.ts 와 같다.
// 브라우저·팀 페이지에는 window.oprn.windowControl 이 없으므로 null 을 돌려 단추를 만들지 않는다.
import type { WindowControlAction, WindowPlatform } from "../../electron/shared/windowControl";

export type DesktopWindowChrome = {
  readonly platform: WindowPlatform;
  /** true 면 렌더러가 최소화·최대화·전체화면·닫기를 그린다(Windows·Linux). false 면 OS 신호등(macOS). */
  readonly drawsOwnButtons: boolean;
  readonly control: (action: WindowControlAction) => Promise<boolean>;
};

type PlatformProbe = { readonly platform?: string; readonly userAgent?: string };

/** 프리로드가 platform 을 주지 못한 옛 브릿지용 보조 판정. */
function guessPlatform(nav: PlatformProbe | undefined): WindowPlatform {
  const probe = `${nav?.platform ?? ""} ${nav?.userAgent ?? ""}`.toLowerCase();
  if (/mac|iphone|ipad/.test(probe)) return "darwin";
  return /win/.test(probe) ? "win32" : "linux";
}

export function desktopWindowChrome(
  bridge: { readonly windowControl?: DesktopWindowChrome["control"]; readonly platform?: WindowPlatform } | undefined =
    typeof window === "undefined" ? undefined : window.oprn,
  nav: PlatformProbe | undefined = typeof navigator === "undefined" ? undefined : navigator,
): DesktopWindowChrome | null {
  const control = bridge?.windowControl;
  if (!control) return null;
  const platform = bridge?.platform ?? guessPlatform(nav);
  return { platform, drawsOwnButtons: platform !== "darwin", control };
}
