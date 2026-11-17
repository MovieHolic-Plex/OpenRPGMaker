// 플레이어가 읽는 글을 청사진에서 짓는 한 곳 — 「현재 목표」 줄 · 대사 없는 사람의 서술.
// 잠긴 단계의 글은 «왜 아직인가» 만 말한다 — 어디로 가서 누구를 만날지는 「현재 목표」 줄이 말한다(2026-11-15 확인 빌드 r5: «먼저 … 「○○」에게 말을 걸어 보자» 줄을 걷었다).
// 규칙: 화면에 나가는 글은 플레이어에게 쓴 칸(대사 lines · goal · 엔딩 closing · playerGoal)과 화면에 뜨는 이름(사람 · 이벤트 · 맵 · 소지품)으로만 짓는다.
// 설계 칸(action · needs · gives · feeling)은 넣지 않는다 — 기획서 말투와 깃발 이름이 목표 줄·대사로 나갔다(2026-11-12 증기의 심장).
import type { GameBlueprintStep } from "@/project/gameBlueprint";
import { eventNoun, josa } from "./blueprintPathNames";

type StepNames = Pick<GameBlueprintStep, "kind" | "who" | "event" | "place"> & { readonly text?: { readonly goal?: string } };

/** 이 단계가 다음 할 일일 때의 「현재 목표」 줄(마침표 없음). 모델이 쓴 goal 이 먼저, 없으면 단계 종류와 이름으로 짓는다. */
export function stepGoal(step: StepNames): string {
  const own = step.text?.goal?.trim().replace(/[.。!]+$/u, "");
  if (own) return own;
  const who = step.who?.trim();
  const name = eventNoun(step.event);
  if (step.kind === "battle") { const foe = who || name; return `${foe}${josa(foe, "을", "를")} 쓰러뜨리자`; }
  if (step.kind === "puzzle") return `${name}의 번호를 맞히자`;
  if (step.kind === "choice" && who) return `${who}${josa(who, "과", "와")} 이야기하고 마음을 정하자`;
  if ((step.kind === "talk" || step.kind === "choice") && who) return `${who}에게 말을 걸자`;
  return `${name}${josa(name, "을", "를")} 살펴보자`;
}

