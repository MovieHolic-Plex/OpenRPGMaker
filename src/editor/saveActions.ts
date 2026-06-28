// editor/saveActions.ts
// 저장 액션. 메뉴/툴바/Ctrl+S 단축키가 모두 같은 경로를 쓴다.

import { store } from "@/project/store";
import { toast } from "@/util/toast";

export async function saveProjectNow(): Promise<boolean> {
  try {
    await store.flush();
    toast("저장됨", "ok");
    return true;
  } catch (error) {
    if (error instanceof Error) {
      toast(`저장 실패: ${error.message}`, "error");
      return false;
    }
    throw error;
  }
}
