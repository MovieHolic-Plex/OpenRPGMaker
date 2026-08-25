import {
  AUTHORING_TEST_GATE_BLOCKED_EVENT,
  evaluateAuthoringTestGate,
} from "@/editor/authoringJourney";
import { store } from "@/project/store";
import { toast } from "@/util/toast";

/** Shared fail-closed boundary for every editor surface that starts authored play. */
export function passesAuthoringTestGate(): boolean {
  const gate = evaluateAuthoringTestGate(store.getCurrent());
  if (gate.allowed) return true;
  window.dispatchEvent(new CustomEvent(AUTHORING_TEST_GATE_BLOCKED_EVENT, {
    detail: { referenceIssues: gate.referenceIssues },
  }));
  toast(`참조 문제 ${gate.referenceIssues.length}개를 해결해야 테스트할 수 있습니다. 여정의 문제 목록에서 데이터로 이동하세요.`, "error");
  return false;
}