const squash = (text: string) => text.replace(/[\s「」『』"'·]/gu, "");

/**
 * 다른 장소로 가야 하는 다음 할 일의 「현재 목표」 줄 — «강지기의 집에서 강지기 할아버지에게 말을 걸자». place = 그 단계의 맵 이름(지금 맵과 다를 때만 준다).
 * 조수가 지은 게임은 필드 안내(화살표·「어디」 꼬리)를 끈 채 나가므로 «누구를 · 어디서» 가 문장 안에 있어야 한다 — «왜» 는 모델이 쓴 goal 이 말한다.
 * 모델이 쓴 goal 은 고치지 않는다. 이름으로 지은 줄에만 장소를 붙이고, 줄이 이미 그 장소 이름을 담고 있으면 그대로 둔다.
 * 왜(2026-11-16 확인 빌드 r6 P3): 목표 줄이 «「강지기 할아버지」를 찾아가자» 뿐이라 어디로 가야 하는지 화면에 없었다(꼬리 «(강지기의 집 입구: …)» 는 숨는다).
 */
export function stepGoalAt(step: StepNames, place?: string): string {
  const goal = stepGoal(step);
  const where = place?.trim();
  if (!where || step.text?.goal?.trim() || squash(goal).includes(squash(where))) return goal;
  return `${where}에서 ${goal}`;
}

/** 이름에서 뜻이 있는 낱말들(두 글자 이상, 조사 뗌) — 대사가 그 사람·장소를 말했는지 볼 때 쓴다. */
const nameWords = (name: string | undefined): string[] => (name ?? "").split(/[\s:·,.「」『』()'"!?~-]+/u)
  .map((word) => word.replace(/(?:에게서|에게|에서|으로|이|가|을|를|의|은|는|와|과|로|에|도)$/u, "")).filter((word) => Array.from(word).length >= 2);

/**
 * 이 단계의 글이 다음 갈 곳을 말했나 — 다음 단계의 사람·대상·장소 이름의 낱말이 하나라도 글에 나오면 말한 것이다(«서점 할아버지한테 가 보세요» ↔ 「서점 주인」).
 * 지금 단계의 장소·사람 이름에도 든 낱말(같은 상점가의 두 가게)은 세지 않는다.
 */
export function namesNextStep(lines: readonly string[], next: StepNames, current: StepNames): boolean {
  const own = new Set([...nameWords(current.place), ...nameWords(current.who), ...nameWords(eventNoun(current.event))]);
  const words = [...nameWords(next.who), ...nameWords(eventNoun(next.event)), ...nameWords(next.place)].filter((word) => !own.has(word));
  const said = lines.join(" ");
  return words.some((word) => said.includes(word));
}

/**
 * 다음 갈 곳을 잇는 서술 한 줄 — 그 단계의 글이 다음 사람·장소를 말하지 않을 때 구성기가 덧붙인다(«(이제 어물전에서 어물전 주인 해순에게 말을 걸자.)»).
 * 다음 단계의 목표 줄과 같은 문장이라 대사 끝과 「새 목표」 띠가 같은 곳을 가리킨다. 그 사람의 말이 아니라 서술(괄호)이다.
 */
export function nextStepLine(next: StepNames, place?: string): string {
  return `(이제 ${stepGoalAt(next, place)}.)`;
}

/** 대사를 받지 못한 사람 단계의 서술 한 줄(자리표시) — 이름으로만 짓는다. */
export function wordlessLine(step: StepNames): string {
  const who = step.who?.trim() || eventNoun(step.event);
  return step.kind === "battle" ? `(${who}${josa(who, "이", "가")} 앞을 막아선다.)` : `(${who}${josa(who, "과", "와")} 이야기를 나누었다.)`;
}

/**
 * 그 사람을 이름으로 부르며 시작해 평서형(«…다.»)으로 끝나는 줄 — 그 사람의 말이 아니라 그 사람을 그린 서술이다.
 * 왜(2026-11-15 확인 빌드 r5): 모델이 쓴 «등대지기는 어두운 등불 앞에서 고개를 떨구고 있다.» 가 등대지기의 이름표와 얼굴 밑에 떴다.
 */
const aboutSpeaker = (body: string, speaker: string): boolean => body.trimStart().startsWith(speaker) && /^(?:은|는|이|가|의|도)\s/u.test(body.trimStart().slice(speaker.length)) && /다[.…]?\s*$/u.test(body);

/** 말하는 사람이 있는 대사 — 「(」로 시작하는 줄과 그 사람을 그린 줄은 서술이라 이름을 붙이지 않는다. */
export const sayAs = (lines: readonly string[] | undefined, speaker: string | undefined): Record<string, unknown>[] => (lines ?? []).filter((l) => l.trim())
  .map((body) => (speaker && !/^\s*[(（]/u.test(body) && !aboutSpeaker(body, speaker) ? { kind: "text", speaker, body } : { kind: "text", body }));

/**
 * 이긴 뒤의 글 — 큰따옴표·낫표로 감싼 줄만 그 상대의 마지막 말(이름표)이고, 나머지는 서술이다: 쓰러진 상대가 제 쓰러짐을 제 입으로 말하지 않는다.
 * 작은따옴표는 인용한 글(떨어진 쪽지)이라 서술로 둔다.
 */
export function afterWinLines(lines: readonly string[] | undefined, speaker: string | undefined): Record<string, unknown>[] {
  return (lines ?? []).filter((l) => l.trim()).map((body) => {
    const said = speaker ? /^\s*(?:"(.+)"|“(.+)”|「(.+)」)\s*$/u.exec(body) : null;
    return said ? { kind: "text", speaker, body: (said[1] ?? said[2] ?? said[3])! } : { kind: "text", body };
  });
}
