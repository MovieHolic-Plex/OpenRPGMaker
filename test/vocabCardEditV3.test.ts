// test/vocabCardEditV3.test.ts
// 어휘 프로포절 카드 인라인 편집 (타일 툴 v3 설계 축 6 — V3B).
// 고정하는 계약: (1) data.cards가 카드 UI로 렌더된다(AI 추정 표기 + 사실 배지 + 편집 필드
// testid ai-vocab-card-<n>/ai-vocab-edit-<field>-<n>) (2) 편집값이 수락 시 커밋되는 값 —
// 편집된 args 재조립(UXD 부분 수락 재실행 패턴)이 origin:"user"와 함께 프로젝트에 반영된다.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ProposedCall } from "@/ai/assistantSession";
import {
  applyVocabularyCardEdits,
  callsWithVocabularyEdits,
  hasVocabularyEdits,
  reassembleSelectedProposalProject,
  renderVocabularyCardList,
  vocabularyCardsData,
  type VocabularyCardEdit,
} from "@/editor/panels/aiChatPanel";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { Project } from "@/project/types";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

// propose_tile_vocabulary를 실제 실행해 ProposedCall 모양의 픽스처를 만든다.
function proposeCall(project: Project): { call: ProposedCall; groupId: string } {
  const groupId = project.tilesets[DEFAULT_TILESET_ID].tileGroups![0].id;
  const args = {
    items: [{ kind: "group", groupId, name: "석벽", role: "wall", patternKind: "nine_slice_expandable", layerHome: "lower" }],
  };
  const ctx: ToolContext = { project: structuredClone(project) };
  const result = runTool(ctx, "propose_tile_vocabulary", structuredClone(args));
  expect(result.ok, result.summary).toBe(true);
  return { call: { name: "propose_tile_vocabulary", args, summary: result.summary, result, destructive: false }, groupId };
}

describe("어휘 카드 렌더 + 인라인 편집", () => {
  it("data.cards가 카드로 렌더되고(AI 추정/사실 배지/편집 필드) 편집 이벤트가 편집값으로 수집된다", () => {
    const project = createBlankProject();
    const { call } = proposeCall(project);
    expect(vocabularyCardsData(call)?.cards).toHaveLength(1);

    const edits = new Map<number, VocabularyCardEdit>();
    const rendered = renderVocabularyCardList(project, call, 1, (cardIndex, field, value) => {
      const entry = edits.get(cardIndex) ?? {};
      entry[field] = value;
      edits.set(cardIndex, entry);
    });
    expect(rendered).not.toBeNull();
    const root = rendered!.element as unknown as FakeElement;
    const card = findByTestId(root, "ai-vocab-card-1") as unknown as FakeElement;
    expect(card).toBeTruthy();
    expect(card.textContent).toContain("AI 추정"); // 추정 표기(원칙 0)
    expect(card.textContent).toContain("사실"); // 결정론 사실 배지 병기

    const nameInput = findByTestId(root, "ai-vocab-edit-name-1") as unknown as FakeElement;
    nameInput.value = "돌담";
    nameInput.dispatchEvent(new Event("change"));
    const layerSelect = findByTestId(root, "ai-vocab-edit-layerHome-1") as unknown as FakeElement;
    layerSelect.value = "perCell";
    layerSelect.dispatchEvent(new Event("change"));
    const roleSelect = findByTestId(root, "ai-vocab-edit-role-1") as unknown as FakeElement;
    expect(roleSelect).toBeTruthy();
    expect(findByTestId(root, "ai-vocab-edit-patternKind-1")).toBeTruthy();

    expect(edits.get(0)).toMatchObject({ name: "돌담", layerHome: "perCell" });
  });

  it("편집값이 수락 시 커밋되는 값이다 — 재조립 재실행 경로가 편집된 이름/layerHome을 origin:user로 반영", () => {
    const project = createBlankProject();
    const { call, groupId } = proposeCall(project);
    const editsByCall = new Map<number, Map<number, VocabularyCardEdit>>([
      [0, new Map([[0, { name: "돌담", layerHome: "upper" }]])],
    ]);
    expect(hasVocabularyEdits(editsByCall)).toBe(true);
    const effective = callsWithVocabularyEdits([call], editsByCall);
    expect(effective).not.toBe([call]);
    const editedItem = (effective[0].args.items as Record<string, unknown>[])[0];
    expect(editedItem).toMatchObject({ name: "돌담", layerHome: "upper" });
    // 원본 call.args는 오염되지 않는다(구조 복제).
    expect((call.args.items as Record<string, unknown>[])[0].name).toBe("석벽");

    // 수락 경로와 동일한 재조립 재실행(reassembleSelectedProposalProject) — 커밋값 검증.
    const reassembled = reassembleSelectedProposalProject(project, effective, [true]);
    expect(reassembled.ok).toBe(true);
    if (!reassembled.ok) return;
    const group = reassembled.project.tilesets[DEFAULT_TILESET_ID].tileGroups!.find((entry) => entry.id === groupId)!;
    expect(group).toMatchObject({ name: "돌담", layerHome: "upper", origin: "user" });
  });

  it("applyVocabularyCardEdits: 빈 이름은 무시하고 patternKind ''는 제거로 취급한다", () => {
    const args = { items: [{ kind: "group", name: "석벽", role: "wall", patternKind: "nine_slice_expandable", layerHome: "lower" }] };
    const next = applyVocabularyCardEdits(args, new Map([[0, { name: "   ", patternKind: "" }]]));
    const item = (next.items as Record<string, unknown>[])[0];
    expect(item.name).toBe("석벽");
    expect(item.patternKind).toBeUndefined();
  });
});
