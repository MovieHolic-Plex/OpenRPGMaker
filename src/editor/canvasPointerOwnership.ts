// editor/canvasPointerOwnership.ts
// 캔버스 포인터 제스처 소유권 판정기 — 순수 모듈.
//
// DOM·Phaser·store·editorState 에 직접 접근하지 않고, 넘겨받은 상태만으로
// 오버레이가 삼킨 pointerdown 을 캔버스가 가져가야 하는지(팬인지, 영역 제스처인지),
// 아니면 오버레이 자신의 것(null)인지를 단 한 곳에서 결정한다.

export type CanvasGestureOwner = "pan" | "region" | "scene";

export type CanvasPointerDescriptor = {
  readonly button: number;
  readonly buttons: number;
};

export type CanvasOwnershipInput = {
  readonly pointer: CanvasPointerDescriptor;
  /** 붙여넣기 미리보기가 떠 있는가(클립보드 고스트 커서 추종 중). */
  readonly pastePreviewActive: boolean;
  /** 스페이스 팬이 켜졌거나 팬이 진행 중인가(CameraPanController.armed()). */
  readonly panArmed: boolean;
  readonly tool: "paint" | "fill" | "collision" | "event" | "erase" | "select" | "eyedropper" | "pan" | "relief";
  readonly selectionActive: boolean;
  readonly paletteStampActive: boolean;
  readonly deferCameraFocus: boolean;
  /** 눌린 칸이 맵 안인가(밖이면 false). */
  readonly tileInMapBounds: boolean;
};

/**
 * 이 pointerdown 을 캔버스가 가져가야 하면 그 종류("pan" | "region" | "scene"),
 * 아니면 null(오버레이의 것)을 반환한다.
 *
 * 판정 순서:
 * 1. 붙여넣기 미리보기 중(pastePreviewActive === true) → "scene"
 *    (어느 버튼이든 씬이 먼저 처리: 좌클릭=확정, 우클릭/맵 밖=취소).
 * 2. 가운데 버튼(button === 1 || (buttons & 4) === 4) → "pan"
 *    (어느 도구에서든 휠 클릭 드래그는 항상 카메라를 민다).
 * 3. 오른쪽 버튼(button === 2 || (buttons & 2) === 2) → "region"
 *    (도구와 무관하다 — EditScene 의 pointerdown 은 우클릭을 팬/페인트보다 먼저 영역 제스처로 가져간다).
 * 4. 왼쪽 버튼(button === 0)이고 (tool === "pan" || panArmed) → "pan"
 *    (화면 밀기 도구 또는 스페이스 바를 누른 상태의 드래그는 카메라의 것이다).
 * 5. 왼쪽 버튼(button === 0)이고 tool === "select" && !selectionActive && !paletteStampActive && !deferCameraFocus && !tileInMapBounds → "pan"
 *    (EditScene.shouldPan 의 «선택 도구 + 맵 밖 드래그» 조항과 동일한 조건으로 카메라 팬에 양보).
 * 6. 그 외 → null (오버레이 고유의 드래그/선택 제스처).
 *    (주의: 전용 eyedropper 도구의 좌클릭은 의도적으로 오버레이가 소유하며(6번), 복원된 스포이트는 우클릭 영역 제스처 경로(3번)를 쓴다).
 */
export function resolveCanvasGestureOwner(input: CanvasOwnershipInput): CanvasGestureOwner | null {
  const {
    pointer,
    pastePreviewActive,
    panArmed,
    tool,
    selectionActive,
    paletteStampActive,
    deferCameraFocus,
    tileInMapBounds,
  } = input;

  // 1. 붙여넣기 미리보기 중이면 버튼과 무관하게 씬이 처리(좌클릭=확정, 우클릭/맵 밖=취소)
  if (pastePreviewActive) {
    return "scene";
  }

  // 2. 가운데 버튼 클릭/드래그는 무조건 카메라 팬
  if (pointer.button === 1 || (pointer.buttons & 4) === 4) {
    return "pan";
  }

  // 3. 오른쪽 버튼 클릭/드래그는 도구와 무관하게 영역 제스처(AI 영역 채우기/스포이트/구조 메뉴)
  if (pointer.button === 2 || (pointer.buttons & 2) === 2) {
    return "region";
  }

  // 4. 왼쪽 버튼(button === 0)이고 화면 밀기 도구 또는 스페이스 팬 무장 상태
  if (pointer.button === 0 && (tool === "pan" || panArmed)) {
    return "pan";
  }

  // 5. 왼쪽 버튼(button === 0)이고 select 도구 + 맵 밖 빈 공간 드래그 (단, 기존 선택·스탬프·초점 유예가 없을 때만)
  if (
    pointer.button === 0 &&
    tool === "select" &&
    !selectionActive &&
    !paletteStampActive &&
    !deferCameraFocus &&
    !tileInMapBounds
  ) {
    return "pan";
  }

  // 6. 나머지는 오버레이가 소유
  return null;
}
