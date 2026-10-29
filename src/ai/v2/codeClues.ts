// 번호 자물쇠와 단서 대사 맞추기(2026-10-29 vm3 flash escape 판정 «가짜 단서(4862)와 자동 입력으로 인한 혼란한 퍼즐 연출»).
//
// 모델은 책상 대사에 「비밀번호는 4862다」, 자물쇠 대사에 「'4862'를 입력하자 문이 덜컥 열렸다!」를 썼는데, 번호 단계(build_blueprint_path)는
// 모델이 code 를 주지 않았다며 5858 을 새로 정하고 「번호 쪽지(5858)」를 덧붙였다. 플레이어에게는 번호가 둘이고, 자물쇠는 «열렸다»고 말한 뒤
// 입력창을 열어 «맞지 않는다»로 뒤집었다. 이 함수는 이미 지어진 자물쇠(숫자 입력 + 정답 분기)마다:
//   1) 정답 번호가 모델 대사(함수가 쓴 쪽지 말고)에 없고, 모델 대사에 같은 자릿수 번호가 하나뿐이면 그 번호를 정답으로 채택한다
//      (분기 값과 함수가 쓴 쪽지 대사의 번호를 바꾼다). 정답이 모델 대사에 있으면 다른 같은 자릿수 «번호» 대사를 정답으로 고쳐 쓴다.
//   2) 입력창 앞에 놓인 «열렸다/입력하자» 같은 결과 대사는 정답 분기 맨 앞으로 옮긴다 — 입력하기 전에 결과를 말하지 않는다.
// 대사 문구는 바꾸지 않고 번호만 맞춘다(프롬프트로 고치지 않는다 — 결정적 후처리).
import type { GameEvent, Project } from "@/project/types";

type Cmd = Record<string, unknown> & { kind?: string };

/** 함수(build_blueprint_path)가 쓴 쪽지 대사 — 모델 단서로 세지 않는다. */
const BUILDER_NOTE = /어딘가의 번호인 것 같다|쪽지에는 \S+ 자리 숫자/u;
/** 번호를 말하는 대사(그냥 숫자가 아니라). */
const CODE_TALK = /비밀번호|번호|암호|숫자|자물쇠|code|password|pin/iu;
/** 입력 결과를 미리 말하는 대사. */
const RESULT_TALK = /열렸|열린다|열리며|풀렸|풀린다|풀리며|입력하자|입력했|눌렀더니|맞췄|맞혔/u;

/** 번호를 넣었다고 말하는 대사. */
const INPUT_CLAIM = /입력하자|입력했|눌러 넣자|맞추자|맞췄|맞혔/u;

const digitsRe = (n: number) => new RegExp(`(?<!\\d)\\d{${n}}(?!\\d)`, "gu");

function textCommands(node: unknown, out: Cmd[] = []): Cmd[] {
  if (Array.isArray(node)) { for (const n of node) textCommands(n, out); return out; }
  if (!node || typeof node !== "object") return out;
  const c = node as Cmd;
  if (c.kind === "text" && typeof c.body === "string") out.push(c);
  for (const v of Object.values(c)) if (v && typeof v === "object") textCommands(v, out);
  return out;
}

interface Lock { event: GameEvent; commands: Cmd[]; inputAt: number; fork: Cmd; digits: number; code: number }

function locksOf(project: Project): Lock[] {
  const out: Lock[] = [];
  for (const map of Object.values(project.maps)) for (const event of map.events ?? []) for (const page of event.pages ?? []) {
    const commands = (page.commands ?? []) as unknown as Cmd[];
    commands.forEach((c, i) => {
      if (c.kind !== "inputNumber" || typeof c.variableId !== "string") return;
      const fork = commands.slice(i + 1).find((f) => {
        const cond = f.condition as { kind?: string; variableId?: string; op?: string; value?: unknown } | undefined;
        return f.kind === "fork" && cond?.kind === "variable" && cond.variableId === c.variableId && cond.op === "==" && typeof cond.value === "number";
      });
      if (!fork) return;
      const digits = typeof c.digits === "number" && c.digits > 0 ? c.digits : String((fork.condition as { value: number }).value).length;
      out.push({ event, commands, inputAt: i, fork, digits, code: (fork.condition as { value: number }).value });
    });
  }
  return out;
}

