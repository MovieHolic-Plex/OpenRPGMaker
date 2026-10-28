// 조수 v2 적대적 화면 검수(VQA) 고리 — 다 지은 게임(게임 전체 요청)을 실제 그림으로 찍어, 다른 모델의 검수자가 «구체적인 결함»을 찾고,
// 조수가 고친 뒤 다음 판을 돈다. 사용자 규칙(2026-10-25): 판 하나가 깨끗하거나, 3판을 돌고 남은 결함을 정직하게 적을 때만 «다 됐다».
//
// 한 판 = 찍기(맵마다 1배 전체 · 타이틀 그림 · 오프닝 그림/애니메틱 틀) → 검수자(역할표의 «눈» 또는 «검토자», 주 모델과 다른 계열을 먼저)
// → 결함 목록(어디·무엇·왜) → 조수가 고침 → 다음 판. 결함 판정은 모델이 하되, 판 수·끝내기·보고 문구는 코드가 정한다.
// 이 파일은 순수하다(찍기·호출은 넘겨받는다). 실행기 연결은 scripts/lib/assistantV2Runtime.ts.
import type { Project } from "@/project/types";

export const VQA_MAX_ROUNDS = 3;
/**
 * 플레이에 지장 주는 결함(blocker)이 남으면 출하 차단으로 보고 판을 더 준다(2026-10-28 사용자: «VQA 가 핵심»).
 * 스위트 기준선에서 3판을 다 돌고도 결함이 남은 채 «보고만» 하고 끝난 게임이 절반이었다. polish 만 남으면 3판에서 멈춘다.
 */
export const VQA_BLOCKER_EXTRA_ROUNDS = 2;
export const VQA_ROUND_CAP = VQA_MAX_ROUNDS + VQA_BLOCKER_EXTRA_ROUNDS;
export const vqaBlockers = (round: VqaRound | undefined): readonly VqaDefect[] => (round?.defects ?? []).filter((d) => d.severity === "blocker");
/** 한 판에 검수자에게 보내는 그림 수 상한. 맵이 많으면 시작 맵·이번에 바뀐 맵을 먼저. */
export const VQA_MAX_IMAGES = 10;

export interface VqaShot {
  /** 사람이 읽는 자리 이름: 「타이틀」·「오프닝 1/3」·「맵 «검은 장미 저택 2층»」. */
  readonly where: string;
  readonly kind: "title" | "opening" | "map";
  readonly ref?: string;
  readonly image: string;
}

export interface VqaDefect {
  readonly where: string;
  readonly what: string;
  /** 「blocker」 = 플레이에 지장·약속과 다름·임시 그림. 「polish」 = 눈에 띄지만 쓸 수는 있음. 둘 다 결함이다. */
  readonly severity: "blocker" | "polish";
  /** 결함이 난 그림의 대상 — 맵이면 mapId, 타이틀·오프닝이면 그림 자원 id. 고치기 지시가 «어디를 고칠지»를 정확히 짚게. */
  readonly target?: { readonly kind: VqaShot["kind"]; readonly ref?: string };
}

export interface VqaRound {
  readonly round: number;
  readonly shots: readonly { readonly where: string; readonly kind: VqaShot["kind"]; readonly ref?: string }[];
  readonly defects: readonly VqaDefect[];
  readonly ms: number;
  readonly reviewer: string;
  readonly problem?: string;
}

/** 찍을 자리. 이미지는 호출자가 그린다(편집기 렌더 브로커). 시작 맵을 맨 앞에, 그다음 이번 실행에서 바뀐 맵. */
export function vqaShotPlan(project: Project, changedMapIds: ReadonlySet<string>): { kind: VqaShot["kind"]; where: string; ref?: string; shotId?: string; atMs?: number[] }[] {
  const plan: { kind: VqaShot["kind"]; where: string; ref?: string; shotId?: string; atMs?: number[] }[] = [];
  const title = project.system.titleScreen?.backgroundResourceId;
  if (title) plan.push({ kind: "title", where: "타이틀 화면 배경", ref: title });
  const opening = project.system.opening;
  if (opening?.enabled) {
    const scenes = opening.scenes;
    scenes.forEach((scene, index) => {
      const where = `오프닝 ${index + 1}/${scenes.length}`;
      if (scene.kind === "image" && scene.resourceId) plan.push({ kind: "opening", where, ref: scene.resourceId });
      else if (scene.kind === "animatic") {
        const duration = Math.max(1, Math.floor(scene.durationMs));
        plan.push({ kind: "opening", where: `${where} (애니메틱 시작·중간·끝)`, shotId: scene.id, atMs: [0, Math.floor(duration / 2), Math.max(0, duration - 1)] });
      }
    });
  }
  const mapIds = Object.keys(project.maps);
  const ordered = [project.startMapId, ...mapIds.filter((id) => changedMapIds.has(id) && id !== project.startMapId), ...mapIds.filter((id) => !changedMapIds.has(id) && id !== project.startMapId)]
    .filter((id, i, all): id is string => Boolean(id && project.maps[id]) && all.indexOf(id) === i);
  // 맵 그림은 편집기 렌더라 주인공을 그리지 않는다 — 검수자·조수가 「시작 맵에 주인공이 안 보인다」를 결함으로 되풀이했다(2026-10-28 mt2 argon escape).
  const startNote = project.startPos ? ` (시작 맵 · 주인공은 게임에서만 그려짐, 시작 칸 ${project.startPos.x},${project.startPos.y})` : " (시작 맵)";
  for (const id of ordered) plan.push({ kind: "map", where: `맵 «${project.maps[id]!.name}»${id === project.startMapId ? startNote : ""}`, ref: id });
  return plan.slice(0, VQA_MAX_IMAGES);
}

