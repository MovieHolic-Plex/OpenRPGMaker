// 조수 v2 적대적 화면 검수(VQA) 고리 — 다 지은 게임(게임 전체 요청)을 실제 그림으로 찍어, 다른 모델의 검수자가 «구체적인 결함»을 찾고,
// 조수가 고친 뒤 다음 판을 돈다. 사용자 규칙(2026-10-25): 판 하나가 깨끗하거나, 3판을 돌고 남은 결함을 정직하게 적을 때만 «다 됐다».
//
// 한 판 = 찍기(맵마다 1배 전체 · 타이틀 그림 · 오프닝 그림/애니메틱 틀) → 검수자(역할표의 «눈» 또는 «검토자», 주 모델과 다른 계열을 먼저)
// → 결함 목록(어디·무엇·왜) → 조수가 고침 → 다음 판. 결함 판정은 모델이 하되, 판 수·끝내기·보고 문구는 코드가 정한다.
// 이 파일은 순수하다(찍기·호출은 넘겨받는다). 실행기 연결은 scripts/lib/assistantV2Runtime.ts.
import { roomSpecOf } from "@/editor/handInterior/builder";
import { BLUEPRINT_OPENING_SHOT_PREFIX } from "@/editor/tools/blueprintOpening";
import type { Project } from "@/project/types";

export const VQA_MAX_ROUNDS = 3;
/**
 * 플레이에 지장 주는 결함(blocker)이 남으면 출하 차단으로 보고 판을 더 준다(2026-10-28 사용자: «VQA 가 핵심»).
 * 스위트 기준선에서 3판을 다 돌고도 결함이 남은 채 «보고만» 하고 끝난 게임이 절반이었다. polish 만 남으면 3판에서 멈춘다.
 */
const VQA_BLOCKER_EXTRA_ROUNDS = 2;
export const VQA_ROUND_CAP = VQA_MAX_ROUNDS + VQA_BLOCKER_EXTRA_ROUNDS;
export const vqaBlockers = (round: VqaRound | undefined): readonly VqaDefect[] => (round?.defects ?? []).filter((d) => d.severity === "blocker");
/** 한 판에 검수자에게 보내는 그림 수 상한. 맵이 많으면 시작 맵·이번에 바뀐 맵을 먼저. */
const VQA_MAX_IMAGES = 10;

export interface VqaShot {
  /** 사람이 읽는 자리 이름: 「타이틀」·「오프닝 1/3」·「맵 «검은 장미 저택 2층»」. */
  readonly where: string;
  readonly kind: "title" | "opening" | "map";
  /** 대상 열쇠 — 맵 id · 그림 자원 id · 오프닝 애니메틱 장면 id · 오프닝 무대(`stage:<mapId>:<eventId>`). 같은 결함인지는 이 열쇠로 먼저 가른다. */
  readonly ref?: string;
  readonly image: string;
}

