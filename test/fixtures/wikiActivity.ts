import type { WorldEntity } from "@/project/world/types";

export function wikiActivity(index = 0): WorldEntity {
  const text = JSON.stringify({ summary: `표지판 이동 ${index}`, appliedTools: ["move_event"], maps: [] });
  return {
    id: `w_applied_${index}`, type: "guideline", name: "적용된 작업", summary: `표지판 이동 ${index}`, body: text, origin: "ai",
    wiki: { kind: "progress", basis: "observed", topic: `wiki_applied_${index}`,
      sources: [{ id: `wiki_applied_${index}`, kind: "application", text, at: 1_789_900_000_000 + index }] },
  };
}

export const manualWikiNote: WorldEntity = {
  id: "w_manual_note", type: "guideline", name: "표지판 디자인", summary: "표지판 이동 시에도 글씨를 유지한다", origin: "user",
  wiki: { kind: "knowledge", basis: "explicit", topic: "wiki_applied_0",
    sources: [{ id: "manual_note", kind: "manual", text: "수동 편집 메모 · 원본 w_applied_0", at: 1_789_900_001_000 }] },
};
