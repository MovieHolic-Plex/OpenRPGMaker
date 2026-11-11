// 판정 결과 한 모양 — 판정자마다 다르던 «문제» 형(표지 붙은 줄 · ShipBlocker · PlayProblem · SceneCraftFinding …)을 이 하나로 모은다.
// 2026-11-11 리팩토링 R5 뒤 절반(openwiki/assistant-v2-refactor.md): 같은 사실(무엇이 문제인가 · 누가 고치나 · 완료를 막나)을 글머리 정규식으로 다시 읽지 않게 한다.

export type FindingJudge = "game" | "ship" | "combat" | "scene" | "place" | "play" | "todo" | "vqa" | "advisor" | "critic";

export interface Finding {
  /** 어느 판정자가 냈나 — 장부·보고의 묶음. */
  readonly judge: FindingJudge;
  /** 규칙 id — 글머리 표지의 주제(「음악」 · 「타이틀 모양」)나 출하 차단 id(「no-healing」). 글이 바뀌어도 같은 문제다. */
  readonly id: string;
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

const TAG = /^\[(게임 검사|출하 차단|scene) ([^\]]+)\]/u;
const TAG_JUDGE: Readonly<Record<string, FindingJudge>> = { "게임 검사": "game", "출하 차단": "ship", scene: "scene" };

/** 표지 붙은 관문 줄을 Finding 으로 읽는다 — 판정자가 Finding 을 바로 낼 때까지의 다리. 표지가 없는 줄은 game/untagged. */
export function fromLine(line: string): Finding {
  const m = TAG.exec(line);
  return { judge: m ? TAG_JUDGE[m[1]!]! : "game", id: m ? m[2]! : "untagged", severity: "block", owner: "model", ko: line };
}
