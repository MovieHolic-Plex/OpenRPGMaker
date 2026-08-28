// editor/panels/aiStartScreenCards.ts
// 조수 컴포저의 **추천 지시 문구 원천**. 파일 이름의 "시작 화면"은 역사적 잔재다 —
// 대기화면 3종(비주얼 갤러리 · 빠른 예시 카드 · 최근 작업 카드)은 2026-08-29 조수 띠로
// 넘어오면서 폐기됐다. 그 카드들이 쓰던 타일 모자이크·캐릭터셋 썸네일 렌더러도 함께 지웠다.
//
// 왜 문구만 남기나: 폐기된 것은 **카드라는 표면**이지 "무엇을 만들 수 있는지 알려주는 일"이
// 아니다. 지금 그 일은 컴포저 추천 칩(`ai-composer-chip`)과 팝오버가 한다 — 입력창이 비고
// 포커스가 있을 때만 뜨므로 띠 높이를 건드리지 않는다. 그래서 라벨·지시문만 남기고
// 그림 데이터는 버렸다(모자이크 배열 ~80줄은 사라진 갤러리 전용이었다).

import { el } from "@/util/dom";

export type AiAuthoringExampleKind = "road" | "npc" | "shop" | "chest" | "house" | "quest";

export type AiAuthoringExample = {
  readonly id: AiAuthoringExampleKind;
  readonly kind: AiAuthoringExampleKind;
  readonly label: string;
  readonly instruction: string;
};

/** 에디터 AI가 실제로 저작할 수 있는 대표 사례. */
export const AI_AUTHORING_EXAMPLES: readonly AiAuthoringExample[] = [
  {
    id: "road",
    kind: "road",
    label: "길",
    instruction: "현재 맵의 입구에서 중심 광장까지 2칸 폭 돌길을 연결하고, 막힘 없이 걸을 수 있는지 확인해줘.",
  },
  {
    id: "npc",
    kind: "npc",
    label: "NPC",
    instruction: "광장 주변에 서로 다른 대사와 역할을 가진 NPC 3명을 배치하고, 말을 걸면 자연스럽게 인사하게 해줘.",
  },
  {
    id: "shop",
    kind: "shop",
    label: "상점",
    instruction: "길가에 상점 NPC를 만들고, 말을 걸면 회복약과 해독초를 사고팔 수 있게 해줘.",
  },
  {
    id: "chest",
    kind: "chest",
    label: "상자",
    instruction: "집 옆에 한 번만 열리는 보물상자를 놓고, 열면 50G를 얻은 뒤 열린 모습으로 남게 해줘.",
  },
  {
    id: "house",
    kind: "house",
    label: "집",
    instruction: "길에 맞닿은 작은 집을 만들고, 문을 조사하면 실내 맵으로 들어갔다가 다시 밖으로 나올 수 있게 해줘.",
  },
  {
    id: "quest",
    kind: "quest",
    label: "퀘스트",
    instruction: "마을 NPC에게서 시작해 보물상자를 찾고 돌아오면 보상을 받는 짧은 퀘스트를 만들어줘.",
  },
];

export function buildAiAuthoringExamples(opts: {
  readonly examples?: readonly AiAuthoringExample[];
  readonly onPick: (instruction: string, id: string) => void;
}): HTMLElement {
  const examples = opts.examples ?? AI_AUTHORING_EXAMPLES;
  return el("div", {
    class: "ai-authoring-examples",
    dataset: { testid: "ai-authoring-examples" },
    children: [
      el("span", { class: "ai-authoring-examples-title", text: "이런 것도 만들 수 있어요" }),
      el("div", {
        class: "ai-authoring-example-chips",
        children: examples.map((example) =>
          el("button", {
            class: "ai-authoring-example-chip",
            text: example.label,
            attrs: { type: "button", title: example.instruction },
            dataset: { testid: `ai-authoring-example-${example.id}` },
            on: { click: () => opts.onPick(example.instruction, example.id) },
          }),
        ),
      }),
    ],
  });
}

/**
 * 추천 지시 한 건. 예전에는 `mosaicTiles` · `mosaicCols` · `charset` 으로 카드 그림까지
 * 실었지만 그 카드를 그리는 곳이 없어졌고, 지금 소비자(`directorStartPrompts` → 컴포저 칩)는
 * 라벨과 지시문만 읽는다.
 */
export type AiVisualStartPrompt = {
  readonly id: string;
  readonly label: string;
  readonly instruction: string;
};

/** 처음 바로 시도할 수 있는 결과 중심 5개. 내부 도구/스킬 이름은 노출하지 않는다. */
export function defaultAiVisualStartPrompts(): readonly AiVisualStartPrompt[] {
  return [
    {
      id: "place",
      label: "장소 만들기",
      instruction: "현재 맵에 집과 길, 나무가 자연스럽게 이어지는 작은 장소를 만들어줘.",
    },
    {
      id: "character",
      label: "등장인물 만들기",
      instruction: "현재 장소에 어울리는 등장인물 한 명을 만들고, 말을 걸면 자연스럽게 인사하도록 해줘.",
    },
    {
      id: "quest",
      label: "퀘스트 만들기",
      instruction: "현재 맵의 등장인물과 장소를 활용한 짧은 퀘스트를 만들어줘. 시작 조건과 완료 보상도 포함해줘.",
    },
    {
      id: "selection",
      label: "선택 영역 꾸미기",
      instruction: "선택한 영역을 나무와 풀, 꽃, 자연스러운 길이 어울리도록 꾸며줘.",
    },
    {
      id: "audit",
      label: "문제 검사/수정",
      instruction: "현재 맵에서 이동 불가, 막힌 입구, 어색한 타일이나 이벤트 문제를 검사하고 안전하게 고칠 변경안을 보여줘.",
    },
  ];
}
