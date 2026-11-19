import type { DatabaseFooterStatus } from "@/editor/panels/databaseWorkbench";
import { store } from "@/project/store";
import { toast } from "@/util/toast";

type WriteStatus = (status: DatabaseFooterStatus) => void;

export async function applyDatabaseChanges(writeStatus: WriteStatus): Promise<boolean> {
  try {
    const result = await store.flush();
    switch (result.kind) {
      case "saved":
        writeStatus({ text: "변경 내용을 저장했습니다.", kind: "ok" });
        toast("저장했습니다.", "ok");
        return true;
      case "saved-local":
        if (result.written === false) {
          // 오류는 한 곳(상태 줄)에만 쓴다 — 토스트를 함께 띄우면 같은 실패가 두 번 보이고 토스트가 결정 띠를
          // 가렸다(J-p2-power-user-01). 편집은 이 세션 메모리에 남아 있으므로 보존하는 길(내보내기)을 알린다.
          writeStatus({ text: "임시 세션이라 파일에 기록하지 않았습니다. 보존하려면 프로젝트를 내보내세요.", kind: "error" });
          return false;
        }
        writeStatus({ text: "적용했습니다. 브라우저에 저장했습니다. 닫아도 안전합니다.", kind: "ok" });
        toast("브라우저에 저장했습니다.", "ok");
        return true;
      case "not-loaded":
        writeStatus({ text: "프로젝트를 아직 불러오는 중이라 저장하지 않았습니다.", kind: "error" });
        toast("아직 프로젝트를 불러오는 중입니다.", "error");
        return false;
      case "conflict":
        writeStatus({ text: `${conflictMapNames(result.conflicts)} 맵이 다른 세션에서 먼저 바뀌어 저장하지 않았습니다.`, kind: "error" });
        toast("저장 충돌이 있습니다.", "error");
        return false;
      case "not-configured":
        writeStatus({ text: "프로젝트 저장소가 연결되지 않아 저장하지 않았습니다.", kind: "error" });
        toast("프로젝트 저장소 연결이 필요합니다.", "error");
        return false;
      case "disabled":
        writeStatus({ text: "이 화면에서는 프로젝트 저장을 사용할 수 없습니다.", kind: "error" });
        toast("이 화면에서는 저장할 수 없습니다.", "error");
        return false;
    }
  } catch (error) {
    if (error instanceof Error) {
      writeStatus({ text: "적용 실패. 메시지를 확인하세요.", kind: "error" });
      toast(`적용 실패: ${error.message}`, "error");
      return false;
    }
    throw error;
  }
}

function conflictMapNames(conflicts: readonly { readonly name: string }[]): string {
  return conflicts.map((conflict) => conflict.name).join(", ") || "현재";
}
