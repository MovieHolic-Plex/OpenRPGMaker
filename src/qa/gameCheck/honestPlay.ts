// qa/gameCheck/honestPlay.ts
// 정직한 자동 플레이 — 기계 플레이어가 «사람이 볼 수 있는 것» 만 쓰게 한다.
//
// 왜 (2026-11-12 r1w-fun 「불씨를 되찾아서」): 눈가림 판정자는 청사진 7단계 중 2단계에서 막혔는데(엔딩 없음) 자동 플레이는 «엔딩 도달» 이었다.
// 자동 플레이는 계획표(엔딩 ← 스위치 ← 그 스위치를 켜는 이벤트)의 좌표로 걸어가므로, 그림도 이름도 알려 준 적 없는 「번호 쪽지」를 조사했고
// 번호는 명령의 정답 갈래에서 읽어 넣었다. 사람은 화면에 보이는 것과 읽은 글만 안다.
//
// 규칙 셋(어기면 그 목표에서 멈추고 까닭을 적는다 — `HONEST_CAUSES` 의 머리말로 시작한다):
//  1) 조사(action)로 여는 이벤트는 보여야 한다: 제 그림 · 늘 빛나는 표지 · 이름이 맞는 그려진 물건(project/eventSight).
//     이름이 다른 물건 그림 위(돌무더기 위의 「번호 쪽지」)면 그 이름을 이미 읽은 글(대사·목표 줄)이 불러 줬어야 한다.
//  2) 밟아서 여는(접촉) 이벤트는 그림이 없어도 된다 — 다른 맵으로 옮기는 칸이거나, 보이는 것들 사이를 걷는 길 위에 있으면.
//  3) 숫자 입력의 답은 이미 읽은 글에 있어야 한다(통째로, 조각으로, 「7 _ 9 _」 꼴로).
// 무엇을 «읽었다» 로 치는가: 러너가 띄운 대사·선택지 물음(finalState.messages)과 목표 줄·알림(session.m2Runtime.ui).

import { canMove } from "@/project/collision";
import { eventSight, thingWord } from "@/project/eventSight";
import type { PlaySession } from "@/project/session";
import type { EventPage, GameEvent, GameMap, Project } from "@/project/types";
import type { RawCommand } from "./walk";

/** 정직한 플레이가 멈춘 까닭 — 실패 글의 머리말(보고서·표가 이 글로 가른다). */
export const HONEST_CAUSES = {
  unseen: "정직한 플레이 — 보이지 않는 것",
  unnamed: "정직한 플레이 — 다른 물건 그림 위",
  code: "정직한 플레이 — 알려 주지 않은 번호",
  touch: "정직한 플레이 — 밟을 까닭이 없는 칸",
} as const;
export type HonestCause = keyof typeof HONEST_CAUSES;

/** 실패 글이 정직한 플레이의 멈춤이면 그 까닭. */
export function honestCauseOf(detail: string | undefined): HonestCause | undefined {
  return (Object.keys(HONEST_CAUSES) as HonestCause[]).find((key) => (detail ?? "").includes(HONEST_CAUSES[key]));
}

export interface HonestMoment {
  readonly project: Project;
  /** changeTile 까지 입힌 지금 맵. */
  readonly map: GameMap;
  readonly session: PlaySession;
  /** 지금까지 띄운 글(대사·물음). */
  readonly messages: readonly string[];
  /** 컷신이 옮긴 이벤트 칸. */
  readonly moved?: Readonly<Record<string, { readonly x: number; readonly y: number }>>;
  /** 지금 조건이 맞는 페이지를 고른다(자동 플레이의 눈과 같게). */
  readonly pageOf: (event: GameEvent) => EventPage | undefined;
}

const squash = (text: string): string => text.replace(/\s+/gu, "");

/** 지금까지 읽은 글 — 대사·물음 + 목표 줄·알림. 필드 안내를 끈 게임은 목표 줄 끝의 「어디」 꼬리(괄호)를 보이지 않는다. */
export function shownTexts(moment: Pick<HonestMoment, "project" | "session" | "messages">): string[] {
  const guides = moment.project.system?.fieldGuides;
  const tailHidden = guides === "off" || guides === "arrows";
  const ui = (moment.session.m2Runtime?.ui ?? []).map((entry) => (tailHidden && entry.surface.trim() === "objectiveChip" ? entry.message.replace(/\s*\([^()]*\)\s*$/u, "") : entry.message));
  return [...moment.messages, ...ui];
}