const DIGIT_WORDS = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉"] as const;
/** 「네 자리」 — 번호 길이에 맞는 자릿수 말. */
export function digitWord(n: number): string { return `${DIGIT_WORDS[n] ?? String(n)} 자리`; }
const DIGIT_CLAIM = /(한|두|세|네|다섯|여섯|일곱|여덟|아홉|\d+)\s*자리(\s*(?:숫자|번호|비밀\s*번호|암호)?\s*(?:는|은|가|이)?\s*[「『'"“]?)(\d+)(?=[」』'"”]|\D|$)/gu;
/**
 * 「네 자리 숫자 「38」」처럼 자릿수 말과 실제 번호 길이가 다른 대사를 고친다(2026-10-29 vm4 argon 방탈출 판정 «네 자리 숫자인데 2자리»).
 * 앞 판 빌드가 모델이 준 번호(38)를 «네 자리» 틀 문구에 넣었다. 번호는 그대로, 자릿수 말만 번호 길이에 맞춘다.
 */
export function fixDigitClaims(project0: Project): { project: Project; notes: string[] } {
  if (!/자리/u.test(JSON.stringify(project0.maps))) return { project: project0, notes: [] };
  const project = structuredClone(project0);
  const notes: string[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const c of textCommands(ev.pages)) {
    const body = String(c.body);
    const next = body.replace(DIGIT_CLAIM, (all, word: string, mid: string, num: string) => {
      const said = /^\d+$/u.test(word) ? Number(word) : DIGIT_WORDS.indexOf(word as (typeof DIGIT_WORDS)[number]);
      return said === num.length ? all : `${DIGIT_WORDS[num.length] ?? String(num.length)} 자리${mid}${num}`;
    });
    if (next !== body) { notes.push(`「${String((ev as { name?: string }).name ?? ev.id)}」 ${body.slice(0, 30)} → ${next.slice(0, 30)}`); c.body = next; }
  }
  return notes.length ? { project, notes } : { project: project0, notes };
}

/** 이미 지은 번호 자물쇠를 단서 대사와 맞춘다. 바꿀 것이 있으면 사본을 고쳐 돌려준다. */
export function alignCodeClues(project0: Project): { project: Project; notes: string[] } {
  const notes: string[] = [];
  if (!locksOf(project0).length) return { project: project0, notes };
  const project = structuredClone(project0);
  const locks = locksOf(project);
  for (const lock of locks) {
    // 다른 자물쇠의 정답 번호는 건드리지 않는다(자물쇠가 둘이면 서로의 번호를 «다른 번호»로 보지 않게).
    const otherCodes = new Set(locks.filter((l) => l !== lock).map((l) => String(l.code).padStart(l.digits, "0")));
    const name = String((lock.event as { name?: string }).name ?? lock.event.id);
    // 2) 입력 앞 결과 대사 → 정답 분기 앞.
    const before = lock.commands.slice(0, lock.inputAt);
    // 결과를 말하는 줄만 — 번호를 넣었다고 말하거나(입력하자·맞췄다) 번호를 품은 «열렸다» 줄. «열쇠를 넣자 걸쇠가 풀린다. 이제 다이얼이다»처럼
    // 입력 전 단계를 말하는 줄은 그대로 둔다(vm3 deepseek 녹슨 금고).
    const early = before.filter((c) => {
      if (c.kind !== "text") return false;
      const body = String(c.body);
      return INPUT_CLAIM.test(body) || (RESULT_TALK.test(body) && digitsRe(lock.digits).test(body));
    });
    if (early.length) {
      for (const c of early) lock.commands.splice(lock.commands.indexOf(c), 1);
      lock.inputAt = lock.commands.findIndex((c) => c.kind === "inputNumber");
      const then = (lock.fork.then as Cmd[] | undefined) ?? [];
      lock.fork.then = [...early.filter((c) => !then.some((t) => t.kind === "text" && t.body === c.body)), ...then];
      if (!lock.commands.slice(0, lock.inputAt).some((c) => c.kind === "text")) lock.commands.splice(lock.inputAt, 0, { kind: "text", body: "번호 자물쇠다. 알아낸 번호를 맞춰 보자." });
      notes.push(`「${name}」 입력 전에 결과를 말하던 대사 ${early.length}줄을 정답 뒤로 옮김`);
    }
    // 1) 번호 맞추기.
    const re = digitsRe(lock.digits);
    // 이 자물쇠의 분기 안 대사(맞히면 나오는 «보관함 번호는 3817»)는 다음 자물쇠의 단서다 — 이 자물쇠의 정답 후보로 세지 않는다(vm3 terra 시계 기록).
    const own = new Set(textCommands([lock.fork.then, lock.fork.else]));
    // 고르기 자물쇠의 보기 번호도 다른 자물쇠의 답이다.
    const choiceNums = new Set(JSON.stringify(Object.values(project.maps).map((m) => m.events)).match(/"text":"\d{3,6}"/gu)?.map((x) => x.slice(8, -1)) ?? []);
    const all = Object.values(project.maps).flatMap((m) => (m.events ?? []).flatMap((e) => textCommands(e.pages))).filter((c) => !own.has(c));
    const model = all.filter((c) => !BUILDER_NOTE.test(String(c.body)));
    const builder = all.filter((c) => BUILDER_NOTE.test(String(c.body)));
    const code = String(lock.code).padStart(lock.digits, "0");
    const mentioned = model.some((c) => (String(c.body).match(re) ?? ([] as string[])).includes(code));
    const others = [...new Set(model.filter((c) => CODE_TALK.test(String(c.body)) || RESULT_TALK.test(String(c.body))).flatMap((c) => String(c.body).match(re) ?? ([] as string[])).filter((n) => n !== code && !otherCodes.has(n) && !choiceNums.has(n)))];
    if (!mentioned && others.length === 1) {
      const adopt = others[0]!;
      (lock.fork.condition as { value: number }).value = Number(adopt);
      // 함수 쪽지는 «어딘가의 번호»가 아니라 모델 단서를 확인하는 글로 — 번호가 하나라는 것이 읽히게.
      for (const c of builder) if (String(c.body).includes(code)) c.body = `쪽지에도 같은 ${digitWord(adopt.length)} 숫자 「${adopt}」가 적혀 있다. 이 번호가 맞는 것 같다.`;
      notes.push(`「${name}」 정답 ${code} → 모델 단서의 ${adopt}(함수 쪽지도 같은 번호로)`);
    } else if (mentioned && others.length) {
      for (const c of model) {
        const body = String(c.body);
        if (!(CODE_TALK.test(body) || RESULT_TALK.test(body))) continue;
        const next = body.replace(re, (n) => (others.includes(n) ? code : n));
        if (next !== body) c.body = next;
      }
      notes.push(`「${name}」 대사 속 다른 번호 ${others.join("·")} → 정답 ${code}`);
    }
  }
  return notes.length ? { project, notes } : { project: project0, notes };
}

// 청사진 id 그대로 보이는 대사(같은 판): gives/needs 를 «clue_number» 같은 영문 id 로 적은 청사진에서 경로 짓기가
// 「『clue_number』을(를) 알아냈다」·「clue_number이(가) 있어야 할 것 같다」를 그대로 대사로 썼다. 영문 id 는 뜻 낱말로 보여 준다.
const ASCII_ID = /^[A-Za-z][A-Za-z0-9_\-]*$/u;
/** 대사에 쓸 이름 — 영문 id 면 뜻 낱말(단서·열쇠·…), 아니면 그대로. */
/** 청사진 gives 를 종류 표식으로 감싼 것 — 「스위치 «짚단서»」「아이템: 회중시계」(vm3 deepseek 추리: 『스위치 «수프단서»』을(를) 알아냈다). */
const WRAPPED = /^(?:스위치|아이템|플래그|변수|switch|item|flag)\s*(?:[«"'「『(:：]\s*)(.+?)\s*[»"'」』)]?$/iu;
export function shownToken(token: string): string {
  const t0 = token.trim();
  const t = WRAPPED.exec(t0)?.[1]?.trim() || t0;
  if (t !== t0) return shownToken(t);
  if (!ASCII_ID.test(t)) return t;
  if (/key/iu.test(t)) return "열쇠";
  if (/clue|hint|number|code|pass|note|memo|cipher/iu.test(t)) return "단서";
  if (/map/iu.test(t)) return "지도";
  if (/letter/iu.test(t)) return "편지";
  if (/item|tool/iu.test(t)) return "물건";
  return "필요한 것";
}
const hasBatchim = (w: string) => { const c = (w.at(-1) ?? "").charCodeAt(0) - 0xac00; return c >= 0 && c <= 11171 && c % 28 !== 0; };
/** 이미 지은 대사 속 청사진 영문 id 를 뜻 낱말로(제자리, 사본). */
export function humanizeBlueprintTokens(project0: Project): { project: Project; notes: string[] } {
  const bp = project0.gameBlueprint;
  const ids = [...new Set((bp?.steps ?? []).flatMap((s) => [s.gives, s.needs]).filter((t): t is string => typeof t === "string" && (ASCII_ID.test(t.trim()) || WRAPPED.test(t.trim())) && !/^(none|start)$/iu.test(t.trim())).map((t) => t.trim()))].sort((a, b) => b.length - a.length);
  const wrappedItems = project0.database.items.some((i) => WRAPPED.test(String(i.name ?? "").trim()));
  if (!ids.length && !wrappedItems) return { project: project0, notes: [] };
  const project = structuredClone(project0);
  const notes: string[] = [];
  // 아이템 이름도 — 증거 아이템이 「스위치 «수프단서»」 그대로 이름이 되어 증거 제시 창에 나왔다.
  for (const item of project.database.items) {
    const name = String(item.name ?? "").trim();
    if (!WRAPPED.test(name)) continue;
    const shown = shownToken(name);
    ids.push(name);
    (item as { name?: string }).name = shown;
    notes.push(`아이템 이름 ${name} → ${shown}`);
  }
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const c of textCommands(ev.pages)) {
    let body = String(c.body);
    for (const id of ids) {
      if (!body.includes(id)) continue;
      const w = shownToken(id), b = hasBatchim(w);
      body = body.split(`${id}을(를)`).join(`${w}${b ? "을" : "를"}`).split(`${id}』을(를)`).join(`${w}』${b ? "을" : "를"}`)
        .split(`${id}이(가)`).join(`${w}${b ? "이" : "가"}`).split(`${id}』이(가)`).join(`${w}』${b ? "이" : "가"}`).split(id).join(w);
    }
    if (body !== c.body) { notes.push(`${ev.name ?? ev.id}: ${String(c.body).slice(0, 40)} → ${body.slice(0, 40)}`); c.body = body; }
  }
  return notes.length ? { project, notes } : { project: project0, notes };
}
