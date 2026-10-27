// A keyboard hold repeats keydown after a short delay. A gamepad stick, D-pad,
// or touch stick only has a pressed/released edge, so menus, shops, and battle
// lists moved one row and then stuck. Field movement ignores `repeat` and keeps
// using the hold, so these extra keydowns must carry repeat:true.

/** Time a direction must stay down before the first repeat. A short tap stays one step. */
export const DIRECTION_REPEAT_DELAY_MS = 500;
/** Gap between later repeats, close to a keyboard repeat interval. */
export const DIRECTION_REPEAT_INTERVAL_MS = 33;

const DIRECTION_ORDER = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const;
const DIRECTION_KEYS = new Set<string>(DIRECTION_ORDER);

export class HeldDirectionRepeat {
  private readonly since = new Map<string, number>();
  private readonly last = new Map<string, number>();

  /**
   * Directions currently held. The first sample only starts the timer — the caller
   * already sent the edge keydown. Later samples return keys that should be sent
   * again with `repeat: true`. Releasing a direction starts the delay over.
   */
  tick(held: readonly string[], now: number): string[] {
    const current = new Set<string>();
    for (const key of held) {
      if (DIRECTION_KEYS.has(key)) current.add(key);
    }
    for (const key of this.since.keys()) {
      if (!current.has(key)) {
        this.since.delete(key);
        this.last.delete(key);
      }
    }
    const due: string[] = [];
    for (const key of DIRECTION_ORDER) {
      if (!current.has(key)) continue;
      const started = this.since.get(key);
      if (started === undefined) {
        this.since.set(key, now);
        this.last.set(key, now);
        continue;
      }
      if (now - started < DIRECTION_REPEAT_DELAY_MS) continue;
      const previous = this.last.get(key) ?? started;
      if (now - previous < DIRECTION_REPEAT_INTERVAL_MS) continue;
      this.last.set(key, now);
      due.push(key);
    }
    return due;
  }

  clear(): void {
    this.since.clear();
    this.last.clear();
  }
}
