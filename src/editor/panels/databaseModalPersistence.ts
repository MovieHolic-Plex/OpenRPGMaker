import { store } from "@/project/store";
import { toast } from "@/util/toast";

export async function applyDatabaseChanges(status: HTMLElement): Promise<boolean> {
  try {
    const result = await store.flush();
    switch (result.kind) {
      case "saved":
        status.textContent = "적용했습니다. DB에 저장했습니다. 닫아도 안전합니다.";
        toast("DB에 저장했습니다.", "ok");
        return true;
      case "saved-local":
        status.textContent = "적용했습니다. 브라우저에 저장했습니다. 닫아도 안전합니다.";
        toast("브라우저에 저장했습니다.", "ok");
        return true;
      case "not-loaded":
        status.textContent = "프로젝트를 아직 불러오는 중이라 저장하지 않았습니다.";
        toast("아직 프로젝트를 불러오는 중입니다.", "error");
        return false;
      case "conflict":
        status.textContent = `${conflictMapNames(result.conflicts)} 맵이 다른 세션에서 먼저 바뀌어 저장하지 않았습니다.`;
        toast("저장 충돌이 있습니다.", "error");
        return false;
      case "not-configured":
        status.textContent = "DB 저장 설정이 없습니다. Supabase 환경 설정을 확인하세요.";
        toast("DB 저장 설정이 없습니다.", "error");
        return false;
      case "disabled":
        status.textContent = "DB 저장이 비활성화되어 저장하지 못했습니다.";
        toast("DB 저장이 비활성화되어 있습니다.", "error");
        return false;
    }
  } catch (error) {
    if (error instanceof Error) {
      status.textContent = "적용 실패. 메시지를 확인하세요.";
      toast(`적용 실패: ${error.message}`, "error");
      return false;
    }
    throw error;
  }
}

function conflictMapNames(conflicts: readonly { readonly name: string }[]): string {
  return conflicts.map((conflict) => conflict.name).join(", ") || "현재";
}