/** 읽은 글이 그 이름을 불렀는가 — 이름 통째, 또는 이름의 물건 낱말. */
function named(texts: readonly string[], name: string | undefined): boolean {
  const full = squash(name ?? "");
  if (full.length < 2) return false;
  const word = thingWord(name);
  return texts.some((text) => { const t = squash(text); return t.includes(full) || (word !== undefined && t.includes(word)); });
}

/** 번호가 읽은 글에 있는가 — 통째로 · 홀로 선 숫자 조각들을 이어서 · 「7 _ 9 _」 처럼 자리별로 겹쳐서. */
export function codeShown(code: string, texts: readonly string[]): boolean {
  if (!code) return true;
  if (texts.some((text) => text.replace(/(?<=\d)[\s·\-.,](?=\d)/gu, "").includes(code))) return true;
  const pieces = new Set(texts.flatMap((text) => text.match(/(?<!\d)\d+(?!\d)/gu) ?? []));
  const built = (rest: string, parts: number): boolean => rest === "" ? parts >= 2
    : [...pieces].some((piece) => piece.length < code.length && rest.startsWith(piece) && built(rest.slice(piece.length), parts + 1));
  if (built(code, 0)) return true;
  const got: (string | undefined)[] = new Array(code.length).fill(undefined);
  for (const text of texts) for (const hit of text.matchAll(/[0-9_＿?○□*](?:[\s·-]*[0-9_＿?○□*])*/gu)) {
    const marks = [...hit[0].replace(/[\s·-]/gu, "")];
    if (marks.length !== code.length) continue;
    marks.forEach((mark, i) => { if (/\d/u.test(mark)) got[i] ??= mark; });
  }
  return got.join("") === code;
}

/** 이 페이지가 숫자 입력 앞에 스스로 띄우는 글(자물쇠 앞의 「문에 4821 이라 적혀 있다」). */
function textsBeforeInput(commands: readonly RawCommand[]): { texts: string[]; inputs: { variableId: string; digits?: number }[] } {
  const texts: string[] = [], inputs: { variableId: string; digits?: number }[] = [];
  const walk = (list: readonly RawCommand[]): void => {
    for (const command of list) {
      if (command.kind === "text" && typeof command.body === "string") texts.push(command.body);
      if (command.kind === "inputNumber" && typeof command.variableId === "string") inputs.push({ variableId: command.variableId, ...(typeof command.digits === "number" ? { digits: command.digits } : {}) });
      for (const value of Object.values(command)) if (Array.isArray(value) && value.length && typeof value[0] === "object" && value[0] && "kind" in (value[0] as object)) walk(value as RawCommand[]);
    }
  };
  walk(commands);
  return { texts, inputs };
}

const DIRS4 = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;

function distances(project: Project, map: GameMap, from: { x: number; y: number }): Int32Array {
  const dist = new Int32Array(map.width * map.height).fill(-1);
  if (from.x < 0 || from.y < 0 || from.x >= map.width || from.y >= map.height) return dist;
  dist[from.y * map.width + from.x] = 0;
  const queue = [from.y * map.width + from.x];
  for (let k = 0; k < queue.length; k += 1) {
    const i = queue[k]!, x = i % map.width, y = (i - x) / map.width;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const j = ny * map.width + nx;
      if (dist[j]! >= 0 || !canMove(project, map, x, y, nx, ny)) continue;
      dist[j] = dist[i]! + 1;
      queue.push(j);
    }
  }
  return dist;
}

