// 게임 내보내기(웹 번들·실행형 HTML·데스크톱 패키지)가 진행 중임을 알린다.
// 기본 토스트는 안내 2초·오류 4초 뒤에 사라진다. 묶음은 그보다 오래 걸리고,
// 사라진 뒤 같은 메뉴를 다시 누르면 만들기가 두 번 겹친다.
import { dismissToastsByKey, toast, type ToastKind } from "@/util/toast";

const GAME_EXPORT_TOAST = Symbol("game-export");
/** 만들기가 이 시간 안에 끝나지 않아도 알림이 먼저 꺼지지 않게 둔다. 끝나면 바로 걷는다. */
const PROGRESS_MS = 30 * 60 * 1000;
const RESULT_MS = 8_000;
const ERROR_MS = 20_000;

let running = false;

/** 진행 알림을 띄운다. 이미 내보내는 중이면 거절하고 false. */
export function beginGameExport(progress: string): boolean {
  if (running) {
    toast("이미 게임을 내보내는 중입니다. 이 작업이 끝난 뒤 다시 누르세요.", { kind: "info", durationMs: RESULT_MS });
    return false;
  }
  running = true;
  toast(progress, { kind: "info", durationMs: PROGRESS_MS, key: GAME_EXPORT_TOAST });
  return true;
}

/** 진행 알림을 걷고 결과(완료·경고·실패)를 남긴다. */
export function endGameExport(message: string, kind: ToastKind): void {
  running = false;
  dismissToastsByKey(GAME_EXPORT_TOAST);
  toast(message, { kind, durationMs: kind === "error" ? ERROR_MS : RESULT_MS });
}

export function resetGameExportForTest(): void {
  running = false;
  dismissToastsByKey(GAME_EXPORT_TOAST);
}