/** 검수자에게 보내는 지시. 게임을 만든 이유·조수 보고는 보여 주지 않는다(눈가림) — 요청 원문과 그림만. */
export function vqaPrompt(task: string, shots: readonly VqaShot[], round: number, previous: readonly VqaDefect[]): string {
  return [
    "You are an adversarial visual QA reviewer for a 2D RPG built by an AI assistant. You did NOT build it. Find concrete defects a player would notice.",
    `The user's request (Korean, verbatim): «${task.slice(0, 1500)}»`,
    `Round ${round} of ${VQA_MAX_ROUNDS}. Images, in order: ${shots.map((s, i) => `[${i + 1}] ${s.where}`).join(" · ")}.`,
    ...(previous.length ? [`Last round you reported these; check whether each is still visible and report it again only if it is:\n${previous.map((d) => `- ${d.where}: ${d.what}`).join("\n")}`] : []),
    "Count as defects (with the exact image and spot): placeholder or editor-default art (generic fields, the default kingdom/sword opening, empty grey blocks); art that contradicts the request (wrong era, setting, characters, genre); unreadable or clipped text; characters standing inside walls, furniture or roofs; doors or exits that lead nowhere visible; rooms that are mostly empty floor; mismatched tile styles; a title that spoils the ending; obviously broken layering (tiles cut off, half trees).",
    "Do NOT count: pixel-art style itself, small decoration choices, things that need sound or animation to judge, anything you cannot actually see in the image, and a missing player character on a map image — map images are editor renders of the tiles and placed events; the player sprite is drawn only in the running game.",
    "Answer with JSON only: {\"defects\":[{\"image\":<number>,\"where\":\"<spot in that image, e.g. top-left, the shop counter>\",\"what\":\"<the defect in one Korean sentence>\",\"severity\":\"blocker\"|\"polish\"}]}. Empty list if you find nothing concrete. No more than 12 defects; most important first.",
  ].join("\n\n");
}

/** 검수자 답 읽기. 읽지 못하면 결함 0 이 아니라 problem 을 돌려준다(깨끗한 판으로 세지 않는다). */
export function parseVqaReply(text: string, shots: readonly VqaShot[]): { defects: VqaDefect[]; problem?: string } {
  if (!text.trim()) return { defects: [], problem: "검수자 빈 답 — 그림을 보지 못했을 수 있음(검수 안 된 판)" };
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return { defects: [], problem: "검수자 답에 JSON 이 없음" };
  let parsed: unknown;
  try { parsed = JSON.parse(text.slice(start, end + 1)); } catch { return { defects: [], problem: "검수자 답 JSON 을 읽지 못함" }; }
  const list = (parsed as { defects?: unknown }).defects;
  if (!Array.isArray(list)) return { defects: [], problem: "검수자 답에 defects 목록이 없음" };
  const defects = list.flatMap((raw): VqaDefect[] => {
    const item = raw as { image?: unknown; where?: unknown; what?: unknown; severity?: unknown };
    const what = typeof item.what === "string" ? item.what.trim() : "";
    if (!what) return [];
    const shot = typeof item.image === "number" ? shots[item.image - 1] : undefined;
    const spot = typeof item.where === "string" && item.where.trim() ? item.where.trim() : "";
    return [{ where: [shot?.where, spot].filter(Boolean).join(" · ") || spot || "(자리 없음)", what, severity: item.severity === "polish" ? "polish" : "blocker",
      ...(shot ? { target: { kind: shot.kind, ...(shot.ref ? { ref: shot.ref } : {}) } } : {}) }];
  }).slice(0, 12);
  return { defects };
}

