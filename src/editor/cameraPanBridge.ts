// 카메라 팬 브리지 — 캔버스 위 DOM 오버레이가 **가져오지 말아야 할** 제스처를 카메라에 넘긴다.
//
// 왜 필요한가: 오버레이는 포인터 이벤트의 표적이 되므로 그 아래 캔버스는 pointerdown 을 아예
// 받지 못한다. 그래서 로케이션 레이어가 켜져 있으면 「화면 밀기」 도구·스페이스 팬·가운데 버튼
// 드래그가 팬을 시작조차 못 하고, 그 드래그는 오버레이의 «빈 곳 그리기» 로 흘러 들어간다
// (2026-09-11 브라우저 실측: 맵을 밀려던 드래그가 로케이션 좌표를 3,3 → 7,5 로 옮겼다).
//
// 오버레이는 Phaser 를 모른다. 카메라와 팬 컨트롤러를 가진 EditScene 이 창구를 꽂고,
// 소비자는 함수만 부른다 — `regionClientRect` / `editorMapViewport` 와 같은 등록소 모양이다.
//
// 등록이 없으면(테스트·헤드리스) 항상 false 이고 팬도 시작되지 않는다 — 좌표를 지어내지 않는다.

export type CameraPanBridge = {
  /** 스페이스 팬이 켜졌거나 팬이 이미 진행 중인가. */
  readonly armed: () => boolean;
  /**
   * **이미 지나간** 화면 좌표를 기준으로 팬을 시작한다.
   *
   * 오버레이는 pointerdown 을 캔버스에 다시 던질 수 없다(표적이 이미 정해졌다). 대신 눌린
   * 좌표를 그대로 넘긴다 — 컨트롤러는 그 자리를 기준점으로 잡고 이후 이동은 window 가드로
   * 받으므로 손과 화면이 어긋나지 않는다(`startFromScreenPoint` 계약).
   */
  readonly startPan: (screenX: number, screenY: number) => void;
};

let bridge: CameraPanBridge | null = null;

export function setCameraPanBridge(next: CameraPanBridge | null): void {
  bridge = next;
}

export function cameraPanArmed(): boolean {
  if (!bridge) return false;
  try {
    return bridge.armed();
  } catch {
    // 씬이 내려가는 중에도 오버레이는 한 프레임 더 살아 있다. 그때는 카메라가 아니라
    // 오버레이의 규칙대로 두는 편이 안전하다(팬을 지어내지 않는다).
    return false;
  }
}

/** 팬을 시작했으면 true. 창구가 없으면 false 이고, 호출자는 제스처를 시작하지 않는다. */
export function startCameraPan(screenX: number, screenY: number): boolean {
  if (!bridge) return false;
  try {
    bridge.startPan(screenX, screenY);
    return true;
  } catch {
    return false;
  }
}
