// H1 요청 뼈대(할 일 고리 갈고리) — 첫 모델 호출 전에 요청 글에서 «꼭 있어야 할 요소»를 낱말 규칙으로 뽑는다.
// 왜: 싼 모델(terra)은 init 에서 요청의 요소 하나를 자주 떨군다 — 「싸우는 장면까지」의 전투, 「배지를 주는 것까지」의 지급,
//     「축하받는」의 대사. 떨군 요소는 목록에 없으니 고리가 끝까지 묻지 않는다.
// 하는 일: ① 첫 호출의 상태 카드로 뼈대를 보여 준다(init 에 넣으라고). ② init 뒤 모델 목록이 덮지 못한 요소 중
//     기계 확인이 이름에 덜 흔들리는 것(전투·대사·인물·엔딩·지급)만 «요청 뼈대» 단계로 덧붙인다(source gate).
//     장소·이동·합류·증거처럼 이름을 모델이 정하거나 확인 종류가 없는 요소는 덧붙이지 않고 카드의 «잊지 말 것» 줄로만 둔다.
import type { TodoCheck, TodoItem } from "../todo/types";
import { nameScore } from "../todo/names";

export interface SkeletonElement {
  /** 사람이 읽는 항목 글. */
  readonly content: string;
  /** 기계 확인 — 없으면 카드에만 싣는 «잊지 말 것». */
  readonly check?: TodoCheck;
  /** 요청 글의 근거 조각. */
  readonly from: string;
}

const PARTICLE_TAIL = /(?:면|고|서|에|를|을|은|는|의|로|으로|와|과|도|만|까지|에서|에게)$/u;
/** 앞 낱말이 조사·어미로 끝나면 떼고 이름 한두 낱말만. */
function nameFrom(words: string): string | undefined {
  const parts = words.trim().split(/\s+/u).filter(Boolean);
  while (parts.length > 1 && PARTICLE_TAIL.test(parts[0]!)) parts.shift();
  const name = parts.join(" ").trim();
  if (!name || name.length < 2 || PARTICLE_TAIL.test(name) && name.length < 3) return undefined;
  if (parts.slice(0, -1).some((w) => /(?:가|을|를)$/u.test(w))) return undefined;
  if (/^(방|곳|장면|마을|사람|사람들|주민|주인공|플레이어|그|이|저)$/u.test(name)) return undefined;
  return name;
}

const W = "[가-힣A-Za-z0-9]+";
/** 「X가 말을 걸/나타나/경고/맞이」 — 말하는 인물. */
const TALKER = new RegExp(`(?<=^|\\s)((?:${W} )?${W}?)(?:이|가) (?:[가-힣]+ )?(?:말을 걸|나타나|경고|맞이|인사|부탁|말하)`, "gu");
/** 「X를 만나/심문/데려/구하」·「X와 흥정/대화」 — 만나는 인물. */
const MEETS = new RegExp(`(?<=^|\\s)((?:${W} )?${W}?)(?:을|를) (?:만나|심문|데려|구하|구출|설득)`, "gu");
const WITH = new RegExp(`(?<=^|\\s)((?:${W} )?${W}?)(?:와|과) (?:[가-힣]+ )?(?:흥정|대화|이야기)`, "gu");
/** 「X와 싸우/결투」·「X를 쓰러뜨리」 — 싸울 상대(대사 요소는 붙이지 않는다). */
const FIGHTS = new RegExp(`(?<=^|\\s)((?:${W} )?${W}?)(?:와|과|을|를) (?:싸우|싸울|결투|쓰러뜨리|물리치)`, "gu");
/** 「X를 주는/받는/얻는」 — 지급. */
const GIVES = new RegExp(`(?<=^|\\s)(${W})(?:을|를) (?:주는|주게|준다|주고|줘|받는|받게|얻는|얻게)`, "gu");
/** 「X는 "…"고 말해/털어놔」 — 인용한 대사(말하는 인물). */
const QUOTE_SAYS = new RegExp(`(?<=^|\\s)((?:${W} )?${W}?)(?:은|는|이|가) (?:${W} ){0,2}?["“「]([^"”」]{4,80})["”」]`, "gu");
/** 「X를 조사하면 "…"」·「X가 있고, 조사하면 「…」」 — 조사하면 뜨는 글(조사 대상 이벤트). */
const QUOTE_EXAMINE = new RegExp(`(?<=^|\\s)(${W}?)(?:을|를|이|가) (?:[^\\s"“「]+ ){0,3}?조사하면,? ["“「]([^"”」]{4,80})["”」]`, "gu");
/** 인용 대사 → 확인에 쓸 앞 두 낱말(모델이 끝말을 바꿔도 걸리게). */
function saysFragment(quote: string): string | undefined {
  const words = quote.replace(/[.,!?…。·~]+/gu, " ").trim().split(/\s+/u).filter(Boolean);
  const head = words.slice(0, 2);
  if (head.length === 2 && head[1]!.length >= 3) head[1] = head[1]!.replace(/(?:이|가|은|는|을|를|의|도)$/u, "");
  const frag = head.join(" ");
  return frag.length >= 3 ? frag : undefined;
}

