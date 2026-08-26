// 이미지 리치 채팅 (감독 지시 2026-08-25: "조수는 반드시 이미지 리치한 채팅. 몬스터를
// 언급하면 몬스터 썸네일, 아이템이면 아이템 썸네일").
//
// 실측한 결함: aiChatRenderers 에는 타일 어휘 카드용 `ai-vocab-thumb` 만 있었고 어시스턴트
// 버블은 순수 텍스트였다. 정작 `recordListThumbnail`(databaseRecordThumbnails.ts:30)이
// 몬스터·아이템·등장인물 썸네일을 이미 그릴 수 있는데 조수 표면에서 한 번도 쓰이지 않았다.
//
// 이 스펙은 장식 씨앵(decorateAssistantMentions)을 직접 잡는다 — 실제 턴 배선은
// 라이브 브라우저 스샷으로 증명한다(verify-shots/ux-after).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decorateAssistantMentions } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;

function projectWithRecords(): Project {
  const project = createBlankProject();
  const enemies = project.database.enemies;
  const items = project.database.items;
  // 기존 레코드 모양을 그대로 복제해 이름만 바꾼다 — 스키마를 손으로 재현하면 필드가 새로
  // 생길 때마다 이 픽스처가 조용히 낡는다.
  const enemyTemplate = enemies[0];
  const itemTemplate = items[0];
  if (!enemyTemplate || !itemTemplate) throw new Error("빈 프로젝트에 적/아이템 템플릿이 없다");
  return {
    ...project,
    database: {
      ...project.database,
      enemies: [{ ...enemyTemplate, id: "enemy_slime_king", name: "슬라임 왕" }],
      items: [{ ...itemTemplate, id: "item_potion", name: "빨간 물약" }],
    },
  } as Project;
}

function bubble(): HTMLElement {
  return el("div", { class: "ai-chat-bubble" });
}

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(projectWithRecords());
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  vi.restoreAllMocks();
});

describe("어시스턴트 문장이 언급한 자료의 썸네일", () => {
  it("몬스터와 아이템을 언급하면 문장 아래에 썸네일 칩 스트립이 붙는다", () => {
    const host = bubble();

    decorateAssistantMentions(host, "슬라임 왕을 배치하고 빨간 물약을 상자에 넣었습니다.", store.getCurrent());

    const strip = findByTestId(host as unknown as FakeElement, "ai-mention-strip");
    expect(strip).toBeTruthy();
    expect(findByTestId(host as unknown as FakeElement, "ai-mention-enemies-enemy_slime_king")).toBeTruthy();
    expect(findByTestId(host as unknown as FakeElement, "ai-mention-items-item_potion")).toBeTruthy();
    expect(strip?.textContent).toContain("슬라임 왕");
    expect(strip?.textContent).toContain("빨간 물약");
  });

  it("언급이 없으면 아무것도 붙이지 않는다", () => {
    const host = bubble();

    decorateAssistantMentions(host, "길을 이어 두었습니다.", store.getCurrent());

    expect(findByTestId(host as unknown as FakeElement, "ai-mention-strip")).toBeNull();
  });

  it("같은 버블을 다시 장식해도 스트립이 중복으로 쌓이지 않는다", () => {
    const host = bubble();
    const text = "슬라임 왕이 나타났다";

    decorateAssistantMentions(host, text, store.getCurrent());
    decorateAssistantMentions(host, text, store.getCurrent());

    const strips = (host as unknown as FakeElement).children.filter(
      (child) => (child as FakeElement).dataset?.testid === "ai-mention-strip",
    );
    expect(strips).toHaveLength(1);
  });

  it("빈 문장이나 null 버블에는 아무 일도 하지 않는다", () => {
    const host = bubble();

    decorateAssistantMentions(host, "", store.getCurrent());
    expect(findByTestId(host as unknown as FakeElement, "ai-mention-strip")).toBeNull();

    expect(() => decorateAssistantMentions(null, "슬라임 왕", store.getCurrent())).not.toThrow();
  });
});