/** 한 판 검수. 호출 실패는 던지지 않고 problem 으로 남긴다(그 판은 «깨끗함»이 아니다). */
export async function reviewVqaRound(input: {
  readonly task: string;
  readonly shots: readonly VqaShot[];
  readonly round: number;
  readonly previous: readonly VqaDefect[];
  readonly chat: (messages: readonly unknown[], signal?: AbortSignal) => Promise<string>;
  readonly reviewer: string;
  readonly signal?: AbortSignal;
}): Promise<VqaRound> {
  const t0 = Date.now();
  const shots = input.shots.map(({ where, kind, ref }) => ({ where, kind, ...(ref ? { ref } : {}) }));
  if (!input.shots.length) return { round: input.round, shots, defects: [], ms: 0, reviewer: input.reviewer, problem: "찍은 그림이 없음 — 검수하지 못함" };
  try {
    const reply = await input.chat([{ role: "user", content: [
      { type: "text", text: vqaPrompt(input.task, input.shots, input.round, input.previous) },
      ...input.shots.map((shot) => ({ type: "image_url", image_url: { url: shot.image } })),
    ] }], input.signal);
    const { defects, problem } = parseVqaReply(reply, input.shots);
    return { round: input.round, shots, defects, ms: Date.now() - t0, reviewer: input.reviewer, ...(problem ? { problem } : {}) };
  } catch (error) {
    if (input.signal?.aborted) throw error;
    return { round: input.round, shots, defects: [], ms: Date.now() - t0, reviewer: input.reviewer, problem: `검수자 호출 실패: ${(error instanceof Error ? error.message : String(error)).slice(0, 160)}` };
  }
}

// ── 고칠 수 있는 결함인가 ───────────────────────────────────────────────────────────
// 2026-10-28 mt2 terra 방탈출 1턴 575초 중 대부분이 고치기 반복이었다(결함 9→6→5→4→4). 남은 넷은 조명 막·타이틀 그림 잘림·
// 타이틀/맵 화풍 차이처럼 조수 동사로 못 고치는 것인데, 모델이 조명값만 바꾸며 돌았다. 결함마다 «동사로 고칠 수 있는가»를
// 낱말로 결정적으로 나눈다. 못 고치는 것은 장부(ai-activity 「런타임/빌더 결함(모델 밖)」)로만 남기고 고치기 차례에 넘기지 않는다.
// 남은 결함 수(보고·출하 차단)는 그대로 센다 — 장부로 뺐다고 결함이 사라지지 않는다.
export type VqaDefectKind =
  | "runtime-screen" | "runtime-hud" | "runtime-text" | "lighting" | "art-style" | "missing-art" | "title-art" | "sprite-scale" | "player-not-drawn" | "shot-limit" | "builder-exit" | "builder-tiles"
  | "fixable";
