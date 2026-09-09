// editor/panels/aiUsageLogDownload.ts
// ☰ 「사용 로그 내려받기」의 동작. 두 표면(헤더 ☰ / 컴포저 ☰)이 같은 항목을 공유하므로
// 구현도 한 곳이다.
//
// 패널이 아니라 별도 모듈인 이유: aiChatPanel 은 이미 3천 줄이고, 이 동작은 패널 상태를
// 하나도 읽지 않는다(로그 → 텍스트 → 파일). 여기 두면 패널을 세우지 않고도 테스트된다.
// 반대로 src/ai 밑에 두지 않는 이유: 토스트는 UI 이고 src/ai 는 토스트를 모르는 층이다.

import { listAiActivityLogs } from "@/ai/activityLog";
import { aiActivityLogTextFileName, formatAiActivityLogText } from "@/ai/activityLogText";
import { downloadBlob } from "@/util/downloadBlob";
import { createLogger } from "@/util/logger";
import { toast } from "@/util/toast";

const log = createLogger("ai-usage-log");

/** 저장했으면 true. 기록이 없거나 실패하면 false(사유는 토스트로 알린다). */
export function downloadAiUsageLogText(): boolean {
  let records: readonly unknown[] = [];
  try {
    const rows = listAiActivityLogs();
    records = rows;
    if (rows.length === 0) {
      // 빈 파일을 떨어뜨리면 "받았는데 아무것도 없다" 로 끝난다. 왜 없는지를 말한다.
      toast("아직 저장된 조수 사용 기록이 없습니다", "info");
      return false;
    }
    const text = formatAiActivityLogText(rows);
    downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), aiActivityLogTextFileName());
    toast(`사용 로그 ${rows.length}건을 txt 로 저장했습니다`, "ok");
    return true;
  } catch (error) {
    log.error("사용 로그 내려받기 실패", { count: records.length, error });
    toast("사용 로그 저장에 실패했습니다", "error");
    return false;
  }
}
