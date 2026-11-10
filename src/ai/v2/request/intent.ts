// 요청 의도 — 요청 한 줄을 한 번 분류한 기록. 범위·소리·전투·장르·도구 묶음을 여기서 정하고, 다른 파일은 이 기록(또는 readers.ts 의 읽는 함수)만 본다.
// 왜: 같은 결정(「게임 하나를 만드는 요청인가」)을 열세 파일이 따로 내려 서로 어긋났다 — 낱말 규칙을 고치는 자리도, 그 답을 내는 자리도 여기 하나다(openwiki/assistant-v2.md 「요청 의도」).
import type { Project } from "@/project/types";
import { audioAsk, type AudioAsk } from "./audio";
import { combatAsk, type CombatAsk } from "./combat";
import { HORROR_WORDS, puzzleAsk } from "./genre";
import { ART_ASK, ENDING_WORDS } from "./asks";
import { PLACE_BUILD_WORDS } from "./place";
import { MAKE_GAME_WORDS, ONE_ROOM_GAME, SINGLE_PLACE, asksToChange, asksToContinue, isEscapeBlueprint, isFreshProject, wholeGameAsk } from "./scope";
import { maskNames, userText } from "./text";
import { matchToolGroups, type ToolGroups } from "./toolGroups";

/**
 * 요청의 범위 — 하나만 고른다.
 * question 묻기·조회(프로젝트를 바꾸지 않는다) · audio 소리 일만 · wholeGame 게임 하나를 만들거나 완성 · continue 앞 실행을 이어 하기
 * · place 장소를 짓거나 다시 짓기 · edit 지은 것에 사람·물건·사건·대사·데이터를 넣거나 고치기.
 */
export type RequestScope = "question" | "audio" | "wholeGame" | "continue" | "place" | "edit";

/** 요청 글만 보고 정한 것. */
export interface RequestText {
  /** 사용자가 쓴 글(의도 메모를 뗀 것). */ readonly own: string;
  /** 낱말 판정에 쓴 글 — 지어 주는 이름·제목·시키는 대사를 가렸다. */ readonly topic: string;
  readonly scope: RequestScope;
  /** 범위를 그렇게 정한 까닭(기록·보고용, 영어 한 줄). */ readonly why: string;
  /** 무엇을 바꾸라는 요청이다(질문이 아니다). */ readonly write: boolean;
  /** 앞 실행을 이어 하라는 요청이다. */ readonly continuation: boolean;
  /** 장소를 짓는 낱말이 있다. */ readonly placeBuild: boolean;
  /** 맵 여러 장과 이야기를 한 번에 맡기는 낱말이 있다(make_game). */ readonly makeGame: boolean;
  /** 방·맵 하나, 또는 방 하나짜리 게임을 말한다. */ readonly oneRoom: boolean;
  readonly audio: AudioAsk;
  readonly combat: CombatAsk;
  readonly horror: boolean;
  /** 단서·자물쇠·탈출(퍼즐 사슬 동사를 싣는다). */ readonly puzzle: boolean;
  /** 엔딩·결말을 말한다. */ readonly ending: boolean;
  /** 타이틀·엔딩·오프닝 그림을 새로 그려 달라고 한다. */ readonly art: boolean;
  readonly tools: ToolGroups;
}

/** 요청 글과 프로젝트를 같이 보고 정한 것. */
export interface RequestIntent extends RequestText {
  /** 이번 턴이 게임 하나를 짓는 일이다 — 범위가 wholeGame 이거나, 이어 하기가 게임 하나로 시작한 프로젝트를 잇는다. 출하 검사·끝맺음 조립·화면 검수가 이것으로 켜진다. */
  readonly wholeGame: boolean;
  /** 빈 프로젝트(이벤트·엔딩 없음)다. */ readonly fresh: boolean;
  /** 지은 맵에 로직만 넣는 요청이다 — 장소 카드·짓기 동사를 필요할 때만 싣는다. */ readonly editOnly: boolean;
}

function scopeOf(own: string, topic: string, facts: { audioOnly: boolean; write: boolean; continuation: boolean; placeBuild: boolean; makeGame: boolean }): { scope: RequestScope; why: string } {
  if (!own.trim()) return { scope: "edit", why: "empty request" };
  if (facts.audioOnly) return { scope: "audio", why: "asks only for music or sound-effect work" };
  if (!facts.write) return { scope: "question", why: "asks a question or to be shown something" };
  const whole = wholeGameAsk(topic);
  if (whole.asked) return { scope: "wholeGame", why: whole.why };
  if (facts.continuation) return { scope: "continue", why: "asks to carry on the previous run" };
  if (facts.placeBuild) return { scope: "place", why: "asks to build or rebuild a place" };
  if (facts.makeGame) return { scope: "place", why: "asks for several maps or a story line" };
  return { scope: "edit", why: `small change to what exists (${whole.why})` };
}