/** 걷다 보면 밟는 칸인가 — 보이는 것(그림 있는 이벤트·다른 맵으로 가는 칸·지금 선 자리) 둘 사이의 가장 짧은 길에서 두 걸음 안. */
const LINE_SLACK = 2;
const MAX_ANCHORS = 24;
function onWalkingLine(moment: HonestMoment, cell: { x: number; y: number }, selfId: string): boolean {
  const { project, map } = moment;
  const fromCell = distances(project, map, cell);
  const stand = (at: { x: number; y: number }): number | undefined => {
    const spots = [at, ...DIRS4.map(([dx, dy]) => ({ x: at.x + dx, y: at.y + dy }))].filter((c) => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height && fromCell[c.y * map.width + c.x]! >= 0);
    return spots.length ? spots.sort((a, b) => fromCell[a.y * map.width + a.x]! - fromCell[b.y * map.width + b.x]!)[0]!.y * map.width + spots[0]!.x : undefined;
  };
  const anchors: number[] = [];
  const here = stand({ x: moment.session.x, y: moment.session.y });
  if (here !== undefined) anchors.push(here);
  for (const event of map.events ?? []) {
    if (event.id === selfId) continue;
    const page = moment.pageOf(event);
    if (!page) continue;
    const at = moment.moved?.[event.id] ?? event;
    const leaves = JSON.stringify(page.commands ?? []).includes('"kind":"transfer"');
    if (!leaves && eventSight(project, map, event, page, at).seen === "none") continue;
    const spot = stand(at);
    if (spot !== undefined) anchors.push(spot);
  }
  const near = [...new Set(anchors)].sort((a, b) => fromCell[a]! - fromCell[b]!).slice(0, MAX_ANCHORS);
  for (let i = 0; i < near.length; i += 1) {
    const a = near[i]!;
    const fromA = distances(project, map, { x: a % map.width, y: Math.floor(a / map.width) });
    for (let j = i + 1; j < near.length; j += 1) {
      const b = near[j]!;
      if (fromA[b]! >= 0 && fromCell[a]! + fromCell[b]! <= fromA[b]! + LINE_SLACK) return true;
    }
  }
  return false;
}

/**
 * 이 이벤트를 지금 쓰는 것이 정직한가. 정직하지 않으면 까닭 글(HONEST_CAUSES 머리말), 괜찮으면 null.
 * answer 는 숫자 입력 변수의 정답을 돌려준다(자동 플레이가 넣을 값).
 */
export function honestRefusal(moment: HonestMoment, event: GameEvent, touch: boolean, answer: (variableId: string) => number): string | null {
  const { project, map } = moment;
  const page = moment.pageOf(event);
  if (!page) return null;
  const at = moment.moved?.[event.id] ?? event;
  const name = event.name?.trim() || event.id;
  const texts = shownTexts(moment);
  const sight = eventSight(project, map, event, page, at);
  const leaves = JSON.stringify(page.commands ?? []).includes('"kind":"transfer"');
  if (leaves && (sight.seen !== "none" || sight.under)) {
    // 다른 곳으로 옮기는 이벤트가 그려진 것(문짝·건물 벽의 문) 위에 있다 — 문은 이름을 부르지 않아도 문이다.
  } else if (touch) {
    if (sight.seen === "none" && !leaves && !onWalkingLine(moment, at, event.id)) {
      return `${HONEST_CAUSES.touch}: 「${name}」 (${at.x},${at.y}) 은 그림 없는 접촉 칸인데 보이는 것들 사이를 걷는 길 위에 없습니다 — 플레이어가 그 칸을 밟을 까닭이 없습니다.`;
    }
  } else if (sight.seen === "none") {
    return `${HONEST_CAUSES.unseen}: 「${name}」 (${at.x},${at.y}) 은 그림이 없습니다${sight.under ? `(큰 그림 「${sight.under}」 의 한 칸)` : page.nearSparkle ? "(가까이 가야 한 번 반짝일 뿐)" : ""} — 플레이어는 어디를 조사할지 볼 수 없습니다.`;
  } else if (sight.seen === "art" && !sight.named && !named(texts, event.name)) {
    return `${HONEST_CAUSES.unnamed}: 「${name}」 (${at.x},${at.y}) 은 그림 없이 「${sight.label}」 그림 위에 있고, 지금까지 읽은 글 어디에도 그 이름이 없습니다 — 플레이어는 그 물건을 조사할 까닭을 모릅니다.`;
  }
  // 지금 페이지가 여는 숫자 입력 — 그 답을 읽은 적이 있는가.
  const { texts: own, inputs } = textsBeforeInput((page.commands ?? []) as unknown as RawCommand[]);
  for (const input of inputs) {
    const value = answer(input.variableId);
    if (!Number.isFinite(value) || value <= 0) continue;
    const raw = String(value);
    const padded = input.digits && raw.length < input.digits ? raw.padStart(input.digits, "0") : raw;
    const read = [...texts, ...own];
    if (codeShown(raw, read) || codeShown(padded, read)) continue;
    return `${HONEST_CAUSES.code}: 「${name}」 의 번호 ${padded} 은 지금까지 읽은 글(대사·목표 줄) 어디에도 없습니다 — 플레이어는 답을 알 길이 없습니다.`;
  }
  return null;
}
