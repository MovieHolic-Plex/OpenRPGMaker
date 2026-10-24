// 지금 플레이 중인 게임의 터치 조작 설정: 플레이어 기기 설정 > 게임 저작 값(system.touchControls) > 기본값.
import { store } from "@/project/store";
import { getPlayerPreferences } from "@/player/playerPreferences";
import { resolveTouchControls, type ResolvedTouchControls } from "@/project/touchControls";

export function currentTouchControls(): ResolvedTouchControls {
  const prefs = getPlayerPreferences();
  return resolveTouchControls(store.getCurrent().system.touchControls, {
    ...(prefs.touchTapToMove !== undefined ? { tapToMove: prefs.touchTapToMove } : {}),
    ...(prefs.touchStick !== undefined ? { stick: prefs.touchStick } : {}),
    ...(prefs.touchHaptics !== undefined ? { haptics: prefs.touchHaptics } : {}),
  });
}
