import type Phaser from "phaser";
import { editorState } from "@/editor/editorState";

type PanStart = {
  readonly screenX: number;
  readonly screenY: number;
  readonly scrollX: number;
  readonly scrollY: number;
};

type SceneWithCamera = Phaser.Scene & {
  readonly cameras: Phaser.Cameras.Scene2D.CameraManager;
  readonly game: Phaser.Game;
};

export class CameraPanController {
  private isPanning = false;
  private spacePanActive = false;
  private panStart: PanStart | null = null;
  // The camera follows every sample, but overlay/viewport sync runs once per frame:
  // a drag delivers both pointermove and mousemove, often several per frame.
  private panMoveFrame: number | null = null;

  private readonly handleAuxiliaryCanvasPointerDown = (event: MouseEvent | PointerEvent): void => {
    if (!this.isMiddleButtonEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.startAt(event.clientX, event.clientY);
  };

  private readonly handleAuxiliaryCanvasClick = (event: MouseEvent | PointerEvent): void => {
    if (!this.isMiddleButtonEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  private readonly handleWindowPanMove = (event: MouseEvent | PointerEvent): void => {
    if (!this.isPanning) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.continueAt(event.clientX, event.clientY);
  };

  private readonly handleWindowPanEnd = (event?: MouseEvent | PointerEvent): void => {
    event?.preventDefault();
    event?.stopPropagation();
    event?.stopImmediatePropagation();
    this.stop();
  };

  constructor(
    private readonly scene: SceneWithCamera,
    private readonly options: {
      readonly onPanStart: () => void;
      readonly onPanMove: () => void;
      readonly onPanEnd: () => void;
    }
  ) {}

  bindCanvasGuards(): void {
    const canvas = this.scene.game.canvas;
    canvas.addEventListener("pointerdown", this.handleAuxiliaryCanvasPointerDown, { capture: true });
    canvas.addEventListener("mousedown", this.handleAuxiliaryCanvasPointerDown, { capture: true });
    canvas.addEventListener("auxclick", this.handleAuxiliaryCanvasClick, { capture: true });
  }

  unbindCanvasGuards(): void {
    const canvas = this.scene.game.canvas;
    canvas.removeEventListener("pointerdown", this.handleAuxiliaryCanvasPointerDown, { capture: true });
    canvas.removeEventListener("mousedown", this.handleAuxiliaryCanvasPointerDown, { capture: true });
    canvas.removeEventListener("auxclick", this.handleAuxiliaryCanvasClick, { capture: true });
  }

  shouldPan(ptr: Phaser.Input.Pointer): boolean {
    return editorState.get().tool === "pan" || this.spacePanActive || ptr.middleButtonDown() || ptr.button === 1;
  }

  start(ptr: Phaser.Input.Pointer): void {
    const point = pointerScreenPosition(ptr);
    this.startAt(point.x, point.y);
  }

  continue(ptr: Phaser.Input.Pointer): void {
    const point = pointerScreenPosition(ptr);
    this.continueAt(point.x, point.y);
  }

  /**
   * 이미 지나간 화면 좌표를 팬 기준점으로 삼아 시작한다.
   *
   * 문턱을 넘은 뒤에야 팬으로 승격하는 제스처(이벤트 레이어 빈 칸 드래그)가 필요하다.
   * `start(ptr)` 는 **지금** 포인터를 기준으로 잡으므로 눌린 자리에서 문턱까지 움직인 만큼이
   * 통째로 사라져 손과 화면이 어긋난다. 누른 자리를 기준으로 잡아 1:1 추종을 유지한다.
   */
  startFromScreenPoint(screenX: number, screenY: number): void {
    this.startAt(screenX, screenY);
  }

  stop(): void {
    const wasPanning = this.isPanning;
    this.isPanning = false;
    this.panStart = null;
    this.unbindWindowGuards();
    this.flushPanMove();
    if (wasPanning) this.options.onPanEnd();
  }

  active(): boolean {
    return this.isPanning;
  }

  /**
   * 스페이스 팬이 켜졌거나 팬이 진행 중인가.
   *
   * 캔버스 위를 덮는 DOM 오버레이(로케이션 레이어)는 이 상태를 볼 수 없어서, 스페이스를 누른 채
   * 시작한 드래그를 자기 제스처로 가져가 버린다. 오버레이가 양보 여부를 물을 때 쓴다.
   */
  armed(): boolean {
    return this.spacePanActive || this.isPanning;
  }

  handleSpaceKeyDown(event: KeyboardEvent): boolean {
    if (event.code !== "Space") return false;
    event.preventDefault();
    this.spacePanActive = true;
    return true;
  }

  handleSpaceKeyUp(event: KeyboardEvent): boolean {
    // Modal buttons own their Space release when the canvas never took keydown.
    if (event.code !== "Space" || !this.spacePanActive) return false;
    event.preventDefault();
    this.spacePanActive = false;
    this.stop();
    return true;
  }

  panBy(deltaX: number, deltaY: number): void {
    const camera = this.scene.cameras.main;
    camera.setScroll(camera.scrollX + deltaX, camera.scrollY + deltaY);
    this.options.onPanMove();
  }

  private startAt(screenX: number, screenY: number): void {
    const camera = this.scene.cameras.main;
    this.isPanning = true;
    this.options.onPanStart();
    this.panStart = {
      screenX,
      screenY,
      scrollX: camera.scrollX,
      scrollY: camera.scrollY,
    };
    this.bindWindowGuards();
  }

  private continueAt(screenX: number, screenY: number): void {
    const start = this.panStart;
    if (!start) return;
    const camera = this.scene.cameras.main;
    const dx = screenX - start.screenX;
    const dy = screenY - start.screenY;
    camera.setScroll(
      start.scrollX - dx / camera.zoom,
      start.scrollY - dy / camera.zoom
    );
    this.schedulePanMove();
  }

  private schedulePanMove(): void {
    if (this.panMoveFrame !== null) return;
    if (typeof requestAnimationFrame !== "function") {
      this.options.onPanMove();
      return;
    }
    this.panMoveFrame = requestAnimationFrame(() => {
      this.panMoveFrame = null;
      this.options.onPanMove();
    });
  }

  private flushPanMove(): void {
    if (this.panMoveFrame === null) return;
    cancelAnimationFrame(this.panMoveFrame);
    this.panMoveFrame = null;
    this.options.onPanMove();
  }

  private bindWindowGuards(): void {
    window.addEventListener("pointermove", this.handleWindowPanMove, { capture: true, passive: false });
    window.addEventListener("mousemove", this.handleWindowPanMove, { capture: true, passive: false });
    window.addEventListener("pointerup", this.handleWindowPanEnd, { capture: true });
    window.addEventListener("pointercancel", this.handleWindowPanEnd, { capture: true });
    window.addEventListener("mouseup", this.handleWindowPanEnd, { capture: true });
  }

  private unbindWindowGuards(): void {
    window.removeEventListener("pointermove", this.handleWindowPanMove, { capture: true });
    window.removeEventListener("mousemove", this.handleWindowPanMove, { capture: true });
    window.removeEventListener("pointerup", this.handleWindowPanEnd, { capture: true });
    window.removeEventListener("pointercancel", this.handleWindowPanEnd, { capture: true });
    window.removeEventListener("mouseup", this.handleWindowPanEnd, { capture: true });
  }

  private isMiddleButtonEvent(event: MouseEvent | PointerEvent): boolean {
    return event.button === 1 || (event.buttons & 4) === 4;
  }
}

export function pointerScreenPosition(ptr: Phaser.Input.Pointer): { readonly x: number; readonly y: number } {
  const event = ptr.event;
  if (event instanceof MouseEvent || event instanceof PointerEvent) {
    return { x: event.clientX, y: event.clientY };
  }
  return { x: ptr.x, y: ptr.y };
}
