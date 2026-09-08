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

  stop(): void {
    const wasPanning = this.isPanning;
    this.isPanning = false;
    this.panStart = null;
    this.unbindWindowGuards();
    if (wasPanning) this.options.onPanEnd();
  }

  active(): boolean {
    return this.isPanning;
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
