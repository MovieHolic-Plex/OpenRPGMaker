/**
 * «Lift Ride»(승강 장치 타기) 필드 정리 — 해석기·도구·편집기가 같은 기본값을 쓴다. 그리기는 player/playSceneLiftRide.ts.
 */

export const DEFAULT_LIFT_SE = "cc0-se-osx-machine-02";

export type LiftRideMode = "depart" | "arrive" | "move";

export type LiftRideSpec = ReturnType<typeof normalizeLiftRide>;

/** 테스트·도구가 쓰는 기본값 정리. */
export function normalizeLiftRide(fields: Readonly<Record<string, unknown>>): {
  mode: "depart" | "arrive" | "move";
  direction: "up" | "down";
  distance: number;
  durationMs: number;
  width: number;
  depth: number;
  x: number | undefined;
  y: number | undefined;
  se: string;
  wait: boolean;
} {
  const num = (key: string): number | undefined => {
    const raw = fields[key];
    if (raw === "" || raw === undefined || raw === null) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };
  const mode = fields.mode === "arrive" || fields.mode === "move" ? fields.mode : "depart";
  const direction = fields.direction === "down" ? "down" : "up";
  const clampInt = (value: number | undefined, lo: number, hi: number, fallback: number): number =>
    value === undefined ? fallback : Math.max(lo, Math.min(hi, Math.round(value)));
  const x = num("x");
  const y = num("y");
  return {
    mode,
    direction,
    distance: clampInt(num("distance"), 1, 20, 4),
    durationMs: clampInt(num("durationMs"), 400, 20_000, 2600),
    width: clampInt(num("width"), 1, 6, 2),
    depth: clampInt(num("depth"), 1, 4, 2),
    x: x === undefined || x < 0 ? undefined : Math.round(x),
    y: y === undefined || y < 0 ? undefined : Math.round(y),
    se: typeof fields.se === "string" && fields.se.trim() ? fields.se.trim() : DEFAULT_LIFT_SE,
    wait: fields.wait !== false && fields.wait !== "false",
  };
}

