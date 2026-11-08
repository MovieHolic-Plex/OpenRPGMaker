// When the scripted player calls a run "stuck" (vm/player.mjs driveUntilFree).
//
// Outside a cutscene: no visible change for STUCK_POLLS polls AND STUCK_MS.
// Inside a cutscene (skip hint or a drawn letterbox bar on screen) the game legitimately holds still while it waits
// for its own timing or input, so the time threshold stretches to a FIXED cap — never unlimited, so a real hang inside
// a cutscene is still reported. The cap must stay reachable within one driveUntilFree budget (maxSteps polls at
// a few hundred ms each while it presses through dialogue), otherwise the run would end as "budget" and the hang
// would go unreported — so unchanged polls inside a cutscene do not spend the step budget; the cap itself ends them.
export const STUCK_POLLS = 6;
export const STUCK_MS = 15000;
export const CUTSCENE_STUCK_CAP_MS = 45000;

/** Whether this poll spends one of driveUntilFree's maxSteps. */
export function spendsStep({ same, cutscene }) {
  return !(cutscene && same > 0);
}

export function stuckThresholdMs(cutscene) {
  return cutscene ? CUTSCENE_STUCK_CAP_MS : STUCK_MS;
}

/** @param {{ same: number, unchangedMs: number, cutscene: boolean }} s */
export function isStuck({ same, unchangedMs, cutscene }) {
  return same >= STUCK_POLLS && unchangedMs >= stuckThresholdMs(cutscene);
}

/** In-page probe: a cutscene is on screen when the skip hint shows or a letterbox bar is actually drawn. */
export function cutsceneOnScreen(doc) {
  if (doc.querySelector("[data-testid='cutscene-skip-hint']")) return true;
  for (const bar of doc.querySelectorAll("[data-testid^='runtime-letterbox-'], .cinematic-letterbox, .battle-look-letterbox")) {
    if (bar.getBoundingClientRect().height >= 1) return true;
  }
  return false;
}