export interface VqaDefect {
  readonly where: string;
  readonly what: string;
  /** 「blocker」 = 플레이에 지장·약속과 다름·임시 그림. 「polish」 = 눈에 띄지만 쓸 수는 있음. 둘 다 결함이다. */
  readonly severity: "blocker" | "polish";
  /** 결함이 난 그림의 대상(VqaShot.ref) — 고치기 지시가 «어디를 고칠지»를 짚고, 판 사이에 같은 결함을 알아보는 열쇠다. */
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

interface VqaShotPlanItem {
  readonly kind: VqaShot["kind"];
  readonly where: string;
  readonly ref?: string;
  readonly shotId?: string;
  readonly atMs?: number[];
  /** 맵의 한 구역만 찍는다(오프닝 무대 둘레). */
  readonly region?: { readonly mapId: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

/** 오프닝 무대 그림의 크기(칸) — 게임 화면 한 장쯤. */
const STAGE_VIEW = { w: 24, h: 14 } as const;
const stageRef = (mapId: string, eventId: string): string => `stage:${mapId}:${eventId}`;

/**
 * 찍을 자리. 이미지는 호출자가 그린다(편집기 렌더 브로커). 차례: 타이틀 → 오프닝 무대 → 모델이 지은 오프닝 장면 → 시작 맵 → 이번 실행에서 바뀐 맵
 * → 나머지 맵 → 끝맺음 단계가 자동으로 지은 맵 조각 오프닝(빌더 몫이라 그림 수 상한에서 맨 뒤로 민다).
 */
export function vqaShotPlan(project: Project, changedMapIds: ReadonlySet<string>): VqaShotPlanItem[] {
  const plan: VqaShotPlanItem[] = [];
  const autoOpening: VqaShotPlanItem[] = [];
  const title = project.system.titleScreen?.backgroundResourceId;
  if (title) plan.push({ kind: "title", where: "타이틀 화면 배경", ref: title });
  const opening = project.system.opening;
  if (opening?.enabled) {
    // 무대 오프닝(author_opening_stage)은 실제 맵 위의 컷신이다 — 그 칸 둘레를 찍어야 모델이 오프닝을 고친 것이 검수자 눈에 보인다.
    const stageMap = opening.stage ? project.maps[opening.stage.mapId] : undefined;
    if (opening.stage && stageMap) {
      const w = Math.min(stageMap.width, STAGE_VIEW.w), h = Math.min(stageMap.height, STAGE_VIEW.h);
      const x = Math.max(0, Math.min(stageMap.width - w, opening.stage.x - Math.floor(w / 2))), y = Math.max(0, Math.min(stageMap.height - h, opening.stage.y - Math.floor(h / 2)));
      plan.push({ kind: "opening", where: `오프닝 무대 — 맵 «${stageMap.name}» 칸 ${opening.stage.x},${opening.stage.y} 둘레 ${w}×${h}칸(새 게임이 이 칸에서 열리고 컷신이 이 맵 위에서 연출된다 · 움직임·대사는 그림에 없음)`,
        ref: stageRef(opening.stage.mapId, opening.stage.eventId), region: { mapId: opening.stage.mapId, x, y, w, h } });
    }
    const scenes = opening.scenes;
    scenes.forEach((scene, index) => {
      const where = `오프닝 ${index + 1}/${scenes.length}`;
      if (scene.kind === "image" && scene.resourceId) plan.push({ kind: "opening", where, ref: scene.resourceId });
      else if (scene.kind === "animatic") {
        const duration = Math.max(1, Math.floor(scene.durationMs));
        (isAutoOpeningRef(scene.id) ? autoOpening : plan).push({ kind: "opening", where: `${where} (애니메틱 시작·중간·끝)`, ref: scene.id, shotId: scene.id, atMs: [0, Math.floor(duration / 2), Math.max(0, duration - 1)] });
      }
    });
  }
  const mapIds = Object.keys(project.maps);
  const ordered = [project.startMapId, ...mapIds.filter((id) => changedMapIds.has(id) && id !== project.startMapId), ...mapIds.filter((id) => !changedMapIds.has(id) && id !== project.startMapId)]
    .filter((id, i, all): id is string => Boolean(id && project.maps[id]) && all.indexOf(id) === i);
  // 맵 그림은 줄여서 간다 — 칸 수를 적어 두지 않으면 검수자가 그림에서 크기를 어림해 «시작 칸이 맵 밖»이라고 한다. 주인공은 편집기 렌더에 없다.
  const startNote = project.startPos ? ` · 시작 맵 · 주인공은 게임에서만 그려짐, 시작 칸 ${project.startPos.x},${project.startPos.y}` : " · 시작 맵";
  for (const id of ordered) { const map = project.maps[id]!; plan.push({ kind: "map", where: `맵 «${map.name}» (${map.width}×${map.height}칸${id === project.startMapId ? startNote : ""})`, ref: id }); }
  return [...plan, ...autoOpening].slice(0, VQA_MAX_IMAGES);
}

/** 끝맺음 단계(applyBlueprintOpening)가 맵을 잘라 지은 기본 오프닝 장면인가 — 장면 id 로 가른다(검수자 글이 아니라 사실로). */
const isAutoOpeningRef = (ref: string | undefined): boolean => !!ref && ref.startsWith(BLUEPRINT_OPENING_SHOT_PREFIX);

/** 검수자에게 보내는 지시. 게임을 만든 이유·조수 보고는 보여 주지 않는다(눈가림) — 요청 원문과 그림만. */
function vqaPrompt(task: string, shots: readonly VqaShot[], round: number, previous: readonly VqaDefect[]): string {
  return [
    "You are an adversarial visual QA reviewer for a 2D RPG built by an AI assistant. You did NOT build it. Find concrete defects a player would notice.",
    `The user's request (Korean, verbatim): «${task.slice(0, 1500)}»`,
    `Round ${round} of ${VQA_MAX_ROUNDS}. Images, in order: ${shots.map((s, i) => `[${i + 1}] ${s.where}`).join(" · ")}.`,
    ...(previous.length ? [`Last round you reported these; check whether each is still visible and report it again only if it is:\n${previous.map((d) => `- ${d.where}: ${d.what}`).join("\n")}`] : []),
    "Count as defects (with the exact image and spot): placeholder or editor-default art (generic fields, the default kingdom/sword opening, empty grey blocks); art that contradicts the request (wrong era, setting, characters, genre); unreadable or clipped text; characters standing inside walls, furniture or roofs; doors or exits that lead nowhere visible; rooms that are mostly empty floor; mismatched tile styles; a title that spoils the ending; obviously broken layering (tiles cut off, half trees).",
    "Each map image shows the whole map scaled to fit; its label gives the real size in cells (e.g. 44×36칸) and cell coordinates in labels are cells of that grid. Never estimate the map size or a cell position from pixels. An «오프닝 무대» image is the map area where the opening cutscene plays in the running game (characters walk and talk there); judge what is placed there, not the missing motion.",
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
type VqaDefectKind =
  | "runtime-screen" | "runtime-hud" | "runtime-text" | "lighting" | "art-style" | "missing-art" | "title-art" | "sprite-scale" | "player-not-drawn" | "shot-limit" | "builder-exit" | "builder-tiles" | "builder-opening"
  | "fixable";
interface VqaDefectClass { readonly fixable: boolean; readonly kind: VqaDefectKind; readonly why: string }
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
const EMPTY_MAP = /빈 맵|기본 (초록 )?잔디|잔디 (타일 )?(하나|한 장|한 가지|만)|(오브젝트|물체|사물|가구)[^.。]{0,8}(하나도 |아무것도 )?없|에디터 기본|플레이 공간이 (만들어지지|없)/u;
/** 타이틀·오프닝 그림 «품질»(잘림·격자·구도)은 모델이 고칠 수 없다. 장르·장소에 안 맞는 그림·모델이 지은 오프닝 장면은 고칠 수 있다(다른 그림·무대 오프닝 — 오프닝을 끄는 것은 고치기가 아니다). */
const TITLE_QUALITY = /잘(려|린|림|렸)|구도|격자|그리드|여백|공백|마름모|끊겨|흐릿|번져/u;
/** 결함 글 + 그림 속 자리(위치 글의 맨 뒤 조각) — 위치 글 앞쪽(맵 이름·주석)의 낱말이 분류에 걸리지 않게. */
const spotText = (d: VqaDefect): string => `${d.where.includes(" · ") ? d.where.slice(d.where.lastIndexOf(" · ") + 3) : ""} ${d.what}`;
const isEmptyMap = (d: VqaDefect): boolean => d.target?.kind === "map" && (EMPTY_MAP.test(spotText(d)) || /«빈 맵»/u.test(d.where));
export function vqaClassify(d: VqaDefect): VqaDefectClass {
  // 자동으로 지은 맵 조각 오프닝의 결함은 검수자가 뭐라고 쓰든 빌더 몫이다(같은 것을 한 판은 «모델 밖», 다른 판은 «막음»으로 올렸다).
  if (d.target?.kind === "opening" && isAutoOpeningRef(d.target.ref))
    return { fixable: false, kind: "builder-opening", why: "끝맺음 단계가 맵을 잘라 지은 기본 오프닝이다 — 빌더가 고칠 것(모델에게 넘기지 않는다)" };
  const text = spotText(d);
  const target = d.target?.kind;
  if ((target === "title" || target === "opening") && TITLE_QUALITY.test(d.what) && !/글자|제목|문구|자막/u.test(d.what))
    return { fixable: false, kind: "title-art", why: "타이틀·오프닝 그림 자체의 품질(잘림·구도·격자)은 자원 문제다" };
  // 빈 맵(바닥 한 장·오브젝트 없음·기본 잔디)은 그림이 없어서가 아니라 장소를 안 지었거나 안 쓰는 맵이 남은 것 — 짓거나 지우면 된다
  // (2026-10-28 mt3 flash: «빈 맵» 잔디 한 장이 missing-art 로 빠져 아무도 고치지 않았다).
  if (isEmptyMap(d))
    return { fixable: true, kind: "fixable", why: "빈 맵은 장소를 짓거나(make_place) 쓰지 않는 맵을 지우면(remove_map) 고친다 — 마감 게이트도 빈 시작 맵을 치운다" };
  for (const [kind, re, why, only] of OUTSIDE) if ((!only || only.includes(target)) && re.test(text)) return { fixable: false, kind, why };
  return { fixable: true, kind: "fixable", why: "가구·빈 방·이벤트·대사·그림 선택은 동사로 고친다" };
}

/** 장부 줄(ai-activity 실행 상태로 남는다) — 우리가 모아 런타임·빌더에서 고칠 결함. */
export function vqaLedgerLine(d: VqaDefect): string {
  const c = vqaClassify(d);
  return `런타임/빌더 결함(모델 밖) [${c.kind}] ${d.where} — ${d.what} (${c.why})`;
}

/** 깨끗한 판 = 검수가 실제로 돌았고 결함 0. 검수하지 못한 판은 깨끗하지 않다. */
export const vqaClean = (round: VqaRound): boolean => !round.problem && round.defects.length === 0;

/**
 * 이 결함을 고치는 호출 — 있을 때만 돌려준다. 다듬기 급 결함은 이 호출이 있을 때만 할 일로 한 번 건넨다(없으면 장부에만 남는다).
 * dress_room 은 방 짓기 역할표(roomKit)가 있는 칩셋의 방만 채운다 — 역할표 없는 칩셋 맵에 권하면 거절만 받는다.
 */
export function vqaFixCall(d: VqaDefect, project?: Project): string | undefined {
  const kind = d.target?.kind, ref = d.target?.ref;
  if (kind === "title") return "set_title_screen{backgroundResourceId} with a picture of this story's place (list_resources{kind:\"backdrop\"}), or generate_art{target:\"title\"}";
  if (kind === "opening") return "restage the opening on the real map with author_opening_stage{mapId, x, y, beats} (people walk and talk there); do not turn the opening off";
  if (kind !== "map" || !ref) return undefined;
  // 빈 방 낱말이 먼저다 — «가구 없이 빈 바닥»은 빈 맵 낱말에도 걸리지만 채울 방이지 지울 맵이 아니다.
  if (!SPARSE_ROOM.test(`${d.where} ${d.what}`)) return isEmptyMap(d) ? `build the place with make_place, or remove the unused map with remove_map{mapId:"${ref}"}` : undefined;
  const map = project?.maps[ref];
  const handRoom = !map || !project || !!roomSpecOf(project.tilesets[map.tilesetId]);
  return handRoom
    ? `dress_room({ mapId: "${ref}", at: <one floor cell of that room>, purpose: "<what the room is for>" }) fills it (do not stamp objects one by one)`
    : `this map's chipset has no room kit (dress_room·edit_place are refused here): add 2–4 props of this chipset with place_object (names from list_spatial_designs{kind:"object", mapId:"${ref}"}) or people with add_people; if nothing fits, block this item`;
}

/** 결함 한 줄 — 고칠 대상(mapId·그림)과, 있으면 고치는 호출을 같이 적는다. */
export function vqaDefectLine(d: VqaDefect, index: number, project?: Project): string {
  const target = d.target?.kind === "map" && d.target.ref ? ` (mapId: ${d.target.ref})`
    : d.target?.kind === "title" ? " (title screen)"
    : d.target?.kind === "opening" ? ` (opening${d.target.ref ? `: ${d.target.ref}` : ""})` : "";
  const call = vqaFixCall(d, project);
  return `${index + 1}. [${d.severity === "blocker" ? "막음" : "다듬기"}] ${d.where}${target} — ${d.what}${call ? ` → ${call}` : ""}`;
}

/** 「방이 비었다·빈 바닥이 많다」 결함 — 고치기 동사는 dress_room 이다(2026-10-26: 고치기 차례가 stamp_object 로 하나씩 찍다 겹침 거부에 막혀 결함이 1건에서 멈췄다). */
const SPARSE_ROOM = /빈 바닥|맨바닥|빈 방|텅 빈|empty room|bare floor|(방|실|복도|바닥|공간|교실|room|office|classroom|floor|corridor|hall)[^.。\n]{0,24}(비어|비었|텅|휑|허전|썰렁|empty|bare|sparse|barren)|(비어|비었|텅|휑|허전|썰렁|empty|bare|sparse|barren)[^.。\n]{0,24}(방|실|복도|바닥|공간|room|floor|corridor|hall)/i;

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
    return [`- map «${map.name}» (mapId: ${id}, ${map.width}×${map.height}, tileset ${map.tilesetId ?? "?"})${id === project.startMapId ? " · start map" : ""} — ${(map.events ?? []).length} events${events ? `: ${events}${(map.events ?? []).length > 14 ? " …" : ""}` : ""}`];
  });
  const others = Object.values(project.maps).filter((m) => !mapIds.includes(m.id)).map((m) => `«${m.name}»(${m.id})`).slice(0, 12);
  return [
    "[Fix turn — the earlier conversation was cleared. The game is already built. Work from the request, defects and map summary below; look again with tools (show_map_region, get_event, inspect) as needed.]",
    `User request (verbatim): «${task.slice(0, 1200)}»`,
    `Game title: «${project.meta?.title ?? ""}»`,
    ...(maps.length ? ["Maps with defects:", ...maps] : []),
    ...(others.length ? [`Other maps: ${others.join(", ")}`] : []),
    // 최종 보고는 앞 보고를 대신한다 — 비운 대화에서도 무엇을 지었는지 다시 쓸 수 있게 앞 보고를 싣는다(잘라서).
    ...(lastReport?.trim() ? [`Previous report (revise it into the final report; the report stays in Korean):\n${lastReport.trim().slice(0, 2000)}${lastReport.trim().length > 2000 ? " …" : ""}`] : []),
  ].join("\n");
}

/** 결함 글 두 개가 닮은 정도(0~1) — 글자 두 개짜리 조각의 겹침(Dice). 한국어는 조사가 붙어 낱말 단위로는 같은 말도 어긋난다. */
function whatSimilarity(a: string, b: string): number {
  const grams = (text: string): Set<string> => {
    const t = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    const out = new Set<string>();
    for (let i = 0; i + 1 < t.length; i++) out.add(t.slice(i, i + 2));
    return out;
  };
  const x = grams(a), y = grams(b);
  if (!x.size || !y.size) return a.trim() === b.trim() ? 1 : 0;
  let both = 0;
  for (const g of x) if (y.has(g)) both += 1;
  return (2 * both) / (x.size + y.size);
}
/** 같은 결함으로 보는 닮음 문턱 — 실제 판 기록에서 같은 결함을 다시 쓴 글은 0.57 이상, 같은 맵의 다른 결함은 0.36 이하였다. */
const VQA_SAME_WHAT = 0.5;

/**
 * 같은 결함인가 — 같은 대상(종류+ref)이고 결함 글(what)끼리 닮았다. 위치 글(where)은 보지 않는다:
 * 같은 그림의 결함은 위치 글 접두어(맵 이름·시작 칸 주석)가 모두 같아, 그것만으로 서로 다른 결함이 «그대로»가 됐다.
 */
export function vqaSameDefect(a: VqaDefect, b: VqaDefect): boolean {
  if ((a.target?.kind ?? "") !== (b.target?.kind ?? "") || (a.target?.ref ?? "") !== (b.target?.ref ?? "")) return false;
  return whatSimilarity(a.what, b.what) >= VQA_SAME_WHAT;
}

/** 끝난 고리의 요약 — 마지막 판이 깨끗하지 않으면 남은 결함을 그대로 적는다(정직한 남은 목록). */
export function vqaSummary(rounds: readonly VqaRound[]): { readonly clean: boolean; readonly text: string; readonly leftover: readonly VqaDefect[] } {
  const last = rounds.at(-1);
  if (!last) return { clean: false, text: "화면 검수: 돌지 않음", leftover: [] };
  const weak = rounds.some((r) => r.reviewer.includes("같은 계열 검수")) ? " · 「같은 계열 검수」(약한 증거)" : "";
  const counts = rounds.map((r) => (r.problem && !r.defects.length ? "검수 못 함" : `${r.defects.length}건`)).join(" → ") + weak;
  if (vqaClean(last)) return { clean: true, text: `화면 검수 ${rounds.length}판: ${counts} — 마지막 판 결함 없음`, leftover: [] };
  const outside = last.defects.filter((d) => !vqaClassify(d).fixable).length;
  const blockers = vqaBlockers(last).filter((d) => vqaClassify(d).fixable).length;
  const split = last.defects.length ? `(막음 ${blockers} · 다듬기 ${last.defects.length - blockers - outside}${outside ? ` · 모델 밖 ${outside}` : ""})` : "";
  return { clean: false, text: `화면 검수 ${rounds.length}판: ${counts} — 남은 결함 ${last.defects.length}건${split}${last.problem ? ` (${last.problem})` : ""}`, leftover: last.defects };
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
function vqaVisionModel(pick: { readonly provider: string; readonly model: string }): { provider: string; model: string; effort?: "high" } {
  const argon = /^gemini-4-argon(?:-(?:low|medium|high))?$/u.exec(pick.model);
  if (!argon) return { provider: pick.provider, model: pick.model };
  if (pick.provider.startsWith("openai-compat:")) return { provider: pick.provider, model: "gemini-4-argon-high" };
  return { provider: pick.provider, model: "gemini-4-argon", effort: "high" };
}
/** 검수자 표시 이름 — 실제로 부른 별칭을 보인다(판정자가 «눈 먼 판»을 가려낼 수 있게). 같은 계열은 «같은 계열 검수»(약한 증거)로 표시한다. */
export const vqaReviewerLabel = (pick: VqaReviewerPick): string =>
  `${pick.provider}/${pick.effort === "high" && pick.model === "gemini-4-argon" ? "gemini-4-argon-high" : pick.model}${pick.sameAsMain ? " 「같은 계열 검수」(다른 계열 검수자가 답하지 못함 — 약한 증거)" : ""}`;

interface VqaReviewerInput {
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