const TEXT_MEMO = new Map<string, RequestText>();
const INTENT_MEMO = new Map<string, RequestIntent>();
const MEMO_MAX = 200;
function remember<T>(memo: Map<string, T>, key: string, make: () => T): T {
  const hit = memo.get(key);
  if (hit) return hit;
  if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value!);
  const made = make();
  memo.set(key, made);
  return made;
}

/** 요청 글만으로 정하는 분류 — 같은 글은 한 번만 계산한다. */
export function readRequest(task: string | undefined): RequestText {
  const raw = String(task ?? "");
  return remember(TEXT_MEMO, raw, () => {
    const own = userText(raw), topic = maskNames(own);
    const audio = audioAsk(topic), combat = combatAsk(topic);
    // 쓰기 판정은 실행기가 붙인 메모까지 본다(옛 동작 그대로) — 메모 속 「만들어」가 질문을 쓰기로 바꿀 수 있다는 것은 알려진 한계다.
    const write = asksToChange(raw), continuation = asksToContinue(own);
    const placeBuild = PLACE_BUILD_WORDS.test(topic), makeGame = MAKE_GAME_WORDS.test(topic);
    const { scope, why } = scopeOf(own, topic, { audioOnly: audio.only, write, continuation, placeBuild, makeGame });
    return {
      own, topic, scope, why, write, continuation, placeBuild, makeGame,
      oneRoom: SINGLE_PLACE.test(topic) || ONE_ROOM_GAME.test(topic),
      audio, combat, horror: HORROR_WORDS.test(topic), puzzle: puzzleAsk(topic), ending: ENDING_WORDS.test(topic), art: ART_ASK.test(topic),
      tools: matchToolGroups(topic, { wholeGame: scope === "wholeGame", audio, combat }),
    };
  });
}

/**
 * 요청과 프로젝트를 같이 본 분류 — (요청 글, 프로젝트의 빈/청사진 상태)마다 한 번만 계산한다.
 * 작은 요청은 게임 하나로 시작한 프로젝트에서도 작은 요청이다. 「계속」「남은 거 마저」「처음에 부탁한 대로 끝까지」처럼 이어 하라는 요청만 청사진의 게임 하나 범위를 물려받는다.
 */
export function classifyRequest(task: string | undefined, project: Pick<Project, "maps" | "endings" | "gameBlueprint">): RequestIntent {
  const text = readRequest(task);
  const blueprint = project.gameBlueprint;
  const fresh = isFreshProject(project as Project);
  const first = blueprint ? readRequest(blueprint.request ?? "") : undefined;
  const escape = blueprint ? isEscapeBlueprint(blueprint) : false;
  const key = [task ?? "", fresh ? 1 : 0, blueprint ? `b:${blueprint.request ?? ""}` : "", escape ? 1 : 0].join("\u0000");
  return remember(INTENT_MEMO, key, () => {
    // 청사진은 게임 하나를 만들 때만 생긴다 — 첫 요청 글이 남아 있지 않은 옛 청사진도 게임 하나로 본다.
    const inherits = text.scope === "continue" && !!blueprint && (first!.scope === "wholeGame" || !blueprint.request?.trim());
    const wholeGame = text.scope === "wholeGame" || inherits;
    const why = inherits ? `${text.why}; the blueprint's first request was a whole game` : text.scope === "continue" ? `${text.why}; no whole-game blueprint to inherit` : text.why;
    return {
      ...text, why, wholeGame, fresh,
      oneRoom: text.oneRoom || !!first?.oneRoom || escape,
      editOnly: !!text.own.trim() && !fresh && text.scope !== "wholeGame" && text.scope !== "place",
    };
  });
}

/** 기록·보고에 남길 한 줄(영어). */
export function describeIntent(intent: RequestIntent): string {
  const marks = [intent.wholeGame && intent.scope !== "wholeGame" ? "whole game (inherited)" : "", intent.oneRoom ? "one room" : "", intent.audio.only ? "audio only" : "", intent.combat.encounters ? "encounters" : "", intent.tools.game ? "game tools" : ""].filter(Boolean);
  return `scope ${intent.scope} — ${intent.why}${marks.length ? ` [${marks.join(", ")}]` : ""}`;
}