export interface VqaDefectClass { readonly fixable: boolean; readonly kind: VqaDefectKind; readonly why: string }
type Target = VqaShot["kind"] | undefined;
/** 순서대로 처음 맞는 것. only = 그 대상(맵·타이틀·오프닝) 결함에만. */
const OUTSIDE: readonly (readonly [VqaDefectKind, RegExp, string, (readonly Target[])?])[] = [
  ["player-not-drawn", /플레이어 ?캐릭터가 (어디에도 )?(보이지|없)|주인공이 (어디에도 )?(보이지|없)|player (character|sprite) (is )?(missing|not visible)/iu, "검수 그림은 편집기 렌더라 주인공을 그리지 않는다"],
  ["shot-limit", /제목 글자|시작 버튼|메뉴 (글|항목|버튼)|타이틀 (글자|문구)가 (없|안 보)/u, "검수 그림은 타이틀 배경 그림만 찍는다(제목·메뉴는 런타임이 겹쳐 그린다)", ["title"]],
  ["runtime-text", /(자막|오프닝 문구|문구|글씨)[^.。]{0,20}(작|읽기 어렵|안 읽)/u, "애니메틱 자막 크기·자리는 런타임 렌더가 정한다", ["opening"]],
  ["art-style", /화풍|그림체|시점|아이소메트릭|isometric|회화풍|같은 게임으로 보이지/iu, "타이틀·오프닝 그림과 칩셋의 화풍 차이는 칩셋이 정한다"],
  ["sprite-scale", /픽셀이 (굵|크)|해상도가 어긋|크기가 (안 맞|어긋)/u, "칩 그림 배율은 빌더·런타임이 정한다"],
  ["runtime-screen", /배율|확대[^.。]{0,6}(되어|돼)|레터박스|검은 ?(띠|테두리|여백)|화면 (밖|아래|위|가장자리)[^.。]{0,10}(잘|끊|돌출)|가장자리에서 끊|여백|카메라|letterbox|margin/u, "화면 배율·여백·잘림은 런타임 화면 맞춤이 정한다"],
  ["runtime-hud", /HUD|목표 ?(표시|창|칩)|상태창|미니맵|메뉴 ?창|체력 ?바|UI ?가/u, "HUD·UI 는 런타임이 그린다"],
  ["lighting", /조명|어둠 ?\d|밝기|조도|광원|불빛|명암|색조|색감|분위기|긴장감|아늑|ambient|tint/iu, "맵 조명 막·분위기 색은 조명 값으로 해결되지 않는다(조명값만 바꾸며 돌았다)", ["map"]],
  ["builder-exit", /(출구|출입구|출입문|통로|복도)[^.。]{0,40}(어두운|빈|끊|잘|돌출|공백|어디로)|문틀|문 표시가 없/u, "실내 출구 통로·문 모양은 방 빌더·런타임 여백이 정한다", ["map"]],
  ["builder-tiles", /타일 ?(스타일|질감)|질감과 색이 서로 달|아무 타일도|남색 (빈|공백)|단색 [^.。]{0,6}공백|격자 ?선|그리드/u, "타일 짜임·빈 공백은 빌더 템플릿 문제다", ["map"]],
  ["missing-art", /맞는 그림이 없|그림이 없어|칩셋에 없|플레이스홀더|placeholder/iu, "칩셋에 맞는 그림이 없다", ["map"]],
];
/** 타이틀·오프닝 그림 «품질»(잘림·격자·구도)은 모델이 고칠 수 없다. 장르·장소에 안 맞는 그림·기본 템플릿 오프닝은 고칠 수 있다(다른 그림·map-view 타이틀·오프닝 끄기). */
const TITLE_QUALITY = /잘(려|린|림|렸)|구도|격자|그리드|여백|공백|마름모|끊겨|흐릿|번져/u;
export function vqaClassify(d: VqaDefect): VqaDefectClass {
  const spot = d.where.includes(" · ") ? d.where.slice(d.where.lastIndexOf(" · ") + 3) : "";
  const text = `${spot} ${d.what}`;
  const target = d.target?.kind;
  if ((target === "title" || target === "opening") && TITLE_QUALITY.test(d.what) && !/글자|제목|문구|자막/u.test(d.what))
    return { fixable: false, kind: "title-art", why: "타이틀·오프닝 그림 자체의 품질(잘림·구도·격자)은 자원 문제다" };
  for (const [kind, re, why, only] of OUTSIDE) if ((!only || only.includes(target)) && re.test(text)) return { fixable: false, kind, why };
  return { fixable: true, kind: "fixable", why: "가구·빈 방·이벤트·대사·그림 선택은 동사로 고친다" };
}

/**
 * 이번 판 결함을 나눈다: fix = 고치기 차례에 넘길 것, ledger = 모델 밖(장부), stuck = 고칠 수 있는 종류지만 앞 판에도 그대로 있던 것
 * (두 판 연속 그대로 — 고치기가 화면에서 효과가 없었다. 다음으로 넘어간다).
 */
export function vqaActionable(round: VqaRound | undefined, previous?: VqaRound): { fix: VqaDefect[]; ledger: VqaDefect[]; stuck: VqaDefect[] } {
  const fix: VqaDefect[] = [], ledger: VqaDefect[] = [], stuck: VqaDefect[] = [];
  for (const d of round?.defects ?? []) {
    if (!vqaClassify(d).fixable) ledger.push(d);
    else if (vqaRepeated(d, previous)) stuck.push(d);
    else fix.push(d);
  }
  return { fix, ledger, stuck };
}

/** 장부 줄(ai-activity 실행 상태로 남는다) — 우리가 모아 런타임·빌더에서 고칠 결함. */
export function vqaLedgerLine(d: VqaDefect): string {
  const c = vqaClassify(d);
  return `런타임/빌더 결함(모델 밖) [${c.kind}] ${d.where} — ${d.what} (${c.why})`;
}

/** 깨끗한 판 = 검수가 실제로 돌았고 결함 0. 검수하지 못한 판은 깨끗하지 않다. */
export const vqaClean = (round: VqaRound): boolean => !round.problem && round.defects.length === 0;

