// 추리 사건 읽기 — 추리 청사진인가(isMysteryBlueprint), 단계 이벤트 찾기(resolveSteps), 용의자 풀·낱말, 대사·내레이션 명령 만들기.
import type { Command, GameEvent, GameMap, Project } from "@/project/types";
import { withJosa } from "@/util/josa";

/** 추리 청사진 낱말(요청·목표·단계·엔딩 어디든). 「도난」만으로는 추리로 보지 않는다(심부름 RPG). */
const MYSTERY_WORDS = /추리|범인|탐정|미스터리|용의자|진범|whodunit|mystery|detective|culprit/iu;

/** 용의자와 말하는 단계(심문). */
export const TALK_STEP = /심문|용의자|투숙객|대화|증언|알리바이|추궁|자백|캐묻|탐문|목격/u;

/** 범인이 될 수 있는 사람 부름 + (있으면) 이름 — 「심부름꾼 준」「수상한 상인」. 주인·투숙객·손님은 의뢰인이거나 무리라 범인 이름으로 쓰지 않는다. */
const ROLE = "심부름꾼|마부|상인|하녀|요리사|여행자|하인|집사|정원사|악사|사냥꾼|대장장이|점원|광대|음유시인|경비병|약초상|떠돌이";

export const ROLE_NAME = new RegExp(`(${ROLE})(?:\\s+([가-힣]{1,3}?)(?=[\\s이가은는을를의에게께도과와,.!?]|$))?`, "u");

export interface Suspect { readonly role: string; readonly name: string; readonly looks: string; readonly place: string }

export const POOL: readonly Suspect[] = [
  { role: "상인", name: "상인 도윤", looks: "merchant", place: "식당 구석 자리" },
  { role: "마부", name: "마부 한스", looks: "man", place: "마구간" },
  { role: "여행자", name: "여행자 미라", looks: "woman", place: "2층 복도 끝 방" },
  { role: "요리사", name: "요리사 베티", looks: "woman", place: "부엌" },
  { role: "악사", name: "악사 리노", looks: "man", place: "난롯가" },
  { role: "하녀", name: "하녀 로자", looks: "maid", place: "세탁실" },
];

export const LOOKS: Record<string, string> = { 상인: "merchant", 하녀: "maid", 집사: "butler", 경비병: "guard", 대장장이: "blacksmith", 요리사: "woman", 여행자: "woman" };

export type Obj = Record<string, unknown>;

export const textOf = (value: unknown): string => JSON.stringify(value ?? "").replace(/"(kind|id|switchId|itemId|endingId|commandId|surface)":"[^"]*"/gu, "");

export const hash = (s: string): number => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

export const nameOf = (ev: GameEvent | undefined): string => String((ev as { name?: string } | undefined)?.name ?? "");

export const visiblePerson = (ev: GameEvent): boolean => (ev.pages ?? []).some((p) => Boolean((p.graphic as { sprite?: unknown } | undefined)?.sprite) && !(p.graphic as { transparent?: boolean }).transparent);

export function walkCommands(list: unknown, visit: (cmd: Obj) => void): void {
  if (!Array.isArray(list)) return;
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const cmd = raw as Obj;
    visit(cmd);
    for (const [key, value] of Object.entries(cmd)) if (Array.isArray(value) && (/^(then|else|branch|commands|body)$/u.test(key) || /Branch$/u.test(key))) walkCommands(value, visit);
    if (Array.isArray(cmd.options)) for (const o of cmd.options) walkCommands((o as Obj | undefined)?.branch, visit);
  }
}

/** 범인을 가리는 사건이 있다는 낱말 — «미스터리»(분위기 말)와 달리 이것만으로 추리 게임이다. */
const WHODUNIT_WORDS = /추리|범인|탐정|용의자|진범|whodunit|detective|culprit/iu;

/**
 * 추리(범인 찾기) 청사진인가. 요청이 «미스터리» 라고 했거나, 청사진 어디든 범인·추리·탐정·용의자를 말할 때만.
 * 왜(2026-11-10 Terra fun-w1 «재밌는 게임»): 모델이 장르를 「증기 도시 미스터리」로 적자 사건 세우기가 돌아, 폭주 기관을 멈추는 게임의
 * 중앙 기관실에 「상인 도윤」「하녀 로자」「여행자 미라」와 «밤새 식당 구석 자리에 있었어요» 알리바이가 섰고 엔딩이 그 셋의 증언에 묶였다.
 * 모델이 분위기로 쓴 «미스터리» 한 낱말(제목·장르·단계)은 사건이 아니다.
 */
export function isMysteryBlueprint(project: Project): boolean {
  const bp = project.gameBlueprint;
  if (!bp) return false;
  if (MYSTERY_WORDS.test(bp.request ?? "")) return true;
  return WHODUNIT_WORDS.test([bp.playerGoal, bp.title, bp.genre, bp.ending.name, bp.ending.how, ...bp.steps.flatMap((s) => [s.event, s.action, s.gives])].join(" "));
}

/** 모델이 이미 사건을 지었나 — presentItem, author_mystery_case 이벤트, 사람이 하는 범인 고르기(엔딩 갈래와 아닌 갈래가 섞인 선택지). */
export function modelBuiltCase(project: Project): boolean {
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    if (ev.id.startsWith("ev_mystery_") || ev.id.startsWith("ev_case_")) return true;
    let found = false;
    for (const page of ev.pages ?? []) walkCommands(page.commands, (cmd) => {
      if (cmd.kind === "presentItem") found = true;
      if (cmd.kind === "choices" && Array.isArray(cmd.options) && cmd.options.length >= 2 && visiblePerson(ev)) {
        const ends = (cmd.options as Obj[]).map((o) => JSON.stringify(o.branch ?? []).includes('"triggerEnding"'));
        if (ends.some(Boolean) && ends.some((e) => !e)) found = true;
      }
    });
    if (found) return true;
  }
  return false;
}

