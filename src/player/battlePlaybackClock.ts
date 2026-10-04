import {
  cancelBattleTimer,
  scheduleBattleTimer,
} from "@/player/battleTimerScope";

interface PlaybackTask {
  readonly callback: () => void;
  remaining: number;
  started: number;
  timer?: number;
}

/** Presentation time stops on contact; battle rules and damage never use this clock. */
export class BattlePlaybackClock {
  private readonly tasks = new Set<PlaybackTask>();
  private paused = false;
  private disposed = false;
  private readonly origin = performance.now();
  private pausedAt = 0;
  private pausedDuration = 0;
  private readonly animations = new Map<Animation, number>();
  private frame?: number;

  get elapsedMs(): number {
    return (
      (this.paused ? this.pausedAt : performance.now()) -
      this.origin -
      this.pausedDuration
    );
  }

  /** WAAPI is a sampler, not another free-running clock. Repeated hitstops cannot add frame drift. */
  trackAnimation(animation: Animation, startAt = this.elapsedMs): void {
    if (this.disposed) {
      animation.cancel();
      return;
    }
    animation.pause();
    this.animations.set(animation, startAt);
    this.syncAnimations();
    this.requestFrame();
  }

  ownsAnimation(animation: Animation): boolean {
    return this.animations.has(animation);
  }

  private syncAnimations(): void {
    const now = this.elapsedMs;
    for (const [animation, start] of this.animations)
      animation.currentTime = Math.max(0, now - start);
  }

  private requestFrame(): void {
    if (
      this.frame !== undefined ||
      this.paused ||
      this.disposed ||
      !this.animations.size
    )
      return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = undefined;
      if (this.disposed) return;
      this.syncAnimations();
      this.requestFrame();
    });
  }

  schedule(callback: () => void, ms: number): void {
    if (this.disposed) return;
    const task: PlaybackTask = {
      callback,
      remaining: Math.max(0, ms),
      started: 0,
    };
    this.tasks.add(task);
    if (!this.paused) this.arm(task);
  }

  private arm(task: PlaybackTask): void {
    task.started = performance.now();
    task.timer = scheduleBattleTimer(() => {
      this.tasks.delete(task);
      if (!this.disposed) {
        this.syncAnimations();
        task.callback();
      }
    }, task.remaining);
  }

  pause(flushAheadMs = 0): void {
    if (this.paused || this.disposed) return;
    const now = performance.now();
    this.pausedAt = now;
    this.paused = true;
    this.syncAnimations();
    if (this.frame !== undefined) window.cancelAnimationFrame(this.frame);
    this.frame = undefined;
    for (const task of [...this.tasks]) {
      if (this.disposed) break;
      if (task.timer === undefined) continue;
      cancelBattleTimer(task.timer);
      task.timer = undefined;
      task.remaining = Math.max(0, task.remaining - (now - task.started));
      // Sequencer and presentation start a few milliseconds apart. Dispatch due contact
      // cues before freezing rather than leaving their sound queued behind the hold.
      if (task.remaining <= flushAheadMs) {
        this.tasks.delete(task);
        task.callback();
      }
    }
  }

  resume(): void {
    if (!this.paused || this.disposed) return;
    this.pausedDuration += performance.now() - this.pausedAt;
    this.paused = false;
    for (const task of this.tasks) this.arm(task);
    this.requestFrame();
  }

  dispose(): void {
    this.disposed = true;
    if (this.frame !== undefined) window.cancelAnimationFrame(this.frame);
    this.frame = undefined;
    for (const animation of this.animations.keys()) animation.cancel();
    this.animations.clear();
    for (const task of this.tasks)
      if (task.timer !== undefined) cancelBattleTimer(task.timer);
    this.tasks.clear();
  }
}