/** 다음 판으로 갈지. 깨끗하면 멈춤, 3판이면 멈춤, 검수 불가가 두 판 이어지면 멈춤(그림 경로가 없는 실행). */
export function vqaShouldContinue(rounds: readonly VqaRound[]): boolean {
  const last = rounds.at(-1);
  if (!last || vqaClean(last)) return false;
  // 결함이 있는데 고칠 수 있는 것이 0(모두 모델 밖이거나 두 판 연속 그대로)이면 더 돌지 않는다. 검수 못 한 판(결함 0·problem)은 아래 규칙대로.
  const act = vqaActionable(last, rounds.at(-2));
  if (last.defects.length && !act.fix.length) return false;
  // 판을 더 주는 막음(blocker) 연장은 고칠 수 있는 막음이 남았을 때만.
  if (rounds.length >= (act.fix.some((d) => d.severity === "blocker") ? VQA_ROUND_CAP : VQA_MAX_ROUNDS)) return false;
  if (last.problem && rounds.at(-2)?.problem) return false;
  return true;
}

/** 결함 한 줄 — 고칠 대상(mapId·그림)을 같이 적는다. */
export function vqaDefectLine(d: VqaDefect, index: number): string {
  const target = d.target?.kind === "map" && d.target.ref ? ` (mapId: ${d.target.ref})`
    : d.target?.kind === "title" ? " (타이틀 화면 — set_title_screen)"
    : d.target?.kind === "opening" ? " (오프닝 — 오프닝 장면 다시 그리기)" : "";
  const sparse = d.target?.kind === "map" && d.target.ref && SPARSE_ROOM.test(`${d.where} ${d.what}`)
    ? ` → dress_room({ mapId: "${d.target.ref}", at: 그 방 바닥 한 칸, purpose: "<그 방의 쓰임>" }) 으로 채운다(물건을 하나씩 찍지 않는다)` : "";
  return `${index + 1}. [${d.severity === "blocker" ? "막음" : "다듬기"}] ${d.where}${target} — ${d.what}${sparse}`;
}

/** 「방이 비었다·빈 바닥이 많다」 결함 — 고치기 동사는 dress_room 이다(2026-10-26: 고치기 차례가 stamp_object 로 하나씩 찍다 겹침 거부에 막혀 결함이 1건에서 멈췄다). */
const SPARSE_ROOM = /빈 바닥|맨바닥|빈 방|텅 빈|empty room|bare floor|(방|실|복도|바닥|공간|교실|room|office|classroom|floor|corridor|hall)[^.。\n]{0,24}(비어|비었|텅|휑|허전|썰렁|empty|bare|sparse|barren)|(비어|비었|텅|휑|허전|썰렁|empty|bare|sparse|barren)[^.。\n]{0,24}(방|실|복도|바닥|공간|room|floor|corridor|hall)/i;

/**
 * 고치기 차례가 도구를 하나도 부르지 않고 글만 쓰고 끝났을 때(2026-10-25 실측: 결함 9→9→9, 판마다 도구 0회) — 그 차례는 판으로 세지 않고,
 * 결함 목록을 다시 주며 한 번 더 고치게 한다. 이 지시와 함께 첫 모델 호출에 tool_choice required 가 걸린다.
 */
export function vqaFixRetry(round: VqaRound, brief?: string): string {
  return [
    ...(brief ? [brief, ""] : []),
    `[화면 검수 ${round.round}/${VQA_MAX_ROUNDS} — 고치기 다시] 앞 차례에서 도구를 하나도 부르지 않고 보고만 고쳤다. 보고를 고치는 것은 고치기가 아니다. 지금 도구로 아래 결함을 하나씩 고친다 — 결함마다 대상 맵·그림을 바꾸는 도구를 부른다.`,
    ...vqaActionable(round).fix.map(vqaDefectLine),
    "정말 고칠 수 없는 결함은 고치지 말고 최종 보고에 «미해결»로 남긴다. 고치지 않은 결함을 «고쳤다»고 쓰지 않는다.",
  ].join("\n");
}

/**
 * 고치기 차례의 자기완결 머리글(J78): 고치기 차례는 앞 대화를 비우고 시작한다(로컬 Claude CLI 가 긴 실행 끝에 「Autocompact is thrashing」으로
 * 죽었다). 그래서 요청 원문과 결함 대상 맵의 요약(이름·id·크기·이벤트)만 싣는다. 더 필요하면 조수가 도구로 다시 본다.
 */