export interface Resolved { readonly k: number; readonly step: { id: string; place: string; event: string; action: string; needs: string; gives: string }; readonly map: GameMap; readonly ev: GameEvent }

export function resolveSteps(project: Project): Resolved[] {
  const bp = project.gameBlueprint!;
  const norm = (s: string) => s.normalize("NFC").replace(/[\s·・,.!?'"「」『』()[\]~\-_/]+/gu, "").toLowerCase();
  const maps = Object.values(project.maps);
  const blueprintMapFor = (_: Project, place: string): GameMap | undefined => maps.find((m) => m.id === place || norm(m.name ?? "") === norm(place))
    ?? maps.find((m) => { const x = norm(m.name ?? ""), y = norm(place); return Math.min(x.length, y.length) >= 2 && (x.includes(y) || y.includes(x)); });
  const out: Resolved[] = [];
  bp.steps.forEach((step, k) => {
    const map = blueprintMapFor(project, step.place);
    const ev = map?.events.find((e) => e.id === step.event || norm(nameOf(e)) === norm(step.event))
      ?? map?.events.find((e) => !e.id.startsWith("ev_objective") && norm(nameOf(e)).length >= 2 && (norm(nameOf(e)).includes(norm(step.event)) || norm(step.event).includes(norm(nameOf(e)))));
    if (map && ev) out.push({ k, step: step as Resolved["step"], map, ev });
  });
  return out;
}

/** 물건이 아닌 진행 낱말인가(「수사 시작」「모든 단서」「사건 해결」「found_clue」). */
export function isProgressWord(word: string): boolean {
  const w = word.trim();
  return !w || /(\s|^)(시작|수사|조사|진행|해결|엔딩|정보|탐문|추리)$/u.test(w) || /^(모든\s*|결정적(인)?\s*)?(단서|증거)들?$/u.test(w) || /^(started|found_clue|clue|asked|evidence)$/iu.test(w);
}

/** 조사만(괄호로 감싼 이름 뒤에 붙일 때). */
export const jo = (word: string, pair: "이/가" | "을/를" | "은/는" | "와/과"): string => withJosa(word, pair).slice(word.length);

export const KEY_ITEM = /열쇠|키\b|key|출입증|통행증/iu;

export const say = (speaker: string, lines: readonly string[]): Command[] => lines.map((body) => ({ kind: "text", speaker, body }) as unknown as Command);

/** 내레이션 줄 앞에 인물 얼굴을 내린다(얼굴이 남으면 그 인물이 서술하는 것처럼 보였다). */
export const CLEAR_FACE = { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false } as unknown as Command;

export const narrate = (lines: readonly string[]): Command[] => lines.map((body) => ({ kind: "text", body }) as unknown as Command);

/** `<사람 id>_evidence` 조사 칸 — 사람(그림 있는 NPC)이 그 id 를 쥐고 있으면 칸이 아니다. */
export const evidenceSpot = (map: GameMap, giverId: string): GameEvent | undefined => (map.events ?? []).find((e) => e.id === `${giverId}_evidence` && !visiblePerson(e));

export const ACCUSE_PROMPT = "범인은 누구일까?";

/**
 * 마지막(범인 지목) 단계가 잠겨 있을 때 남은 단서를 센다 — 「아직 단서가 모자라다. 남은 단서 2개: 「젖은 장화」(여관 동쪽)·「부엌 장부」」.
 * 앞 단계를 하나씩 마칠 때마다 켜지는 조건으로 페이지를 나눠, 지금 남은 것만 말한다. 되풀이 안전(이름 「남은 단서」 페이지를 다시 쓴다).
 * 왜(2026-10-29 vm3 terra 추리 판정): 단서 없이 장부 보관함을 조사하면 「먼저 금고를 살펴보자.」뿐 — 몇 개가 남았고 어디인지 몰라 맵을 뒤졌다.
 */
/**
 * 이벤트가 놓인 칸(몸 사각 포함)의 가구 이름 — 바닥·벽·깔개·그림자는 뺀다. 없으면 "".
 * 의자 칸 조사(단서 그림을 옆 탁자 위에 얹은 경우, examineArt)는 탁자 위 물건 이름(「책」)이 찾을 것이다.
 */
/**
 * 칩셋 이름표 꼬리(조각 자리·방향·크기 표식)를 떼어 물건 이름만 — 「책장 1w」「탁자 조각 LB」「긴 목재 탁자 상단」「거실 탁자 1,0」 → 책장·탁자·긴 목재 탁자·거실 탁자.
 * 왜(2026-10-29 vm6 terra 추리): 남은 단서 안내가 「「여관 장부」(남서쪽 책장 1w)」로 이름표 꼬리를 그대로 보였다.
 */
export function thingWords(label: string): string {
  const words = label.replace(/\s*\([^()]*\)/gu, "").trim().split(/\s+/u).filter(Boolean);
  const tail = /[0-9A-Za-z]|^(상단|하단|중단|좌측|우측|중앙|왼쪽|오른쪽|윗부분|아랫부분|위|아래|조각|부분|끝|몸통|머리|다리)$/u;
  while (words.length > 1 && tail.test(words.at(-1)!)) words.pop();
  return words.length === 1 && /[0-9A-Za-z]/u.test(words[0]!) && !/[가-힣]/u.test(words[0]!) ? "" : words.join(" ");
}
