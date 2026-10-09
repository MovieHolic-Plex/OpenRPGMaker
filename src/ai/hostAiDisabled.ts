// ai/hostAiDisabled.ts
// 칩(aiConnectionStatus)과 AI 설정 창(aiAuthSettings)이 같은 판정·문구를 쓴다. 테스트 여럿이
// aiConnectionStatus 를 vi.mock 으로 통째 바꾸므로, 거기에 두면 설정 창 쪽 import 가 비어 버린다.

/**
 * 공유 호스트가 AI 를 꺼 둔 503(`electron/serve/runtime.ts`) — 재시작으로는 풀리지 않으므로
 * 「개발 서버를 껐다 켜 보세요」 대신 서버를 띄운 사람이 할 일을 말한다.
 */
export function isHostAiDisabledMessage(serverMessage: string): boolean {
  return serverMessage.includes("OPRN_HOST_OWNER_AI");
}

export const HOST_AI_DISABLED_GUIDANCE =
  "이 서버는 AI 연결을 꺼 둔 채로 실행됐어요. 다시 시작해도 풀리지 않습니다. 서버를 실행한 사람이 OPRN_HOST_OWNER_AI=1 을 붙여 다시 실행해야 합니다(팀 소유자만 사용할 수 있어요).";