export function vqaFixBrief(task: string, project: Project, defects: readonly VqaDefect[], lastReport?: string): string {
  const mapIds = [...new Set(defects.flatMap((d) => (d.target?.kind === "map" && d.target.ref ? [d.target.ref] : [])))];
  const maps = mapIds.flatMap((id) => {
    const map = project.maps[id];
    if (!map) return [];
    const events = (map.events ?? []).slice(0, 14).map((ev) => `${ev.name || ev.id}@${ev.x},${ev.y}`).join(", ");
    return [`- 맵 «${map.name}» (mapId: ${id}, ${map.width}×${map.height}, 타일셋 ${map.tilesetId ?? "?"})${id === project.startMapId ? " · 시작 맵" : ""} — 이벤트 ${(map.events ?? []).length}개${events ? `: ${events}${(map.events ?? []).length > 14 ? " …" : ""}` : ""}`];
  });
  const others = Object.values(project.maps).filter((m) => !mapIds.includes(m.id)).map((m) => `«${m.name}»(${m.id})`).slice(0, 12);
  return [
    "[고치기 차례 — 앞 대화는 비웠다. 게임은 이미 지어져 있다. 아래 요청·결함·맵 요약만 보고, 필요한 것은 도구(show_map_region·get_event·inspect)로 다시 본다.]",
    `사용자 요청(원문): «${task.slice(0, 1200)}»`,
    `게임 제목: «${project.meta?.title ?? ""}»`,
    ...(maps.length ? ["결함이 난 맵:", ...maps] : []),
    ...(others.length ? [`다른 맵: ${others.join(", ")}`] : []),
    // 최종 보고는 앞 보고를 대신한다 — 비운 대화에서도 무엇을 지었는지 다시 쓸 수 있게 앞 보고를 싣는다(잘라서).
    ...(lastReport?.trim() ? [`앞 보고(이것을 고쳐 최종 보고로 쓴다):\n${lastReport.trim().slice(0, 2000)}${lastReport.trim().length > 2000 ? " …" : ""}`] : []),
  ].join("\n");
}

/** 앞 판에도 있던 결함인가 — 같은 대상(맵·그림)이고 위치·내용 낱말이 겹친다. */
export function vqaRepeated(defect: VqaDefect, previous: VqaRound | undefined): boolean {
  if (!previous) return false;
  const words = (text: string) => new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2));
  const mine = words(`${defect.where} ${defect.what}`);
  return previous.defects.some((old) => (old.target?.kind ?? "") === (defect.target?.kind ?? "") && (old.target?.ref ?? "") === (defect.target?.ref ?? "")
    && [...words(`${old.where} ${old.what}`)].filter((w) => mine.has(w)).length >= 3);
}

/** 조수에게 줄 고치기 지시(판 사이). previous = 바로 앞 판 — 같은 결함이 다시 나오면 앞 고치기가 화면에서 효과가 없었다는 뜻이다. */
export function vqaFollowUp(round: VqaRound, brief?: string, previous?: VqaRound): string {
  if (round.problem && !round.defects.length) {
    return `[화면 검수 ${round.round}/${VQA_MAX_ROUNDS}] 검수를 하지 못했다(${round.problem}). 다시 찍어 검수하도록 할 것이 없으면 최종 보고에 «화면 검수 미완료»라고 쓴다.`;
  }
  return [
    ...(brief ? [brief, ""] : []),
    `[화면 검수 ${round.round}/${VQA_MAX_ROUNDS}] 다른 모델의 검수자(${round.reviewer})가 실제 그림에서 아래 결함을 찾았다. 각각 고친다 — 맵은 show_map_region 으로 다시 보고, 타이틀·오프닝은 다시 그려 확인한다. 고칠 수 없으면 고치지 말고 최종 보고에 남은 결함으로 쓴다.`,
    ...vqaActionable(round, previous).fix.map((d, i) => vqaDefectLine(d, i)),
    // 모델 밖(런타임·빌더) 결함과 두 판 연속 그대로인 결함은 고치기 차례에 넘기지 않는다 — 남은 결함으로는 센다.
    ...(() => { const a = vqaActionable(round, previous); const n = a.ledger.length + a.stuck.length; return n ? [`(이 밖에 결함 ${n}건 — 모델 밖 ${a.ledger.length}건은 런타임/빌더 장부로, 두 판 연속 그대로인 ${a.stuck.length}건은 미해결로 남긴다. 이것들은 고치지 말고, 최종 보고의 남은 결함에 그대로 센다.)`] : []; })(),
    "보고만 다시 쓰는 것은 고치기가 아니다 — 이 차례에는 도구로 그림을 바꾼다(도구를 하나도 부르지 않으면 이 판은 세지 않고 한 번 더 시킨 뒤, 그래도 안 하면 «미해결»로 끝난다). 고치지 않은 결함을 «고쳤다»고 쓰지 않는다.",
    "다 고친 뒤 「최종 보고(앞 보고를 고침):」로 시작하는 보고 하나로 앞 보고를 대신한다. 검수자가 다음 판에서 같은 그림을 다시 본다.",
  ].join("\n");
}

