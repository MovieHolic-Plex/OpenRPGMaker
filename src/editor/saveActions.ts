import { store } from "@/project/store";
import { toast } from "@/util/toast";

export async function saveProjectNow(): Promise<boolean> {
  toast("저장 중...", "info");
  try {
    const result = await store.flush();
    switch (result.kind) {
      case "saved":
        toast("저장 완료", "ok");
        return true;
      case "saved-local":
        toast("저장 완료 (브라우저)", "ok");
        return true;
      case "not-loaded":
        toast("아직 프로젝트를 불러오는 중입니다.", "error");
        return false;
      case "conflict":
        toast(`저장 충돌: ${conflictMapNames(result.conflicts)} 맵이 다른 세션에서 먼저 바뀌었습니다.`, "error");
        return false;
      case "disabled":
        toast("DB 저장 안 됨: 개발용 쇼케이스", "error");
        return false;
      case "not-configured":
        toast("DB 저장 안 됨: Supabase 설정 없음", "error");
        return false;
    }
  } catch (error) {
    if (error instanceof Error) {
      toast(`저장 실패: ${error.message}`, "error");
      return false;
    }
    throw error;
  }
}

function conflictMapNames(conflicts: readonly { readonly name: string }[]): string {
  return conflicts.map((conflict) => conflict.name).join(", ") || "현재";
}
