import type Phaser from "phaser";

export type QaFrameRequest = { readonly frames: number; readonly deltaMs: number };
export type QaFrameReceipt = QaFrameRequest & {
  readonly sequence: number;
  readonly startFrame: number;
  readonly endFrame: number;
};
export type RuntimeQaFrames = {
  pause(): void;
  step(request: QaFrameRequest): QaFrameReceipt;
  resume(): void;
  readState(): { readonly controlled: boolean; readonly canStep: boolean; readonly sequence: number; readonly frame: number };
};
type QaWindow = Window & { __oprnQaFrames?: RuntimeQaFrames };

/** Installed only by the explicit QA boot capability. No life/session clock here.
 * TimeStep.step is the engine method used by tick(), with a controlled timestamp
 * instead of performance.now(). Unlike Game.step alone it updates input timing,
 * loop.time/delta/frame and the normal Game -> SceneManager -> Systems pipeline.
 */
export function installRuntimeQaFrames(game: Phaser.Game): void {
  if (game.registry.get("qaInstrumentation") !== true) return;
  const host = window as QaWindow;
  let controlled = false;
  let stepping = false;
  let disposed = false;
  let destroying = false;
  let sequence = 0;

  function requireLive(): void {
    if (disposed || host.__oprnQaFrames !== control || !game.isRunning || !game.loop.started) {
      throw new Error("QA frame controller is not active");
    }
    if (stepping) throw new Error("QA frame control is already stepping");
  }

  const control: RuntimeQaFrames = Object.freeze({
    readState() {
      requireLive();
      return { controlled, canStep: controlled && !game.loop.running && !game.isPaused && !destroying, sequence, frame: game.loop.frame };
    },
    pause() {
      requireLive();
      if (destroying || game.isPaused) throw new Error("Game cannot enter QA frame control");
      game.loop.sleep();
      controlled = true;
    },
    step(request: QaFrameRequest) {
      requireLive();
      // The native driver is a boundary. Use integer milliseconds so tick deadlines
      // cannot depend on floating-point subtraction of a fractional RAF timestamp.
      if (!request || !Number.isSafeInteger(request.frames) || request.frames < 1 || request.frames > 600
        || !Number.isSafeInteger(request.deltaMs) || request.deltaMs < 1 || request.deltaMs > 1000) {
        throw new RangeError("QA frames require 1..600 frames and 1..1000 integer milliseconds per frame");
      }
      const loop = game.loop;
      if (!controlled || loop.running || game.isPaused || destroying) {
        throw new Error("Game must be under exclusive QA frame control");
      }
      const { frames, deltaMs } = request;
      if (!Number.isSafeInteger(Math.floor(loop.lastTime) + frames * deltaMs)
        || !Number.isSafeInteger(loop.frame + frames) || !Number.isSafeInteger(sequence + 1)) {
        throw new RangeError("QA frame batch exceeds the engine counter range");
      }
      const startFrame = loop.frame;
      const smoothStep = loop.smoothStep;
      let completed = 0;
      const onFrame = () => { completed += 1; };
      // Only quantize the engine's sampling anchor, not its accumulated time or
      // any scene/session owner. All delivered timestamps remain increasing.
      loop.lastTime = Math.floor(loop.lastTime);
      stepping = true;
      loop.smoothStep = false;
      game.events.on("postrender", onFrame);
      try {
        for (let index = 0; index < frames; index += 1) {
          if (disposed || loop.running || game.isPaused || destroying) {
            throw new Error(`QA frame batch interrupted after ${completed} frames`);
          }
          loop.step(loop.lastTime + deltaMs);
          if (completed !== index + 1) throw new Error(`Missing Phaser frame completion after ${completed} frames`);
        }
        const receipt = Object.freeze({ sequence: ++sequence, frames: completed, deltaMs, startFrame, endFrame: loop.frame });
        host.dispatchEvent(new CustomEvent("oprn:qa-frames", { detail: receipt }));
        return receipt;
      } finally {
        game.events.off("postrender", onFrame);
        loop.smoothStep = smoothStep;
        stepping = false;
      }
    },
    resume() {
      requireLive();
      if (!controlled) return;
      controlled = false;
      // Phaser's documented sleep/wake pair needs a fresh sampling origin after
      // simulated frames, not catch-up for wall time spent examining the game.
      game.loop.resetDelta();
      game.loop.wake();
    },
  });
  host.__oprnQaFrames = control;
  // Game.destroy only sets pendingDestroy; an asleep loop would never execute
  // its deferred disposal. Wake via Phaser after the caller/current frame exits.
  const originalDestroy = game.destroy;
  const destroy: Phaser.Game["destroy"] = (removeCanvas, noReturn) => {
    originalDestroy.call(game, removeCanvas, noReturn);
    destroying = true;
    if (controlled) queueMicrotask(() => {
      if (!disposed && controlled && destroying) {
        controlled = false;
        game.loop.resetDelta();
        game.loop.wake();
      }
    });
  };
  game.destroy = destroy;
  game.events.once("destroy", () => {
    disposed = true;
    if (game.destroy === destroy) game.destroy = originalDestroy;
    if (host.__oprnQaFrames === control) delete host.__oprnQaFrames;
  });
}
