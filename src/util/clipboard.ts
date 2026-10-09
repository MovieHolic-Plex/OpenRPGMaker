// util/clipboard.ts — 텍스트 클립보드 복사(성공 여부를 boolean 으로 돌려준다).
//
// 계약은 이미 저장소에 두 번 손으로 복제돼 있던 것과 같다:
//   `regionTaskModal.copyTextToClipboard` / `editActivityPanel.copyText`
// 둘이 갈라진 이유는 번들 격리였다 — 작업 기록 드롭다운이 영역 작업 모달 전체를 끌어올
// 수 없었기 때문이다(editActivityPanel 주석). 그래서 정본을 **의존성 없는 util** 로 둔다.
// 기존 두 사본은 이 파일과 계약이 같으므로 나중에 이쪽으로 모을 수 있다.
//
// 왜 Clipboard API 만으로 안 되는가: `navigator.clipboard` 는 secure context 전용이라
// HTTP 서빙(사내 dev 서버)에서는 없거나 권한 거부로 reject 한다. 그 경우 조용히 실패하면
// 사용자는 붙여넣기를 시도한 다음에야 실패를 알게 된다 — 그래서 textarea + execCommand
// 폴백까지 시도하고, **두 경로 다 실패했을 때만** false 를 돌려준다(호출자가 알린다).
import { createLogger } from "@/util/logger";

const log = createLogger("clipboard");

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    log.warn("클립보드 API 복사 실패 — textarea 폴백", error);
  }
  if (typeof document === "undefined") return false;
  // 폴백은 화면 밖 textarea 를 선택해 execCommand 로 복사한다. execCommand 가 없는 환경
  // (테스트 DOM·최신 브라우저의 일부 컨텍스트)에서는 throw 하므로 remove 를 finally 로 묶는다 —
  // 예전 사본들은 throw 경로에서 노드를 body 에 남겼다.
  let area: HTMLTextAreaElement | null = null;
  try {
    area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.append(area);
    area.select?.();
    return document.execCommand("copy");
  } catch (error) {
    log.warn("textarea 폴백 복사 실패", error);
    return false;
  } finally {
    area?.remove();
  }
}
