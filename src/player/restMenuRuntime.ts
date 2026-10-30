// player/restMenuRuntime.ts
// ESC 메뉴 「쉬기」 실행 — 페이드 → 고른 시각까지 시간 진행 → 맵 이벤트 페이지 재평가 → 페이드 인(2026-10-30, 공백 E).
// 규칙(목표 시각·거절 사유)은 project/restMenu.ts 가 정한다. 시간 진행은 이벤트 「시간 진행」 명령과 같은 applyAdvanceTimeStep 을
// 써서 날 경계·강제 취침·하루 종료 공통 이벤트·실패 복원까지 같은 경로를 탄다.
import { resolveTimeSystem } from "@/project/gameTime";
import { minutesUntilRestTarget, resolveRestMenu, restRefusal, REST_REFUSAL_TEXT, REST_TARGET_LABELS, type RestTarget } from "@/project/restMenu";
import { recoverPartyVitals } from "@/project/sessionVitals";
import { store } from "@/project/store";
import { applyAdvanceTimeStep } from "@/player/playSceneTime";
import { fadeCamera, TRANSFER_FADE_DURATION_MS } from "@/player/playSceneMapCommands";
import type { PlaySceneContext } from "@/player/playSceneTypes";

export type RestResult = { readonly ok: true; readonly message: string } | { readonly ok: false; readonly message: string };

/** 메뉴를 닫은 뒤 부른다. 거절이면 아무것도 바꾸지 않고 사유를 돌려준다. */
export async function restUntilTarget(scene: PlaySceneContext, target: RestTarget): Promise<RestResult> {
  const project = store.getCurrent();
  const rest = resolveRestMenu(project);
  const system = resolveTimeSystem(project);
  const refusal = restRefusal(project, scene.session, scene.map);
  if (refusal || !rest || !system || !scene.session.gameTime) return { ok: false, message: REST_REFUSAL_TEXT[refusal ?? "time-off"] };
  if (!rest.targets.includes(target) || minutesUntilRestTarget(scene.session.gameTime, target, system) === undefined) {
    return { ok: false, message: `${REST_TARGET_LABELS[target]}까지는 쉴 수 없습니다` };
  }
  if (scene.running) return { ok: false, message: REST_REFUSAL_TEXT["time-off"] };
  scene.running = true;
  scene.setInputEnabled(false);
  try {
    await fadeCamera(scene, "out", { red: 0, green: 0, blue: 0 }, TRANSFER_FADE_DURATION_MS);
    // 페이드 동안에도 시계가 흐른다 — 분은 어두워진 뒤에 센다(목표 시각을 1분 넘기지 않게).
    const minutes = scene.session.gameTime ? minutesUntilRestTarget(scene.session.gameTime, target, system) ?? 0 : 0;
    try {
      await applyAdvanceTimeStep(scene, { kind: "advanceTime", minutes });
    } catch {
      await fadeCamera(scene, "in", { red: 0, green: 0, blue: 0 }, TRANSFER_FADE_DURATION_MS);
      return { ok: false, message: "쉬는 동안 날을 넘기지 못했습니다" };
    }
    if (rest.recoverHp) recoverPartyVitals(scene.session.actorVitals, scene.session.partyActorIds, { recoverMp: false });
    scene.timeFixedAccumulatorMs = 0;
    scene.timeMinuteAccumulator = 0;
    await fadeCamera(scene, "in", { red: 0, green: 0, blue: 0 }, TRANSFER_FADE_DURATION_MS);
    return { ok: true, message: `${REST_TARGET_LABELS[target]}까지 쉬었다` };
  } finally {
    scene.running = false;
    scene.lastActionTargetKey = "";
    scene.setInputEnabled(true);
    // 시각이 바뀌었으니 맵 이벤트 페이지(시간대 조건)·자동 이벤트를 다시 본다. 필드 스폰은 다음 틱이 시간대를 읽는다.
    scene.refreshRuntimeSurfaces();
    scene.syncRuntimeState();
  }
}
