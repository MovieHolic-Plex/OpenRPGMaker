// AI 활동 로그의 런 식별자. 디스크 미러(output/ai-activity/latest.json)가 하던 격리를 DB 로 옮긴다.
//
// 왜 필요한가: DB 에는 런/세션/호스트 식별자가 없어서 "방금 끝난 내 턴"을 물을 수 없었다.
// 같은 머신에서 워크트리 여러 개의 dev 서버가 전부 같은 project_id 로 쓰기 때문에
// `order=created_at.desc&limit=1` 은 옆 워크트리의 e2e 턴을 준다. cwd 가 공짜 격리 키였고
// 그게 디스크 미러의 유일한 존재 이유였다. run_id 를 붙이면 같은 질문을 DB 에 할 수 있다.
//
// 범위는 **탭 1개**다(sessionStorage). 새로고침해도 유지되고 — QA 는 한 탭에서 리로드를 섞는다 —
// 탭/워크트리가 다르면 갈라진다. sessionStorage 가 없으면(테스트·SSR) 메모리로 떨어진다.
import { randomUuid } from "@/util/id";

const RUN_ID_KEY = "oprn:ai-activity-run-id";

let memoryRunId: string | null = null;

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    // 일부 브라우저는 서드파티 컨텍스트에서 접근 자체를 throw 한다.
    return null;
  }
}

/** 이 탭의 런 식별자(uuid). 첫 호출에 발급하고 이후 같은 값을 준다. */
export function aiActivityRunId(): string {
  const store = sessionStore();
  if (store) {
    const existing = store.getItem(RUN_ID_KEY);
    if (existing) return existing;
  }
  if (!memoryRunId) memoryRunId = randomUuid();
  try {
    store?.setItem(RUN_ID_KEY, memoryRunId);
  } catch {
    /* quota/보안 오류는 메모리 값으로 계속 간다 */
  }
  return memoryRunId;
}

/** 테스트 전용 — 다음 호출이 새 런을 발급하게 만든다. */
export function resetAiActivityRunIdForTest(): void {
  memoryRunId = null;
  try {
    sessionStore()?.removeItem(RUN_ID_KEY);
  } catch {
    /* ignore */
  }
}
