// 그림 있는 선택 카드 — 마을 탭의 글자 <select> 를 대체하는 공용 컨트롤.
//
// databaseControls 에 넣지 않는 이유: 그 모듈은 폼 크롬(라벨·숫자·세그먼트)만 알고,
// 타일 미리보기·킷 id 같은 마을 지식을 끌어들이면 공용이 아니게 된다.
// databaseVillageView 에 넣지 않는 이유: 카드 DOM(radiogroup·radio 버튼·미디어 슬롯)은
// 층수·킷뿐 아니라 이후 프리셋 필드도 쓸 자리라, 뷰가 커지지 않게 여기로 뺀다.
//
// 값 계약은 예전 select 와 같다. 필드 testid 는 radiogroup 에 남고, data-value 가
// 현재 값이다(비움은 ""). 카드 클릭은 onChange(id) 또는 비움이면 onChange(undefined).

import { field } from "@/editor/panels/databaseControls";
import { el } from "@/util/dom";

export type VisualSelectOption = {
  readonly id: string;
  readonly name: string;
  readonly meta?: string;
};

export function visualSelect(args: {
  readonly label: string;
  readonly testid: string;
  readonly value: string;
  readonly options: readonly VisualSelectOption[];
  readonly allowUnset?: boolean;
  readonly unsetLabel?: string;
  readonly mediaFor: (id: string | undefined) => HTMLElement;
  readonly onChange: (id: string | undefined) => void;
}): HTMLElement {
  const cards: HTMLElement[] = [];
  if (args.allowUnset) {
    cards.push(optionCard(args, undefined, args.unsetLabel ?? "지정 안 함"));
  }
  for (const option of args.options) {
    cards.push(optionCard(args, option.id, option.name, option.meta));
  }
  return field(args.label, el("div", {
    class: "db-village-option-grid",
    attrs: { role: "radiogroup", "aria-label": args.label },
    dataset: { testid: args.testid, value: args.value },
    children: cards,
  }));
}

function optionCard(
  args: {
    readonly testid: string;
    readonly value: string;
    readonly mediaFor: (id: string | undefined) => HTMLElement;
    readonly onChange: (id: string | undefined) => void;
  },
  id: string | undefined,
  name: string,
  meta?: string,
): HTMLElement {
  const checked = (id ?? "") === args.value;
  return el("button", {
    class: `db-village-option-card${checked ? " active" : ""}`,
    attrs: {
      type: "button",
      role: "radio",
      "aria-checked": checked ? "true" : "false",
      title: name,
    },
    dataset: { testid: id === undefined ? `${args.testid}-unset` : `${args.testid}-${id}` },
    on: {
      click: () => {
        if ((id ?? "") === args.value) return;
        args.onChange(id);
      },
    },
    children: [
      el("span", {
        class: "db-village-option-media",
        attrs: { "aria-hidden": "true" },
        children: [args.mediaFor(id)],
      }),
      el("span", { class: "db-village-option-name", text: name }),
      ...(meta ? [el("span", { class: "db-village-option-meta", text: meta })] : []),
    ],
  });
}
