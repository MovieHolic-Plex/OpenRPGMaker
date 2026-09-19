import { store } from "@/project/store";
import { toast } from "@/util/toast";

/**
 * 푸터 상태줄에 문구와 **상태 색**을 함께 쓴다. 예전에는 textContent 만 바꿔서 실패·충돌
 * 문구가 성공 녹색 필에 그대로 떴다(2026-09-19 리뷰 P0-5). CSS 는
 * `.database-footer-status[data-status-kind]` 가 받는다.
 */
function writeStatus(status: HTMLElement, text: string, kind: "ok" | "pending" | "error"): void {
  status.textContent = text;
  status.dataset.statusKind = kind;
}

export function writeDatabaseFooterPending(status: HTMLElement, text: string): void {
  writeStatus(status, text, "pending");
}

export function writeDatabaseFooterError(status: HTMLElement, text: string): void {
  writeStatus(status, text, "error");
}

export async function applyDatabaseChanges(status: HTMLElement): Promise<boolean> {
  try {
    const result = await store.flush();
    switch (result.kind) {
      case "saved":
        writeStatus(status, "적용하고 온라인에 저장했습니다. 닫아도 안전합니다.", "ok");
        toast("온라인에 저장했습니다.", "ok");
        return true;
      case "saved-local":
        writeStatus(status, "적용했습니다. 브라우저에 저장했습니다. 닫아도 안전합니다.", "ok");
        toast("브라우저에 저장했습니다.", "ok");
        return true;
      case "not-loaded":
        writeStatus(status, "프로젝트를 아직 불러오는 중이라 저장하지 않았습니다.", "error");
        toast("아직 프로젝트를 불러오는 중입니다.", "error");
        return false;
      case "conflict":
        writeStatus(status, `${conflictMapNames(result.conflicts)} 맵이 다른 세션에서 먼저 바뀌어 저장하지 않았습니다.`, "error");
        toast("저장 충돌이 있습니다.", "error");
        return false;
      case "not-configured":
        writeStatus(status, "온라인 저장 연결이 필요합니다. 상태바의 ‘온라인 저장’을 확인하세요.", "error");
        toast("온라인 저장 연결이 필요합니다.", "error");
        return false;
      case "disabled":
        writeStatus(status, "이 화면에서는 온라인 저장을 사용할 수 없습니다.", "error");
        toast("온라인 저장을 사용할 수 없습니다.", "error");
        return false;
    }
  } catch (error) {
    if (error instanceof Error) {
      writeStatus(status, "적용 실패. 메시지를 확인하세요.", "error");
      toast(`적용 실패: ${error.message}`, "error");
      return false;
    }
    throw error;
  }
}

function conflictMapNames(conflicts: readonly { readonly name: string }[]): string {
  return conflicts.map((conflict) => conflict.name).join(", ") || "현재";
}
