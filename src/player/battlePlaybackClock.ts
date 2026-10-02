import { cancelBattleTimer, scheduleBattleTimer } from "@/player/battleTimerScope";

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

  schedule(callback: () => void, ms: number): void {
    if (this.disposed) return;
    const task: PlaybackTask = { callback, remaining: Math.max(0, ms), started: 0 };
    this.tasks.add(task);
    if (!this.paused) this.arm(task);
  }

  private arm(task: PlaybackTask): void {
    task.started = performance.now();
    task.timer = scheduleBattleTimer(() => {
      this.tasks.delete(task);
      if (!this.disposed) task.callback();
    }, task.remaining);
  }

  pause(flushAheadMs = 0): void {
    if (this.paused || this.disposed) return;
    this.paused = true;
    const now = performance.now();
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
    this.paused = false;
    for (const task of this.tasks) this.arm(task);
  }

  dispose(): void {
    this.disposed = true;
    for (const task of this.tasks) if (task.timer !== undefined) cancelBattleTimer(task.timer);
    this.tasks.clear();
  }
}
