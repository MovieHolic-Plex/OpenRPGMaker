// 단계가 건네는 것 — 소지품에 드는 물건인가, 켜지기만 하는 진행인가. 모델이 item 칸을 아껴 쓰는지에 기대지 않고 단계의 종류와 그 단계의 화면 글로 가른다.
// 왜·증거는 openwiki/assistant-v2.md 「소지품에 드는 것은 단계가 정한다」.
import type { GameBlueprintStep } from "@/project/gameBlueprint";
import { isItem, type PathStepText } from "./blueprintPathNames";

/** 플레이어가 그 단계에서 읽는 글 — 대사 · 이긴 뒤(맞힌 뒤) 글 · 고른 답. */
export const shownLines = (t: PathStepText | undefined): string[] => [...(t?.lines ?? []), ...(t?.winLines ?? []), ...(t?.choices ?? []).flatMap((o) => o.lines ?? [])];

/** 그 글이 이 이름의 물건 낱말(마지막 어절)을 부르는가 — 한 글자 낱말은 이름 전체로 본다(「약」 이 「약속」 에 걸리지 않게). */
function named(name: string, lines: readonly string[]): boolean {
  const head = name.trim().split(/\s+/u).at(-1) ?? "";
  const word = head.length >= 2 ? head : name.trim();
  return !!word && lines.some((line) => line.includes(word));
}

/** 함수가 건네는 쪽지 — 번호를 알려 준 상대가 맵에서 사라질 때 그 글을 들고 다니게 한다. */
const MEMO = { item: "번호 쪽지", line: "번호를 쪽지에 적어 두었다." } as const;

export interface Handover {
  /** 소지품에 들어오는 물건 이름. 없으면 진행은 스위치로만 잇는다(«얻었다» 줄도 없다). */
  readonly item?: string;
  /** 그 물건의 소지품 설명 — 번호를 알려 준 글(메뉴에서 다시 읽는다). */
  readonly note?: string;
  /** 건넬 때의 한 줄 — 없으면 «『물건』을 얻었다.». */
  readonly line?: string;
}

/**
 * 이 단계에서 소지품에 들어오는 것.
 *  - 마지막 단계는 엔딩을 부른다 — 건네지 않는다. 종류 없는 옛 청사진은 전과 같다(item, 없으면 gives 의 물건 낱말).
 *  - 뒤 자물쇠의 번호를 알려 주는 단계(told): 알려 준 것이 맵에 남으면(사람·물건 — 그 자리에서 다시 읽는다) 건네지 않고,
 *    사라지면(쓰러진 상대 — leaves) 그 글을 적은 쪽지를 건넨다.
 *  - 줍는 단계(find)는 적힌 물건 그대로. 사람·상대·자물쇠의 단계는 그 단계의 화면 글이 그 물건을 부를 때만 — 글이 건네지 않은 것은 소지품에 없다.
 */
export function stepHandover(step: Pick<GameBlueprintStep, "kind" | "gives">, t: PathStepText | undefined, at: { readonly last: boolean; readonly told?: string; readonly leaves: boolean }): Handover {
  if (at.last) return {};
  const wanted = t?.item?.trim() || (isItem(step.gives) ? step.gives : undefined);
  if (!step.kind) return wanted ? { item: wanted } : {};
  const lines = shownLines(t);
  if (at.told) {
    if (!at.leaves) return {};
    const note = lines.filter((line) => line.includes(at.told!)).join(" ");
    // 이름은 청사진이 지은 것(item, 없으면 gives)이 글에 불릴 때 그것 — «구겨진 쪽지가 떨어졌다» 의 쪽지. 글이 부르지 않으면 함수의 쪽지.
    const dropped = wanted ?? step.gives?.trim();
    return dropped && named(dropped, lines) ? { item: dropped, note } : { ...MEMO, note };
  }
  if (!wanted) return {};
  return step.kind === "find" || named(wanted, lines) ? { item: wanted } : {};
}
