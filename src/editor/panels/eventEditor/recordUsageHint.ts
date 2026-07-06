import { store } from "@/project/store";
import { el } from "@/util/dom";

// [치명-2] 스위치/변수 조작 폼의 빈 공간에 표시하는 참조 요약.
// 프로젝트 이벤트(맵 이벤트 + 공통 이벤트)에서 해당 레코드 id 가 몇 곳에서 쓰이는지 센다.
export function recordUsageHint(kind: "switch" | "variable", recordId: string): HTMLElement {
  const label = kind === "switch" ? "스위치" : "변수";
  if (!recordId) {
    return el("div", {
      class: "event-command-record-usage",
      text: `${label}를 선택하면 참조 위치 요약이 표시됩니다.`,
      dataset: { testid: `event-command-${kind}-usage` },
    });
  }
  const count = countRecordReferences(recordId);
  return el("div", {
    class: "event-command-record-usage",
    text: count > 0 ? `이 ${label} 참조: 프로젝트 이벤트 ${count}곳` : `이 ${label}는 다른 곳에서 아직 참조되지 않습니다.`,
    dataset: { testid: `event-command-${kind}-usage` },
  });
}

function countRecordReferences(recordId: string): number {
  const project = store.getCurrent();
  const needle = `"${recordId}"`;
  let count = 0;
  try {
    const haystack = JSON.stringify(project.maps) + JSON.stringify(project.commonEvents ?? []);
    let cursor = haystack.indexOf(needle);
    while (cursor >= 0) {
      count += 1;
      cursor = haystack.indexOf(needle, cursor + needle.length);
    }
  } catch {
    return 0;
  }
  return count;
}
