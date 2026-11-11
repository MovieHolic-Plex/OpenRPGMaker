// 판정 결과 한 모양 — 판정자마다 다르던 «문제» 형(표지 붙은 줄 · ShipBlocker · PlayProblem · SceneCraftFinding …)을 이 하나로 모은다.
// 2026-11-11 리팩토링 R5 뒤 절반(openwiki/assistant-v2-refactor.md): 같은 사실(무엇이 문제인가 · 누가 고치나 · 완료를 막나)을 글머리 정규식으로 다시 읽지 않게 한다.

/** 판정 묶음 — 보고·장부에서 한데 모이는 단위(글머리 표지가 있는 묶음은 그 표지와 같다: game = 「게임 검사」 · ship = 「출하 차단」). */
export type FindingJudge = "game" | "ship" | "scene" | "place" | "play" | "todo" | "vqa" | "advisor" | "critic";

export interface Finding {
  readonly judge: FindingJudge;
  /** 규칙 id — 글머리 표지의 주제(「음악」 · 「타이틀 모양」)나 출하 차단 id(「no-healing」). 글이 바뀌어도 같은 문제다. */
  readonly id: string;
  /** 같은 규칙 id 아래의 갈래(「화면」 의 shake · flash · letterbox) — 표지는 같아도 다른 문제다. 열쇠와 영어 글이 갈린다. */
  readonly variant?: string;
  /** 무엇에 대한 것인가 — 열쇠와 «어디를 고칠지»에 쓴다. */
  readonly target?: { readonly mapId?: string; readonly eventId?: string; readonly x?: number; readonly y?: number; readonly ref?: string };
  /** block = 완료를 막는다 · polish = 장부에만 · note = 보고에만. */
  readonly severity: "block" | "polish" | "note";
  /** 누가 고칠 수 있나 — model(할 일로 건넨다) · builder(끝맺음 단계 몫) · outside(런타임·그림, 모델에게 넘기지 않는다). */
  readonly owner: "model" | "builder" | "outside";
  /** 보고·장부에 실리는 줄 — 글머리 표지까지 든 지금의 관문 줄 그대로다. */
  readonly ko: string;
  /** 모델이 받는 글(영어). 없으면 ko. */
  readonly en?: string;
  /** 고치는 호출(동사 뼈대)을 알면. */
  readonly fix?: string;
  readonly evidence?: string;
}

/** 보고·할 일에 실리는 관문 줄. */
export const findingLine = (f: Finding): string => f.ko;

/** 관문 열쇠 — 글이 아니라 판정 묶음·규칙·대상에서 나온다. 글(이름·개수·목록)이 바뀌어도 같은 문제는 같은 항목이고, 시도 상한이 그 항목에서 센다. */
export function findingKey(f: Finding): string {
  const rule = `${f.judge}:${f.id}${f.variant ? `/${f.variant}` : ""}`, t = f.target;
  return t ? `${rule}:${t.mapId ?? ""}:${t.eventId ?? t.ref ?? ""}` : rule;
}

/** 글머리 표지 낱말 — 판정 묶음마다 하나(「[게임 검사 음악] …」 · 「[출하 차단 no-healing] …」 · 「[scene thin] …」). */
const TAG_WORD = { game: "게임 검사", ship: "출하 차단", scene: "scene" } as const;
type TaggedJudge = keyof typeof TAG_WORD;

/** 판정자가 문제 하나를 낸다 — 줄 글은 «[표지 id] body» 로 지금과 같다. */
export function tagged(judge: TaggedJudge, id: string, body: string, more?: Pick<Finding, "target" | "evidence" | "variant">): Finding {
  return { judge, id, severity: "block", owner: "model", ko: `[${TAG_WORD[judge]} ${id}] ${body}`, ...more };
}
