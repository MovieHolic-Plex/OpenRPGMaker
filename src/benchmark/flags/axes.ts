import type { FlagAxisMeta } from "./types";

export const FLAG_AXES: readonly FlagAxisMeta[] = [
  { id: "declaration", label: "선언 정합성", question: "참조한 스위치/변수가 실제로 선언되어 있나?", weight: 0.14 },
  { id: "naming", label: "명명", question: "쓴 슬롯에 사람이 읽을 이름을 붙였나?", weight: 0.12 },
  { id: "registry", label: "서사 레지스트리", question: "storyFlags 로 의미를 등록했나?", weight: 0.08 },
  { id: "scopeChoice", label: "스코프 선택", question: "이벤트 로컬 상태에 self-switch 를 썼나?", weight: 0.13 },
  { id: "pageGating", label: "페이지 게이팅", question: "상태 변화를 이벤트 페이지 조건으로 반영했나?", weight: 0.16 },
  { id: "variableUsage", label: "변수 활용", question: "카운터/진행도에 변수와 산술·비교를 썼나?", weight: 0.13 },
  { id: "conditionalReads", label: "조건 읽기", question: "쓴 플래그를 어딘가에서 실제로 읽나?", weight: 0.12 },
  { id: "orphanFlags", label: "고아 플래그", question: "쓰고 안 읽거나 읽고 안 쓰는 플래그가 없나?", weight: 0.06 },
  { id: "integrity", label: "무결성", question: "lint error / 플래그 경고가 없나?", weight: 0.06 },
];