/** 「X로 돌아와」 — 엔딩 맵. */
const RETURN_TO = new RegExp(`(${W})(?:로|으로) 돌아`, "u");

function speakers(task: string): string[] {
  const out: string[] = [];
  for (const re of [TALKER]) for (const m of task.matchAll(re)) { const n = nameFrom(m[1] ?? ""); if (n) out.push(n); }
  return [...new Set(out)];
}
function met(task: string): string[] {
  const out: string[] = [];
  for (const re of [MEETS, WITH]) for (const m of task.matchAll(re)) { const n = nameFrom(m[1] ?? ""); if (n) out.push(n); }
  return [...new Set(out)];
}

/** 요청 글 → 뼈대 요소. fresh 는 「만들어」류 요청(이번 턴 것만 통과). */
export function requestSkeleton(task: string, fresh = true): SkeletonElement[] {
  const t = task.replace(/\s+/gu, " ").trim();
  const els: SkeletonElement[] = [];
  const f = fresh ? { fresh: true } : {};
  const talkers = speakers(t);
  const meets = met(t);
  for (const who of talkers) {
    els.push({ content: `${who} 두기`, check: { kind: "person", name: who, ...f }, from: who });
    els.push({ content: `${who}이(가) 말을 건다(대사)`, check: { kind: "talk", who, ...f }, from: who });
  }
  for (const who of meets) if (!talkers.some((x) => nameScore(x, who) > 0)) {
    els.push({ content: `${who} 두기`, check: { kind: "person", name: who, ...f }, from: who });
    els.push({ content: `${who}와(과) 대화(대사)`, check: { kind: "talk", who, ...f }, from: who });
  }
  // 요청이 따옴표로 준 대사는 그 줄이 실제로 나와야 한다 — 2026-10-31 asst-parity 사냥꾼 계약 terra: 뱃사공·어부의 아내를 「인물 있음」 확인으로만 적어
  // 단서 대사 없이 ✓ 로 닫혔다. 조사 글(「시체를 조사하면 "…"」)은 그 물건 이벤트의 대사로 확인한다.
  const quoted = new Set<string>();
  for (const [re, kind] of [[QUOTE_EXAMINE, "examine"], [QUOTE_SAYS, "say"]] as const) {
    for (const m of t.matchAll(re)) {
      const who = nameFrom(m[1] ?? ""), says = saysFragment(m[2] ?? "");
      if (!who || !says || quoted.has(says) || /^(제목|이름|타이틀|게임|맵|장소|문구|글|글귀|말|대사|텍스트|메시지|선택지|자막)$/u.test(who.split(" ").at(-1) ?? who)) continue;
      quoted.add(says);
      els.push({ content: kind === "examine" ? `${who} 조사 글 「${m[2]!.trim().slice(0, 40)}」` : `${who} 대사 「${m[2]!.trim().slice(0, 40)}」`, check: { kind: "talk", who, says, ...f }, from: m[0] });
    }
  }
  // 「마왕을 쓰러뜨린 뒤 …」·「이긴 뒤」 처럼 지난 일을 말하는 전투 낱말은 떼고 본다.
  const tb = t.replace(/\S+ (?:쓰러뜨린|이긴|물리친) 뒤|(?:쓰러뜨린|이긴|물리친) 뒤/gu, "");
  const battle = /싸우|싸움|전투|몬스터|관장전|결투|덤벼|보스전/u.exec(tb);
  if (battle) {
    const foes = [...tb.matchAll(FIGHTS)].map((m) => nameFrom(m[1] ?? "")).filter((n): n is string => !!n);
    const boss = /보스|관장전/u.test(tb) || foes.some((n) => /마왕|보스|관장/u.test(n));
    const who = foes[0] ?? talkers[0] ?? (boss ? meets[0] : undefined);
    if (foes[0] && !talkers.concat(meets).some((x) => nameScore(x, foes[0]!) > 0)) els.push({ content: `${foes[0]} 두기`, check: { kind: "person", name: foes[0], ...f }, from: foes[0] });
    els.push({ content: `${boss ? "보스 " : ""}전투${who ? ` — ${who}` : ""}`, check: { kind: "battle", ...(who ? { who } : {}), ...(boss ? { boss: true } : {}), ...f }, from: battle[0] });
  }
  if (/엔딩/u.test(t)) {
    const map = RETURN_TO.exec(t)?.[1];
    els.push({ content: `엔딩에 닿는다${map ? ` — ${map}` : ""}`, check: { kind: "ending", ...(map ? { map } : {}), ...f }, from: "엔딩" });
  }
  // 번호 자물쇠: 「비밀번호 7294」·「7294가 비밀번호」 + 「3번째로 틀렸을 때 … 힌트」.
  const code = /(?:비밀번호|암호|번호)\s*(?:는|은|가|이)?\s*[「"']?(\d{3,8})(?!\d)/u.exec(t)?.[1] ?? /(?<!\d)(\d{3,8})[」"']?\s*(?:이|가)?\s*(?:비밀번호|암호)/u.exec(t)?.[1];
  if (code && /입력|자물쇠|잠금|열/u.test(t)) {
    const hint = /(\d)\s*(?:번째|번\s*째|회째|번)\s*(?:로\s*|에\s*)?틀[리렸린려]|틀린\s*(?:횟수|게)?\s*(?:가\s*)?(\d)\s*(?:번|회)/u.exec(t);
    const hintAfter = hint && /힌트|도움말|알려/u.test(t) ? Number(hint[1] ?? hint[2]) : undefined;
    els.push({ content: `번호 자물쇠 ${code}${hintAfter ? ` — ${hintAfter}번째 오답에 힌트` : ""}`, check: { kind: "code_lock", code, ...(hintAfter ? { hintAfter } : {}), ...f }, from: code });
  }
  for (const m of t.matchAll(GIVES)) {
    const name = nameFrom(m[1] ?? "");
    if (name && !/^(값|말|도움|축하|경고|힌트|선택)$/u.test(name)) els.push({ content: `${name}을(를) 준다`, check: { kind: "item", name, gives: true, ...f }, from: m[0] });
  }
  // 확인 종류가 없거나 이름을 모델이 정하는 요소 — 카드에만.
  const remind = (re: RegExp, content: string) => { const m = re.exec(t); if (m) els.push({ content, from: m[0] }); };
  const join = /동료로 합류|파티에 합류|동료가 되|합류하|동료로 삼/u.exec(t);
  if (join) {
    const who = meets[0] ?? talkers[0];
    if (who) els.push({ content: `${who} 동료 합류(대화 뒤 파티에 넣기)`, check: { kind: "party_join", name: who, ...f }, from: join[0] });
    else els.push({ content: "동료 합류(파티에 넣기 — 대사 뒤 changeParty)", from: join[0] });
  }
  remind(/(\S+(?:과|와) \S+) 사이에/u, "양 끝 두 곳과 각각 이어지는 이동");
  remind(/지금 마을과 이어|이어 줘|연결해/u, "지금 마을과 이어지는 이동(양방향)");
  remind(/가장 안쪽에/u, "기존 장소 가장 안쪽에서 이어지는 입구");
  remind(/증거를 내밀|증거를 보여/u, "증거 아이템 지급 + 내밀기(presentItem) 반응");
  remind(/갈림길/u, "갈림길(길이 두 갈래 이상)");
  remind(/보물 상자|상자/u, "보물 상자(열면 아이템)");
  remind(/다리/u, "강을 건너는 다리");
  remind(/흥정/u, "흥정 선택지와 값이 달라지는 결과");
  return els;
}

/** 모델 항목이 이 요소를 덮나 — 같은 확인 종류 + 이름(있으면) 맞음. 전투·엔딩은 같은 종류면 덮는다. */
export function covers(items: readonly Pick<TodoItem, "check" | "content">[], el: SkeletonElement): boolean {
  const c = el.check;
  if (!c) return true;
  return items.some((it) => {
    const k = it.check;
    if (!k || k.kind !== c.kind) return false;
    switch (c.kind) {
      case "person": return k.kind === "person" && nameScore(c.name, k.name) > 0;
      // 인용 대사 요소(says)는 모델 항목도 그 대사를 확인해야 덮는다 — 「인물이 말한다」만으로는 단서 줄을 묻지 않는다.
      case "talk": return k.kind === "talk" && nameScore(c.who, k.who) > 0 && (!c.says || !!k.says);
      case "item": return k.kind === "item" && nameScore(c.name, k.name) > 0;
      case "party_join": return k.kind === "party_join" && nameScore(c.name, k.name) > 0;
      case "code_lock": return k.kind === "code_lock" && k.code === c.code && (!c.hintAfter || k.hintAfter === c.hintAfter);
      default: return true;
    }
  });
}

/** 첫 호출 카드 글. */
export function skeletonCard(els: readonly SkeletonElement[]): string | undefined {
  if (!els.length) return undefined;
  const checked = els.filter((e) => e.check);
  const remind = els.filter((e) => !e.check);
  return [
    "[Request skeleton — required elements a function extracted from the request text. Put every one into todo init (checked elements you leave out are appended by the loop)]",
    ...checked.map((e) => `- ${e.content} — check ${JSON.stringify(e.check)}`),
    ...(remind.length ? [`Do not forget (no machine check): ${remind.map((e) => e.content).join(" · ")}`] : []),
  ].join("\n");
}