/** 끝난 고리의 요약 — 마지막 판이 깨끗하지 않으면 남은 결함을 그대로 적는다(정직한 남은 목록). */
export function vqaSummary(rounds: readonly VqaRound[]): { readonly clean: boolean; readonly text: string; readonly leftover: readonly VqaDefect[] } {
  const last = rounds.at(-1);
  if (!last) return { clean: false, text: "화면 검수: 돌지 않음", leftover: [] };
  const weak = rounds.some((r) => r.reviewer.includes("같은 계열 검수")) ? " · 「같은 계열 검수」(약한 증거)" : "";
  const counts = rounds.map((r) => (r.problem && !r.defects.length ? "검수 못 함" : `${r.defects.length}건`)).join(" → ") + weak;
  if (vqaClean(last)) return { clean: true, text: `화면 검수 ${rounds.length}판: ${counts} — 마지막 판 결함 없음`, leftover: [] };
  const outside = last.defects.filter((d) => !vqaClassify(d).fixable).length;
  return { clean: false, text: `화면 검수 ${rounds.length}판: ${counts} — 남은 결함 ${last.defects.length}건${outside ? `(그중 모델 밖 ${outside}건)` : ""}${last.problem ? ` (${last.problem})` : ""}`, leftover: last.defects };
}

/** 결함이 남은 채 고리가 끝났을 때 조수에게 줄 마지막 지시 — 더 고치지 말고 남은 목록을 보고에 그대로 쓴다. */
export function vqaLeftoverInstruction(rounds: readonly VqaRound[], why?: string): string {
  const summary = vqaSummary(rounds);
  const problem = rounds.at(-1)?.problem;
  const blockers = vqaBlockers(rounds.at(-1));
  return [
    ...(blockers.length ? [`[출하 차단 vqa-blocker] 플레이에 지장 주는 화면 결함 ${blockers.length}건이 ${rounds.length}판 뒤에도 남았다 — 이 게임은 «완성»이 아니다. 보고 첫 줄에 「아직 완성 아님: 화면 결함 ${blockers.length}건」이라고 쓴다.`] : []),
    `[화면 검수 끝 — ${summary.text}${why ? ` · ${why}` : ""}] 더 고치지 말고, 앞 보고를 대신하는 최종 보고를 「최종 보고(앞 보고를 고침):」로 시작해 쓴다. 끝에 아래 남은 것을 그대로 적는다(«다 됐다»고 쓰지 않는다):`,
    ...(summary.leftover.length ? summary.leftover.map((d) => `- ${d.where}: ${d.what}${vqaClassify(d).fixable ? "" : " (런타임/빌더 결함 — 모델 밖)"}`) : [`- 화면 검수 미완료${problem ? `(${problem})` : ""}`]),
  ].join("\n");
}

/** 게임 전체를 만드는 요청인가 — 출하 검사(shipChecks.wantsWholeGame)와 같은 범위. */
export { wantsWholeGame } from "./shipChecks";

/**
 * 검수자 모델 고르기 — 그림을 받는 모델 중 주 모델과 다른 계열을 먼저(역할표 src/ai/assistantRoles.ts 의 규칙과 같다).
 * 순서: 사용자가 정한 «눈» 칸(그 계정 키가 있을 때) → 검토자 칸(그림을 받는 계열일 때) → 키가 있는 다른 계열 계정의 기본 눈 모델
 * → 로컬 Claude CLI Sonnet(주 모델이 Claude 가 아닐 때) → 주 모델(같은 눈, 표시). Argon 은 어느 자리든 그림을 보는 high 별칭으로 부른다(vqaVisionModel).
 * keyed = 이 실행에 키가 실린 계정(호스트가 역할·그림 칸 계정의 키를 싣는다) + 로컬 CLI.
 */
export interface VqaReviewerPick { readonly provider: string; readonly model: string; readonly sameAsMain: boolean; readonly effort?: "high" }

/**
 * 그림을 실제로 보는 별칭으로 바꾼다. 2026-10-25 실측(8318, 16×16 PNG): gemini-4-argon·gemini-3.8-flash 는 빈 답, -medium 은 400,
 * gemini-4-argon-high 만 그림을 봤다. 그래서 Argon 검수자는 늘 high 로 부른다 — google-antigravity 는 강도 라우팅(effort high →
 * gemini-4-argon-high), 이름에 강도가 박힌 사용자 지정 엔드포인트(openai-compat:*)는 모델 ID 자체를 -high 로.
 */
