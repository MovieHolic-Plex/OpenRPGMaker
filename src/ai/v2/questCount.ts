// 「세는 퀘스트」 — 완성도 척도(scripts/fs-scale/score.mjs questFacts)의 퀘스트 규칙을 조수 하네스 안으로 옮긴 것이다(mapCount.ts 와 같은 방식).
// 척도와 같아야 한다: 단계 이름(label ?? description ?? title)을 정규화해 서로 다른 것이 2개 이상이고, 제목(제목 ?? key ?? id)이 다른 퀘스트와 달라야 센다.
// 함정: create_quest 의 단계 정의에는 label 이 선택이고 공식 예시(QUEST_DEF_EXAMPLE)에도 label 이 없다 — 예시대로 만들면 게임에서는 동작해도
// 척도로는 0개라 관문이 영영 안 닫힌다. 그래서 못 센 퀘스트마다 이유를 적고, 관문 문구의 예시 호출은 label 이 다른 단계 2개를 보인다.
// test/aiV2QuestCount.test.ts 가 같은 입력에서 척도 questFacts 와 같은 개수를 세는지 겨룬다.
import type { Project } from "@/project/types";

/** 끝맺음 관문이 강제하는 세는 퀘스트 수(2026-11-10 리드: 단계 1 권장 3 — 42분 안에 들어가는지 측정 뒤 올린다). */
export const MIN_COUNTED_QUESTS = 3;
/** 단계 1 권장(강제 아님) — 지금은 강제와 같다. */
export const RECOMMENDED_QUESTS = 3;

/** score.mjs normalizeLine 과 같다. */
const normalizeLine = (text: unknown): string =>
  String(text)
    .toLowerCase()
    .replace(/[0-9０-９]+/g, "")
    .replace(/[\s.,!?…~·'"“”‘’()\[\]{}:;\-_*]+/g, "");

type UncountedQuestReason = "steps" | "no-title" | "dup-title";
interface QuestCountResult {
  /** 센 퀘스트 제목(정규화 전). */
  readonly counted: readonly string[];
  readonly uncounted: readonly { readonly id: string; readonly title: string; readonly reason: UncountedQuestReason; readonly detail: string }[];
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

export function countQuests(project: Project): QuestCountResult {
  const quests = (Array.isArray((project as unknown as Obj).quests) ? (project as unknown as Obj).quests : []) as unknown[];
  const titles = new Set<string>();
  const counted: string[] = [];
  const uncounted: { id: string; title: string; reason: UncountedQuestReason; detail: string }[] = [];
  for (const raw of quests) {
    if (!isObj(raw)) continue;
    const id = String(raw.key ?? raw.id ?? "");
    const shown = String(raw.title ?? raw.key ?? raw.id ?? "");
    const steps = raw.steps ?? raw.nodes ?? [];
    const own = new Set<string>();
    for (const step of Array.isArray(steps) ? steps : []) {
      if (!isObj(step)) continue;
      const text = normalizeLine(step.label ?? step.description ?? step.title ?? "");
      if (text) own.add(text);
    }
    if (own.size < 2) { uncounted.push({ id, title: shown, reason: "steps", detail: `단계 이름(label) ${own.size}종<2` }); continue; }
    const title = normalizeLine(shown);
    if (!title) { uncounted.push({ id, title: shown, reason: "no-title", detail: "제목 없음" }); continue; }
    if (titles.has(title)) { uncounted.push({ id, title: shown, reason: "dup-title", detail: "제목이 앞 퀘스트와 같음" }); continue; }
    titles.add(title);
    counted.push(shown);
  }
  return { counted, uncounted };
}
