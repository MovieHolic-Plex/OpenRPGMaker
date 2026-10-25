// editor/assetStore/gameUpdateDraft.ts
// 스토어 업데이트 글 초안 재료(2026-10-25). 조수 도구 store_game_changes 가 쓴다 — 조수가 바뀐 점과 대본 변화를 읽고
// 「소식」 글(제목·마크다운 본문)과 판본 코멘트를 쓴다. 올리는 것은 store_game_post 카드에서 사용자가 누를 때다.
// DOM·스토어를 모른다.
import type { Project } from "@/project/types";
import { collectDialogueLines } from "@/editor/dialogue/dialogueIndex";
import type { StoreGameChanges } from "@/project/storeGameRelease";

export interface ScreenplayLine { readonly where: string; readonly speaker: string; readonly text: string }
export interface ScreenplayChanges {
  /** 새로 생긴 대사(장면 순서대로, 최대 limit 줄). */
  readonly added: readonly ScreenplayLine[];
  readonly addedTotal: number;
  /** 사라진 대사 수(글은 싣지 않는다 — 초안에 「없어진 장면」을 쓸 때만 참고). */
  readonly removedTotal: number;
  /** 대사가 바뀐 장면 이름(최대 20). */
  readonly scenes: readonly string[];
}

const lineKey = (line: { groupKey: string; speaker: string; text: string }) => `${line.groupKey}\u0000${line.speaker}\u0000${line.text}`;

function linesOf(project: Project | null) {
  if (!project) return [];
  try {
    return collectDialogueLines(project).filter((line) => line.kind === "text" || line.kind === "choiceOption" || line.kind === "ending");
  } catch {
    return []; // 옛 판본 project.json 이 지금 모양과 다르면 대본 비교는 건너뛴다.
  }
}

/** 두 판본의 대본(대사) 차이. before 가 없으면(첫 판본) 바뀐 것이 없다. */
export function screenplayChanges(before: Project | null, after: Project, limit = 40): ScreenplayChanges {
  if (!before) return { added: [], addedTotal: 0, removedTotal: 0, scenes: [] };
  const old = new Map<string, number>();
  for (const line of linesOf(before)) old.set(lineKey(line), (old.get(lineKey(line)) ?? 0) + 1);
  const added: ScreenplayLine[] = [];
  const scenes = new Set<string>();
  let addedTotal = 0;
  for (const line of linesOf(after)) {
    const key = lineKey(line);
    const left = old.get(key) ?? 0;
    if (left > 0) { old.set(key, left - 1); continue; }
    addedTotal += 1;
    scenes.add(line.groupLabel);
    if (added.length < limit) added.push({ where: line.groupLabel, speaker: line.speaker, text: line.text.slice(0, 200) });
  }
  let removedTotal = 0;
  for (const count of old.values()) removedTotal += count;
  return { added, addedTotal, removedTotal, scenes: [...scenes].slice(0, 20) };
}

/** 조수에게 넘길 바뀐 점 요약(이름 목록은 자른다, 내부 id 같은 이름은 뺀다). */
export function briefChanges(changes: StoreGameChanges, cap = 12) {
  const internal = (name: string) => /[a-z]+_[a-z0-9_]*[0-9a-f]{8}/i.test(name);
  const pick = (names: readonly string[]) => {
    const human = names.filter((name) => !internal(name));
    return { count: names.length, names: human.slice(0, cap) };
  };
  return Object.fromEntries(Object.entries(changes).map(([kind, set]) => [kind, { added: pick(set.added), changed: pick(set.changed), removed: pick(set.removed) }]));
}

/** 소식 글 쓰는 법(조수 지침). 스토어 서버 src/markdown.ts 와 같은 문법만 쓴다. */
export const POST_WRITING_GUIDE = [
  "플레이어에게 쓰는 글이다. 개발자 낱말(PR 번호, 브랜치, 내부 id, 파일 이름)은 쓰지 마라.",
  "제목은 한 줄(120자 이하), 무엇이 새로 생겼는지가 보이게.",
  "본문은 짧은 첫 문단 → ## 새로 들어온 것 / ## 손본 것 / ## 고친 것 목록 → 마무리 한 줄. 대본 변화에서 줄거리를 스포일러 없이 맛보기로만 쓴다.",
  "쓸 수 있는 문법: # ## ### 제목, - 목록, 1. 번호, **굵게**, *기울임*, [글](https://…), > 인용, ---. HTML 은 글자 그대로 보인다.",
  "그림은 ![설명](경로) — 그 판본에 들어 있는 그림 파일 경로(images 목록)만 보인다. 없는 경로·다른 사이트 그림은 안 보인다.",
  "제작자 코멘트(comment)는 작가 말투의 한두 문장(600자 이하). 사용자가 쓴 말이 있으면 그 말을 살린다.",
].join("\n");