export function vqaVisionModel(pick: { readonly provider: string; readonly model: string }): { provider: string; model: string; effort?: "high" } {
  const argon = /^gemini-4-argon(?:-(?:low|medium|high))?$/u.exec(pick.model);
  if (!argon) return { provider: pick.provider, model: pick.model };
  if (pick.provider.startsWith("openai-compat:")) return { provider: pick.provider, model: "gemini-4-argon-high" };
  return { provider: pick.provider, model: "gemini-4-argon", effort: "high" };
}
/** 검수자 표시 이름 — 실제로 부른 별칭을 보인다(판정자가 «눈 먼 판»을 가려낼 수 있게). 같은 계열은 «같은 계열 검수»(약한 증거)로 표시한다. */
export const vqaReviewerLabel = (pick: VqaReviewerPick): string =>
  `${pick.provider}/${pick.effort === "high" && pick.model === "gemini-4-argon" ? "gemini-4-argon-high" : pick.model}${pick.sameAsMain ? " 「같은 계열 검수」(다른 계열 검수자가 답하지 못함 — 약한 증거)" : ""}`;

export interface VqaReviewerInput {
  readonly main: { readonly provider: string; readonly model: string };
  readonly vision?: { readonly provider: string; readonly model: string };
  readonly advisor?: { readonly provider: string; readonly model: string };
  readonly keyed: ReadonlySet<string>;
  readonly familyOf: (providerId: string) => string | undefined;
}

/**
 * 검수자 후보 차례(2026-10-26 결정): 다른 계열을 모두 먼저, 그다음에만 같은 계열(«같은 계열 검수» 표시, 약한 증거).
 * 다른 계열: «눈» 칸 → 검토자 칸 → 키 있는 기본 계정 → 로컬 CLI(Claude Sonnet·Codex GPT·Gemini).
 * 같은 계열: 명시한 «눈» 칸(예: argon-high) → 검토자 칸 → 주 모델. 실행기는 앞 후보가 답하지 못하면(호출 실패·빈 답·JSON 없음) 다음 후보로 같은 그림을 다시 보낸다.
 */
export function vqaReviewerCandidates(input: VqaReviewerInput): VqaReviewerPick[] {
  const mainFamily = input.familyOf(input.main.provider);
  const differs = (provider: string) => { const f = input.familyOf(provider); return Boolean(f && f !== mainFamily); };
  const seesImages = (provider: string) => !/deepseek/iu.test(provider) && input.familyOf(provider) !== "deepseek";
  const usable = (provider: string) => input.keyed.has(provider) || provider.startsWith("local-cli:");
  const out: VqaReviewerPick[] = [];
  const add = (slot: { provider: string; model: string } | undefined, sameAsMain: boolean) => {
    if (!slot) return;
    const pick = { ...vqaVisionModel(slot), sameAsMain };
    if (!out.some((p) => p.provider === pick.provider && p.model === pick.model && p.effort === pick.effort)) out.push(pick);
  };
  if (input.vision && usable(input.vision.provider) && differs(input.vision.provider)) add(input.vision, false);
  if (input.advisor && usable(input.advisor.provider) && seesImages(input.advisor.provider) && differs(input.advisor.provider)) add(input.advisor, false);
  for (const d of [{ provider: "google-antigravity", model: "gemini-4-argon" }, { provider: "openai-codex", model: "gpt-6.1-sol" }]) {
    if (input.keyed.has(d.provider) && differs(d.provider)) add(d, false);
  }
  // 키 있는 다른 계열 계정이 없거나 답하지 못하면 로컬 CLI. 설치돼 있지 않으면 호출이 실패해 다음 후보로 넘어간다.
  for (const d of [{ provider: "local-cli:claude", model: "claude-sonnet-5-5" }, { provider: "local-cli:codex", model: "gpt-6.1-sol" }, { provider: "local-cli:gemini", model: "gemini-4-argon" }]) {
    if (differs(d.provider)) add(d, false);
  }
  if (input.vision && usable(input.vision.provider) && !differs(input.vision.provider)) add(input.vision, true);
  if (input.advisor && usable(input.advisor.provider) && seesImages(input.advisor.provider) && !differs(input.advisor.provider)) add(input.advisor, true);
  add(input.main, true);
  return out;
}

export function pickVqaReviewer(input: VqaReviewerInput): VqaReviewerPick {
  return vqaReviewerCandidates(input)[0]!;
}
