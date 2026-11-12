// 청사진 경로의 밑받침 — 단계 글 형(PathStepText), 이름 맞추기·장소 맵 찾기(blueprintMapFor), 조사·살펴보기 줄.
import type { GameMap, Project } from "@/project/types";

/** 모델이 단계별로 덧붙일 수 있는 글(전부 선택). 숫자 자물쇠를 원하면 code 와 앞 단계 lines 에 그 답을. */
export interface PathStepText {
  readonly id: string;
  readonly lines?: readonly string[];
  readonly lockedLines?: readonly string[];
  readonly doneLines?: readonly string[];
  readonly code?: string;
  readonly options?: readonly string[];
  readonly wrongLines?: readonly string[];
  /** battle 단계: 이긴 뒤 한두 줄(진 쪽의 말 또는 서술). */
  readonly winLines?: readonly string[];
  /** find·puzzle 단계: 그 장소에 그려진 물건 가운데 이 단계가 쓰는 것의 이름(build_places 결과의 things). */
  readonly on?: string;
  /** choice 단계: 고를 것들 — lines = 그것을 골랐을 때 그 사람의 답, later = 엔딩 직전에 보이는 «그 선택의 결과» 한 줄. */
  readonly choices?: readonly { readonly text: string; readonly lines?: readonly string[]; readonly later?: string }[];
  /** 이 단계가 다음 할 일일 때의 「현재 목표」 줄(플레이어에게 하는 말). */
  readonly goal?: string;
  /** 이 단계에서 손에 들어오는 물건의 이름(소지품에 들어가고 다음 단계가 확인한다). */
  readonly item?: string;
}

export const norm = (s: string) => s.normalize("NFC").replace(/[\s·・,.!?'"「」『』()[\]~\-_/]+/gu, "").toLowerCase();

export function sameName(a: string, b: string): boolean {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 2 && long.includes(short);
}

export function blueprintMapFor(project: Project, place: string): GameMap | undefined { return mapFor(project, place); }

export function mapFor(project: Project, place: string): GameMap | undefined {
  const maps = Object.values(project.maps);
  return maps.find((m) => m.id === place || norm(m.name ?? "") === norm(place)) ?? maps.find((m) => sameName(m.name ?? "", place));
}

/** 들고 다니는 물건 낱말이면 아이템, 아니면(알게 된 것·켜진 장치·호감) 스위치. */
const ITEM_WORD = /열쇠|키\b|카드|쪽지|메모|편지|지도|부적|반지|목걸이|도구|상자|병|약|책|일지|사진|조각|부품|톱니|태엽|램프|등불|key|card|note|letter|map|amulet|ring|tool|potion|book|photo|piece|gear/iu;

export const isItem = (gives: string) => ITEM_WORD.test(gives) && !/엔딩|ending|열림|풀림|알게|비밀번호|암호|번호|단서/iu.test(gives);

export const josa = (word: string, withBatchim: string, without: string) => {
  const last = word.trim().at(-1) ?? "";
  const code = last.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 ? (code % 28 ? withBatchim : without) : `${withBatchim}(${without})`;
};

/** 「~으로/로」 — 받침 ㄹ 이면 「로」. */
export const towardJosa = (word: string): string => {
  const code = (word.trim().at(-1) ?? "").charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return "(으)로";
  return code % 28 === 0 || code % 28 === 8 ? "로" : "으로";
};

/** 「책상 조사를 살펴보았다」처럼 이벤트 이름의 행동 낱말까지 읽지 않게 — 「책상을 살펴보았다」. */
export const eventNoun = (event: string): string => event.replace(/\s*(조사하기|조사|살펴보기|확인하기|확인|열기|탈출하기|탈출|찾기|수색)$/u, "").trim() || event;
export const lookLine = (event: string): string => {
  const noun = eventNoun(event);
  return `${noun}${josa(noun, "을", "를")} 살펴보았다.`;
};

export type RawPage = Record<string, unknown> & { conditions?: unknown[]; commands?: unknown[] };
