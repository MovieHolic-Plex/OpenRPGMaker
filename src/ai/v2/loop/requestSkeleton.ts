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
      case "talk": return k.kind === "talk" && nameScore(c.who, k.who) > 0;
      case "item": return k.kind === "item" && nameScore(c.name, k.name) > 0;
      case "party_join": return k.kind === "party_join" && nameScore(c.name, k.name) > 0;
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
    "[요청 뼈대 — 함수가 요청 글에서 뽑은 필수 요소. todo init 에 빠짐없이 넣는다(빠진 확인 요소는 고리가 덧붙인다)]",
    ...checked.map((e) => `- ${e.content} — check ${JSON.stringify(e.check)}`),
    ...(remind.length ? [`잊지 말 것(기계 확인 없음): ${remind.map((e) => e.content).join(" · ")}`] : []),
  ].join("\n");
}
